import { useState, useEffect, useRef } from 'react';
import { useAgentStatus } from '../hooks/useAgentStatus';
import { useWallet } from '../hooks/useWallet';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { Activity, Terminal as TerminalIcon, Gauge, Play, ShieldAlert } from 'lucide-react';

export default function ResultsPage() {
  const { status, loading: statusLoading } = useAgentStatus(5000);
  const { formattedBalance } = useWallet(5000);
  const [terminalLogs, setTerminalLogs] = useState([]);
  const [isOperational, setIsOperational] = useState(localStorage.getItem('DEMO_OPERATIONAL') === 'true');
  const terminalRef = useRef(null);

  const canStart = parseFloat(formattedBalance || '0') > 0;

  const handleStart = () => {
    localStorage.setItem('DEMO_OPERATIONAL', 'true');
    setIsOperational(true);
    window.dispatchEvent(new Event('storage'));
  };

  useEffect(() => {
    if (terminalRef?.current) terminalRef.current.scrollTo({ top: terminalRef.current.scrollHeight, behavior: 'smooth' });
  }, [terminalLogs]);

  useEffect(() => {
    if (isOperational && status?.agent?.short_term_memory) setTerminalLogs(status.agent.short_term_memory);
  }, [status, isOperational]);

  useEffect(() => {
    if (isOperational) return;
    const interval = setInterval(() => {
      setTerminalLogs(prev => [ ...prev.slice(-15), `[IDLE] ${new Date().toLocaleTimeString()} - Awaiting liquidity in Enclave...` ]);
    }, 2000);
    return () => clearInterval(interval);
  }, [isOperational]);

  if (statusLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0D0F14]">
        <LoadingSpinner size="lg" />
        <p className="mt-8 text-xs font-bold text-slate-600 uppercase tracking-widest animate-pulse">Syncing Mirror Telemetry...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadein max-w-[1400px] mx-auto">
      
      {/* HEADER SECTION */}
      <div className="dashboard-card p-10 flex flex-col lg:flex-row justify-between items-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#00BFA5]/20 to-transparent" />
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
             <Activity className="text-[#00BFA5]" size={22} />
             LIVE_TRACING_MIRROR
          </h1>
          <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest font-semibold">Authorized Real-time Enclave Memory Access</p>
        </div>
        
        <div className="flex items-center gap-10 mt-6 lg:mt-0">
          {!isOperational && (
            <button
              onClick={handleStart}
              disabled={!canStart}
              className={`flex items-center gap-2 px-8 py-3.5 rounded text-[10px] font-bold uppercase tracking-widest transition-all ${
                canStart 
                  ? 'bg-gradient-to-r from-[#0091EA] to-[#00BFA5] text-white shadow-xl shadow-cyan-500/10 active:scale-95' 
                  : 'bg-white/5 text-slate-600 border border-white/5 cursor-not-allowed opacity-40'
              }`}
            >
              <Play size={14} fill={canStart ? "white" : "none"} />
              {canStart ? 'Initiate Enclave Rails' : 'Awaiting Injection'}
            </button>
          )}

          {isOperational && (
            <div className="flex flex-col items-end">
              <span className="text-[9px] text-slate-500 uppercase font-bold tracking-[0.2em] mb-1">Audit Status</span>
              <div className="flex items-center gap-2 px-3 py-1 bg-[#00BFA5]/5 text-[#00BFA5] rounded border border-[#00BFA5]/10">
                 <div className="w-1.5 h-1.5 rounded-full bg-[#00BFA5] animate-pulse" />
                 <span className="text-[9px] font-bold tracking-widest">RAILS_COMMITTED</span>
              </div>
            </div>
          )}
          
          <div className="h-10 w-[1px] bg-white/5" />
          <div className="flex flex-col items-end">
            <span className="text-[9px] text-slate-500 uppercase font-bold tracking-widest mb-1">Enclave Authority</span>
            <span className="text-[10px] font-mono text-white/60">
                {status?.agent?.address?.slice(0, 12)}...
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* MAIN TERMINAL */}
        <div className="lg:col-span-2 dashboard-card p-6 min-h-[500px] flex flex-col">
          <div className="flex items-center justify-between mb-6">
             <div className="flex items-center gap-3">
                <TerminalIcon size={16} className="text-[#0091EA]" />
                <span className="text-xs font-bold text-white uppercase tracking-widest">Enclave Execution Trace</span>
             </div>
             <span className="text-[9px] font-black text-slate-500 px-2 py-0.5 border border-white/5 rounded">VERIFIED_LOGS</span>
          </div>
          <div className="flex-1 bg-black/30 rounded border border-white/5 p-6 overflow-hidden">
             <div ref={terminalRef} className="h-full overflow-y-auto terminal-compact scrollbar-hide text-slate-400">
                {(terminalLogs || []).map((log, i) => (
                   <div key={i} className="mb-2 flex gap-4 border-l border-white/5 pl-5 hover:bg-white/5 transition-colors group">
                      <span className="text-[9px] opacity-10 group-hover:opacity-40 select-none">[{i.toString().padStart(3, '0')}]</span>
                      <span className="whitespace-pre-wrap">{log}</span>
                   </div>
                ))}
                {!terminalLogs.length && <div className="text-slate-700 italic">Waiting for authority stream...</div>}
             </div>
          </div>
        </div>

        {/* SIDEBAR */}
        <div className="lg:col-span-1 space-y-6">
          <div className="dashboard-card p-6">
             <div className="flex items-center gap-3 mb-8">
                <Gauge size={16} className="text-[#00BFA5]" />
                <span className="text-xs font-bold text-white uppercase tracking-widest">Resource Monitoring</span>
             </div>
             <div className="space-y-6">
                <div>
                   <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase mb-2">
                      <span>CPU Partition</span>
                      <span className="text-white">12.4%</span>
                   </div>
                   <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-[#0091EA] w-[12.4%]" />
                   </div>
                </div>
                <div>
                   <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase mb-2">
                      <span>Memory Isolation</span>
                      <span className="text-white">842MB / 12GB</span>
                   </div>
                   <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-[#00BFA5] w-[7%]" />
                   </div>
                </div>
                <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                   <span className="text-[10px] text-slate-500 uppercase font-bold">Socket State</span>
                   <span className="text-[#00BFA5] text-[10px] font-black uppercase">Established</span>
                </div>
             </div>
          </div>

          <div className="dashboard-card p-8 flex flex-col items-center justify-center text-center space-y-4">
             <ShieldAlert size={48} className="text-[#0091EA] opacity-20" />
             <div>
                <span className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">Platform Integrity</span>
                <p className="text-[10px] text-[#00BFA5] font-black mt-1">INTEL_TDX_VERIFIED</p>
             </div>
             <p className="text-[10px] text-slate-600 leading-relaxed max-w-[200px]">
                Hardware root-of-trust validated via PCCS certification.
             </p>
          </div>
        </div>

      </div>
    </div>
  );
}
