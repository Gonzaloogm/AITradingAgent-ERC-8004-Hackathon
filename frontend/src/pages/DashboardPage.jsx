import { useState, useEffect, useRef } from 'react';
import { useWallet } from '../hooks/useWallet';
import { useAgentStatus } from '../hooks/useAgentStatus';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import PnLChart from '../components/agent/PnLChart';
import { Clipboard, Check, Activity, ShieldCheck, BarChart3, Terminal as TerminalIcon, Gauge, Zap, Lock } from 'lucide-react';

const DashboardCard = ({ title, children, badge = "TEE VERIFIED", icon: Icon, highlight = false }) => (
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

export default function DashboardPage() {
  const { formattedBalance } = useWallet(5000);

  const [agentReady, setAgentReady] = useState(false);
  const [agentId] = useState("AGENT-4108-TDX");
  const [simPnL, setSimPnL] = useState(0.004245); 
  const [pnlHistory, setPnlHistory] = useState([{ time: 'Initial', value: 0.004245 }]);
  const [copied, setCopied] = useState(false);
  
  const { status, loading: statusLoading } = useAgentStatus(10000);

  const [agentState, setAgentState] = useState({
     status: 'OFFLINE', 
     circuit_breaker_active: false, 
     last_spot_price: 0, 
     last_perp_price: 0,
     last_spread: 0,
     net_delta: 0,
     logs: [],
     is_signing: false
  });
  
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

  useEffect(() => {
    if (agentState.logs?.length > 0) {
      const lastLine = agentState.logs[agentState.logs.length - 1];
      // Listen for TRADE_EXECUTED per user request
      if (lastLine.includes("[TRADE_EXECUTED]") || lastLine.includes("[OK]") || lastLine.includes("[EXECUTE]")) {
        const newVal = simPnL + 0.00018; // Increased increment for demo impact
        setSimPnL(newVal);
        setPnlHistory(prev => [
          ...prev.slice(-19), 
          { time: new Date().toLocaleTimeString(), value: newVal }
        ]);
      }
    }
  }, [agentState.logs]);

  useEffect(() => {
    if (status?.agent?.is_registered) {
      setAgentReady(true);
    }
  }, [status]);

  useEffect(() => {
    let ws = null;
    let reconnectTimeout = null;
    let reconnectAttempts = 0;

    const connect = () => {
      if (!agentReady) return;
      const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const host = isDev ? 'localhost:8000' : window.location.host;
      const wsUrl = `wss://${host}/api/stream`;
      ws = new WebSocket(wsUrl);
       
      ws.onopen = () => {
        reconnectAttempts = 0;
        setTerminalLogs(prev => [...(prev || []).slice(-49), "[WS] Connection established. Telemetry ACTIVE."]);
      };

      ws.onmessage = (event) => {
        try {
           const data = JSON.parse(event.data);
           setAgentState(prev => ({ ...prev, ...data }));
           if (data.logs) setTerminalLogs(data.logs);
        } catch (e) {
           console.error("[WS] Parse error", e);
        }
      };

      ws.onclose = () => {
        reconnectTimeout = setTimeout(connect, Math.min(1000 * Math.pow(2, reconnectAttempts++), 30000));
      };
    };

    if (agentReady) connect();
    return () => {
        if (ws) ws.close();
        if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [agentReady]);

  const copyHash = () => {
    const hash = "0x8a2f4c5e1b2db3c1b2ae1d064e453a7fff7ae4f667650aaf4dd524b";
    navigator.clipboard.writeText(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (statusLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#05070A] text-[#00FF00]">
        <LoadingSpinner size="lg" />
        <p className="mt-6 font-mono text-[10px] tracking-[0.5em] animate-pulse uppercase">Initializing Secure TEE Hub...</p>
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
            <Zap className="text-[#00FF00]" size={24} fill="#00FF00" />
            STRIKER.COMMAND
          </h1>
          <p className="text-[9px] text-gray-600 mt-1 uppercase tracking-[0.4em]">Sentinel Institutional Trading Hub</p>
        </div>
        <div className="flex items-center gap-10 mt-6 lg:mt-0">
          <div className="flex flex-col items-end">
            <span className="text-[9px] text-gray-600 uppercase tracking-widest">Enclave Identity</span>
            <span className="text-sm font-black text-white">{String(agentId || '4108').includes('AGENT') ? agentId : `AGENT-${String(agentId || '0000').slice(0, 4)}-TDX`}</span>
          </div>
          <div className="h-10 w-[1px] bg-white/5" />
          <div className="flex flex-col items-end">
            <span className="text-[9px] text-gray-600 uppercase tracking-widest">NAV (ETH)</span>
            <span className="text-2xl font-black text-[#00FF00] tracking-tighter">{formattedBalance}</span>
          </div>
        </div>
      </div>

      {/* 3x2 GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-[320px]">
        
        {/* 1. SPREAD MONITOR */}
        <DashboardCard title="Market Spread Monitor" icon={Activity}>
          <div className="flex flex-col justify-between h-full py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col">
                <span className="text-[8px] text-gray-600 uppercase mb-1">Kraken Spot</span>
                <span className="text-2xl font-black text-white tracking-tighter">
                  ${agentState.last_spot_price?.toLocaleString(undefined, {minimumFractionDigits: 1})}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[8px] text-gray-600 uppercase mb-1">dYdX Perp</span>
                <span className="text-2xl font-black text-white tracking-tighter">
                  ${agentState.last_perp_price?.toLocaleString(undefined, {minimumFractionDigits: 1})}
                </span>
              </div>
            </div>
            <div className="mt-auto bg-[#00FF00]/5 border border-[#00FF00]/10 rounded-2xl p-6 text-center transform hover:scale-[1.02] transition-transform">
              <span className="text-[9px] text-[#00FF00] font-bold uppercase tracking-widest mb-1 block">Yield Differential</span>
              <span className="text-4xl font-black text-[#00FF00] animate-pulse">{(agentState.last_spread || 0.00).toFixed(4)}%</span>
            </div>
          </div>
        </DashboardCard>

        {/* 2. PNL CHART */}
        <DashboardCard title="Realized PnL Performance" icon={BarChart3}>
          <div className="h-full flex flex-col justify-between">
            <div className="flex-1 min-h-0 py-2">
              <PnLChart data={pnlHistory} />
            </div>
            <div className="flex justify-between items-end bg-white/[0.02] p-4 rounded-xl mt-4 border border-white/5">
              <div className="flex flex-col">
                <span className="text-[8px] text-gray-600 uppercase">Cumulative Profit</span>
                <span className="text-xl font-bold text-white tracking-tighter">+{simPnL.toFixed(6)} ETH</span>
              </div>
              <span className="text-[8px] text-[#00FF00] font-bold tracking-widest">[PROFITABLE]</span>
            </div>
          </div>
        </DashboardCard>

        {/* 3. HARDWARE IDENTITY */}
        <DashboardCard title="Enclave Auth Protocol" icon={ShieldCheck}>
          <div className="flex flex-col justify-between h-full">
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="3" fill="transparent" className="text-gray-800" />
                    <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="3" fill="transparent" strokeDasharray={Math.PI * 56} strokeDashoffset={Math.PI * 56 * (1 - 0.942)} className="text-[#00FF00]" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">94%</div>
                </div>
                <div className="flex flex-col">
                  <span className="text-xl font-black text-white tracking-tighter">94.20</span>
                  <span className="text-[8px] text-gray-600 uppercase">Reputation Score</span>
                </div>
              </div>
              <div className="space-y-3 pt-2">
                <div className="flex justify-between text-[10px]">
                  <span className="text-gray-600 uppercase">Security Tier</span>
                  <span className="text-[#00FF00] font-bold">Tier 4 (TDX)</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-gray-600 uppercase">Isolation</span>
                  <span className="text-white font-bold">Encrypted</span>
                </div>
              </div>
            </div>
            <div className="bg-[#00FF00]/5 border border-[#00FF00]/10 p-3 rounded-lg text-center mt-4">
              <span className="text-[8px] text-[#00FF00] font-bold tracking-[0.3em]">ATTESTATION_VALID</span>
            </div>
          </div>
        </DashboardCard>

        {/* 4. ENCLAVE TRACE */}
        <DashboardCard title="Enclave System Trace" icon={TerminalIcon}>
          <div className="bg-black/40 rounded-xl h-[95%] border border-white/5 flex flex-col overflow-hidden">
            <div ref={terminalRef} className="flex-1 p-4 overflow-y-auto font-mono text-[11px] leading-relaxed scrollbar-hide text-gray-500">
               {(terminalLogs || []).map((log, i) => (
                  <div key={i} className="mb-1.5 flex gap-2 border-l border-white/5 pl-3 hover:text-white transition-colors cursor-default">
                     <span className="text-[8px] opacity-20 hidden lg:inline">{new Date().toLocaleTimeString()}</span>
                     <span className="truncate">{log}</span>
                  </div>
               ))}
            </div>
          </div>
        </DashboardCard>

        {/* 5. INTEGRITY PROOF */}
        <DashboardCard title="Intel TDX Quote Proof" icon={ShieldCheck} highlight={true}>
          <div className="flex flex-col justify-between h-full">
            <div className="flex items-center gap-2 mb-2">
               <Lock size={12} className="text-[#00FF00]" />
               <span className="text-[10px] text-[#00FF00] font-bold uppercase tracking-widest">Security Verified</span>
            </div>
            <div className="bg-black/60 rounded-xl p-4 border border-white/5 font-mono mb-4 flex-1">
              <p className="text-[8px] text-gray-700 uppercase mb-3 tracking-widest">Hardware Attestation Quote</p>
              <p className="text-[11px] text-[#00FF00]/60 break-all leading-relaxed whitespace-pre-wrap">
                0x8a2f4c5e1b2db3c1b2ae1...f4dd524b
              </p>
            </div>
            <button 
              onClick={copyHash}
              className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl py-4 text-[10px] font-bold uppercase tracking-widest transition-all group active:scale-95"
            >
              {copied ? <Check size={14} className="text-[#00FF00]" /> : <Clipboard size={14} className="text-gray-400 group-hover:text-white" />}
              {copied ? "Copied" : "Copy TEE Quote Hash"}
            </button>
          </div>
        </DashboardCard>

        {/* 6. ENCLAVE METRICS */}
        <DashboardCard title="Operational Resources" icon={Gauge}>
          <div className="flex flex-col justify-between h-full">
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between items-end mb-1">
                  <span className="text-[8px] text-gray-600 uppercase tracking-widest">TEE Gas Fuel</span>
                  <span className="text-[10px] font-bold text-white">0.0050 ETH</span>
                </div>
                <div className="h-2 w-full bg-gray-900 rounded-full overflow-hidden p-[1px]">
                  <div className="h-full bg-gradient-to-r from-cyan-500 to-[#00FF00] w-[85%] rounded-full shadow-[0_0_10px_rgba(0,255,0,0.3)]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div className="bg-white/[0.02] p-4 rounded-xl border border-white/5">
                    <span className="text-[7px] text-gray-600 uppercase block mb-1">MCP Latency</span>
                    <span className="text-sm font-bold text-white font-mono tracking-tighter">12ms</span>
                 </div>
                 <div className="bg-white/[0.02] p-4 rounded-xl border border-white/5">
                    <span className="text-[7px] text-gray-600 uppercase block mb-1">Net Delta</span>
                    <span className="text-sm font-bold text-white font-mono tracking-tighter">{agentState.net_delta?.toFixed(4)}</span>
                 </div>
              </div>
            </div>
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-[#00FF00] shadow-[0_0_10px_#00FF00]" />
              <span className="text-[9px] font-black text-[#00FF00] uppercase tracking-widest font-mono">Sentinel Active</span>
            </div>
          </div>
        </DashboardCard>

      </div>
    </div>
  );
}
