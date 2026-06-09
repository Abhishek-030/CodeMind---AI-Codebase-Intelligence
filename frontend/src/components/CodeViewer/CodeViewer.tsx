import { useState, useMemo } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { FileItem } from '../../types';

interface Props {
  files: FileItem[];
  selectedFile: string | null;
  fileContent: string | null;
  onSelectFile: (path: string) => void;
}

const EXT_LANG_MAP: Record<string, string> = {
  py: 'python',
  js: 'javascript',
  jsx: 'jsx',
  ts: 'typescript',
  tsx: 'tsx',
  java: 'java',
  go: 'go',
  rs: 'rust',
  cpp: 'cpp',
  c: 'c',
  h: 'c',
  hpp: 'cpp',
  cs: 'csharp',
  rb: 'ruby',
  php: 'php',
  swift: 'swift',
  kt: 'kotlin',
  md: 'markdown',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  sh: 'bash',
  bash: 'bash',
  html: 'html',
  css: 'css',
  scss: 'scss',
  sql: 'sql',
  xml: 'xml',
};

function getExtClass(ext: string): string {
  if (['py'].includes(ext)) return 'ext-py';
  if (['js', 'jsx'].includes(ext)) return 'ext-js';
  if (['ts', 'tsx'].includes(ext)) return 'ext-ts';
  return 'ext-default';
}

function getFileIcon(ext: string): string {
  const icons: Record<string, string> = {
    py: '🐍', js: '⚡', jsx: '⚛️', ts: '🔷', tsx: '⚛️',
    java: '☕', go: '🐹', rs: '🦀', cpp: '⚙️', c: '⚙️',
    md: '📝', json: '📋', yaml: '📋', yml: '📋',
    html: '🌐', css: '🎨', scss: '🎨', sh: '📟',
    sql: '🗄️', toml: '📋', rb: '💎',
  };
  return icons[ext] ?? '📄';
}

export default function CodeViewer({ files, selectedFile, fileContent, onSelectFile }: Props) {
  const [search, setSearch] = useState('');

  const filteredFiles = useMemo(() => {
    const q = search.toLowerCase();
    return q ? files.filter(f => f.path.toLowerCase().includes(q) || f.name.toLowerCase().includes(q)) : files;
  }, [files, search]);

  const selectedFileItem = files.find(f => f.path === selectedFile);
  const language = selectedFileItem ? (EXT_LANG_MAP[selectedFileItem.ext] ?? 'text') : 'text';
  const lineCount = fileContent ? fileContent.split('\n').length : 0;

  return (
    <div className="code-viewer">
      {/* File tree panel */}
      <div className="file-tree">
        <div className="file-tree-search">
          <input
            className="glass-input"
            style={{ width: '100%', fontSize: 11 }}
            placeholder="🔍 Search files..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {files.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 11, padding: '20px 0' }}>
            No files loaded
          </div>
        ) : filteredFiles.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 11, padding: '20px 0' }}>
            No matches found
          </div>
        ) : (
          <>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', padding: '0 4px 6px', fontFamily: 'var(--font-mono)' }}>
              {filteredFiles.length} of {files.length} files
            </div>
            {filteredFiles.map(file => (
              <div
                key={file.path}
                className={`file-item ${selectedFile === file.path ? 'active' : ''}`}
                onClick={() => onSelectFile(file.path)}
                title={file.path}
              >
                <span className={`file-ext-badge ${getExtClass(file.ext)}`}>
                  {file.ext || '?'}
                </span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {getFileIcon(file.ext)} {file.name}
                </span>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Code display panel */}
      <div className="code-display">
        {!selectedFile ? (
          <div className="code-display-empty">
            <div style={{ fontSize: 36 }}>📂</div>
            <div>Select a file to view its contents</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {files.length} files available
            </div>
          </div>
        ) : fileContent === null ? (
          <div className="code-display-empty">
            <div style={{ fontSize: 28 }}>⏳</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading file...</div>
          </div>
        ) : (
          <>
            <div className="code-display-header">
              <span style={{ color: 'var(--accent-cyan)' }}>
                {getFileIcon(selectedFileItem?.ext ?? '')}
              </span>
              <span style={{ color: 'var(--text-primary)' }}>{selectedFile}</span>
              <span style={{ marginLeft: 'auto', fontSize: 11 }}>
                {lineCount} lines
              </span>
              <span style={{ color: 'var(--accent-purple-light)', fontSize: 11 }}>
                {language}
              </span>
            </div>
            <SyntaxHighlighter
              language={language}
              style={oneDark}
              showLineNumbers
              lineNumberStyle={{
                minWidth: '3em',
                paddingRight: '1em',
                color: 'rgba(255,255,255,0.15)',
                fontSize: 11,
                userSelect: 'none',
              }}
              customStyle={{
                margin: 0,
                padding: '16px',
                background: 'transparent',
                fontSize: '12px',
                lineHeight: '1.6',
                fontFamily: 'JetBrains Mono, Fira Code, monospace',
                minHeight: '100%',
              }}
              codeTagProps={{
                style: { fontFamily: 'JetBrains Mono, Fira Code, monospace' },
              }}
            >
              {fileContent}
            </SyntaxHighlighter>
          </>
        )}
      </div>
    </div>
  );
}
