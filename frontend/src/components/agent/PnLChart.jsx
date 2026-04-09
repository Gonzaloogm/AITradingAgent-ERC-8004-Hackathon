import React from 'react';

export default function PnLChart({ data }) {
  if (!data || data.length < 2) return <div className="h-full w-full flex items-center justify-center text-gray-500 font-mono text-[10px]">Awaiting Telemetry...</div>;

  const width = 800; // Increased width for center view
  const height = 250; // Increased height
  const padding = 20;

  const values = data.map(d => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 0.0001;

  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * (width - 2 * padding) + padding;
    const y = height - ((d.value - minVal) / range) * (height - 2 * padding) - padding;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="w-full h-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
        <defs>
          <linearGradient id="pnlGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={`M ${points.split(' ')[0]} L ${points} V ${height} H ${points.split(' ')[0].split(',')[0]} Z`}
          fill="url(#pnlGradient)"
        />
        <polyline
          fill="none"
          stroke="#10b981"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
          className="drop-shadow-[0_0_12px_rgba(16,185,129,0.8)]"
        />
      </svg>
    </div>
  );
}
