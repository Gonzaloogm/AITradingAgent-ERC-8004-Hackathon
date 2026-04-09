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
  content: `### TEE Agent Auditor V1.0 Connected\n\nI am the autonomous supervisor of the AGENT-4108-TDX strategy. You can audit my enclave state by asking about:\n- **Hardware Security**: "What is your attestation status?"\n- **Trading Logic**: "Explain your Delta-Neutral strategy."\n- **Portfolio Audit**: "Show me your current equity and realized gains."\n\nI am currently running inside a **SECURED INTEL TDX ENCLAVE**.`,
};

export default function ChatInterface() {
  const [messages, setMessages]     = useState([GREETING]);
  const [input, setInput]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [sessionId, setSessionId]   = useState(getOrCreateSession);
  const bottomRef                   = useRef(null);
  const textareaRef                 = useRef(null);
  const toast                       = useToast();

  // ... (rest of the logic remains the same, but I'll update the render part below)
  // [NOTE: I'll skip to the return block to save tokens but keeping logic intact]
  
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
      toast('Audit session cleared', 'success');
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
    <div className="bg-black/60 border border-white/5 rounded-[2.5rem] flex flex-col h-[450px] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-white/[0.06] bg-white/[0.02]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">🛡️</div>
          <div>
            <p className="text-xs font-black text-white uppercase tracking-widest">Agent Auditor V1.0</p>
            <p className="text-[10px] text-emerald-500/60 font-mono uppercase">Internal Integrity Stream</p>
          </div>
        </div>
        <button
          onClick={handleNewSession}
          className="text-[10px] px-3 py-1 rounded-lg border border-white/10 text-gray-500 hover:text-white hover:bg-white/5 transition-all font-mono uppercase"
        >
          Reset Logs
        </button>
      </div>

      {/* Messages */}
      <div className="chat-messages flex-1 overflow-y-auto px-8 py-6 space-y-6 font-sans">
        {messages.map((msg, i) =>
          msg.role === 'typing' ? (
            <div key="typing" className="flex gap-4 animate-fadein">
              <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center bg-gray-900 border border-white/10 text-xs">🤖</div>
              <div className="rounded-2xl rounded-tl-sm px-5 py-3 bg-white/[0.02] border border-white/[0.04] flex items-center gap-2">
                <LoadingSpinner size="sm" color="emerald" />
                <span className="text-[11px] text-gray-500 font-mono">AUDITING ENCLAVE...</span>
              </div>
            </div>
          ) : (
            <MessageBubble key={i} message={msg} />
          )
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-8 pb-8 pt-4">
        <div className="flex items-end gap-3 bg-white/[0.02] border border-white/10 rounded-2xl px-6 py-3 focus-within:border-emerald-500/40 transition-all">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Pregunta al agente sobre su estado de seguridad o balance de trading..."
            rows={1}
            disabled={loading}
            className="flex-1 bg-transparent resize-none text-[13px] text-gray-300 placeholder-gray-700 outline-none font-sans py-1 leading-relaxed disabled:opacity-50"
            style={{ maxHeight: '100px' }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400
              hover:bg-emerald-500/20 disabled:opacity-10 transition-all flex items-center justify-center"
          >
            {loading ? <LoadingSpinner size="sm" /> : '→'}
          </button>
        </div>
      </div>
    </div>
  );
}
