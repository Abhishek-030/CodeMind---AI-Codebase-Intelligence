import type { Repo, GraphData } from '../types';

const BASE = '/api';

export async function fetchRepos(): Promise<Repo[]> {
  const res = await fetch(`${BASE}/repos`);
  if (!res.ok) throw new Error('Failed to fetch repos');
  return res.json();
}

export async function fetchRepo(repoId: string): Promise<Repo> {
  const res = await fetch(`${BASE}/repos/${repoId}`);
  if (!res.ok) throw new Error('Failed to fetch repo');
  return res.json();
}

export async function ingestUrl(githubUrl: string): Promise<{ repo_id: string; name: string; status: string }> {
  const res = await fetch(`${BASE}/repos/ingest/url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ github_url: githubUrl }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(err.detail || 'Failed to ingest');
  }
  return res.json();
}

export async function ingestZip(file: File): Promise<{ repo_id: string; name: string; status: string }> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${BASE}/repos/ingest/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(err.detail || 'Failed to upload');
  }
  return res.json();
}

export async function deleteRepo(repoId: string): Promise<void> {
  const res = await fetch(`${BASE}/repos/${repoId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete repo');
}

export async function fetchGraph(repoId: string): Promise<GraphData> {
  const res = await fetch(`${BASE}/graph/${repoId}`);
  if (!res.ok) throw new Error('Failed to fetch graph');
  return res.json();
}

export async function fetchFileTree(repoId: string): Promise<{ files: { path: string; name: string; ext: string }[] }> {
  const res = await fetch(`${BASE}/files/${repoId}`);
  if (!res.ok) throw new Error('Failed to fetch file tree');
  return res.json();
}

export async function fetchFileContent(repoId: string, path: string): Promise<{ content: string; path: string }> {
  const res = await fetch(`${BASE}/files/${repoId}/content?path=${encodeURIComponent(path)}`);
  if (!res.ok) throw new Error('Failed to fetch file content');
  return res.json();
}

export function streamQuery(
  repoId: string,
  question: string,
  endpoint: 'query' | 'debug' = 'query',
  onChunk: (data: Record<string, unknown>) => void,
  onDone: () => void,
  onError: (err: string) => void
): () => void {
  const controller = new AbortController();

  fetch(`${BASE}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_id: repoId, question }),
    signal: controller.signal,
  }).then(async (res) => {
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Request failed' }));
      onError(err.detail || 'Request failed');
      return;
    }
    const reader = res.body?.getReader();
    if (!reader) { onError('No response body'); return; }
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) { onDone(); break; }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            onChunk(data);
          } catch { /* ignore parse errors */ }
        }
      }
    }
  }).catch((err) => {
    if (err.name !== 'AbortError') onError(err.message);
  });

  return () => controller.abort();
}
