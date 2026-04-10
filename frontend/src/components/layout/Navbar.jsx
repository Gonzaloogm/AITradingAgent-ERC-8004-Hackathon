import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useAgentStatus } from '../../hooks/useAgentStatus';
import { formatAddress } from '../../utils/formatters';
import { ShieldCheck, Activity, Wallet, Search } from 'lucide-react';

const navLinks = [
  { to: '/',          label: 'Dashboard',      icon: <Activity size={14} /> },
  { to: '/results',   label: 'Live Ops',       icon: <Search size={14} /> },
  { to: '/liquidity', label: 'Liquidity',      icon: <Wallet size={14} /> },
  { to: '/audit',     label: 'Security Audit', icon: <ShieldCheck size={14} /> },
];

export default function Navbar() {
  const { status } = useAgentStatus(20000);
  const [isOperational, setIsOperational] = useState(localStorage.getItem('DEMO_OPERATIONAL') === 'true');

  const isOnline = !!status;
  const shortAddr = status?.agent?.address ? formatAddress(status.agent.address) : '—';

  useEffect(() => {
    const checkState = () => {
      setIsOperational(localStorage.getItem('DEMO_OPERATIONAL') === 'true');
    };
    window.addEventListener('storage', checkState);
    const interval = setInterval(checkState, 1000);
    return () => {
      window.removeEventListener('storage', checkState);
      clearInterval(interval);
    };
  }, []);

  return (
    <nav className="sticky-header flex items-center justify-between px-10 mb-8 shadow-sm">
      {/* Brand - Minimalism */}
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded bg-gradient-to-br from-[#0091EA] to-[#00BFA5] shadow-lg shadow-cyan-500/20" />
        <span className="text-white font-bold tracking-tight text-base uppercase">Striker</span>
      </div>

      {/* Corporate Tabs */}
      <div className="flex items-center gap-1">
        {navLinks.map(link => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-2 px-6 h-[60px] text-[10px] font-semibold uppercase tracking-wider transition-all duration-300 transform ${
                isActive
                  ? 'text-[#00BFA5] active-tab-indicator'
                  : 'text-gray-500 hover:text-white'
              }`
            }
          >
            {link.icon}
            {link.label}
          </NavLink>
        ))}
      </div>

      {/* Status & ID - Corporate Right */}
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-2 py-1 px-3 bg-white/5 rounded-full border border-white/5">
          <div className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${
            !isOnline ? 'bg-red-500' : 
            isOperational ? 'bg-[#00BFA5] animate-pulse shadow-[0_0_8px_#00BFA5]' : 
            'bg-amber-400'
          }`} />
          <span className={`text-[9px] font-bold uppercase tracking-widest leading-none ${
            !isOnline ? 'text-gray-500' : 
            isOperational ? 'text-[#00BFA5]' : 
            'text-amber-400'
          }`}>
            {!isOnline ? 'System Offline' : isOperational ? 'Operational' : 'Validated Ready'}
          </span>
        </div>
        
        <div className="flex flex-col items-end">
          <span className="text-[7px] text-gray-600 font-bold uppercase tracking-tighter mb-0.5">Enclave_Identity</span>
          <span className="text-[10px] font-mono text-white/80 leading-none">{shortAddr}</span>
        </div>
      </div>
    </nav>
  );
}
