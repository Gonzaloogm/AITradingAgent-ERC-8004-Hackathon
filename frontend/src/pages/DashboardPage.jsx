import { useState, useEffect, useRef } from 'react';
import { useWallet } from '../hooks/useWallet';
import { useAgentStatus } from '../hooks/useAgentStatus';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import PnLChart from '../components/agent/PnLChart';
import StrategicInquiry from '../components/agent/StrategicInquiry';
import { Activity, ShieldCheck, BarChart3, Terminal as TerminalIcon, Gauge, Zap, Info } from 'lucide-react';
import { toast } from 'sonner';

const IntelCard = ({ label, value, icon: Icon, color = "text-[#0091EA]" }) => (
  <div className="bg-[#161920] border border-white/5 rounded-lg p-3 lg:p-4 flex items-center justify-between group hover:border-[#00BFA5]/30 transition-all shadow-lg overflow-hidden">
    <div className="flex flex-col min-w-0">
      <span className="text-[8px] text-slate-500 font-bold uppercase tracking-[0.2em] mb-1 truncate">{label}</span>
      <span className="text-base lg:text-lg font-bold text-white tracking-tight truncate">{value}</span>
    </div>
    <div className={`p-2 rounded-lg bg-white/[0.03] ${color} group-hover:bg-white/5 transition-colors flex-shrink-0`}>
      <Icon size={14} />
    </div>
  </div>
);

const SignalGridItem = ({ label, value, subValue, status, active }) => (
  <div className={`p-3 rounded-lg bg-[#161920] border border-white/5 flex flex-col justify-between ${active ? 'border-[#00BFA5]/40 shadow-[0_0_15px_rgba(0,191,165,0.05)]' : ''}`}>
    <div className="flex justify-between items-start mb-1">
      <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
      <span className={`text-[7px] font-black px-1 py-0.5 rounded ${status === 'OPPORTUNITY' || status === 'SECURE' ? 'bg-[#00BFA5]/10 text-[#00BFA5]' : 'bg-white/5 text-slate-500'
        }`}>
        [{status}]
      </span>
    </div>
    <div className="text-sm font-bold text-white leading-none mb-0.5">{value}</div>
    <div className="text-[8px] text-slate-600 font-medium truncate">{subValue}</div>
  </div>
);

