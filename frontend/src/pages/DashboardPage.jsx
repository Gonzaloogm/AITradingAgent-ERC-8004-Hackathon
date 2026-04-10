import { useState, useEffect, useRef } from 'react';
import { useWallet } from '../hooks/useWallet';
import { useAgentStatus } from '../hooks/useAgentStatus';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import PnLChart from '../components/agent/PnLChart';
import { Activity, ShieldCheck, BarChart3, Terminal as TerminalIcon, Gauge, Zap } from 'lucide-react';

const SignalCard = ({ label, value, signal, subValue, icon: Icon, active = false, status = "NEUTRAL" }) => (
  <div className={`dashboard-card p-5 flex flex-col justify-between h-full ${active ? 'arbitrage-glow-active' : ''}`}>
    <div className="flex justify-between items-start mb-4">
      <div className="flex items-center gap-2">
        {Icon && <Icon size={14} className={active ? 'text-[#00BFA5]' : 'text-slate-500'} />}
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</span>
      </div>
      <span className={`text-[9px] font-black px-2 py-0.5 rounded ${
        status === 'BUY' || status === 'OPPORTUNITY' ? 'bg-[#00BFA5]/10 text-[#00BFA5]' :
        status === 'SELL' ? 'bg-rose-500/10 text-rose-500' :
        'bg-slate-500/10 text-slate-500'
      }`}>
        [{status}]
      </span>
    </div>
    <div>
      <div className="text-2xl font-bold text-white tracking-tight mb-1">{value}</div>
      <div className="text-[10px] text-slate-500 font-medium">{subValue}</div>
    </div>
  </div>
);

