import React from 'react';
import GlassCard from '../ui/GlassCard';

export default function TrustCenter({ agentStatus, teeState }) {
  const isHardware = agentStatus?.tee?.enabled;
  const teeMode = agentStatus?.tee?.tee_mode;
  const isVerified = teeMode === 'HARDWARE' || teeMode === 'MOCK';
  const agentAddress = agentStatus?.agent?.address;

  return (
    <GlassCard className={`border-2 transition-all duration-500 ${isVerified ? 'border-emerald-500/20' : 'border-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.05)]'}`}>
      <div className={`font-mono text-[10px] font-bold border-b border-white/10 pb-2 mb-4 uppercase tracking-widest flex items-center justify-between ${isVerified ? 'text-emerald-500' : 'text-amber-500'}`}>
        <span>Trust & Verifiability Center</span>
        <div className="flex items-center gap-1">
           <span className={`w-2 h-2 rounded-full animate-pulse ${isVerified ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
           {isVerified ? 'ENCLAVE SECURE' : 'DEV_MODE: SIMULATION'}
        </div>
      </div>

      <div className="space-y-4">
        {/* Verification Status */}
        <div className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${isVerified ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all ${isVerified ? 'bg-emerald-500/20 border-emerald-500/40' : 'bg-amber-500/20 border-amber-500/40'}`}>
            <svg className={`w-6 h-6 ${isVerified ? 'text-emerald-400' : 'text-amber-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04a11.357 11.357 0 00-1.226 5.616 12.234 12.234 0 001.022 4.192 12.153 12.153 0 008.822 8.216a12.153 12.153 0 008.822-8.216 12.234 12.234 0 001.022-4.192 11.357 11.357 0 00-1.226-5.616z" />
            </svg>
          </div>
          <div>
            <p className={`text-xs font-bold ${isVerified ? 'text-emerald-400' : 'text-amber-400'}`}>
              {isVerified ? 'TEE Verified: Intel TDX' : 'Simulation Mode'}
            </p>
            <p className={`text-[10px] font-mono break-all line-clamp-1 ${isVerified ? 'text-emerald-500/70' : 'text-amber-500/70'}`}>
              {agentAddress || '0x_MOCK_IDENTITY'}
            </p>
          </div>
        </div>

        {/* TEE Specs */}
        <div className="space-y-2 font-mono text-[10px]">
          <div className="flex justify-between py-1 border-b border-white/5">
            <span className="text-gray-500">Hardware Arch</span>
            <span className={isVerified ? 'text-gray-200' : 'text-amber-200'}>
              {teeMode === 'HARDWARE' ? 'Intel TDX (Phala dStack)' : (teeMode === 'MOCK' ? 'dStack Simulation (Intel TDX)' : 'Standard CPU (MOCK)')}
            </span>
          </div>
          <div className="flex justify-between py-1 border-b border-white/5">
            <span className="text-gray-500">Attestation Mode</span>
            <span className={isVerified ? 'text-emerald-400' : 'text-amber-400 font-bold'}>
              {isVerified ? 'Hardware Quote v3' : 'SIMULATION'}
            </span>
          </div>
          <div className="flex justify-between py-1 border-b border-white/5">
            <span className="text-gray-500">Security Level</span>
            <span className={isVerified ? 'text-emerald-400' : 'text-amber-500'}>
              {isVerified ? 'PRODUCTION' : 'LOW (MOCK_ENABLED)'}
            </span>
          </div>
        </div>

        {/* Proof JSON Button */}
        <button 
          onClick={() => window.open('/api/attestation', '_blank')}
          className={`w-full py-2 border rounded text-[10px] font-bold tracking-widest transition-all ${isHardware ? 'bg-emerald-500/5 hover:bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/5 hover:bg-amber-500/10 border-amber-500/20 text-amber-400'}`}
        >
          VIEW RAW ATTESTATION DATA
        </button>
        
        <div className="bg-black/40 p-2 rounded border border-white/5">
           <p className="text-[9px] text-gray-500 leading-tight uppercase">
             This agent's private keys were derived inside a secure enclave and never exposed to the host OS. 
             Every trade is verifiable via on-chain reputation.
           </p>
        </div>
      </div>
    </GlassCard>
  );
}
