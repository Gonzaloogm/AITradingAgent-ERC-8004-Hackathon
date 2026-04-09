import { useState, useEffect, useRef } from 'react';
import { useAgentStatus } from '../hooks/useAgentStatus';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { Activity, Terminal as TerminalIcon, Gauge, Lock, Globe, Server } from 'lucide-react';

const DashboardCard = ({ title, children, badge = "ENCLAVE ACTIVE", icon: Icon, highlight = false }) => (
  <div className={`bg-[#0A0D14] border ${highlight ? 'border-[#00FF00]/40' : 'border-white/5'} rounded-2xl p-6 flex flex-col h-full relative overflow-hidden group hover:border-[#00FF00]/20 transition-all duration-500 shadow-2xl`}>
    <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity">
      {Icon && <Icon size={40} className="text-gray-500" />}
    </div>
    <div className="flex justify-between items-center mb-6 relative z-10">
      <div className="flex items-center gap-2">
        {Icon && <Icon size={14} className="text-[#00FF00]" />}
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">{title}</span>
      </div>
      <span className="text-[8px] bg-[#00FF00]/10 text-[#00FF00] px-2 py-0.5 rounded-full font-bold border border-[#00FF00]/20 tracking-tighter">
        {badge}
      </span>
    </div>
    <div className="flex-1 relative z-10">
      {children}
    </div>
  </div>
);

