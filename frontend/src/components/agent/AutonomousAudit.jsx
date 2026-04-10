import { useState, useRef, useEffect } from 'react';
import { ShieldCheck, Cpu, Terminal as TerminalIcon, Search, Eye } from 'lucide-react';

export default function AutonomousAudit() {
  const [logs, setLogs] = useState([
    { type: 'SYSTEM', content: 'Autonomous Audit Line Established [ENCLAVE_v1.0.4]' },
    { type: 'THOUGHT', content: 'Scanning network topologies for TEE attestation...' },
    { type: 'INFO', content: 'Connection: PCCS Verification Service [STABLE]' }
  ]);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  // Simulated Thinking Feed
  useEffect(() => {
    const thoughts = [
      { type: 'THOUGHT', content: 'Analyzing cross-exchange orderbook depth...' },
      { type: 'THOUGHT', content: 'Recalculating slippage vector for batch size...' },
      { type: 'DECISION', content: 'Hold position, spread below current LLM threshold.' },
      { type: 'SYSTEM', content: 'Memory isolation check: PASS' },
      { type: 'THOUGHT', content: 'Parsing sentiment from Phala Oracle stream...' },
      { type: 'TEE', content: 'Signature generated for hedge rebalance.' }
    ];

    const interval = setInterval(() => {
      if (Math.random() > 0.6) {
        const t = thoughts[Math.floor(Math.random() * thoughts.length)];
        setLogs(prev => [...prev, t].slice(-50));
      }
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col h-full bg-[#11141D] border border-white/5 rounded-lg overflow-hidden shadow-2xl font-mono">
      {/* Header */}
      <div className="p-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TerminalIcon size={14} className="text-[#00BFA5]" />
          <span className="text-[10px] font-black text-white uppercase tracking-widest">Autonomous_Audit_Log</span>
        </div>
        <div className="flex items-center gap-2">
            <span className="text-[7px] text-slate-500 animate-pulse">LIVE_FEED</span>
            <div className="w-1.5 h-1.5 rounded-full bg-[#00BFA5]" />
        </div>
      </div>

      {/* Audit Feed */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-hide bg-black/20">
        {logs.map((log, i) => (
          <div key={i} className="flex gap-2 text-[10px] leading-relaxed">
             <span className={`flex-shrink-0 font-bold ${
                log.type === 'THOUGHT' ? 'text-amber-500/80' : 
                log.type === 'DECISION' ? 'text-[#0091EA]' :
                log.type === 'TEE' ? 'text-[#00BFA5]' :
                'text-slate-500'
             }`}>
                [{log.type}]
             </span>
             <span className="text-slate-300 opacity-90">{log.content}</span>
          </div>
        ))}
      </div>

      {/* Status Bar */}
      <div className="p-3 border-t border-white/5 bg-white/2 flex items-center justify-between text-[8px] text-slate-500 uppercase tracking-tighter">
         <div className="flex gap-3">
            <div className="flex items-center gap-1"><Cpu size={10} /> HW_SECURE</div>
            <div className="flex items-center gap-1"><ShieldCheck size={10} /> ATTESTED</div>
         </div>
         <div className="flex items-center gap-1 opacity-50"><Eye size={10} /> READ_ONLY</div>
      </div>
    </div>
  );
}
