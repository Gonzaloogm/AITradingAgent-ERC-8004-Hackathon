import { useState } from 'react';
import GlassCard from '../components/ui/GlassCard';
import ChatInterface from '../components/chat/ChatInterface';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useAgentStatus } from '../hooks/useAgentStatus';
import { formatAddress } from '../utils/formatters';

function AgentStatusBar({ status, loading }) {
  const [expanded, setExpanded] = useState(false);
  const agent = status?.agent;

  if (loading) {
    return (
      <GlassCard className="!py-3 flex items-center gap-3 text-gray-400 text-sm mb-4">
        <LoadingSpinner size="sm" /> Loading agent status...
      </GlassCard>
    );
  }

  return (
    <div className="mb-4">
      {/* Collapsed bar */}
      <button
        onClick={() => setExpanded(o => !o)}
        className="w-full glass-panel px-4 py-3 flex items-center gap-4 hover:border-cyan-500/20 transition-colors"
      >
        <div className="flex items-center gap-4 flex-wrap flex-1 text-sm">
          <div className="flex items-center gap-2">
            <span className="pulse-dot green" />
            <span className="text-gray-300">Online</span>
          </div>
          {agent?.address && (
            <span className="font-mono text-xs text-gray-500">{formatAddress(agent.address)}</span>
          )}
          <div className={`flex items-center gap-2 ${agent?.is_registered ? 'text-emerald-400' : 'text-yellow-400'}`}>
            <span className={`pulse-dot ${agent?.is_registered ? 'green' : 'yellow'}`} />
            {agent?.is_registered ? 'Registered' : 'Unregistered'}
          </div>
          <div className="flex items-center gap-2 text-emerald-400">
            <span className="pulse-dot green" />
            TEE Secured
          </div>
        </div>
        <span className="text-gray-600 text-xs ml-auto whitespace-nowrap">
          {expanded ? 'Hide details ▲' : 'Click for details ▼'}
        </span>
      </button>

      {/* Expanded details */}
      {expanded && (
        <GlassCard className="mt-2 !pt-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold">Agent Details</h2>
            <button onClick={() => setExpanded(false)} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/[0.03] rounded-lg p-4 border border-white/[0.06]">
              <p className="text-xs text-gray-500 mb-2">Wallet Address</p>
              <p className="font-mono text-xs text-gray-200 break-all">{agent?.address || '—'}</p>
            </div>
            <div className="bg-white/[0.03] rounded-lg p-4 border border-white/[0.06]">
              <p className="text-xs text-gray-500 mb-2">Agent ID</p>
              <p className="font-mono text-gray-200">{agent?.agent_id || 'Not registered'}</p>
            </div>
            <div className="bg-white/[0.03] rounded-lg p-4 border border-white/[0.06]">
              <p className="text-xs text-gray-500 mb-2">Status</p>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-2 h-2 rounded-full ${agent?.is_registered ? 'bg-emerald-400' : 'bg-yellow-400'}`} />
                <span className="text-sm text-gray-200">{agent?.is_registered ? 'Registered' : 'Not Registered'}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-sm text-gray-200">TEE Secured (Intel TDX)</span>
              </div>
            </div>
          </div>
        </GlassCard>
      )}
    </div>
  );
}

export default function DeveloperPage() {
  const { status, loading } = useAgentStatus(20000);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Developer API</h1>
          <p className="text-gray-500 text-sm mt-0.5">Interact with your TEE agent in a secure Intel TDX enclave</p>
        </div>
      </div>

      <AgentStatusBar status={status} loading={loading} />

      <ChatInterface />
    </div>
  );
}