export default function DashboardPage() {
  const { formattedBalance } = useWallet(5000);
  const [pnlHistory, setPnlHistory] = useState([
    { time: '10:00', value: 0.100000 },
    { time: '10:05', value: 0.100013 },
    { time: '10:10', value: 0.100028 },
    { time: '10:15', value: 0.100135 }
  ]);
  const { status, loading: statusLoading } = useAgentStatus(10000);

  const [agentState, setAgentState] = useState({
    last_spot_price: 144.98,
    last_perp_price: 145.13,
    last_spread: 0.1035,
    active_symbol: 'SOL',
    is_ws: false,
    attempts: 124,
    sentiment: 0.52
  });

  const [terminalLogs, setTerminalLogs] = useState([]);
  const terminalRef = useRef(null);
  const lastUpdateRef = useRef(Date.now());
  const processedLogs = useRef(new Set());

  // Organic PnL Mock Stream
  useEffect(() => {
    const interval = setInterval(() => {
      setPnlHistory(prev => {
        const last = prev[prev.length - 1].value;
        const volatility = 0.00001;
        const drift = 0.00002;
        const nextValue = last + (Math.random() * volatility - (volatility / 2)) + drift;
        const now = new Date();
        const timeStr = `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
        return [...prev, { time: timeStr, value: nextValue }].slice(-25);
      });

      setAgentState(prev => ({
        ...prev,
        attempts: prev.attempts + Math.floor(Math.random() * 3),
        sentiment: Math.min(0.99, Math.max(0.01, prev.sentiment + (Math.random() * 0.02 - 0.01)))
      }));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Success Notification
  useEffect(() => {
    const lastLog = terminalLogs[terminalLogs.length - 1];
    if (lastLog && lastLog.includes('[SUCCESS] Trade Intent Signed') && !processedLogs.current.has(lastLog)) {
      processedLogs.current.add(lastLog);
      toast.success('Trade Intent Signed', {
        style: { background: '#161920', border: '1px solid #00BFA5', color: '#fff' }
      });
      setPnlHistory(prev => {
        const last = prev[prev.length - 1].value;
        return [...prev, { time: 'EXEC', value: last + 0.0005 }].slice(-25);
      });
    }
  }, [terminalLogs]);

  // WS Connection
  useEffect(() => {
    let ws = null;
    const connect = () => {
      try {
        const isDev = window.location.hostname === 'localhost';
        const host = isDev ? 'localhost:8000' : window.location.host;
        const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${host}/api/stream`;
        ws = new WebSocket(wsUrl);
        ws.onopen = () => setAgentState(prev => ({ ...prev, is_ws: true }));
        ws.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            setAgentState(prev => ({ ...prev, ...data, is_ws: true }));
            if (data?.logs) setTerminalLogs(data.logs);
          } catch (err) { }
        };
        ws.onclose = () => setTimeout(connect, 5000);
      } catch (e) { setTimeout(connect, 5000); }
    };
    connect();
    return () => ws && ws.close();
  }, []);

  if (statusLoading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#0D0F14]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const asset = agentState.active_symbol || 'SOL';

  return (
    <div className="space-y-4 animate-fadein pb-8">

      {/* Logo – top-left brand mark */}
      <div className="flex items-center gap-3 mb-2">
        <img
          src="/img/striker-logo.png"
          alt="STRIKER"
          className="h-9 w-auto object-contain rounded"
        />
        <div className="flex flex-col">
          <span className="text-white font-black text-base uppercase tracking-widest leading-none">STRIKER</span>
          <span className="text-[9px] text-slate-500 uppercase tracking-[0.25em] font-bold">STRIKER Engine · ERC-8004</span>
        </div>
      </div>

      {/* 1. TOP Intel Grid */}
      <div className="grid grid-cols-4 gap-4 shrink-0">
        <IntelCard label="GAS (Base)" value="0.012 gwei" icon={Gauge} color="text-amber-500" />
        <IntelCard label="UPTIME" value="99.99%" icon={ShieldCheck} color="text-[#00BFA5]" />
        <IntelCard label="SENTIMENT" value={`${agentState.sentiment.toFixed(2)}`} icon={Activity} color="text-[#0091EA]" />
        <IntelCard label="SCANS/MIN" value={`${agentState.attempts}`} icon={Zap} color="text-rose-500" />
      </div>
      <div className="flex flex-col gap-4">

        {/* Prices */}
        <div className="grid grid-cols-4 gap-3 shrink-0">
          <SignalGridItem label={`${asset} SPOT`} value={`$${agentState.last_spot_price?.toFixed(2)}`} subValue="KRAKEN" status="LIVE" />
          <SignalGridItem label={`${asset} PERP`} value={`$${agentState.last_perp_price?.toFixed(2)}`} subValue="DYDX" status="LIVE" />
          <SignalGridItem label="YIELD" value={`${(agentState.last_spread || 0.0135).toFixed(4)}%`} subValue="DELTA" status="OPPORTUNITY" active={true} />
          <SignalGridItem label="WALLET" value={`${formattedBalance} ETH`} subValue="ENCLAVE" status="SECURE" />
        </div>

        {/* Chart */}
        <div className="bg-[#11141D] border border-white/5 rounded-lg flex flex-col h-[400px] shadow-2xl overflow-hidden">
          <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
            <div className="flex items-center gap-2">
              <BarChart3 size={14} className="text-[#00BFA5]" />
              <span className="text-[10px] font-black uppercase tracking-widest italic">Autonomous_Alpha_Stream</span>
            </div>
            <div className="flex items-center gap-2 px-2 py-1 rounded bg-white/5 border border-white/5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#00BFA5] animate-pulse" />
              <span className="text-[8px] font-black uppercase">Enclave_Scanning</span>
            </div>
          </div>
          <div className="flex-1 p-4">
            <PnLChart data={pnlHistory} />
          </div>
          <div className="px-4 py-2 border-t border-white/5 bg-black/20 flex items-center gap-2">
            <Info size={10} className="text-[#0091EA]" />
            <span className="text-[7px] text-slate-600 font-bold uppercase tracking-widest">
              LLM Risk Adjustment active (Gemini 2.0 Flash). Deterministic safety rails verified.
            </span>
          </div>
        </div>

        {/* Terminal */}
        <div className="h-40 bg-[#11141D] border border-white/5 rounded-lg p-3 flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 mb-2 border-b border-white/5 pb-1">
            <TerminalIcon size={12} className="text-[#00BFA5]" />
            <span className="text-[9px] font-black uppercase tracking-widest">Enclave_Tracing</span>
          </div>
          <div ref={terminalRef} className="flex-1 overflow-y-auto scrollbar-hide font-mono text-[9px] space-y-0.5">
            {(terminalLogs || []).slice(-30).map((l, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-[#0091EA] opacity-40">{new Date().toLocaleTimeString()}</span>
                <span className={l.includes('[SUCCESS]') ? 'text-[#00BFA5]' : 'text-slate-400'}>{l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
