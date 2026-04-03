import { useState, useEffect, useRef } from 'react';
import GlassCard from '../components/ui/GlassCard';

// --- Log Templates (from dashboard-live.js) ---
const logTemplates = [
  { sys: '[PRISM-API]', type: 'prism', msgs: [
    'Resolved intent asset "WBTC" to canonical → [BITCOIN:0x...]',
    'Fetching L2 liquidity depth for cbBTC/USD',
    'Symbol collision avoided (97% Confidence).',
  ]},
  { sys: '[KRAKEN-MCP]', type: 'kraken', msgs: [
    'Evaluating Delta-neutral spread (Spot vs Perp)',
    'Circuit Breaker Check: Volatility 1.2% (SAFE)',
    'Submitting trade intent... Execution 32ms.',
    'Error HTTP 429: Rate Limit. Utilizing MCP Error Envelope fallback.',
  ]},
  { sys: '[TDX-ENV]', type: 'tee', msgs: [
    'Generating Intel TDX Quote for state validation...',
    'Attestation signed with derived EIP-1271 key.',
    'SHA-256 Hash matches RedPill inference manifest.',
  ]},
  { sys: '[X402-NET]', type: 'x402', msgs: [
    'Intercepted 402 PAYMENT-REQUIRED from external Oracle.',
    'Cost evaluating... 0.05 USDC is within threshold.',
    'Signing payload and dispensing micropayment via Base L2.',
    'Access Granted. Data synchronized.',
  ]},
  { sys: '[ERC-8004]', type: 'tee', msgs: [
    'Pushing Reputation Feedback to Identity Registry.',
    'Validation artifact uploaded to Sandbox.',
    'Smart Contract Event emitted: TradeVerified()',
  ]},
];

const TYPE_COLOR = {
  prism:  'text-purple-400',
  kraken: 'text-sky-400',
  tee:    'text-emerald-400',
  x402:   'text-yellow-400',
};

function randomLog() {
  const t = logTemplates[Math.floor(Math.random() * logTemplates.length)];
  const msg = t.msgs[Math.floor(Math.random() * t.msgs.length)];
  const time = new Date().toISOString().split('T')[1].slice(0, -1);
  return { sys: t.sys, type: t.type, msg, time, id: Math.random() };
}

function KPICard({ label, value, sub, subColor = 'text-gray-500', glowColor }) {
  return (
    <GlassCard className="!p-5">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">{label}</p>
      <h3 className={`text-2xl font-bold mb-1 ${glowColor || 'text-white'}`}>{value}</h3>
      <p className={`text-xs font-mono ${subColor}`}>{sub}</p>
    </GlassCard>
  );
}

