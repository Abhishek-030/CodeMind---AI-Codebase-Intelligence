import { useState, useEffect, useCallback, useRef } from 'react';
import type { Repo, ChatMessage, GraphData, FileItem, QueryMode } from './types';
import {
  fetchRepos,
  deleteRepo,
  fetchGraph,
  fetchFileTree,
  fetchFileContent,
  streamQuery,
  ingestUrl,
  ingestZip,
} from './api/client';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/Chat/ChatInterface';
import DependencyGraph from './components/Graph/DependencyGraph';
import CodeViewer from './components/CodeViewer/CodeViewer';
import RepoLoader from './components/RepoLoader';

type Tab = 'chat' | 'graph' | 'files';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export default function App() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [activeRepo, setActiveRepo] = useState<Repo | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [fileTree, setFileTree] = useState<FileItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [showLoader, setShowLoader] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const loadRepos = useCallback(async () => {
    try {
      const list = await fetchRepos();
      setRepos(list);
      setActiveRepo(prev => {
        if (!prev) return prev;
        const updated = list.find(r => r.repo_id === prev.repo_id);
        return updated ?? prev;
      });
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    loadRepos();
  }, [loadRepos]);

  // Poll for status updates when repos are processing
  useEffect(() => {
    const hasProcessing = repos.some(r => r.status === 'indexing' || r.status === 'pending');
    if (hasProcessing && !pollingRef.current) {
      pollingRef.current = setInterval(loadRepos, 2000);
    } else if (!hasProcessing && pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [repos, loadRepos]);

  const handleSelectRepo = useCallback(async (repo: Repo) => {
    setActiveRepo(repo);
    setMessages([]);
    setGraphData(null);
    setFileTree([]);
    setSelectedFile(null);
    setFileContent(null);
    setActiveTab('chat');
    if (repo.status === 'ready') {
      fetchGraph(repo.repo_id).then(setGraphData).catch(() => {});
      fetchFileTree(repo.repo_id).then(d => setFileTree(d.files)).catch(() => {});
    }
  }, []);

  const handleDeleteRepo = useCallback(async (repoId: string) => {
    try {
      await deleteRepo(repoId);
      setRepos(prev => prev.filter(r => r.repo_id !== repoId));
      if (activeRepo?.repo_id === repoId) {
        setActiveRepo(null);
        setMessages([]);
      }
      addToast('success', 'Repository deleted');
    } catch {
      addToast('error', 'Failed to delete repository');
    }
  }, [activeRepo, addToast]);

  const handleIngestUrl = useCallback(async (url: string) => {
    try {
      const result = await ingestUrl(url);
      addToast('info', `Cloning ${result.name}... This may take a minute.`);
      setShowLoader(false);
      await loadRepos();
    } catch (e: unknown) {
      addToast('error', e instanceof Error ? e.message : 'Failed to ingest');
    }
  }, [loadRepos, addToast]);

  const handleIngestZip = useCallback(async (file: File) => {
    try {
      const result = await ingestZip(file);
      addToast('info', `Indexing ${result.name}...`);
      setShowLoader(false);
      await loadRepos();
    } catch (e: unknown) {
      addToast('error', e instanceof Error ? e.message : 'Failed to upload');
    }
  }, [loadRepos, addToast]);

  const handleSendMessage = useCallback((question: string, mode: QueryMode) => {
    if (!activeRepo) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: question,
    };
    const assistantId = (Date.now() + 1).toString();
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      isStreaming: true,
    };
    setMessages(prev => [...prev, userMsg, assistantMsg]);

    const endpoint = mode === 'debug' ? 'debug' : 'query';
    streamQuery(
      activeRepo.repo_id,
      question,
      endpoint,
      (data) => {
        setMessages(prev => prev.map(m => {
          if (m.id !== assistantId) return m;
          const chunk = data as Record<string, unknown>;
          if (chunk.type === 'meta') {
            return {
              ...m,
              query_type: chunk.query_type as string,
              sources: chunk.sources as ChatMessage['sources'],
            };
          }
          if (chunk.type === 'text') {
            return { ...m, content: m.content + (chunk.content as string) };
          }
          if (chunk.type === 'step') {
            const step = {
              step: chunk.step as number,
              title: chunk.title as string,
              message: chunk.message as string,
              files: chunk.files as string[] | undefined,
            };
            return { ...m, debug_steps: [...(m.debug_steps || []), step] };
          }
          if (chunk.type === 'error') {
            return { ...m, content: chunk.message as string, isError: true };
          }
          return m;
        }));
      },
      () => {
        setMessages(prev =>
          prev.map(m => m.id === assistantId ? { ...m, isStreaming: false } : m)
        );
      },
      (err) => {
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantId
              ? { ...m, content: err, isStreaming: false, isError: true }
              : m
          )
        );
      }
    );
  }, [activeRepo]);

  const handleTabChange = useCallback(async (tab: Tab) => {
    setActiveTab(tab);
    if (!activeRepo || activeRepo.status !== 'ready') return;
    if (tab === 'graph' && !graphData) {
      try {
        const data = await fetchGraph(activeRepo.repo_id);
        setGraphData(data);
      } catch { addToast('error', 'Failed to load graph'); }
    }
    if (tab === 'files' && fileTree.length === 0) {
      try {
        const data = await fetchFileTree(activeRepo.repo_id);
        setFileTree(data.files);
      } catch { addToast('error', 'Failed to load files'); }
    }
  }, [activeRepo, graphData, fileTree, addToast]);

  const handleFileSelect = useCallback(async (path: string) => {
    if (!activeRepo) return;
    setSelectedFile(path);
    try {
      const data = await fetchFileContent(activeRepo.repo_id, path);
      setFileContent(data.content);
    } catch { addToast('error', 'Failed to load file'); }
  }, [activeRepo, addToast]);

  const handleSuggestionClick = useCallback((q: string) => {
    handleSendMessage(q, 'ask');
  }, [handleSendMessage]);

  const statusColor = (status: Repo['status']) => {
    if (status === 'ready') return 'var(--accent-green)';
    if (status === 'error') return 'var(--accent-red)';
    return 'var(--accent-orange)';
  };

  return (
    <div className="app-layout">
      <Sidebar
        repos={repos}
        activeRepo={activeRepo}
        onSelectRepo={handleSelectRepo}
        onDeleteRepo={handleDeleteRepo}
        onAddRepo={() => setShowLoader(true)}
      />

      <div className="main-content">
        {!activeRepo ? (
          <div className="no-repo">
            <div className="no-repo-icon">🧠</div>
            <h2>CodeMind</h2>
            <p>
              AI-powered codebase intelligence. Ingest any repository and ask
              natural language questions about it.
            </p>
            <div className="feature-pills">
              {['AST Parsing', 'Semantic Search', 'Dependency Graphs', 'Agentic Debugger', 'Code Refactoring'].map(f => (
                <div key={f} className="feature-pill">✦ {f}</div>
              ))}
            </div>
            <button
              className="btn btn-primary"
              onClick={() => setShowLoader(true)}
              style={{ marginTop: 8 }}
            >
              + Load Repository
            </button>
          </div>
        ) : (
          <>
            <div className="tab-bar">
              {([
                ['chat', '💬', 'Ask AI'],
                ['graph', '🕸️', 'Dep Graph'],
                ['files', '📁', 'Files'],
              ] as const).map(([id, icon, label]) => (
                <button
                  key={id}
                  className={`tab-btn ${activeTab === id ? 'active' : ''}`}
                  onClick={() => handleTabChange(id)}
                >
                  {icon} {label}
                </button>
              ))}
              <div className="tab-spacer" />
              <div className="repo-indicator">
                <div
                  className="repo-indicator-dot"
                  style={{ background: statusColor(activeRepo.status) }}
                />
                <span>{activeRepo.name}</span>
                {activeRepo.status === 'ready' && (
                  <span style={{ color: 'var(--text-muted)' }}>
                    · {activeRepo.file_count} files · {activeRepo.chunk_count} chunks
                  </span>
                )}
                {(activeRepo.status === 'pending' || activeRepo.status === 'indexing') && (
                  <span style={{ color: 'var(--accent-orange)' }}>
                    · {activeRepo.status}...
                  </span>
                )}
              </div>
            </div>

            {activeTab === 'chat' && (
              <ChatInterface
                messages={messages}
                isReady={activeRepo.status === 'ready'}
                onSend={handleSendMessage}
                onSuggestion={handleSuggestionClick}
              />
            )}
            {activeTab === 'graph' && (
              <DependencyGraph data={graphData} />
            )}
            {activeTab === 'files' && (
              <CodeViewer
                files={fileTree}
                selectedFile={selectedFile}
                fileContent={fileContent}
                onSelectFile={handleFileSelect}
              />
            )}
          </>
        )}
      </div>

      {showLoader && (
        <RepoLoader
          onClose={() => setShowLoader(false)}
          onIngestUrl={handleIngestUrl}
          onIngestZip={handleIngestZip}
        />
      )}

      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.type === 'success' ? '✅' : t.type === 'error' ? '❌' : 'ℹ️'} {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
