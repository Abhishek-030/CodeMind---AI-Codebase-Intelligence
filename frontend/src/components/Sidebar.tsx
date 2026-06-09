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
        >
          + Load Repository
        </button>
      </div>

      <div className="sidebar-scroll">
        {repos.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: 12,
              padding: '20px 0',
              lineHeight: 1.8,
            }}
          >
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
              <div className="repo-name" title={repo.name}>📦 {repo.name}</div>
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

      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--glass-border)',
          fontSize: 11,
          color: 'var(--text-muted)',
        }}
      >
        <div>Powered by Gemini 1.5 Flash</div>
        <div style={{ marginTop: 2 }}>ChromaDB · tree-sitter · NetworkX</div>
      </div>
    </div>
  );
}
