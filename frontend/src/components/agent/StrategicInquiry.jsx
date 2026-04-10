import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, ShieldCheck } from 'lucide-react';
import { apiClient } from '../../api/client';

export default function StrategicInquiry() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Inquiry line established. I am the Agent Auditor. How can I assist with your strategy analysis?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const scrollRef = useRef(null);

  // Initialize Session
  useEffect(() => {
    const init = async () => {
       try {
          const resp = await apiClient.newChatSession();
          if (resp.success) setSessionId(resp.data.session_id);
       } catch (e) {}
    };
    init();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      // Use the session-based chat message
      const resp = await apiClient.sendChatMessage(sessionId, userMsg);
      if (resp.success) {
        // Map resp.data.response (from backend chat_endpoint)
        setMessages(prev => [...prev, { role: 'assistant', content: resp.data.response }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Enclave response timeout. Re-authenticating...' }]);
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Strategic Inquiry Error: ' + e.message }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#161920] border border-white/5 rounded-lg overflow-hidden shadow-2xl relative">
      {/* Header */}
      <div className="p-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck size={14} className="text-[#00BFA5]" />
          <span className="text-[10px] font-bold text-white uppercase tracking-widest">Strategic_Inquiry_Hub</span>
        </div>
        <span className="text-[8px] bg-[#0091EA]/10 text-[#0091EA] px-2 py-0.5 rounded font-black">AUDITOR_V1</span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide bg-black/10">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
             <div className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ${m.role === 'assistant' ? 'bg-[#00BFA5]/20 text-[#00BFA5]' : 'bg-white/5 text-slate-400'}`}>
                {m.role === 'assistant' ? <Bot size={14} /> : <User size={14} />}
             </div>
             <div className={`max-w-[85%] p-3 rounded-lg text-[11px] leading-relaxed ${m.role === 'assistant' ? 'bg-white/5 text-slate-300' : 'bg-[#0091EA]/20 text-white'}`}>
                {m.content}
             </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3 animate-pulse">
            <div className="w-6 h-6 rounded bg-[#00BFA5]/20" />
            <div className="h-8 w-24 bg-white/5 rounded" />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-white/5 bg-white/2">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Inquire Enclave logic..."
            className="w-full bg-black/20 border border-white/10 rounded-md py-2.5 pl-4 pr-10 text-[11px] text-white focus:outline-none focus:border-[#00BFA5]/30 focus:bg-black/30 transition-all font-sans"
          />
          <button 
            onClick={handleSend}
            disabled={loading}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-[#00BFA5] transition-colors"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
