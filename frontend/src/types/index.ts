export interface Repo {
  repo_id: string;
  name: string;
  url: string;
  status: 'pending' | 'indexing' | 'ready' | 'error';
  file_count: number;
  chunk_count: number;
  error?: string;
  repo_path?: string;
}

export interface Source {
  file: string;
  start_line: number;
  end_line: number;
  name: string;
  type: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  query_type?: string;
  sources?: Source[];
  debug_steps?: DebugStep[];
  isStreaming?: boolean;
  isError?: boolean;
}

export interface DebugStep {
  step: number;
  title: string;
  message: string;
  files?: string[];
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: { node_count: number; edge_count: number };
}

export interface GraphNode {
  id: string;
  label: string;
  language: string;
  in_degree: number;
  out_degree: number;
  centrality: number;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface FileItem {
  path: string;
  name: string;
  ext: string;
}

export type QueryMode = 'ask' | 'debug';
