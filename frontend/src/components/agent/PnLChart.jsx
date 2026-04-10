import React from 'react';

/**
 * PnLChart - Institutional Corporate Style
 * Features: Smooth Monotone Cubic Curve and Teal/Cyan Gradient
 */
export default function PnLChart({ data }) {
  if (!data || data.length < 2) {
    return (
      <div className="h-full w-full flex items-center justify-center text-slate-700 font-mono text-[10px] uppercase tracking-widest animate-pulse">
        Stabilizing Enclave Link...
      </div>
    );
  }

  const width = 800;
  const height = 250;
  const padding = 20;

  const values = data.map(d => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 0.0001;

  const getPoints = () => {
    return data.map((d, i) => ({
      x: (i / (data.length - 1)) * (width - 2 * padding) + padding,
      y: height - ((d.value - minVal) / range) * (height - 2 * padding) - padding
    }));
  };

  const points = getPoints();

  // Create a smooth cubic bezier path
  const createSmoothPath = (pts) => {
    if (pts.length < 2) return "";
    let d = `M ${pts[0].x},${pts[0].y}`;
    
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i === 0 ? i : i - 1];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2 === pts.length ? i + 1 : i + 2];

      // Simple Catmull-Rom to Cubic Bezier conversion for smoothness
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return d;
  };

  const linePath = createSmoothPath(points);
  const areaPath = `${linePath} V ${height} H ${padding} Z`;

  return (
    <div className="w-full h-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
        <defs>
          <linearGradient id="pnlCorporateGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0091EA" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#00BFA5" stopOpacity="0.01" />
          </linearGradient>
          <linearGradient id="lineStrokeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00BFA5" />
            <stop offset="100%" stopColor="#0091EA" />
          </linearGradient>
        </defs>
        
        {/* Area fill */}
        <path d={areaPath} fill="url(#pnlCorporateGradient)" />
        
        {/* Smooth line */}
        <path
          d={linePath}
          fill="none"
          stroke="url(#lineStrokeGradient)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
