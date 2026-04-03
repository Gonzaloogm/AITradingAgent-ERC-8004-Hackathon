import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import GlassCard from '../components/ui/GlassCard';
import StatusCard from '../components/ui/StatusCard';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useWallet } from '../hooks/useWallet';
import { useToast } from '../components/ui/Toast';
import { apiClient } from '../api/client';
import { formatEth, getExplorerUrl, formatTxHash } from '../utils/formatters';

const STEP_LABELS = ['Wallet Funding', 'Register Agent', 'Agent Status'];

function StepIndicator({ step, current, label }) {
  const done = current > step;
  const active = current === step;
  return (
    <div className="flex items-center gap-2">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 transition-all ${
        done ? 'bg-emerald-500/20 border border-emerald-500/60 text-emerald-400' :
        active ? 'bg-cyan-500/20 border border-cyan-500/60 text-cyan-400' :
        'bg-gray-800 border border-gray-700 text-gray-600'
      }`}>
        {done ? '✓' : step + 1}
      </div>
      <span className={`text-sm font-medium hidden sm:block ${done ? 'text-emerald-400' : active ? 'text-cyan-400' : 'text-gray-600'}`}>
        {label}
      </span>
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { wallet, loading: walletLoading, error: walletError, formattedBalance, isFunded } = useWallet(5000);

  const [currentStep, setCurrentStep] = useState(0);
  const [chainConfig, setChainConfig] = useState(null);
  const [reg, setReg] = useState({
    started: false,
    identity: { status: 'waiting', message: 'Waiting...' },
    reputation: { status: 'waiting', message: 'Waiting for identity...' },
  });
  const [agentReady, setAgentReady] = useState(false);
  const [agentId, setAgentId] = useState(null);

  // Load chain config
  useEffect(() => {
    apiClient.getChainConfig().then(r => { if (r.success) setChainConfig(r.data); });
  }, []);

  // Advance step when wallet funded
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
            identity:  { status: 'success', message: `Registered (ID: ${agent.agent_id})` },
            reputation:{ status: 'success', message: 'Confirmed' },
          });
          setCurrentStep(2);
          setAgentReady(true);
        }
      }
    })();
  }, []);

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
    setReg(prev => ({ ...prev, started: true, identity: { status: 'in_progress', message: 'Broadcasting transaction...' } }));

    try {
      // Identity
      const identResult = await apiClient.registerAgent();
      if (!identResult.success) {
        setReg(prev => ({ ...prev, identity: { status: 'error', message: identResult.error } }));
        return;
      }

      const data = identResult.data;
      let txIdentity = data.tx_hash;
      let finalAgentId = data.agent_id;

      if (data.already_registered && data.agent_id) {
        finalAgentId = data.agent_id;
      } else {
        const conf = await pollTx(txIdentity, (n) => {
          setReg(prev => ({ ...prev, identity: { status: 'in_progress', message: `Confirming... (attempt ${n})` } }));
        });
        if (!conf?.agent_id) {
          setReg(prev => ({ ...prev, identity: { status: 'error', message: 'Transaction failed or timed out' } }));
          return;
        }
        finalAgentId = conf.agent_id;
      }

      setAgentId(finalAgentId);
      setReg(prev => ({
        ...prev,
        identity:  { status: 'success', message: `Registered (ID: ${finalAgentId})`, txHash: txIdentity, explorerUrl: chainConfig ? getExplorerUrl(txIdentity, chainConfig.block_explorer_urls?.[0]) : '#' },
        reputation:{ status: 'in_progress', message: 'Initializing...' },
      }));

      // Reputation
      const repResult = await apiClient.submitInitialReputation();
      if (repResult.success) {
        setReg(prev => ({
          ...prev,
          reputation: { status: 'success', message: 'Starts at 0 (builds from client feedback)' },
        }));
        setCurrentStep(2);
        setAgentReady(true);
      } else {
        setReg(prev => ({ ...prev, reputation: { status: 'error', message: repResult.error } }));
      }
    } catch (e) {
      setReg(prev => ({ ...prev, identity: { status: 'error', message: e.message } }));
    }
  }

  const allRegDone = reg.identity.status === 'success' && reg.reputation.status === 'success';

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-extrabold gradient-text tracking-tight">TEE Agent Dashboard</h1>
        <p className="text-gray-500 mt-1 text-sm">Complete the setup steps to activate your on-chain agent identity</p>
      </div>

      {/* Step progress bar */}
      <GlassCard className="!py-4">
        <div className="flex items-center justify-between">
          {STEP_LABELS.map((label, i) => (
            <div key={i} className="flex items-center gap-2 flex-1">
              <StepIndicator step={i} current={currentStep} label={label} />
              {i < STEP_LABELS.length - 1 && (
                <div className={`hidden sm:block flex-1 h-px mx-2 ${currentStep > i ? 'bg-emerald-500/40' : 'bg-gray-800'}`} />
              )}
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Step 1: Wallet */}
      <GlassCard className={currentStep < 0 ? 'opacity-50' : ''}>
        <div className="flex items-center gap-3 mb-5">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
            isFunded ? 'bg-emerald-500/20 border border-emerald-500/60 text-emerald-400' : 'bg-cyan-500/20 border border-cyan-500/60 text-cyan-400'
          }`}>{isFunded ? '✓' : '1'}</div>
          <h2 className="text-xl font-bold">Wallet Funding</h2>
        </div>

        {walletLoading ? (
          <div className="flex items-center gap-3 text-gray-400 ml-11">
            <LoadingSpinner size="sm" /> <span>Loading wallet...</span>
          </div>
        ) : walletError ? (
          <p className="text-red-400 ml-11 text-sm">❌ {walletError}</p>
        ) : (
          <div className="ml-11 space-y-3">
            {isFunded ? (
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                <span>✓ Wallet Funded</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-yellow-400 text-sm font-medium">
                <span className="pulse-dot yellow" /> Waiting for funds...
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-white/[0.03] rounded-lg px-4 py-3 border border-white/[0.06]">
                <p className="text-xs text-gray-500 mb-1">Address</p>
                <p className="font-mono text-xs text-gray-200 break-all">{wallet?.address}</p>
              </div>
              <div className="bg-white/[0.03] rounded-lg px-4 py-3 border border-white/[0.06]">
                <p className="text-xs text-gray-500 mb-1">Balance</p>
                <p className="font-mono text-lg text-white">
                  {formattedBalance} <span className="text-gray-500 text-sm">ETH</span>
                </p>
              </div>
            </div>
            {!isFunded && (
              <a href="/funding" className="inline-block mt-1 text-sm text-cyan-400 hover:text-cyan-300 transition-colors">
                → Fund Wallet
              </a>
            )}
          </div>
        )}
      </GlassCard>

      {/* Step 2: Register */}
      <GlassCard className={currentStep < 1 ? 'opacity-40 pointer-events-none' : ''}>
        <div className="flex items-center gap-3 mb-5">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
            allRegDone ? 'bg-emerald-500/20 border border-emerald-500/60 text-emerald-400' : 'bg-cyan-500/20 border border-cyan-500/60 text-cyan-400'
          }`}>{allRegDone ? '✓' : '2'}</div>
          <h2 className="text-xl font-bold">Register Your Agent</h2>
        </div>

        <div className="ml-11">
          {!reg.started ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-400">Register your agent on-chain for ERC-8004 Identity and Reputation.</p>
              <button
                onClick={startRegistration}
                disabled={!isFunded}
                className="bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-700 disabled:cursor-not-allowed
                  px-6 py-3 rounded-xl font-semibold text-sm transition-all
                  shadow-[0_0_20px_rgba(0,243,255,0.2)] hover:shadow-[0_0_30px_rgba(0,243,255,0.35)]"
              >
                Register Agent
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <StatusCard title="Identity Registry" statusData={reg.identity} />
              <StatusCard title="Reputation" statusData={reg.reputation} />
              {allRegDone && (
                <button
                  onClick={() => navigate('/developer')}
                  className="w-full mt-3 bg-emerald-600 hover:bg-emerald-700 px-6 py-3 rounded-xl font-semibold text-sm transition-all"
                >
                  Go to Developer Dashboard →
                </button>
              )}
            </div>
          )}
        </div>
      </GlassCard>

      {/* Step 3: Agent Status */}
      <GlassCard className={currentStep < 2 ? 'opacity-40 pointer-events-none' : ''}>
        <div className="flex items-center gap-3 mb-5">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
            agentReady ? 'bg-emerald-500/20 border border-emerald-500/60 text-emerald-400' : 'bg-gray-800 border border-gray-700 text-gray-600'
          }`}>{agentReady ? '✓' : '3'}</div>
          <h2 className="text-xl font-bold">Agent Status</h2>
        </div>

        <div className="ml-11">
          {agentReady ? (
            <div className="space-y-4">
              <p className="text-emerald-400 font-medium text-sm">✓ Agent Ready — A2A endpoints active</p>
              {agentId && <p className="text-xs font-mono text-gray-500">Agent ID: {agentId}</p>}
              <div className="flex flex-wrap gap-3">
                <a
                  href="/agent.json"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:text-cyan-300 text-sm transition-colors"
                >
                  → View Agent Card
                </a>
                <button
                  onClick={() => navigate('/developer')}
                  className="bg-cyan-600/20 border border-cyan-500/40 hover:bg-cyan-600/30 text-cyan-400 px-4 py-2 rounded-lg text-sm transition-all"
                >
                  Developer Dashboard
                </button>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Waiting for registration...</p>
          )}
        </div>
      </GlassCard>
    </div>
  );
}
