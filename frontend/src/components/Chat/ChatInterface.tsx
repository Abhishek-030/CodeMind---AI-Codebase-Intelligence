import { useState, useRef, useEffect, useCallback } from 'react';
import type { ChatMessage, QueryMode } from '../../types';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface Props {
  messages: ChatMessage[];
  isReady: boolean;
  onSend: (question: string, mode: QueryMode) => void;
  onSuggestion: (question: string) => void;
}

const SUGGESTIONS = [
  { label: 'Explain', text: 'Explain the overall architecture and main entry points of this codebase' },
  { label: 'Where', text: 'Where is authentication handled? Show me the relevant files' },
  { label: 'Refactor', text: 'Which parts of the code could be refactored for better maintainability?' },
  { label: 'Debug', text: 'Are there any potential bugs or error-handling issues in the codebase?' },
];

const BADGE_CLASS: Record<string, string> = {
  where: 'badge-where',
  why: 'badge-why',
  explain: 'badge-explain',
  refactor: 'badge-refactor',
  debug: 'badge-debug',
  general: 'badge-general',
};

export default function ChatInterface({ messages, isReady, onSend, onSuggestion }: Props) {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<QueryMode>('ask');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isStreaming = messages.some(m => m.isStreaming);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(() => {
    const q = input.trim();
    if (!q || isStreaming || !isReady) return;
    setInput('');
    onSend(q, mode);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, [input, isStreaming, isReady, onSend, mode]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // Auto-resize textarea
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 150) + 'px';
  }, []);

  return (
    <div className="chat-container">
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">💬</div>
            <div className="empty-title">Ask anything about this codebase</div>
            <div className="empty-subtitle">
              {isReady
                ? 'The repository is indexed and ready. Try one of these questions to get started:'
                : 'The repository is still being indexed. Please wait...'}
            </div>
            {isReady && (
              <div className="suggestions-grid">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s.label}
                    className="suggestion-chip"
                    onClick={() => onSuggestion(s.text)}
                  >
                    <div className="suggestion-label">{s.label}</div>
                    {s.text}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          messages.map(msg => (
            <MessageBubble key={msg.id} message={msg} />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-area">
        <div className="mode-selector">
          <button
            className={`mode-btn ${mode === 'ask' ? 'active' : ''}`}
            onClick={() => setMode('ask')}
          >
            💬 Ask
          </button>
          <button
            className={`mode-btn ${mode === 'debug' ? 'active' : ''}`}
            onClick={() => setMode('debug')}
          >
            🔍 Debug
          </button>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4, alignSelf: 'center' }}>
            {mode === 'debug' ? 'Agentic multi-step reasoning' : 'Semantic Q&A with sources'}
          </span>
        </div>
        <div className="chat-input-row">
          <textarea
            ref={textareaRef}
            className="chat-textarea"
            placeholder={
              isReady
                ? mode === 'debug'
                  ? 'Describe a bug or issue to investigate...'
                  : 'Ask anything about the codebase... (Enter to send, Shift+Enter for newline)'
                : 'Waiting for indexing to complete...'
            }
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={!isReady || isStreaming}
            rows={1}
          />
          <button
            className="send-btn"
            onClick={handleSend}
            disabled={!input.trim() || isStreaming || !isReady}
            title="Send message"
          >
            {isStreaming ? (
              <span style={{ fontSize: 16 }}>⏳</span>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  const badgeClass = message.query_type ? (BADGE_CLASS[message.query_type] ?? 'badge-general') : '';

  return (
    <div className={`message ${isUser ? 'user' : 'assistant'}`}>
      <div className="message-avatar">
        {isUser ? '👤' : '🤖'}
      </div>
      <div className="message-bubble">
        {!isUser && (message.query_type || (message.sources && message.sources.length > 0)) && (
          <div className="message-meta">
            {message.query_type && (
              <span className={`query-type-badge ${badgeClass}`}>
                {message.query_type}
              </span>
            )}
          </div>
        )}

        {/* Debug steps */}
        {message.debug_steps && message.debug_steps.length > 0 && (
          <div className="debug-steps">
            {message.debug_steps.map((step, i) => (
              <div key={i} className="debug-step">
                <div className="step-num">{step.step}</div>
                <div>
                  <div className="step-title">{step.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {step.message}
                  </div>
                  {step.files && step.files.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                      {step.files.map(f => (
                        <span key={f} className="source-chip" style={{ cursor: 'default' }}>
                          📄 {f.split('/').pop()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Content */}
        {message.isStreaming && !message.content ? (
          <div className="typing-indicator">
            <div className="typing-dot" />
            <div className="typing-dot" />
            <div className="typing-dot" />
          </div>
        ) : message.isError ? (
          <div style={{ color: 'var(--accent-red)', fontSize: 13 }}>
            ⚠️ {message.content}
          </div>
        ) : isUser ? (
          <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {message.content}
          </div>
        ) : (
          <ReactMarkdown
            components={{
              code({ className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '');
                const isInline = !match;
                if (isInline) {
                  return <code className={className} {...props}>{children}</code>;
                }
                return (
                  <SyntaxHighlighter
                    style={oneDark}
                    language={match[1]}
                    PreTag="div"
                    customStyle={{
                      margin: '8px 0',
                      borderRadius: '6px',
                      fontSize: '12px',
                      background: 'rgba(0,0,0,0.5)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                );
              },
            }}
          >
            {message.content}
          </ReactMarkdown>
        )}

        {/* Streaming cursor */}
        {message.isStreaming && message.content && (
          <span
            style={{
              display: 'inline-block',
              width: 2,
              height: '1em',
              background: 'var(--accent-purple)',
              marginLeft: 2,
              animation: 'typing 1s infinite',
              verticalAlign: 'text-bottom',
            }}
          />
        )}

        {/* Sources */}
        {!isUser && message.sources && message.sources.length > 0 && !message.isStreaming && (
          <div className="sources-list">
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 4 }}>
              Sources:
            </span>
            {message.sources.map((src, i) => (
              <span key={i} className="source-chip" title={`${src.file}:${src.start_line}-${src.end_line}`}>
                📄 {src.file.split('/').pop()} :{src.start_line}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