export default function ResultsPage() {
  const [logs, setLogs] = useState([]);
  const [pnl, setPnl]   = useState(1452.80);
  const [x402, setX402] = useState(284);
  const [latency, setLatency] = useState(24);
  const [sharpe]        = useState(3.24);
  const [drawdown]      = useState(1.8);
  const logsEndRef = useRef(null);

  useEffect(() => {
    // Init with 6 logs
    setLogs(Array.from({ length: 6 }, randomLog));

    const logInterval = setInterval(() => {
      setLogs(prev => {
        const next = [...prev, randomLog()];
        return next.length > 14 ? next.slice(next.length - 14) : next;
      });
    }, 1200);

    const metricsInterval = setInterval(() => {
      setLatency(Math.floor(Math.random() * 15 + 15));
      if (Math.random() > 0.5) {
        setPnl(prev => prev + (Math.random() * 2 - 0.5));
        if (Math.random() > 0.8) setX402(prev => +(prev + 0.05).toFixed(2));
      }
    }, 3000);

    return () => { clearInterval(logInterval); clearInterval(metricsInterval); };
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <GlassCard className="!py-4 !px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, #00f3ff, #9d00ff)',
              boxShadow: '0 0 20px rgba(0,243,255,0.4)',
              animation: 'orbPulse 3s ease-in-out infinite alternate',
            }}
          />
          <div>
            <h1 className="text-xl font-extrabold gradient-text tracking-widest">AI TRADING AGENT</h1>
            <p className="text-xs text-gray-500 font-mono">Hackathon Capital Sandbox | Delta-Neutral Strategy</p>
          </div>
        </div>
        <div className="flex items-center flex-wrap gap-2">
          <div className="flex items-center gap-2 bg-black/40 border border-white/[0.08] rounded-lg px-3 py-2 font-mono text-xs">
            <span className="pulse-dot green" />
            Intel TDX Enrolled
          </div>
          <div className="bg-black/40 border border-white/[0.08] rounded-lg px-3 py-2 font-mono text-xs text-gray-300">
            ⟠ ETH Sepolia
          </div>
        </div>
      </GlassCard>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Identity + KPIs */}
        <div className="space-y-4">
          {/* Identity Card */}
          <GlassCard>
            <h2 className="text-sm font-semibold uppercase tracking-widest cyan-text mb-5">ERC-8004 Identity</h2>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">AGENT ID</p>
                <p className="tech-mono text-sm">#4092-B7A1</p>
              </div>
              <div className="border-t border-white/[0.05] pt-4">
                <p className="text-xs text-gray-500 mb-1">WALLET (EIP-1271)</p>
                <p className="tech-mono text-xs glow-text break-all text-gray-200">
                  0x742d35Cc6634C0532925a3b844Bc454e4438f44e
                </p>
              </div>
              <div className="border-t border-white/[0.05] pt-4">
                <div className="flex justify-between mb-2">
                  <span className="text-xs text-gray-500">REPUTATION SCORE</span>
                  <span className="text-xs cyan-text font-bold">94.2%</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: '94.2%' }} />
                </div>
              </div>
            </div>
          </GlassCard>

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3">
            <KPICard
              label="Kraken PnL (Net)"
              value={`+$${pnl.toFixed(2)}`}
              sub="▲ 12.4% 24h"
              subColor="text-emerald-400"
              glowColor="cyan-text"
            />
            <KPICard
              label="Max Drawdown"
              value={`${drawdown}%`}
              sub="Safe zone (Limit 5%)"
              subColor="text-emerald-400"
            />
            <KPICard
              label="Risk-Adj Return"
              value={sharpe.toString()}
              sub="Sharpe · Excellent"
              glowColor="purple-text"
            />
            <KPICard
              label="X402 Revenue"
              value={`${x402.toFixed(2)}`}
              sub="USDC via Oracle calls"
              subColor="text-gray-500"
            />
          </div>
        </div>

        {/* Right: Terminal + Chart */}
        <div className="lg:col-span-2 space-y-4">
          {/* Terminal */}
          <GlassCard className="!p-0 flex flex-col" style={{ minHeight: '380px' }}>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.05] bg-black/20 rounded-t-xl">
              <div className="flex gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-500" />
                <span className="w-3 h-3 rounded-full bg-yellow-500" />
                <span className="w-3 h-3 rounded-full bg-emerald-500" />
              </div>
              <span className="font-mono text-xs text-gray-500">Agentic Execution Core // MCP Router</span>
            </div>
            <div className="terminal-body flex-1 p-4 space-y-1 overflow-y-auto" style={{ maxHeight: '340px' }}>
              {logs.map(log => (
                <div key={log.id} className="log-entry flex gap-2 text-xs">
                  <span className="log-time flex-shrink-0">{log.time}</span>
                  <span className={`log-sys flex-shrink-0 font-semibold ${TYPE_COLOR[log.type]}`}>{log.sys}</span>
                  <span className="log-msg text-gray-300">{log.msg}</span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </GlassCard>

          {/* Infrastructure Graph */}
          <GlassCard>
            <h2 className="text-sm font-semibold cyan-text mb-4">Live Infrastructure Graph</h2>
            <div className="flex gap-4 mb-4">
              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_5px_#00f3ff]" />
                PRISM API Latency: <strong className="text-cyan-400">{latency}ms</strong>
              </div>
              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_5px_#9d00ff]" />
                MCP Commands/hr: <strong className="text-purple-400">842</strong>
              </div>
            </div>
            <div className="h-28 relative overflow-hidden rounded-lg">
              <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="w-full h-full">
                <defs>
                  <linearGradient id="cyber-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#00f3ff" stopOpacity="0.5" />
                    <stop offset="100%" stopColor="#00f3ff" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M0,30 L0,15 Q5,5 10,18 T20,12 T30,22 T40,10 T50,15 T60,5 T70,12 T80,8 T90,2 T100,10 L100,30 Z"
                  fill="url(#cyber-gradient)"
                />
                <path
                  d="M0,15 Q5,5 10,18 T20,12 T30,22 T40,10 T50,15 T60,5 T70,12 T80,8 T90,2 T100,10"
                  fill="none"
                  stroke="#00f3ff"
                  strokeWidth="0.5"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
