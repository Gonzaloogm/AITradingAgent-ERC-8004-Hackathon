import React from 'react';
import GlassCard from '../ui/GlassCard';

export default function PrismScanSidebar({ scanResults, activeSymbol }) {
  const assets = [
    { symbol: 'BTC', name: 'Bitcoin' },
    { symbol: 'ETH', name: 'Ethereum' },
    { symbol: 'SOL', name: 'Solana' }
  ];

  return (
    <div className="bg-white/[0.02] rounded-3xl border border-white/5 p-8 space-y-6">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <h3 className="font-mono text-[10px] font-bold text-gray-500 uppercase tracking-[0.3em]">Prism Network Scan</h3>
        <span className="flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-cyan-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
        </span>
      </div>

      <div className="space-y-3">
        {assets.map((asset) => {
          const isActive = activeSymbol === asset.symbol;
          const data = scanResults?.find(r => r.symbol === asset.symbol);
          
          return (
            <div 
              key={asset.symbol}
              className={`p-4 rounded-2xl border transition-all duration-500 group ${
                isActive 
                ? 'bg-cyan-500/10 border-cyan-500/50 shadow-[0_0_20px_rgba(34,211,238,0.1)]' 
                : 'bg-white/[0.03] border-white/5 hover:border-white/10'
              }`}
            >
              <div className="flex justify-between items-center mb-1">
                <div className="flex flex-col">
                  <span className="text-sm font-black font-mono text-white tracking-tighter">{asset.symbol}/USDC</span>
                  <span className="text-[9px] text-gray-600 font-bold uppercase">{asset.name}</span>
                </div>
                <div className="flex flex-col items-end">
                   {isActive ? (
                     <span className="text-[9px] bg-cyan-500 text-black px-2 py-0.5 rounded font-black tracking-tighter">ACTIVE</span>
                   ) : (
                     <span className="text-[9px] text-gray-500 font-bold">SCANNING</span>
                   )}
                </div>
              </div>
              
              <div className="mt-3 flex items-center justify-between">
                 <div className="flex -space-x-1">
                    {[1,2,3].map(i => (
                      <div key={i} className={`w-1.5 h-1.5 rounded-full border border-black ${isActive ? 'bg-cyan-400' : 'bg-gray-800'}`} />
                    ))}
                 </div>
                 <span className={`text-[10px] font-mono ${isActive ? 'text-cyan-400' : 'text-gray-600'}`}>
                    {data ? `+${(data.real_time_spread || data.spread || 0).toFixed(3)}%` : '---'}
                 </span>
              </div>
            </div>
          );
        })}
      </div>
      
      <p className="text-[9px] text-gray-600 leading-tight uppercase font-medium">
        Monitoring global liquidity across Strykr Index nodes. Auto-selecting highest yield opportunity per tick.
      </p>
    </div>
  );
}
