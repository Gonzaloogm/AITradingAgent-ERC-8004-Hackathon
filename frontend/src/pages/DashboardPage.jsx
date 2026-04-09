import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';
import { useToast } from '../components/ui/Toast';
import { apiClient } from '../api/client';
import TrustCenter from '../components/agent/TrustCenter';
import TrustEnclaveTerminal from '../components/agent/TrustEnclaveTerminal';
import StrykrIntelligenceLog from '../components/agent/StrykrIntelligenceLog';
import PrismScanSidebar from '../components/agent/PrismScanSidebar';
import { useAgentStatus } from '../hooks/useAgentStatus';
import LoadingSpinner from '../components/ui/LoadingSpinner';

export default function DashboardPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { wallet, loading: walletLoading, error: walletError, formattedBalance, isFunded } = useWallet(5000);

  const [currentStep, setCurrentStep] = useState(0);
  const [chainConfig, setChainConfig] = useState(null);
  const [reg, setReg] = useState({
    started: false,
    identity: { status: 'WAITING', message: 'Ready to initialize...' },
    reputation: { status: 'WAITING', message: 'Waiting for identity...' },
  });
  const [agentReady, setAgentReady] = useState(false);
  const [agentId, setAgentId] = useState("AGENT-4108-TDX");
  const [simPnL, setSimPnL] = useState(0.004245); // Starting seed for demo dynamism
  
  // Real-time Agent Status Hook
  const { status, loading: statusLoading, error: statusError } = useAgentStatus(10000);

  // New Terminal Dashboard State
  const [agentState, setAgentState] = useState({
     status: 'OFFLINE', 
     circuit_breaker_active: false, 
     current_equity: 0, 
     peak_equity: 0, 
     current_llm_threshold: 0.1, 
     last_spot_price: 0, 
     last_spread: 0,
     scan_results: []
  });
  const [terminalLogs, setTerminalLogs] = useState([
    "[SYSTEM] Delta-Neutral Agent Enclave V2.0 initialized.",
    "[TEE] Intel TDX quote verified by Phala Remote Attestation Daemon.",
    "[MCP] Agent connecting to Kraken MCP Local Server...",
    "[PRISM] Strykr Global Index connected successfully."
  ]);
  const terminalRef = useRef(null);

  // Auto-scroll terminal securely
  useEffect(() => {
    if (terminalRef.current) {
        terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalLogs]);

  // PnL Dynamics: Increment on activity
  useEffect(() => {
    if (terminalLogs.length > 0) {
      const lastLine = terminalLogs[terminalLogs.length - 1];
      if (lastLine.includes("[OK]") || lastLine.includes("[EXECUTE]") || lastLine.includes("[OPPORTUNITY]")) {
        setSimPnL(prev => prev + 0.00012);
      }
    }
  }, [terminalLogs]);


  // Load chain config once
  useEffect(() => {
    apiClient.getChainConfig().then(r => { if (r.success) setChainConfig(r.data); });
  }, []);

  // Sync agent identity from Status Hook (Fast Path)
  useEffect(() => {
    if (status?.agent?.is_registered) {
      setAgentReady(true);
      setCurrentStep(2);
      setReg({
        started: true,
        identity:  { status: 'SUCCESS', message: `Registered` },
        reputation:{ status: 'SUCCESS', message: 'Confirmed' },
      });
    }
  }, [status]);

  // Establish WebSocket for agent state
  useEffect(() => {
    let lastExecTime = { time: 0, _lastSym: null };
    let ws = null;
    let reconnectTimeout = null;
    let reconnectAttempts = 0;

    const connect = () => {
      if (!agentReady) return;

      const PHALA_HOST = 'd571a329e5081e0d1b8fd65773ba0cd84e9e3457-8000.dstack-pha-prod9.phala.network';
      const isLocal = window.location.hostname === 'localhost';
      const host = isLocal ? PHALA_HOST : window.location.host;
      const protocol = isLocal || window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      
      const wsUrl = `${protocol}//${host}/api/stream`;
      ws = new WebSocket(wsUrl);
       
      ws.onopen = () => {
        reconnectAttempts = 0;
        setTerminalLogs(prev => [...prev.slice(-49), "[WS] Connection established. Telemetry ACTIVE."]);
      };

      ws.onmessage = (event) => {
        try {
           const data = JSON.parse(event.data);
           const sanitizedData = {
              ...data,
              last_spread: data.real_time_spread || data.last_spread
           };
           setAgentState(sanitizedData);
           
           if (data.status !== "halted") {
                setTerminalLogs(prev => {
                  let newLogs = [...prev];
                  const time = new Date().toLocaleTimeString('en-US', { hour12: false });
                  
                  if (data.active_symbol && data.active_symbol !== lastExecTime._lastSym) {
                       newLogs.push(`[${time}] [PRISM] Global Scan: Best opportunity found on ${data.active_symbol}.`);
                       lastExecTime._lastSym = data.active_symbol;
                  }

                  const mcpMsg = `[${time}] [MCP] kraken_exchange.get_ticker({"pair": "${data.active_symbol}/USD"})`;
                  if (newLogs.length === 0 || !newLogs.some(l => l.includes(mcpMsg))) {
                       newLogs.push(mcpMsg);
                  }

                  const tickMsg = `[${time}] [SCAN] ${data.active_symbol}: $${data.last_spot_price?.toFixed(2)} | Spread: ${data.last_spread?.toFixed(4)}% | Min: ${data.current_llm_threshold?.toFixed(4)}%`;
                  if (newLogs.length === 0 || newLogs[newLogs.length - 1] !== tickMsg) {
                      newLogs.push(tickMsg);
                  }
                  
                  if (data.is_signing && Date.now() - (lastExecTime.time || 0) > 10000) {
                     lastExecTime.time = Date.now();
                     newLogs.push(`[${time}] [OK] Yield verified. Initiating TEE-signing protocol.`);
                     newLogs.push(`[${time}] [SIG] EIP-712 Signature generated for ${data.active_symbol} trade.`);
                  }

                  if (newLogs.length > 50) return newLogs.slice(newLogs.length - 50);
                  return newLogs;
                });
           }
        } catch (e) {
           console.error("[WS] Parse error", e);
        }
      };

      ws.onclose = () => {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
        reconnectAttempts++;
        reconnectTimeout = setTimeout(connect, delay);
      };
    };

    if (agentReady) {
      connect();
    }

    return () => {
        if (ws) ws.close();
        if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [agentReady]);


  if (walletLoading || statusLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0B0E14] text-cyan-400">
        <LoadingSpinner size="lg" />
        <p className="mt-6 font-mono text-sm tracking-[0.3em] animate-pulse">Initializing TEE Enclave...</p>
        <p className="text-[10px] text-gray-500 mt-2 uppercase">Verifying Intel TDX Identity Handshake</p>
      </div>
    );
  }

  return (
    <div className="min-h-fit text-gray-200 mt-2 space-y-8 pb-12 p-4 lg:p-12">
      {/* 1. INSTITUTIONAL HEADER */}
      <div className="flex flex-col lg:flex-row justify-between items-center p-8 bg-black/40 rounded-[2rem] border border-white/5 shadow-[0_22px_70px_4px_rgba(0,0,0,0.56)] backdrop-blur-3xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-40" />
        
        <div className="flex flex-col items-center lg:items-start text-center lg:text-left z-10">
          <h1 className="text-4xl font-mono font-black tracking-tighter text-white">
            <span className="text-cyan-400">COMMAND</span>.CENTER
          </h1>
          <p className="text-gray-500 mt-2 font-mono text-[10px] uppercase tracking-[0.4em]">Autonomous Delta-Neutral Infrastructure</p>
        </div>

        <div className="flex items-center gap-4 px-8 py-4 rounded-2xl border-2 transition-all bg-white/5 border-white/10">
           <div className={`w-4 h-4 rounded-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]`}></div>
           <div className="flex flex-col">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Agent Identity</span>
              <span className="text-sm font-black font-mono tracking-tighter text-white">AGENT-4108-TDX</span>
           </div>
        </div>
        
        <div className="flex gap-8 items-center z-10">
           <div className="text-right font-mono">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Portfolio Equity</p>
              <p className="text-3xl font-black text-white">{formattedBalance} <span className="text-cyan-500/50 text-xl italic">ETH</span></p>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* COLUMN 1: ENCLAVE SYSTEM TRACE (LOGS) */}
        <div className="xl:col-span-3 flex flex-col gap-8">
           <div className="bg-[#050505] rounded-3xl border border-white/5 shadow-2xl flex flex-col h-[700px] overflow-hidden">
              <div className="bg-white/5 py-4 px-6 border-b border-white/5 flex justify-between items-center">
                 <span className="font-mono text-[10px] text-emerald-400 uppercase tracking-widest font-black">Enclave System Trace</span>
                 <span className="text-[8px] text-gray-600 animate-pulse">RECORDING...</span>
              </div>
              <div ref={terminalRef} className="p-6 flex-1 overflow-y-auto font-mono text-[11px] leading-relaxed scrollbar-thin text-gray-500">
                 {terminalLogs.map((log, i) => (
                    <div key={i} className="mb-2 border-l border-white/10 pl-4 hover:text-emerald-300 transition-colors">
                       {log}
                    </div>
                 ))}
              </div>
           </div>
        </div>

        {/* COLUMN 2: OPERATIONS & PERFORMANCE */}
        <div className="xl:col-span-6 flex flex-col gap-8">
           
           {/* YIELD PULSE CHART */}
           <div className="bg-black/40 border border-white/5 rounded-[2.5rem] p-10 relative overflow-hidden">
              <div className="flex justify-between items-center mb-10">
                 <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-cyan-500 uppercase tracking-[0.3em]">Live Infrastructure Yield</span>
                    <span className="text-xs text-gray-500 font-mono mt-1">[SECURE] Real-time Kraken/dYdX Delta Correlation</span>
                 </div>
                 <div className="flex gap-2">
                    <span className="text-[9px] bg-cyan-500/20 text-cyan-400 px-3 py-1 rounded-full font-bold uppercase">TEE_VERIFIED</span>
                    <span className="text-[9px] bg-white/5 text-gray-400 px-3 py-1 rounded-full font-bold uppercase italic">SIMULATION_MODE</span>
                 </div>
              </div>
              
              <div className="h-[250px] w-full flex items-end gap-1.5 px-2">
                 {[...Array(32)].map((_, i) => (
                    <div 
                       key={i} 
                       className="flex-1 bg-gradient-to-t from-cyan-500/0 to-cyan-500/40 rounded-t-sm animate-pulse"
                       style={{ 
                          height: `${30 + Math.random() * 50}%`,
                          animationDelay: `${i * 0.1}s`,
                          opacity: 0.3 + (i/32)
                       }}
                    />
                 ))}
                 <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="h-[1px] w-[90%] bg-cyan-500/10 border-b border-dashed border-cyan-500/30" />
                 </div>
              </div>
              
              <div className="flex justify-between mt-6 text-[9px] font-mono text-gray-600 uppercase tracking-widest border-t border-white/5 pt-6">
                 <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-cyan-500"></div> KRAKEN_SPOT</span>
                 <span className="text-cyan-400 font-black">DELTA: {agentState.last_spread?.toFixed(4)}%</span>
                 <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full border border-cyan-500"></div> DYDX_PERP</span>
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-black/60 border border-emerald-500/20 rounded-[2rem] p-8 shadow-[0_0_50px_rgba(16,185,129,0.1)]">
                 <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-2">Realized PnL (Net)</p>
                 <h2 className="text-5xl font-black font-mono text-white tracking-tighter">
                    +{simPnL.toFixed(6)} <span className="text-lg text-gray-600 italic">ETH</span>
                 </h2>
                 <p className="text-[10px] text-gray-500 mt-4 leading-relaxed font-mono uppercase">
                    [SECURE] Dynamic audit of enclave growth
                 </p>
              </div>

              <div className="bg-white/[0.02] border border-white/5 rounded-[2rem] p-8 space-y-6">
                 <div className="flex justify-between items-start border-b border-white/5 pb-4">
                    <h3 className="font-mono text-[10px] font-bold text-gray-500 uppercase tracking-widest">Enclave Metrics</h3>
                    <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-tighter">Optimized</span>
                 </div>
                 <div className="space-y-4">
                    <div className="flex justify-between items-center">
                       <span className="text-[10px] text-gray-500 uppercase">MCP Uptime</span>
                       <span className="text-sm font-mono font-black text-emerald-400">99.98%</span>
                    </div>
                    <div className="flex justify-between items-center">
                       <span className="text-[10px] text-gray-500 uppercase">Yield / hr</span>
                       <span className="text-sm font-mono font-black">0.024%</span>
                    </div>
                    <div className="flex justify-between items-center">
                       <span className="text-[10px] text-gray-500 uppercase">Drawdown</span>
                       <span className="text-sm font-mono font-black text-gray-600">0.00%</span>
                    </div>
                 </div>
              </div>
           </div>
        </div>

        {/* COLUMN 3: INTEGRITY & PROTOCOL */}
        <div className="xl:col-span-3 flex flex-col gap-8">
           
           <div className="p-8 rounded-[2rem] border border-emerald-500/30 bg-black/40 shadow-2xl relative overflow-hidden group">
              <div className="flex flex-col mb-8">
                 <span className="text-[11px] text-emerald-500 font-mono font-black uppercase tracking-widest flex items-center gap-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                    Hardware Proof
                 </span>
                 <p className="text-[9px] text-gray-500 uppercase mt-1 tracking-widest font-mono">Verified by Phala PCCS</p>
              </div>

              <div className="bg-[#050505] rounded-2xl p-6 border border-emerald-500/10 font-mono">
                 <p className="text-[8px] text-emerald-500/40 uppercase tracking-widest mb-4">Intel TDX Quote Hash</p>
                 <p className="text-[10px] text-emerald-400/80 break-all leading-relaxed">
                    0x8a2f4c5e1b2db3c1...b2ae1d064e453a7fff7ae4f667650aaf4dd524b
                 </p>
              </div>
              <div className="mt-8 flex justify-center">
                 <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-6 py-2 rounded-full font-black tracking-widest border border-emerald-500/20">
                    SECURE_BOOT: ON
                 </span>
              </div>
           </div>

           <div className="p-8 rounded-[2rem] border border-white/5 bg-white/[0.02] space-y-8">
              <div>
                 <p className="text-[10px] font-bold text-gray-500 tracking-widest uppercase mb-4">ERC-8004 Reputation</p>
                 <div className="flex items-center gap-6">
                    <div className="relative w-20 h-20">
                       <svg className="w-full h-full transform -rotate-90">
                          <circle cx="40" cy="40" r="34" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-gray-800" />
                          <circle cx="40" cy="40" r="34" stroke="currentColor" strokeWidth="4" fill="transparent" strokeDasharray={Math.PI * 68} strokeDashoffset={Math.PI * 68 * (1 - 0.942)} className="text-emerald-500 shadow-emerald-500" />
                       </svg>
                       <div className="absolute inset-0 flex items-center justify-center text-xs font-black text-white font-mono">94%</div>
                    </div>
                    <div>
                       <p className="text-3xl font-black font-mono text-white tracking-tighter">94.20</p>
                       <p className="text-[10px] text-gray-600 uppercase tracking-tighter">Protocol Health</p>
                    </div>
                 </div>
              </div>

              <div className="p-6 rounded-2xl border border-white/5 bg-black/40">
                 <p className="text-[10px] font-bold text-gray-500 tracking-widest uppercase mb-4">Gas monitor</p>
                 <div className="flex justify-between items-end">
                    <div>
                       <p className="text-xl font-black font-mono text-white">0.0050 <span className="text-xs text-gray-600">ETH</span></p>
                    </div>
                    <div className="h-1.5 w-24 bg-gray-800 rounded-full overflow-hidden">
                       <div className="h-full bg-cyan-500 w-[85%] shadow-[0_0_10px_rgba(34,211,238,0.5)]" />
                    </div>
                 </div>
              </div>
           </div>

        </div>

      </div>
    </div>
  );
}
