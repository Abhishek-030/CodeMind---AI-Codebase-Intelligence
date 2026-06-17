import type { Repo } from '../types';

interface Props {
  repos: Repo[];
  activeRepo: Repo | null;
  onSelectRepo: (repo: Repo) => void;
  onDeleteRepo: (id: string) => void;
  onAddRepo: () => void;
}

export default function Sidebar({ repos, activeRepo, onSelectRepo, onDeleteRepo, onAddRepo }: Props) {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="logo">
          <div className="logo-icon">🧠</div>
          <span className="logo-text">CodeMind</span>
        </div>
        <div className="logo-tagline">AI Codebase Intelligence</div>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-title">Repositories</div>
        <button
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center' }}
          onClick={onAddRepo}
          id="load-repo-btn"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Load Repository
        </button>
      </div>

      <div className="sidebar-scroll">
        {repos.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: 12,
              padding: '28px 12px',
              lineHeight: 1.9,
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 10, opacity: 0.5 }}>📂</div>
            No repositories yet.
            <br />
            Load one to get started.
          </div>
        ) : (
          repos.map(repo => (
            <div
              key={repo.repo_id}
              className={`repo-card ${activeRepo?.repo_id === repo.repo_id ? 'active' : ''}`}
              onClick={() => onSelectRepo(repo)}
            >
              <button
                className="repo-delete-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteRepo(repo.repo_id);
                }}
                title="Delete repository"
              >
                ✕
              </button>
              <div className="repo-name" title={repo.name}>
                <span style={{ marginRight: 6 }}>📦</span>{repo.name}
              </div>
              <div className="repo-stats">
                <span>{repo.file_count} files</span>
                {repo.chunk_count > 0 && <span>· {repo.chunk_count} chunks</span>}
              </div>
              <div className={`repo-status ${repo.status}`}>
                <div className="status-dot" />
                {repo.status === 'ready'
                  ? '✓ Ready'
                  : repo.status === 'indexing'
                  ? 'Indexing...'
                  : repo.status === 'pending'
                  ? 'Pending'
                  : 'Error'}
              </div>
              {(repo.status === 'indexing' || repo.status === 'pending') && (
                <div className="loading-bar">
                  <div className="loading-bar-fill" />
                </div>
              )}
              {repo.status === 'error' && repo.error && (
                <div style={{ fontSize: 10, color: 'var(--accent-red)', marginTop: 4 }}>
                  {repo.error.slice(0, 60)}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="sidebar-footer">
        <div className="sidebar-footer-powered">
          <span>⚡</span>
          <span>Powered by Gemini 1.5 Flash</span>
        </div>
        <div className="sidebar-footer-stack">
          <span className="stack-tag">ChromaDB</span>
          <span className="stack-tag">tree-sitter</span>
          <span className="stack-tag">NetworkX</span>
          <span className="stack-tag">FastAPI</span>
        </div>
      </div>
    </div>
  );
}
