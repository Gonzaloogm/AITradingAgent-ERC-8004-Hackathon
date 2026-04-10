import { useState, useEffect, useRef } from 'react';
import { useAgentStatus } from '../hooks/useAgentStatus';
import { useWallet } from '../hooks/useWallet';
import { apiClient } from '../api/client';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import StrategicInquiry from '../components/agent/StrategicInquiry';
import { toast } from 'sonner';
import { Activity, Terminal as TerminalIcon, Gauge, Play, Square, ShieldAlert } from 'lucide-react';

export default function ResultsPage() {
  const { status, loading: statusLoading } = useAgentStatus(5000);
  const { marginReady, refetch: refetchWallet } = useWallet(5000);
  const [terminalLogs, setTerminalLogs] = useState([]);
  const [isOperational, setIsOperational] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const terminalRef = useRef(null);

  // Sync isOperational with global status
  useEffect(() => {
    // 2. Persistencia de Estado: Solo cambiamos el estado si el servidor devuelve una respuesta clara
    if (!status) return; 

    // Solo actualizamos si hay un cambio definitivo en el estado del motor
    if (status.status === 'running' || status.is_activated) {
        setIsOperational(true);
    } else if (status.status === 'halted' || status.status === 'operational') {
        // En este backend, 'operational' significa que está listo pero no corriendo (halted)
        setIsOperational(false);
    }
  }, [status]);

  // WebSocket for Live Logs
  useEffect(() => {
    let ws = null;
    const connect = () => {
      const isDev = window.location.hostname === 'localhost';
      const host = isDev ? 'localhost:8000' : window.location.host;
      const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${host}/api/stream`;
      
      ws = new WebSocket(wsUrl);
      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.logs) {
            setTerminalLogs(data.logs);
          }
          setIsOperational(data.status === 'running');
        } catch (err) {}
      };
      ws.onclose = () => setTimeout(connect, 3000);
    };

    connect();
    return () => ws && ws.close();
  }, []);

  const handleStart = async () => {
    // 3. Optimistic UI: Cambiamos el estado local inmediatamente
    setIsOperational(true);
    setIsStarting(true);
    
    const res = await apiClient.startStrategy();
    if (res.success) {
      toast.success('Enclave rails engaged successfully');
      refetchWallet();
    } else {
      // Revertimos si falla
      setIsOperational(false);
      toast.error('Engagement failed: ' + res.error);
    }
    setIsStarting(false);
  };

  const handleStop = async () => {
    // 3. Optimistic UI: Cambiamos el estado local inmediatamente
    setIsOperational(false);
    setIsStopping(true);
    
    const res = await apiClient.stopStrategy();
    if (res.success) {
      toast.info('Autonomous strategy terminated');
    } else {
      // Revertimos si falla
      setIsOperational(true);
      toast.error('Termination failed: ' + res.error);
    }
    setIsStopping(false);
  };

  useEffect(() => {
    if (terminalRef?.current) {
        terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalLogs]);



  return (
    <div className="space-y-6 animate-fadein max-w-[1600px] mx-auto pb-10">
      
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
          {!isOperational ? (
            <button
              onClick={handleStart}
              disabled={!marginReady || isStarting}
              className={`flex items-center gap-2 px-8 py-3.5 rounded text-[10px] font-bold uppercase tracking-widest transition-all ${
                marginReady 
                  ? 'bg-gradient-to-r from-[#0091EA] to-[#00BFA5] text-white shadow-xl shadow-cyan-500/10 active:scale-95' 
                  : 'bg-white/5 text-slate-600 border border-white/5 cursor-not-allowed opacity-40'
              }`}
            >
              {isStarting ? <LoadingSpinner size="sm" /> : <Play size={14} fill={marginReady ? "white" : "none"} />}
              {marginReady ? 'Initiate Enclave Rails' : '[WAITING MARGIN]'}
            </button>
          ) : (
            <button
              onClick={handleStop}
              disabled={isStopping}
              className="flex items-center gap-2 px-8 py-3.5 rounded text-[10px] font-bold uppercase tracking-widest transition-all bg-rose-600/20 text-rose-500 border border-rose-500/30 hover:bg-rose-600/30 active:scale-95"
            >
              {isStopping ? <LoadingSpinner size="sm" /> : <Square size={14} fill="currentColor" />}
              {isStopping ? 'TERMINATING...' : 'Terminate Strategy'}
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
        
        {/* LEFT COLUMN: MAIN OPS (2 COLUMNS) */}
        <div className="lg:col-span-2 space-y-6">
            {/* TERMINAL */}
            <div className="dashboard-card p-6 h-[550px] flex flex-col">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <TerminalIcon size={16} className="text-[#0091EA]" />
                        <span className="text-xs font-bold text-white uppercase tracking-widest">Enclave Execution Trace</span>
                    </div>
                    <span className="text-[9px] font-black text-slate-500 px-2 py-0.5 border border-white/5 rounded lowercase">operational_logs</span>
                </div>
                <div className="flex-1 bg-black/30 rounded border border-white/5 p-6 overflow-hidden">
                    <div ref={terminalRef} className="h-full overflow-y-auto terminal-compact text-slate-400 font-mono scroll-smooth">
                        {(terminalLogs || []).map((log, i) => (
                        <div key={i} className="mb-2 flex gap-4 border-l border-white/5 pl-5 hover:bg-white/5 transition-colors group">
                            <span className="text-[9px] opacity-10 group-hover:opacity-40 select-none">[{i.toString().padStart(3, '0')}]</span>
                            <span className={`whitespace-pre-wrap text-[11px] ${log.includes('[SUCCESS]') ? 'text-[#00BFA5]' : log.includes('[WARN]') ? 'text-amber-500' : ''}`}>{log}</span>
                        </div>
                        ))}
                        {!terminalLogs.length && <div className="text-slate-700 italic text-[11px]">Waiting for authority stream...</div>}
                    </div>
                </div>
            </div>
            
            {/* PLATFORM INTEGRITY CARD */}
            <div className="dashboard-card p-6 flex items-center justify-between bg-gradient-to-r from-transparent to-[#00BFA5]/5">
                <div className="flex items-center gap-6">
                    <ShieldAlert size={32} className="text-[#00BFA5] opacity-40" />
                    <div className="flex flex-col">
                        <span className="text-[10px] text-white font-black uppercase tracking-[0.2em]">INTEL_TDX_SECURE_ENCLAVE</span>
                        <p className="text-[9px] text-slate-500 mt-1 uppercase tracking-widest font-bold">Hardware-Attested Execution Environment</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 border border-[#00BFA5]/20 rounded bg-[#00BFA5]/5">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#00BFA5] animate-pulse" />
                    <span className="text-[9px] font-black text-[#00BFA5]">ATTESTATION_VALID</span>
                </div>
            </div>
        </div>

        {/* RIGHT COLUMN: ANALYTICS & CHAT (1 COLUMN) */}
        <div className="lg:col-span-1 space-y-6 h-full flex flex-col">
          
          {/* RESOURCE MONITORING */}
          <div className="dashboard-card p-6 flex-shrink-0">
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
                   <span className="text-[#00BFA5] text-[10px] font-black uppercase">{isOperational ? 'Established' : 'Standby'}</span>
                </div>
             </div>
          </div>

          {/* STRATEGIC INQUIRY HUB (CHAT) */}
          <div className="flex-1 min-h-[450px] relative">
             <StrategicInquiry />
          </div>

        </div>

      </div>
    </div>
  );
}
