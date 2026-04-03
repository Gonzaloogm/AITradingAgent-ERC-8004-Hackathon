import { useState, useEffect, useRef, useCallback } from 'react';
import { apiClient } from '../../api/client';
import MessageBubble from './MessageBubble';
import QuickActions from './QuickActions';
import LoadingSpinner from '../ui/LoadingSpinner';
import { useToast } from '../ui/Toast';

const SESSION_KEY = 'tee_agent_session_id';

function getOrCreateSession() {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

const GREETING = {
  role: 'assistant',
  content: `Hello! I'm your **TEE Agent** running in a secure Intel TDX enclave.\n\nI can help you:\n- Check wallet balance and sign messages\n- Generate attestation proofs\n- Query registration and reputation status\n- Run Python or shell scripts\n- Explore agent capabilities\n\nWhat would you like to do?`,
};

export default function ChatInterface() {
  const [messages, setMessages]     = useState([GREETING]);
  const [input, setInput]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [sessionId, setSessionId]   = useState(getOrCreateSession);
  const bottomRef                   = useRef(null);
  const textareaRef                 = useRef(null);
  const toast                       = useToast();

  // Load history on mount
  useEffect(() => {
    (async () => {
      const result = await apiClient.getChatHistory(sessionId);
      if (result.success && result.data.messages?.length > 0) {
        setMessages(result.data.messages.map(m => ({
          role:      m.role,
          content:   m.content,
          toolCalls: m.tool_calls,
        })));
      }
    })();
  }, [sessionId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = useCallback((msg) => {
    setMessages(prev => prev.filter(m => m.role !== 'typing').concat(msg));
  }, []);

  const showTyping = useCallback(() => {
    setMessages(prev => [...prev, { role: 'typing', content: '' }]);
  }, []);

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || loading) return;
    setInput('');
    textareaRef.current && (textareaRef.current.style.height = 'auto');
    addMessage({ role: 'user', content: text });
    showTyping();
    setLoading(true);

    const result = await apiClient.sendChatMessage(sessionId, text);

    if (result.success) {
      if (result.data.session_id && result.data.session_id !== sessionId) {
        setSessionId(result.data.session_id);
        localStorage.setItem(SESSION_KEY, result.data.session_id);
      }
      addMessage({
        role: 'assistant',
        content: result.data.response,
        toolCalls: result.data.tool_calls,
      });
    } else {
      addMessage({ role: 'assistant', content: `⚠️ Error: ${result.error}\n\nPlease try again.` });
      toast(result.error, 'error');
    }
    setLoading(false);
  }, [loading, sessionId, addMessage, showTyping, toast]);

  const handleQuickAction = useCallback(async (tool, label) => {
    if (loading) return;
    addMessage({ role: 'user', content: `[Quick Action: ${label}]` });
    showTyping();
    setLoading(true);

    const result = await apiClient.quickAction(sessionId, tool);
    if (result.success) {
      addMessage({ role: 'assistant', content: result.data.response, toolCalls: result.data.tool_calls });
    } else {
      addMessage({ role: 'assistant', content: `⚠️ Error: ${result.error}` });
    }
    setLoading(false);
  }, [loading, sessionId, addMessage, showTyping]);

  const handleNewSession = async () => {
    const result = await apiClient.newChatSession();
    if (result.success) {
      const newId = result.data.session_id;
      setSessionId(newId);
      localStorage.setItem(SESSION_KEY, newId);
      setMessages([GREETING]);
      toast('New session started', 'success');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
  };

  return (
    <div className="glass-panel flex flex-col" style={{ height: 'calc(100vh - 200px)', minHeight: '500px' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <span className="text-xl">🤖</span>
          <div>
            <p className="text-sm font-semibold text-white">TEE Agent Chat</p>
            <p className="text-xs text-gray-500 font-mono">Intel TDX Secured</p>
          </div>
        </div>
        <button
          onClick={handleNewSession}
          className="text-xs px-3 py-1.5 rounded-lg border border-white/[0.08] text-gray-400 hover:text-white hover:bg-white/[0.06] transition-colors"
        >
          New Session
        </button>
      </div>

      {/* Quick actions */}
      <div className="px-4 pt-3">
        <QuickActions onAction={handleQuickAction} disabled={loading} />
      </div>

      {/* Messages */}
      <div className="chat-messages flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg, i) =>
          msg.role === 'typing' ? (
            <div key="typing" className="flex gap-3 animate-fadein">
              <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center bg-cyan-900/60 border border-cyan-500/30 text-base">🤖</div>
              <div className="rounded-2xl rounded-tl-sm px-4 py-3 bg-white/[0.04] border border-white/[0.08] flex items-center gap-2">
                <LoadingSpinner size="sm" color="cyan" />
                <span className="text-xs text-gray-500">Thinking...</span>
              </div>
            </div>
          ) : (
            <MessageBubble key={i} message={msg} />
          )
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 pb-4 pt-2 border-t border-white/[0.06]">
        <div className="flex items-end gap-2 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2 focus-within:border-cyan-500/40 transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type your message... (Enter to send, Shift+Enter for newline)"
            rows={1}
            disabled={loading}
            className="flex-1 bg-transparent resize-none text-sm text-gray-200 placeholder-gray-600 outline-none font-sans py-1 leading-relaxed disabled:opacity-50"
            style={{ maxHeight: '160px' }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            className="flex-shrink-0 w-9 h-9 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-400
              hover:bg-cyan-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center text-lg"
          >
            {loading ? <LoadingSpinner size="sm" /> : '↑'}
          </button>
        </div>
        <p className="text-xs text-gray-700 mt-1.5 text-center font-mono">Session: {sessionId.slice(0, 8)}…</p>
      </div>
    </div>
  );
}
