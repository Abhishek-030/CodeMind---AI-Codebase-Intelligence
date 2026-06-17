import { useState, useRef, useCallback } from 'react';

interface Props {
  onClose: () => void;
  onIngestUrl: (url: string) => Promise<void>;
  onIngestZip: (file: File) => Promise<void>;
}

const POPULAR_REPOS = [
  { name: 'Flask', url: 'https://github.com/pallets/flask' },
  { name: 'Express', url: 'https://github.com/expressjs/express' },
  { name: 'FastAPI', url: 'https://github.com/tiangolo/fastapi' },
  { name: 'Requests', url: 'https://github.com/psf/requests' },
];

export default function RepoLoader({ onClose, onIngestUrl, onIngestZip }: Props) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUrl = useCallback(async () => {
    if (!url.trim()) return;
    setLoading(true);
    try {
      await onIngestUrl(url.trim());
    } finally {
      setLoading(false);
    }
  }, [url, onIngestUrl]);

  const handleFile = useCallback(async (file: File) => {
    setLoading(true);
    try {
      await onIngestZip(file);
    } finally {
      setLoading(false);
    }
  }, [onIngestZip]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith('.zip')) handleFile(file);
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Load Repository</div>
        <div className="modal-subtitle">
          Ingest a codebase to start asking AI-powered questions
        </div>

        <div className="modal-section">
          <div className="modal-label">GitHub URL</div>
          <div className="input-group">
            <input
              id="github-url-input"
              className="glass-input"
              placeholder="https://github.com/owner/repo"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleUrl()}
              disabled={loading}
              autoFocus
            />
            <button
              className="btn btn-primary"
              onClick={handleUrl}
              disabled={loading || !url.trim()}
            >
              {loading ? '⏳' : 'Clone'}
            </button>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {POPULAR_REPOS.map(p => (
              <button
                key={p.name}
                className="btn btn-secondary btn-sm"
                onClick={() => setUrl(p.url)}
                disabled={loading}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <div className="divider">or upload ZIP</div>

        <div className="modal-section">
          <input
            ref={fileRef}
            type="file"
            accept=".zip"
            style={{ display: 'none' }}
            onChange={handleFileInput}
          />
          <div
            className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !loading && fileRef.current?.click()}
          >
            <span className="drop-zone-icon">📦</span>
            <div className="drop-zone-text">
              {loading
                ? 'Uploading...'
                : 'Drop a .zip file here, or click to browse'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              Supports ZIP archives of any codebase
            </div>
          </div>
        </div>

        {loading && (
          <div className="loading-bar" style={{ marginBottom: 8 }}>
            <div className="loading-bar-fill" />
          </div>
        )}

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={loading}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
