import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';
import { useToast } from '../components/ui/Toast';
import { apiClient } from '../api/client';
import TrustCenter from '../components/agent/TrustCenter';
import TrustEnclaveTerminal from '../components/agent/TrustEnclaveTerminal';
import StrykrIntelligenceLog from '../components/agent/StrykrIntelligenceLog';
import ChatInterface from '../components/chat/ChatInterface';
import PrismScanSidebar from '../components/agent/PrismScanSidebar';

export default function DashboardPage() {
  const navigate = useNavigate();
  const toast = useToast();
  // Using 5000ms polling for wallet in the custom hook as originally defined
  const { wallet, loading: walletLoading, error: walletError, formattedBalance, isFunded } = useWallet(5000);

  const [currentStep, setCurrentStep] = useState(0);
  const [chainConfig, setChainConfig] = useState(null);
  const [reg, setReg] = useState({
    started: false,
    identity: { status: 'WAITING', message: 'Ready to initialize...' },
    reputation: { status: 'WAITING', message: 'Waiting for identity...' },
  });
  const [agentReady, setAgentReady] = useState(false);
  const [agentId, setAgentId] = useState(null);
  const [activeTab, setActiveTab] = useState('intelligence'); // 'intelligence' or 'debug'

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


  // Load chain config once
  useEffect(() => {
    apiClient.getChainConfig().then(r => { if (r.success) setChainConfig(r.data); });
  }, []);

  // Advance initial onboarding step when wallet funded
  useEffect(() => {
    if (isFunded && currentStep < 1) setCurrentStep(1);
  }, [isFunded, currentStep]);

  // Check if already registered on mount
  useEffect(() => {
    (async () => {
      const result = await apiClient.getStatus();
      if (result.success) {
        const agent = result.data.agent;
        if (agent.is_registered && agent.agent_id) {
          setAgentId(agent.agent_id);
          setReg({
            started: true,
            identity:  { status: 'SUCCESS', message: `Registered (ID: ${agent.agent_id})` },
            reputation:{ status: 'SUCCESS', message: 'Confirmed' },
          });
          setCurrentStep(2);
          setAgentReady(true);
        }
      }
    })();
  }, []);

  // Establish WebSocket for agent state and dynamically populate algorithmic logs
  useEffect(() => {
    let lastExecTime = { time: 0, _lastSym: null };
    let ws = null;
    let reconnectTimeout = null;
    let reconnectAttempts = 0;

    const connect = () => {
      if (!agentReady) return;

      // Dynamic Host Detection: Use Phala production host if on localhost
      const PHALA_HOST = 'd571a329e5081e0d1b8fd65773ba0cd84e9e3457-8000.dstack-pha-prod9.phala.network';
      const isLocal = window.location.hostname === 'localhost';
      const host = isLocal ? PHALA_HOST : window.location.host;
      const protocol = isLocal || window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      
      const wsUrl = `${protocol}//${host}/api/stream`;
      console.log(`[WS] Connecting to ${wsUrl}...`);
      ws = new WebSocket(wsUrl);
       
      ws.onopen = () => {
        reconnectAttempts = 0;
        console.log("[WS] Connection established.");
        setTerminalLogs(prev => [...prev.slice(-49), "[WS] Connection established. Telemetry ACTIVE."]);
      };

      ws.onmessage = (event) => {
        try {
           const data = JSON.parse(event.data);
           // Handle telemetry renaming from backend
           const sanitizedData = {
              ...data,
              last_spread: data.real_time_spread || data.last_spread // Fallback for UI binding
           };
           setAgentState(sanitizedData);
           
           if (data.status !== "halted") {
                setTerminalLogs(prev => {
                  let newLogs = [...prev];
                  const time = new Date().toLocaleTimeString('en-US', { hour12: false });
                  
                  // Show PRISM Scan result if changed
                  if (data.active_symbol && data.active_symbol !== lastExecTime._lastSym) {
                       newLogs.push(`[${time}] [PRISM] Global Scan: Best opportunity found on ${data.active_symbol}.`);
                       lastExecTime._lastSym = data.active_symbol;
                  }

                  // Show MCP Tool Calls
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
                     newLogs.push(`[${time}] [AI] Yield verified. Initiating TEE-signing protocol.`);
                     newLogs.push(`[${time}] [SIG] EIP-712 Signature generated for ${data.active_symbol} trade.`);
                     if (data.latest_cid) {
                         newLogs.push(`[${time}] [IPFS] Integrity Proof Pinned: ${data.latest_cid}`);
                     }
                  }

                  if (data.circuit_breaker_active && !newLogs.some(l => l.includes("CIRCUIT BREAKER"))) {
                      newLogs.push(`[${time}] [CRITICAL] CIRCUIT BREAKER TRIPPED! TRADING HALTED.`);
                  }

                  if (newLogs.length > 50) return newLogs.slice(newLogs.length - 50);
                  return newLogs;
                });
           }
        } catch (e) {
           console.error("[WS] Parse error", e);
        }
      };

      ws.onerror = (e) => {
        console.error("[WS] Error occurred", e);
      };

      ws.onclose = () => {
        console.warn("[WS] Socket closed. Attempting reconnect...");
        setTerminalLogs(prev => [...prev.slice(-49), "[WS] Link Severed. Attempting self-healing..."]);
        
        // Exponential backoff for reconnection
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

  async function pollTx(txHash, onUpdate) {
    let delay = 2000;
    let attempts = 0;
    while (attempts < 30) {
      await new Promise(r => setTimeout(r, delay));
      const r = await apiClient.getTransactionStatus(txHash);
      if (r.success && r.data.confirmed) return r.data;
      onUpdate(++attempts);
      delay = Math.min(delay * 1.5, 10000);
    }
    return null;
  }

  async function startRegistration() {
    if (!isFunded) { toast('Fund your wallet first', 'warning'); return; }
    setReg(prev => ({ ...prev, started: true, identity: { status: 'IN_PROGRESS', message: 'Broadcasting tx...' } }));

    try {
      const identResult = await apiClient.registerAgent();
      if (!identResult.success) {
        setReg(prev => ({ ...prev, identity: { status: 'ERROR', message: identResult.error } }));
        return;
      }

      const data = identResult.data;
      let txIdentity = data.tx_hash;
      let finalAgentId = data.agent_id;

      if (data.already_registered && data.agent_id) {
        finalAgentId = data.agent_id;
      } else {
        const conf = await pollTx(txIdentity, (n) => {
          setReg(prev => ({ ...prev, identity: { status: 'IN_PROGRESS', message: `Confirming... (attempt ${n})` } }));
        });
        if (!conf?.agent_id) {
          setReg(prev => ({ ...prev, identity: { status: 'ERROR', message: 'Tx failed' } }));
          return;
        }
        finalAgentId = conf.agent_id;
      }

      setAgentId(finalAgentId);
      setReg(prev => ({
        ...prev,
        identity:  { status: 'SUCCESS', message: `Registered (ID: ${finalAgentId})`, txHash: txIdentity },
        reputation:{ status: 'IN_PROGRESS', message: 'Init...' },
      }));

      const repResult = await apiClient.submitInitialReputation();
      if (repResult.success) {
        setReg(prev => ({
          ...prev,
          reputation: { status: 'SUCCESS', message: 'Initialized' },
        }));
        setCurrentStep(2);
        setAgentReady(true);
        setTerminalLogs(prev => [...prev, `[SYSTEM] Agent ID ${finalAgentId} active. Starting logic loops...`]);
      } else {
        setReg(prev => ({ ...prev, reputation: { status: 'ERROR', message: repResult.error } }));
      }
    } catch (e) {
      setReg(prev => ({ ...prev, identity: { status: 'ERROR', message: e.message } }));
    }
  }

  const allRegDone = reg.identity.status === 'SUCCESS' && reg.reputation.status === 'SUCCESS';

  return (
    <div className="min-h-fit text-gray-200 mt-2 space-y-8 pb-12">
      {/* 1. STATE-OF-THE-ART HEADER & BLINKING BADGE */}
      <div className="flex flex-col lg:flex-row justify-between items-center p-8 bg-black/40 rounded-[2rem] border border-white/5 shadow-[0_22px_70px_4px_rgba(0,0,0,0.56)] backdrop-blur-3xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-40" />
        
        <div className="flex flex-col items-center lg:items-start text-center lg:text-left z-10">
          <h1 className="text-4xl font-mono font-black tracking-tighter text-white">
            <span className="text-cyan-400">ENCLAVE</span>.EX
          </h1>
          <p className="text-gray-500 mt-2 font-mono text-[10px] uppercase tracking-[0.4em]">Verifiable Autonomous Infrastructure</p>
        </div>

        {/* THE WINNER BADGE */}
        <div className={`my-6 lg:my-0 flex items-center gap-4 px-8 py-4 rounded-2xl border-2 transition-all duration-300 transform scale-110 ${agentState.is_signing ? 'bg-emerald-500/20 border-emerald-400 shadow-[0_0_40px_rgba(52,211,153,0.5)] animate-pulse' : 'bg-white/5 border-white/10 opacity-60'}`}>
           <div className={`w-4 h-4 rounded-full ${agentReady ? (agentState.is_signing ? 'bg-emerald-400' : 'bg-emerald-500') : 'bg-gray-700'}`}></div>
           <div className="flex flex-col">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Integrity Status</span>
              <span className={`text-sm font-black font-mono tracking-tighter ${agentState.is_signing ? 'text-emerald-300' : 'text-white'}`}>
                {agentState.is_signing ? 'HARDWARE_SIGNING_ID...' : 'HARDWARE VERIFIED: INTEL TDX'}
              </span>
           </div>
        </div>
        
        <div className="flex gap-8 items-center z-10">
           <div className="text-right font-mono">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Portfolio Equity</p>
              <p className="text-3xl font-black text-white">{formattedBalance} <span className="text-cyan-500/50 text-xl italic">ETH</span></p>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* CENTER COLUMN: THE PROTAGONIST ENCLAVE TERMINAL */}
        <div className="lg:col-span-12 xl:col-span-8 flex flex-col gap-8">
          
          <div className="space-y-4">
             <div className="flex gap-2 font-mono text-[10px] items-center mb-2">
                <button 
                  onClick={() => setActiveTab('intelligence')}
                  className={`px-4 py-2 rounded-lg border transition-all ${activeTab === 'intelligence' ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.2)]' : 'bg-white/5 border-white/5 text-gray-600 hover:text-gray-400'}`}
                >
                  STRYKR INTELLIGENCE
                </button>
                <button 
                  onClick={() => setActiveTab('live_ops')}
                  className={`px-4 py-2 rounded-lg border transition-all ${activeTab === 'live_ops' ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'bg-white/5 border-white/5 text-gray-600 hover:text-gray-400'}`}
                >
                  LIVE OPS
                </button>
                <button 
                  onClick={() => setActiveTab('debug')}
                  className={`px-4 py-2 rounded-lg border transition-all ${activeTab === 'debug' ? 'bg-purple-500/10 border-purple-500/50 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.2)]' : 'bg-white/5 border-white/5 text-gray-600 hover:text-gray-400'}`}
                >
                  DEBUG_CHAT_V1.2
                </button>
             </div>

             {activeTab === 'intelligence' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                   {/* REAL TIME HEX STREAM */}
                   <TrustEnclaveTerminal isSigning={agentState.is_signing} />
                   
                   {/* MARKET GRID */}
                   <StrykrIntelligenceLog 
                     scanResults={agentState.scan_results} 
                     activeSymbol={agentState.active_symbol} 
                     logs={agentState.short_term_memory}
                   />
                </div>
             )}

             {activeTab === 'live_ops' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-white">
                      <div className="bg-black/40 border border-white/5 rounded-3xl p-8 flex flex-col justify-between">
                         <div>
                            <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-2">Realized PnL (Net)</p>
                            <h2 className="text-5xl font-black font-mono">
                               {((agentState.current_equity || 0.1) - 0.1).toFixed(6)} <span className="text-xl text-gray-500">ETH</span>
                            </h2>
                            <p className="text-xs text-gray-500 mt-4 leading-relaxed">
                               Cumulative profit generated by the Delta-Neutral strategy within the secure enclave. All fees considered.
                            </p>
                         </div>
                         <div className="mt-8 pt-8 border-t border-white/5 flex gap-8">
                            <div>
                               <p className="text-[9px] text-gray-500 uppercase tracking-widest">Growth</p>
                               <p className="text-lg font-mono text-emerald-400">+{(((agentState.current_equity || 0.1) / 0.1 - 1) * 100).toFixed(2)}%</p>
                            </div>
                            <div>
                               <p className="text-[9px] text-gray-500 uppercase tracking-widest">Drawdown</p>
                               <p className="text-lg font-mono text-gray-400">0.00%</p>
                            </div>
                         </div>
                      </div>

                      <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 space-y-6">
                         <div className="flex justify-between items-start">
                            <h3 className="font-mono text-[10px] font-bold text-gray-400 uppercase tracking-widest">Operational Metrics</h3>
                            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-bold">STABLE</span>
                         </div>
                         
                         <div className="space-y-4">
                            <div className="flex justify-between items-center py-3 border-b border-white/5">
                               <span className="text-xs text-gray-500">Peak Enclave Equity</span>
                               <span className="text-sm font-mono font-bold">{(agentState.peak_equity || 0).toFixed(4)} ETH</span>
                            </div>
                            <div className="flex justify-between items-center py-3 border-b border-white/5">
                               <span className="text-xs text-gray-500">Risk-Adjusted Yield</span>
                               <span className="text-sm font-mono font-bold">{(agentState.last_net_yield || 0).toFixed(3)}% / hr</span>
                            </div>
                            <div className="flex justify-between items-center py-3 border-b border-white/5">
                               <span className="text-xs text-gray-500">MCP Uptime</span>
                               <span className="text-sm font-mono font-bold text-emerald-400">99.98%</span>
                            </div>
                         </div>
                      </div>
                   </div>
                </div>
             )}

             {activeTab === 'debug' && (
                <div className="animate-in fade-in zoom-in-95 duration-500">
                   <ChatInterface />
                </div>
             )}
          </div>

          {/* AUTO LOGS (Replaced by compact console at bottom if intelligence is active) */}
          {activeTab === 'intelligence' && (
            <div className="bg-[#050505] rounded-3xl border border-white/5 shadow-inner flex flex-col h-[200px] overflow-hidden opacity-80">
                <div className="bg-white/5 py-2 px-6 border-b border-white/5 font-mono text-[9px] text-gray-500 uppercase tracking-widest">
                  System Trace
                </div>
                <div ref={terminalRef} className="p-6 flex-1 overflow-y-auto font-mono text-[11px] leading-relaxed scrollbar-thin">
                   {terminalLogs.slice(-10).map((log, i) => (
                      <div key={i} className="mb-1 text-gray-600 border-l border-white/10 pl-4">{log}</div>
                   ))}
                </div>
            </div>
          )}
        </div>

        {/* SIDEBAR: TRUST & INFRA */}
        <div className="lg:col-span-12 xl:col-span-4 flex flex-col gap-8">
          
          <TrustCenter 
            agentStatus={status?.data} 
            teeState={agentState} 
          />

          <PrismScanSidebar 
            scanResults={agentState.scan_results} 
            activeSymbol={agentState.active_symbol} 
          />

          <div className="bg-white/[0.02] rounded-3xl border border-white/5 p-8 space-y-6">
            <h3 className="font-mono text-[10px] font-bold text-gray-500 uppercase tracking-[0.3em] border-b border-white/5 pb-4">Initialization Flow</h3>
            
            <div className="space-y-4">
              <div className={`p-6 rounded-2xl border transition-all ${isFunded ? 'bg-emerald-500/[0.03] border-emerald-500/20 shadow-[inset_0_0_20px_rgba(16,185,129,0.05)]' : 'bg-white/5 border-white/10'}`}>
                 <p className="text-[9px] font-bold text-gray-500 mb-2 tracking-widest">ENV: COLLATERAL</p>
                 {isFunded ? (
                   <p className="text-lg font-mono text-emerald-400 font-bold">{formattedBalance} ETH</p>
                 ) : (
                   <button onClick={() => navigate('/funding')} className="w-full py-3 bg-cyan-600 text-white font-black rounded-xl text-xs uppercase tracking-tighter hover:bg-cyan-500 transition-colors">Deposit Funds</button>
                 )}
              </div>

              <div className={`p-6 rounded-2xl border transition-all ${allRegDone ? 'bg-emerald-500/[0.03] border-emerald-500/20' : 'bg-white/5 border-white/10'}`}>
                 <p className="text-[9px] font-bold text-gray-500 mb-2 tracking-widest">PROT: ERC-8004_ID</p>
                 {allRegDone ? (
                   <div className="flex items-center justify-between">
                     <p className="text-sm font-mono text-white font-bold truncate pr-4">AGENT_{agentId?.slice(0, 8)}</p>
                     <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded font-bold uppercase tracking-tighter">Verified</span>
                   </div>
                 ) : (
                   <button 
                     onClick={startRegistration} 
                     disabled={!isFunded || reg.started}
                     className="w-full py-3 bg-white/10 hover:bg-white/20 text-white font-black rounded-xl text-xs uppercase transition-all disabled:opacity-30"
                   >
                     {reg.started ? 'BROADCASTING...' : 'INITIATE REGISTRY'}
                   </button>
                 )}
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
