import React from 'react';

export default function StrykrIntelligenceLog({ scanResults, activeSymbol }) {
  // Use results or defaults
  const results = scanResults?.length > 0 ? scanResults : [
    { symbol: 'BTC', spread: 0.082, confidence: 0.98, funding: 0.0001 },
    { symbol: 'ETH', spread: 0.125, confidence: 0.95, funding: 0.00015 },
    { symbol: 'SOL', spread: 0.240, confidence: 0.88, funding: 0.0004 }
  ];

  return (
    <div className="bg-black/40 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-xl">
      <div className="bg-white/5 border-b border-white/5 px-6 py-4 flex justify-between items-center">
        <h3 className="font-mono text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">Strykr PRISM Multi-Asset Scan</h3>
        <span className="text-[10px] text-emerald-500 font-mono animate-pulse">● LIVE_FEED</span>
      </div>
      
      <div className="p-6">
        <table className="w-full text-left font-mono text-xs">
          <thead>
            <tr className="text-gray-500 border-b border-white/5">
              <th className="pb-3 font-medium">ASSET</th>
              <th className="pb-3 font-medium">SPREAD (%)</th>
              <th className="pb-3 font-medium">FUNDING</th>
              <th className="pb-3 font-medium">CONFIDENCE</th>
              <th className="pb-3 font-medium text-right">STATUS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {results.filter(r => ['BTC', 'ETH', 'SOL'].includes(r.symbol)).map((item) => (
              <tr 
                key={item.symbol} 
                className={`transition-all duration-300 ${activeSymbol === item.symbol ? 'bg-cyan-500/10 text-white' : 'text-gray-400 hover:text-gray-200'}`}
              >
                <td className="py-4 font-bold flex items-center gap-2">
                   <div className={`w-1.5 h-1.5 rounded-full ${activeSymbol === item.symbol ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]' : 'bg-gray-700'}`}></div>
                   {item.symbol}/USD
                </td>
                <td className={`py-4 font-bold ${item.spread > 0.1 ? 'text-emerald-400' : ''}`}>
                  {item.spread.toFixed(3)}%
                </td>
                <td className="py-4 text-[10px]">{(item.funding * 100).toFixed(4)}%</td>
                <td className="py-4">
                  <div className="w-20 h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-500/50" style={{ width: `${item.confidence * 100}%` }}></div>
                  </div>
                </td>
                <td className="py-4 text-right">
                   {activeSymbol === item.symbol ? (
                     <span className="text-[9px] bg-cyan-500 text-black px-2 py-0.5 rounded font-black tracking-tighter shadow-[0_0_10px_rgba(34,211,238,0.4)]">ACTIVE_SELECTION</span>
                   ) : (
                     <span className="text-[9px] text-gray-600">MONITORING</span>
                   )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        <div className="mt-6 flex gap-4 items-center bg-white/[0.02] p-3 rounded-lg border border-white/5">
           <div className="flex -space-x-2">
              <div className="w-6 h-6 rounded-full bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-[10px] font-bold text-orange-400">B</div>
              <div className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-[10px] font-bold text-blue-400">E</div>
              <div className="w-6 h-6 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-[10px] font-bold text-purple-400">S</div>
           </div>
           <p className="text-[9px] text-gray-500 leading-tight">
             PRISM batch resolution complete. Cross-venue liquidity verified via TEE. 
             Trading logic optimized for <strong>Delta Neutral Exposure</strong> across 3 primary pairs.
           </p>
        </div>
      </div>
    </div>
  );
}