export default function DashboardPage() {
  const { formattedBalance } = useWallet(5000);
  const [pnlHistory, setPnlHistory] = useState([{ time: 'Initial', value: 0.004245 }]);
  const [isOperational, setIsOperational] = useState(localStorage.getItem('DEMO_OPERATIONAL') === 'true');
  const { status, loading: statusLoading } = useAgentStatus(10000);

  const [agentState, setAgentState] = useState({
     last_spot_price: 64245.2, 
     last_perp_price: 64251.8,
     last_spread: 0.0102,
     is_ws: false
  });
  
  const [terminalLogs, setTerminalLogs] = useState([]);
  const terminalRef = useRef(null);

  useEffect(() => {
    const checkState = () => setIsOperational(localStorage.getItem('DEMO_OPERATIONAL') === 'true');
    window.addEventListener('storage', checkState);
    const interval = setInterval(checkState, 1000);
    return () => {
      window.removeEventListener('storage', checkState);
      clearInterval(interval);
    };
  }, []);

  // Sim
  useEffect(() => {
    if (agentState.is_ws) return;
    const interval = setInterval(() => {
      setAgentState(prev => {
        const vol = 0.0001; 
        const s = prev.last_spot_price * (1 + (Math.random() * vol * 2 - vol));
        const p = prev.last_perp_price * (1 + (Math.random() * vol * 2 - vol));
        return { ...prev, last_spot_price: s, last_perp_price: p, last_spread: Math.abs((p - s) / s * 100) };
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [agentState.is_ws]);

  useEffect(() => {
    if (terminalRef?.current) terminalRef.current.scrollTo({ top: terminalRef.current.scrollHeight, behavior: 'smooth' });
  }, [terminalLogs]);

  // WS
  useEffect(() => {
    let ws = null;
    const connect = () => {
      const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const host = isDev ? 'localhost:8000' : window.location.host;
      const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${host}/api/stream`;
      try {
        ws = new WebSocket(wsUrl);
        ws.onopen = () => setAgentState(prev => ({ ...prev, is_ws: true }));
        ws.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            setAgentState(prev => ({ ...prev, ...data }));
            if (data?.logs) setTerminalLogs(data.logs);
          } catch (err) {}
        };
        ws.onclose = () => {
            setAgentState(prev => ({ ...prev, is_ws: false }));
            setTimeout(connect, 5000);
        };
      } catch (e) { setTimeout(connect, 5000); }
    };
    connect();
    return () => ws && ws.close();
  }, []);

  if (statusLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0D0F14]">
        <LoadingSpinner size="lg" />
        <p className="mt-8 text-xs font-bold text-slate-600 uppercase tracking-widest animate-pulse">Establishing Secure Context...</p>
      </div>
    );
  }

  const hasOpportunity = agentState.last_spread > 0.02;

  return (
    <div className="space-y-6 animate-fadein max-w-[1400px] mx-auto">
      
      {/* ROW 1: SIGNAL SCANNER GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SignalCard 
          label="KRAKEN SPOT" 
          value={`$${agentState.last_spot_price?.toLocaleString(undefined, {minimumFractionDigits: 2})}`}
          subValue="BTC/USD MARKET"
          status={hasOpportunity ? "BUY" : "NEUTRAL"}
          icon={Zap}
          active={hasOpportunity}
        />
        <SignalCard 
          label="DYDX PERP" 
          value={`$${agentState.last_perp_price?.toLocaleString(undefined, {minimumFractionDigits: 2})}`}
          subValue="BTC-USD INV"
          status={hasOpportunity ? "SELL" : "NEUTRAL"}
          icon={Zap}
          active={hasOpportunity}
        />
        <SignalCard 
          label="NET SPREAD" 
          value={`${(agentState.last_spread || 0).toFixed(4)}%`}
          subValue="ARB MARGIN"
          status={hasOpportunity ? "OPPORTUNITY" : "SCANNING"}
          icon={Activity}
          active={hasOpportunity}
        />
        <SignalCard 
          label="ENCLAVE NAV" 
          value={`${formattedBalance} ETH`}
          subValue="TOTAL EQUITY"
          status="HEDGED"
          icon={ShieldCheck}
        />
      </div>

      {/* ROW 2: PERFORMANCE & AUDIT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LARGE CHART CONTAINER */}
        <div className="lg:col-span-2 dashboard-card p-0 overflow-hidden flex flex-col">
          <div className="flex justify-between items-center p-6 border-b border-white/5">
             <div className="flex items-center gap-3">
                <BarChart3 size={18} className="text-[#0091EA]" />
                <span className="text-xs font-bold text-white uppercase tracking-widest">Cumulative Strategy PnL</span>
             </div>
             <span className="text-[10px] text-slate-500 font-semibold px-2 py-1 bg-white/5 rounded">AUTHORIZED_VIEW_ONLY</span>
          </div>
          <div className="flex-1 p-6 h-[320px]">
            <PnLChart data={pnlHistory} />
          </div>
        </div>

        {/* TEE / LOGS SIDEBAR */}
        <div className="lg:col-span-1 space-y-6">
          <div className="dashboard-card p-6 h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
               <div className="flex items-center gap-3">
                  <TerminalIcon size={16} className="text-[#00BFA5]" />
                  <span className="text-xs font-bold text-white uppercase tracking-widest">Enclave Tracing</span>
               </div>
               <div className={`w-2 h-2 rounded-full ${isOperational ? 'bg-[#00BFA5] animate-pulse' : 'bg-amber-400'}`} />
            </div>
            <div className="flex-1 bg-black/20 rounded border border-white/5 p-4 overflow-hidden mb-4">
               <div ref={terminalRef} className="h-full overflow-y-auto terminal-compact scrollbar-hide">
                  {(terminalLogs || []).map((l, i) => (
                    <div key={i} className="mb-1 opacity-80 hover:opacity-100 transition-opacity whitespace-nowrap overflow-hidden text-ellipsis">
                      <span className="text-[#0091EA] mr-2">»</span> {l}
                    </div>
                  ))}
                  {!terminalLogs.length && <div className="italic opacity-40">Listening for enclave syscalls...</div>}
               </div>
            </div>
            <div className="space-y-3">
               <div className="flex justify-between text-[10px]">
                  <span className="text-slate-500 uppercase font-bold">Hardware Auth</span>
                  <span className="text-white font-mono">{status?.agent?.address?.slice(0, 8)}...</span>
               </div>
               <div className="flex justify-between text-[10px]">
                  <span className="text-slate-500 uppercase font-bold">Isolation</span>
                  <span className="text-[#00BFA5]">100% SECURE</span>
               </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
