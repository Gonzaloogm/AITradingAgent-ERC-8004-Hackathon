import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAgentStatus } from '../../hooks/useAgentStatus';
import { formatAddress } from '../../utils/formatters';

const navLinks = [
  { to: '/',          label: 'Dashboard',  icon: '⬡' },
  { to: '/results',   label: 'Live Ops',   icon: '◎' },
];

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { status } = useAgentStatus(20000);
  const location = useLocation();

  const isOnline = !!status;
  const isRegistered = status?.agent?.is_registered;
  const shortAddr = status?.agent?.address ? formatAddress(status.agent.address) : '—';

  return (
    <nav className="glass-panel sticky top-0 z-50 px-4 sm:px-6 py-3 mb-6 flex items-center justify-between">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-full flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, #00f3ff, #9d00ff)',
            boxShadow: '0 0 20px rgba(0,243,255,0.4)',
            animation: 'orbPulse 3s ease-in-out infinite alternate',
          }}
        />
        <div className="hidden sm:block">
          <p className="gradient-text font-extrabold tracking-widest text-sm leading-tight">AI TRADING AGENT</p>
          <p className="text-gray-500 text-xs font-mono">ERC-8004 · TEE Secured</p>
        </div>
      </div>

      {/* Desktop links */}
      <div className="hidden md:flex items-center gap-1">
        {navLinks.map(link => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/[0.06]'
              }`
            }
          >
            <span className="text-base leading-none">{link.icon}</span>
            {link.label}
          </NavLink>
        ))}
      </div>

      {/* Agent status badges */}
      <div className="hidden lg:flex items-center gap-2">
        <div className="flex items-center gap-2 bg-black/30 border border-white/[0.08] rounded-lg px-3 py-1.5 font-mono text-xs">
          <span className={`pulse-dot ${isOnline ? 'green' : 'red'}`} />
          <span className="text-gray-300">{isOnline ? 'Online' : 'Offline'}</span>
        </div>
        {status?.agent?.address && (
          <div className="hidden xl:flex items-center gap-2 bg-black/30 border border-white/[0.08] rounded-lg px-3 py-1.5 font-mono text-xs text-gray-300">
            {shortAddr}
          </div>
        )}
        <div className={`flex items-center gap-2 bg-black/30 border rounded-lg px-3 py-1.5 font-mono text-xs ${
          isRegistered ? 'border-emerald-500/30 text-emerald-400' : 'border-white/[0.08] text-yellow-400'
        }`}>
          <span className={`pulse-dot ${isRegistered ? 'green' : 'yellow'}`} />
          {isRegistered ? 'Registered' : 'Unregistered'}
        </div>
      </div>

      {/* Hamburger */}
      <button
        className="md:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
        onClick={() => setMenuOpen(o => !o)}
        aria-label="Toggle menu"
      >
        {menuOpen ? '✕' : '☰'}
      </button>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 glass-panel mx-4 p-3 flex flex-col gap-1 md:hidden">
          {navLinks.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-cyan-500/15 text-cyan-400'
                    : 'text-gray-400 hover:text-white hover:bg-white/[0.06]'
                }`
              }
            >
              <span>{link.icon}</span>
              {link.label}
            </NavLink>
          ))}
          <div className="border-t border-white/[0.06] mt-2 pt-2 flex items-center gap-2 px-2 text-xs font-mono text-gray-500">
            <span className={`pulse-dot ${isOnline ? 'green' : 'red'}`} />
            {isOnline ? 'Online' : 'Offline'} · {shortAddr}
          </div>
        </div>
      )}
    </nav>
  );
}