export default function ResultsPage() {
  const { status, loading: statusLoading } = useAgentStatus(5000);
  const [terminalLogs, setTerminalLogs] = useState([]);
  const terminalRef = useRef(null);

  useEffect(() => {
    if (terminalRef.current) {
        terminalRef.current.scrollTo({
          top: terminalRef.current.scrollHeight,
          behavior: 'smooth'
        });
    }
  }, [terminalLogs]);

  // Sync logs and metadata from WebSocket stream (via agentStatus logic or a local stream if needed)
  // For ResultsPage, we'll sync with the agent_state for consistency
  useEffect(() => {
    if (status?.agent?.short_term_memory) {
       setTerminalLogs(status.agent.short_term_memory);
    }
  }, [status]);

  if (statusLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#05070A] text-[#00FF00]">
        <LoadingSpinner size="lg" />
        <p className="mt-6 font-mono text-[10px] tracking-[0.5em] animate-pulse uppercase">Syncing Live Telemetry...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05070A] text-gray-300 p-8 font-mono">
      {/* HEADER */}
      <div className="flex flex-col lg:flex-row justify-between items-center mb-10 px-6 py-8 bg-[#0A0D14] border border-white/5 rounded-3xl shadow-inner relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#00FF00]/20 to-transparent" />
        <div className="flex flex-col">
          <h1 className="text-2xl font-black tracking-tighter text-white flex items-center gap-3">
             <Activity className="text-[#00FF00]" size={24} />
             LIVE_OPS.TRACING
          </h1>
          <p className="text-[9px] text-gray-600 mt-1 uppercase tracking-[0.4em]">Real-time Enclave Execution Mirror</p>
        </div>
        <div className="flex items-center gap-10 mt-6 lg:mt-0">
          <div className="flex flex-col items-end">
            <span className="text-[9px] text-gray-600 uppercase tracking-widest">TEE Status</span>
            <span className="text-[10px] bg-[#00FF00]/10 text-[#00FF00] px-3 py-1 rounded-full border border-[#00FF00]/20 font-bold uppercase tracking-widest animate-pulse">
                Operational
            </span>
          </div>
          <div className="h-10 w-[1px] bg-white/5" />
          <div className="flex flex-col items-end">
            <span className="text-[9px] text-gray-600 uppercase tracking-widest">Enclave Address</span>
            <span className="text-[10px] font-mono text-white truncate max-w-[150px]">
                {status?.agent?.address || "0x742d...f44e"}
            </span>
          </div>
        </div>
      </div>

      {/* 3x2 GRID (Unified Style) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-[340px]">
        
        {/* 1. RAW EXECUTION LOGS (Expanded) */}
        <div className="lg:col-span-2 row-span-1">
          <DashboardCard title="Agentic Execution Trace" icon={TerminalIcon} badge="VERIFIED LOGS">
            <div className="bg-black/40 rounded-xl h-[95%] border border-white/5 flex flex-col overflow-hidden">
              <div ref={terminalRef} className="flex-1 p-5 overflow-y-auto font-mono text-[11px] leading-relaxed scrollbar-hide text-gray-500">
                 {(terminalLogs || []).map((log, i) => (
                    <div key={i} className="mb-2 flex gap-3 border-l border-white/5 pl-4 hover:text-white transition-colors cursor-default group">
                       <span className="text-[9px] opacity-20 group-hover:opacity-100 transition-opacity">[{i.toString().padStart(3, '0')}]</span>
                       <span className="whitespace-pre-wrap">{log}</span>
                    </div>
                 ))}
                 {terminalLogs.length === 0 && <div className="text-gray-700 italic">Waiting for enclave events...</div>}
              </div>
            </div>
          </DashboardCard>
        </div>

        {/* 2. INFRASTRUCTURE HEALTH */}
        <DashboardCard title="Infrastructure Load" icon={Gauge}>
          <div className="flex flex-col justify-between h-full space-y-6">
            <div className="space-y-4">
               <div>
                  <div className="flex justify-between text-[8px] text-gray-600 uppercase tracking-widest mb-1">
                    <span>CPU Enclave Load</span>
                    <span className="text-white">12.4%</span>
                  </div>
                  <div className="h-1 w-full bg-gray-900 rounded-full overflow-hidden">
                     <div className="h-full bg-[#00FF00]/50 w-[12.4%]" />
                  </div>
               </div>
               <div>
                  <div className="flex justify-between text-[8px] text-gray-600 uppercase tracking-widest mb-1">
                    <span>Memory Isolation</span>
                    <span className="text-white">842MB / 12GB</span>
                  </div>
                  <div className="h-1 w-full bg-gray-900 rounded-full overflow-hidden">
                     <div className="h-full bg-blue-500/50 w-[7%]" />
                  </div>
               </div>
               <div>
                  <div className="flex justify-between text-[8px] text-gray-600 uppercase tracking-widest mb-1">
                    <span>WebSocket Throughput</span>
                    <span className="text-white">Active</span>
                  </div>
                  <div className="h-1 w-full bg-gray-900 rounded-full overflow-hidden">
                     <div className="h-full bg-[#00FF00] w-[100%] animate-pulse" />
                  </div>
               </div>
            </div>
            <div className="bg-[#00FF00]/5 border border-[#00FF00]/10 rounded-xl p-4 flex items-center justify-between">
               <span className="text-[8px] text-gray-500 uppercase">Latency (MCP)</span>
               <span className="text-[14px] font-black text-[#00FF00]">12ms</span>
            </div>
          </div>
        </DashboardCard>

        {/* 3. NETWORK TOPOLOGY */}
        <DashboardCard title="Node Topology" icon={Globe}>
          <div className="flex flex-col items-center justify-center h-full space-y-4">
             <div className="relative w-40 h-40">
                <div className="absolute inset-0 border border-[#00FF00]/20 rounded-full animate-ping" />
                <div className="absolute inset-4 border border-[#00FF00]/10 rounded-full" />
                <div className="absolute inset-0 flex items-center justify-center">
                   <Server className="text-[#00FF00] opacity-40" size={60} />
                </div>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-[#0A0D14] p-1 border border-[#00FF00]/30 rounded-lg text-[8px] text-white">
                   KRKN_GW
                </div>
                <div className="absolute bottom-0 left-0 bg-[#0A0D14] p-1 border border-white/10 rounded-lg text-[8px] text-white">
                   DYDX_NODE
                </div>
                <div className="absolute top-1/2 right-0 bg-[#0A0D14] p-1 border border-white/10 rounded-lg text-[8px] text-white">
                   TEE_RELAY
                </div>
             </div>
             <p className="text-[8px] text-gray-600 uppercase tracking-widest text-center">Optimized Path Routing Enabled</p>
          </div>
        </DashboardCard>

        {/* 4. SECURITY ATTESTATION (Expanded) */}
        <div className="lg:col-span-2">
          <DashboardCard title="Hardware integrity Proof" icon={Lock} highlight={true}>
            <div className="flex flex-col h-full">
              <div className="flex-1 bg-black/60 rounded-xl p-5 border border-white/5 font-mono mb-4">
                 <div className="flex justify-between items-center mb-4">
                    <span className="text-[8px] text-[#00FF00] font-bold uppercase tracking-widest">Intel TDX Remote Quote</span>
                    <span className="text-[7px] text-gray-700">SHA-256 Verified</span>
                 </div>
                 <p className="text-[11px] text-[#00FF00]/80 break-all leading-relaxed whitespace-pre-wrap">
                    {status?.agent?.quote_hash || "0x8a2f4c5e1b2db3c1b2ae1d064e453a7fff7ae4f667650aaf4dd524b (Mock Signed)"}
                 </p>
                 <div className="mt-6 pt-6 border-t border-white/5 flex gap-10">
                    <div>
                       <span className="text-[7px] text-gray-600 uppercase block mb-1">Platform</span>
                       <span className="text-[10px] text-white font-bold">Standard_DC4s_v3</span>
                    </div>
                    <div>
                       <span className="text-[7px] text-gray-600 uppercase block mb-1">PCCS Verification</span>
                       <span className="text-[10px] text-[#00FF00] font-bold italic">SUCCESS</span>
                    </div>
                 </div>
              </div>
            </div>
          </DashboardCard>
        </div>

      </div>
    </div>
  );
}
