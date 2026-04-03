import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useState } from 'react';
import { copyToClipboard } from '../../utils/formatters';

function CodeBlock({ language, value }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await copyToClipboard(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative rounded-lg overflow-hidden my-3 border border-white/[0.08]">
      <div className="flex items-center justify-between px-4 py-1.5 bg-black/40 border-b border-white/[0.06]">
        <span className="text-xs font-mono text-gray-500">{language || 'code'}</span>
        <button
          onClick={handleCopy}
          className="text-xs text-gray-400 hover:text-cyan-400 transition-colors"
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <SyntaxHighlighter
        language={language || 'text'}
        style={atomDark}
        customStyle={{ margin: 0, padding: '1rem', background: 'rgba(0,0,0,0.5)', fontSize: '0.82rem' }}
        wrapLongLines
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
}

function ToolResult({ toolCall }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify(toolCall.result, null, 2);
  const name = toolCall.tool?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const handleCopy = async (e) => {
    e.stopPropagation();
    await copyToClipboard(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-3 rounded-lg border border-white/[0.08] overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-2.5 bg-black/30 hover:bg-black/40 transition-colors text-sm text-left"
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-gray-300">📋 {name}</span>
        <div className="flex items-center gap-2">
          <button onClick={handleCopy} className="text-xs text-gray-500 hover:text-cyan-400 transition-colors p-1">
            {copied ? '✓' : '⎘'}
          </button>
          <span className="text-gray-500 text-xs">{open ? '▲' : '▼'}</span>
        </div>
      </button>
      {open && (
        <SyntaxHighlighter
          language="json"
          style={atomDark}
          customStyle={{ margin: 0, padding: '1rem', background: 'rgba(0,0,0,0.5)', fontSize: '0.8rem', maxHeight: '320px' }}
          wrapLongLines
        >
          {json}
        </SyntaxHighlighter>
      )}
    </div>
  );
}

export default function MessageBubble({ message }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 animate-fadein ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-base ${
        isUser
          ? 'bg-purple-800/60 border border-purple-500/30'
          : 'bg-cyan-900/60 border border-cyan-500/30'
      }`}>
        {isUser ? '👤' : '🤖'}
      </div>

      {/* Content */}
      <div className={`max-w-[80%] sm:max-w-[75%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-purple-700/40 border border-purple-500/30 text-gray-100 rounded-tr-sm'
            : 'bg-white/[0.04] border border-white/[0.08] text-gray-200 rounded-tl-sm'
        }`}>
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-sm max-w-none prose-invert">
              <ReactMarkdown
                components={{
                  code({ node, inline, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '');
                    return !inline && match ? (
                      <CodeBlock language={match[1]} value={String(children).replace(/\n$/, '')} />
                    ) : (
                      <code className="inline-code" {...props}>{children}</code>
                    );
                  },
                  a: ({ href, children }) => (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 underline">
                      {children}
                    </a>
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Tool results */}
        {message.toolCalls?.map((tc, i) => (
          <ToolResult key={i} toolCall={tc} />
        ))}
      </div>
    </div>
  );
}
