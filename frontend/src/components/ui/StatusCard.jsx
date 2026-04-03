import LoadingSpinner from './LoadingSpinner';

const statusConfig = {
  waiting: {
    ring: 'bg-gray-700 text-gray-400 border border-gray-600',
    label: 'text-gray-400',
    card: '',
  },
  in_progress: {
    ring: 'bg-blue-900/60 border border-blue-500/60',
    label: 'text-blue-400',
    card: 'border-blue-500/30',
  },
  success: {
    ring: 'bg-emerald-900/60 border border-emerald-500/60 text-emerald-400',
    label: 'text-emerald-400',
    card: 'border-emerald-500/30',
  },
  error: {
    ring: 'bg-red-900/60 border border-red-500/60 text-red-400',
    label: 'text-red-400',
    card: 'border-red-500/30',
  },
};

function StatusRing({ status }) {
  const cfg = statusConfig[status] || statusConfig.waiting;
  if (status === 'in_progress') {
    return (
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.ring}`}>
        <LoadingSpinner size="sm" color="cyan" />
      </div>
    );
  }
  const icon = status === 'success' ? '✓' : status === 'error' ? '✕' : '○';
  return (
    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${cfg.ring}`}>
      {icon}
    </div>
  );
}

export default function StatusCard({ title, statusData, onRetry }) {
  const cfg = statusConfig[statusData.status] || statusConfig.waiting;
  return (
    <div className={`flex items-start gap-3 rounded-lg p-4 bg-white/[0.03] border border-white/[0.06] ${cfg.card}`}>
      <StatusRing status={statusData.status} />
      <div className="flex-1 min-w-0">
        <p className={`font-semibold text-sm ${cfg.label}`}>{title}</p>
        <p className="text-xs text-gray-400 mt-0.5">{statusData.message}</p>
        {statusData.txHash && (
          <a
            href={statusData.explorerUrl || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-400 hover:text-cyan-300 text-xs mt-1 inline-block"
          >
            View tx ↗
          </a>
        )}
        {statusData.status === 'error' && onRetry && (
          <button
            onClick={onRetry}
            className="mt-2 bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-xs text-white transition-colors"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
