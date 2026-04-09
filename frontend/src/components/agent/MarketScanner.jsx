import React from 'react';
import GlassCard from '../ui/GlassCard';

export default function MarketScanner({ scanResults, activeSymbol }) {
  return (
    <GlassCard className="!p-0 overflow-hidden border-cyan-500/20">
      <div className="bg-cyan-500/5 px-4 py-2 border-b border-white/10 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-cyan-400 tracking-widest uppercase">Prism Engine: Multi-Asset Scan</span>
          <div className="flex gap-1">
            <span className="w-1 h-3 bg-cyan-500/40 animate-pulse"></span>
            <span className="w-1 h-3 bg-cyan-500/60 animate-pulse animation-delay-75"></span>
            <span className="w-1 h-3 bg-cyan-500 animate-pulse animation-delay-150"></span>
          </div>
        </div>
        <span className="text-[10px] text-gray-500 font-mono">Verifying liquidity across 5+ venues</span>
      </div>
      
      <div className="p-4">
        <div className="grid grid-cols-5 gap-4">
          {(scanResults || [
            {symbol: 'BTC', spread: 0.082, confidence: 0.98},
            {symbol: 'ETH', spread: 0.125, confidence: 0.95},
            {symbol: 'SOL', spread: 0.240, confidence: 0.88},
            {symbol: 'XRP', spread: 0.045, confidence: 0.92},
            {symbol: 'ADA', spread: 0.021, confidence: 0.85}
          ]).map((item) => (
            <div 
              key={item.symbol}
              className={`p-3 rounded-lg border transition-all duration-500 ${
                activeSymbol === item.symbol 
                ? 'bg-cyan-500/10 border-cyan-500 shadow-[0_0_15px_rgba(34,211,238,0.2)] scale-105 z-10' 
                : 'bg-white/5 border-white/10 opacity-60'
              }`}
            >
              <div className="flex justify-between items-start mb-1">
                <span className="text-sm font-bold font-mono">{item.symbol}</span>
                {activeSymbol === item.symbol && (
                   <span className="text-[8px] bg-cyan-500 text-black px-1 font-bold rounded">BEST</span>
                )}
              </div>
              <div className={`text-lg font-mono font-bold ${item.spread > 0.1 ? 'text-emerald-400' : 'text-gray-300'}`}>
                {item.real_time_spread ? item.real_time_spread.toFixed(3) : item.spread.toFixed(3)}%
              </div>
              <div className="mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-cyan-500 transition-all duration-1000" 
                  style={{ width: `${item.confidence * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </GlassCard>
  );
}
