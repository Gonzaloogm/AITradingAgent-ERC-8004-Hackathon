import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Zap, Lock, ChevronRight, Activity } from 'lucide-react';

const FEATURES = [
  {
    icon: <Shield size={20} className="text-[#00BFA5]" />,
    title: 'TEE Attestation',
    desc: 'Intel TDX hardware isolation. Every trade is cryptographically attested and verifiable on-chain.',
  },
  {
    icon: <Zap size={20} className="text-[#0091EA]" />,
    title: 'AI Decision Engine',
    desc: 'Gemini-powered LLM sets dynamic spread thresholds in real time, adapting to market volatility.',
  },
  {
    icon: <Lock size={20} className="text-amber-400" />,
    title: 'Delta-Neutral Strategy',
    desc: 'Cash-and-carry arbitrage between spot and perpetual markets. Zero directional exposure.',
  },
  {
    icon: <Activity size={20} className="text-violet-400" />,
    title: 'ERC-8004 Identity',
    desc: 'On-chain agent registration with reputation scoring. Fully compliant with the ERC-8004 standard.',
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden">



      {/* Ambient glow blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full bg-[#0091EA]/5 blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-[#00BFA5]/5 blur-[100px]" />
      </div>

      {/* ── HERO (centrado) ── */}
      <div
        className={`relative z-10 flex flex-col items-center justify-center min-h-screen px-6 pb-32 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
      >
        <div className="flex flex-col items-center text-center max-w-3xl w-full">

          {/* Badge */}
          <div className="mb-6 flex items-center gap-2 px-4 py-1.5 bg-[#00BFA5]/10 border border-[#00BFA5]/20 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-[#00BFA5] animate-pulse shadow-[0_0_6px_#00BFA5]" />
            <span className="text-[9px] font-black text-[#00BFA5] uppercase tracking-[0.3em]">
              ERC-8004 · Intel TDX · Base Sepolia
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl font-black tracking-tight text-white mb-4 leading-[1.05]">
            <span className="bg-gradient-to-r from-white via-white to-slate-400 bg-clip-text text-transparent">
              STRIKER
            </span>
            <br />
            <span className="text-2xl sm:text-3xl font-bold text-slate-400 tracking-wide">
              STRIKER - Verified Autonomous Trading
            </span>
          </h1>

          {/* Description */}
          <p className="text-slate-400 text-base leading-relaxed max-w-xl mb-10">
            A TEE-secured, AI-driven delta-neutral trading agent with on-chain identity and reputation.
            Every decision signed inside an Intel TDX enclave. Every trade attested on Base Sepolia.
          </p>

          {/* CTA BUTTON */}
          <button
            id="enter-dashboard-btn"
            onClick={() => navigate('/dashboard')}
            className="group flex items-center gap-3 px-10 py-4 bg-gradient-to-r from-[#0091EA] to-[#00BFA5] hover:from-[#0080cc] hover:to-[#00a88e] text-white font-bold text-sm uppercase tracking-widest rounded-xl shadow-lg shadow-cyan-500/20 transition-all duration-300 active:scale-95 hover:shadow-cyan-400/30 hover:shadow-xl"
          >
            Enter the Enclave
            <ChevronRight
              size={18}
              className="transition-transform duration-300 group-hover:translate-x-1"
            />
          </button>

          <p className="mt-4 text-[10px] text-slate-600 uppercase tracking-widest">
            Hackathon Demo · LabLab ERC-8004 Challenge
          </p>
        </div>

        {/* ── FEATURE CARDS ── */}
        <div className="mt-20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 w-full max-w-5xl">
          {FEATURES.map((f, i) => (
            <div
              key={i}
              className="dashboard-card p-6 flex flex-col gap-3 hover:border-white/10 transition-all duration-300"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/5 rounded-lg">{f.icon}</div>
                <span className="text-xs font-bold text-white uppercase tracking-widest">{f.title}</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom fade */}
      <div className="pointer-events-none fixed bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0D0F14] to-transparent" />
    </div>
  );
}
