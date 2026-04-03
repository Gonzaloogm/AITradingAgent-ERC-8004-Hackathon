const QUICK_ACTIONS = [
  { tool: 'get_wallet_info',        icon: '💰', label: 'Wallet Info' },
  { tool: 'get_agent_card',         icon: '📋', label: 'Agent Card' },
  { tool: 'generate_attestation',   icon: '🔐', label: 'Attestation' },
  { tool: 'get_registration_status',icon: '📝', label: 'Registration' },
  { tool: 'get_reputation',         icon: '⭐', label: 'Reputation' },
];

export default function QuickActions({ onAction, disabled }) {
  return (
    <div className="flex flex-wrap gap-2 pb-3 border-b border-white/[0.06]">
      {QUICK_ACTIONS.map(btn => (
        <button
          key={btn.tool}
          onClick={() => onAction(btn.tool, btn.label)}
          disabled={disabled}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
            bg-white/[0.04] border border-white/[0.08] text-gray-300
            hover:bg-cyan-500/10 hover:border-cyan-500/30 hover:text-cyan-400
            disabled:opacity-40 disabled:cursor-not-allowed
            transition-all duration-200"
        >
          <span>{btn.icon}</span>
          {btn.label}
        </button>
      ))}
    </div>
  );
}
