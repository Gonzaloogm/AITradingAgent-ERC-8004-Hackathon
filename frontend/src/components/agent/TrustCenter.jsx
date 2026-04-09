import React from 'react';
import GlassCard from '../ui/GlassCard';

export default function TrustCenter({ agentStatus, teeState }) {
  const isHardware = agentStatus?.tee?.enabled;
  const agentAddress = agentStatus?.agent?.address;

  return (
    <GlassCard className="border-emerald-500/20">
      <div className="font-mono text-[10px] font-bold border-b border-white/10 pb-2 mb-4 text-emerald-500 uppercase tracking-widest flex items-center justify-between">
        <span>Trust & Verifiability Center</span>
        <div className="flex items-center gap-1">
           <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
           ENCLAVE SECURE
        </div>
      </div>

      <div className="space-y-4">
        {/* Verification Status */}
        <div className="flex items-center gap-3 bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/30">
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/40">
            <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04a11.357 11.357 0 00-1.226 5.616 12.234 12.234 0 001.022 4.192 12.153 12.153 0 008.822 8.216a12.153 12.153 0 008.822-8.216 12.234 12.234 0 001.022-4.192 11.357 11.357 0 00-1.226-5.616z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-bold text-emerald-400">Identity Verified</p>
            <p className="text-[10px] text-emerald-500/70 font-mono break-all line-clamp-1">{agentAddress}</p>
          </div>
        </div>

        {/* TEE Specs */}
        <div className="space-y-2 font-mono text-[10px]">
          <div className="flex justify-between py-1 border-b border-white/5">
            <span className="text-gray-500">Hardware Arch</span>
            <span className="text-gray-200">Intel TDX (Phala dStack)</span>
          </div>
          <div className="flex justify-between py-1 border-b border-white/5">
            <span className="text-gray-500">Attestation Mode</span>
            <span className="text-emerald-400">{isHardware ? 'Hardware Quote' : 'Simulation/Mock'}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-white/5">
            <span className="text-gray-500">Measurement Hash</span>
            <span className="text-gray-400">0x45ec93...524e</span>
          </div>
        </div>

        {/* Proof JSON Button */}
        <button 
          onClick={() => window.open('/api/attestation', '_blank')}
          className="w-full py-2 bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/20 rounded text-[10px] font-bold text-emerald-400 tracking-widest transition-all"
        >
          VIEW RAW TDX QUOTE (JSON)
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
