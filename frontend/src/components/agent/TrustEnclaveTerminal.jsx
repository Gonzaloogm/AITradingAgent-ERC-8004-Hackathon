import React, { useState, useEffect, useRef } from 'react';

export default function TrustEnclaveTerminal({ isSigning }) {
  const [lines, setLines] = useState([]);
  const containerRef = useRef(null);

  // Generate random hex characters
  const generateHexLine = () => {
    const chars = '0123456789ABCDEF';
    let line = '';
    for (let i = 0; i < 64; i++) {
        line += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return line;
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setLines(prev => {
        const newLine = generateHexLine();
        const next = [...prev, newLine];
        if (next.length > 20) return next.slice(1);
        return next;
      });
    }, 100);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines]);

  return (
    <div className={`relative bg-black/90 border-2 rounded-xl h-[300px] overflow-hidden transition-all duration-300 ${isSigning ? 'border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.4)]' : 'border-white/5'}`}>
       {/* Background Glow */}
       <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,255,100,0.05)_0%,transparent_70%)] pointer-events-none" />
       
       <div className="bg-white/5 px-4 py-2 border-b border-white/5 flex justify-between items-center relative z-10 backdrop-blur-md">
          <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
             <span className="text-[10px] font-mono font-bold text-emerald-400 tracking-tighter uppercase">Live Attestation Quote Stream [TDX_64_HEX]</span>
          </div>
          <span className="text-[9px] text-gray-500 font-mono">ENCLAVE_READY</span>
       </div>

       <div ref={containerRef} className="p-4 font-mono text-[11px] leading-tight text-emerald-500/80 overflow-hidden select-none">
          {lines.map((line, i) => (
             <div key={i} className="whitespace-nowrap opacity-60 hover:opacity-100 transition-opacity">
                <span className="mr-4 text-emerald-900">{i.toString(16).padStart(4, '0')}</span>
                {line.match(/.{1,4}/g).join(' ')}
             </div>
          ))}
       </div>

       {/* Scanline Effect */}
       <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,128,0,0.02),rgba(0,0,255,0.06))] z-20 bg-[length:100%_4px,3px_100%]" />
       
       {isSigning && (
          <div className="absolute inset-0 bg-emerald-500/10 flex items-center justify-center z-30 animate-pulse border-4 border-emerald-500/50">
             <span className="text-2xl font-black text-emerald-400 drop-shadow-[0_0_10px_rgba(0,255,0,0.8)] tracking-widest uppercase">CRON_JOB: SIGNING_PAYLOAD...</span>
          </div>
       )}
    </div>
  );
}
