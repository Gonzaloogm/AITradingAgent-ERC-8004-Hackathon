import { useState, useEffect } from 'react';
import { useWallet } from '../hooks/useWallet';
import { apiClient } from '../api/client';
import { formatAddress } from '../utils/formatters';
import { WalletManager } from '../utils/walletManager';
import { QRCodeSVG as QRCode } from 'qrcode.react';
import { toast } from 'sonner';
import { Wallet, ArrowUpCircle, Activity, Info, ShieldCheck } from 'lucide-react';
import LoadingSpinner from '../components/ui/LoadingSpinner';

export default function LiquidityPage() {
  const { wallet, loading, formattedBalance, isFunded, refetch } = useWallet(5000);
  const [chainConfig, setChainConfig] = useState(null);
  const [walletMgr, setWalletMgr] = useState(null);
  const [connected, setConnected] = useState(false);
  const [userAddress, setUserAddress] = useState('');
  const [userBalance, setUserBalance] = useState('0');
  const [amount, setAmount] = useState('0.01');
  const [sending, setSending] = useState(false);
  const [activating, setActivating] = useState(false);
  const [showLockAnim, setShowLockAnim] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await apiClient.getChainConfig();
      if (r.success) {
        setChainConfig(r.data);
        const manager = new WalletManager(r.data);
        setWalletMgr(manager);
        if (manager.shouldAutoConnect()) {
          try {
            const addr = await manager.connect();
            setUserAddress(addr);
            setUserBalance(await manager.getBalance(addr));
            setConnected(true);
          } catch (e) {}
        }
      }
    })();
  }, []);

  const handleConnect = async () => {
    try {
      const addr = await walletMgr.connect();
      setUserAddress(addr);
      setUserBalance(await walletMgr.getBalance(addr));
      setConnected(true);
      toast.success('Authority linked and verified');
    } catch (e) { toast.error('Connection failed: ' + e.message); }
  };

  const handleSend = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast.warning('Specify a valid injection amount'); return; }
    if (!wallet?.address) return;
    
    setSending(true);
    try {
      await walletMgr.sendTransaction(wallet.address, amt);
      toast.success('Funds committed to Secure Enclave');
      setTimeout(() => { refetch(); }, 8000);
    } catch (e) { toast.error('Transaction failed: ' + e.message); } 
    finally { setSending(false); }
  };

  const handleManualActivate = async () => {
    setActivating(true);
    try {
      const r = await apiClient.post('/api/activate', {});
      if (r.success) {
        setShowLockAnim(true);
        setTimeout(() => {
            setShowLockAnim(false);
            toast.success('Enclave Strategy Engaged Successfully');
            localStorage.setItem('DEMO_OPERATIONAL', 'true');
            window.dispatchEvent(new Event('storage'));
            setTimeout(() => { refetch(); }, 1000);
        }, 3000);
      } else {
        toast.error('Activation failed: ' + (r.error || 'Unknown error'));
      }
    } catch (e) {
      toast.error('Execution Error: ' + e.message);
    } finally {
      setActivating(false);
    }
  };

  const transfers = [
    { date: '2026-04-10 10:12:04', type: 'INBOUND', asset: 'ETH', amount: '0.0500', status: 'CONFIRMED' },
    { date: '2026-04-10 09:45:12', type: 'INTERNAL', asset: 'USDC', amount: '150.00', status: 'ATTESTED' },
    { date: '2026-04-09 23:10:55', type: 'OUTBOUND', asset: 'ETH', amount: '0.0100', status: 'SETTLED' },
  ];

  if (loading) {
     return (
       <div className="min-h-screen flex flex-col items-center justify-center bg-[#0D0F14]">
         <LoadingSpinner size="lg" />
         <p className="mt-8 text-xs font-bold text-slate-600 uppercase tracking-widest animate-pulse">Establishing Reserve Authority...</p>
       </div>
     );
  }

  return (
    <div className="space-y-6 animate-fadein max-w-[1400px] mx-auto">
      <div className="dashboard-card p-10 flex flex-col relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#00BFA5]/20 to-transparent" />
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3 lowercase">
          <Wallet className="text-[#00BFA5]" size={22} />
          liquidity_management_repository
        </h1>
        <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest font-semibold italic">Multi-asset sovereign enclave funding protocol</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        {/* RESERVES */}
        <div className="dashboard-card p-6 flex flex-col justify-between">
          <div className="flex justify-between items-center mb-8">
             <div className="flex items-center gap-3">
                <Activity size={16} className="text-[#0091EA]" />
                <span className="text-xs font-bold text-white uppercase tracking-widest">Enclave Reserves</span>
             </div>
             <span className="text-[9px] font-black text-slate-500 px-2 py-0.5 border border-white/5 rounded">LIVE_AUDIT</span>
          </div>
          <div className="space-y-8 flex-1">
             <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Native Asset (ETH)</span>
                <div className="text-3xl font-bold text-white tracking-tight">{formattedBalance} <span className="text-sm font-normal text-slate-600">ETH</span></div>
             </div>
             <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Inventory (USDC)</span>
                <div className="text-2xl font-bold text-white tracking-tight opacity-80">1,245.50 <span className="text-xs font-normal text-slate-600">USDC</span></div>
             </div>
          </div>
          <div className={`mt-auto px-4 py-2.5 rounded border flex items-center gap-3 ${isFunded ? 'bg-[#00BFA5]/5 border-[#00BFA5]/10 text-[#00BFA5]' : 'bg-rose-500/5 border-rose-500/10 text-rose-500'}`}>
             <div className={`w-1.5 h-1.5 rounded-full ${isFunded ? 'bg-[#00BFA5]' : 'bg-rose-500'}`} />
             <span className="text-[10px] font-bold uppercase tracking-widest">{isFunded ? 'STRATEGY_NOMINAL' : 'LIMIT_LIQUIDITY_ALARM'}</span>
          </div>
        </div>

        {/* INBOUND PATHWAY */}
        <div className="dashboard-card p-6 flex flex-col h-full pb-4 border-teal-500/10 active:border-teal-500/20">
          <div className="flex justify-between items-center mb-6">
             <div className="flex items-center gap-3">
                <ArrowUpCircle size={16} className="text-[#00BFA5]" />
                <span className="text-xs font-bold text-white uppercase tracking-widest">Asset Inbound Path</span>
             </div>
          </div>
          <div className="bg-black/20 rounded border border-white/5 p-6 flex flex-col items-center justify-center space-y-4 flex-1 min-h-0">
             <div className="p-3 bg-white rounded-xl shadow-[0_0_20px_rgba(0,145,234,0.15)] overflow-hidden">
                <QRCode value={wallet?.address || ''} size={140} bgColor="#FFFFFF" fgColor="#0D0F14" />
             </div>
             <div className="text-center w-full">
                <span className="text-[8px] text-slate-600 uppercase font-bold block mb-1">Authority ECDSA Path</span>
                <code className="text-[10px] text-white/40 font-mono break-all leading-relaxed block px-4 py-1 bg-white/5 rounded">
                   {wallet?.address}
                </code>
             </div>
          </div>
          <div className="flex gap-2 mt-4 flex-shrink-0">
             <button onClick={() => { navigator.clipboard.writeText(wallet?.address); toast.info('Path copied to clipboard'); }} className="flex-1 bg-white/5 hover:bg-white/10 text-slate-400 py-3 rounded text-[10px] font-bold uppercase transition-all tracking-widest">Copy ID</button>
             <button onClick={handleConnect} className="flex-1 bg-[#0091EA]/10 hover:bg-[#0091EA]/20 text-[#0091EA] border border-[#0091EA]/20 py-3 rounded text-[10px] font-bold uppercase transition-all tracking-widest">{connected ? 'Auth Active' : 'Link Authority'}</button>
          </div>
        </div>

        {/* LEDGER */}
        <div className="dashboard-card p-6 min-h-0 flex flex-col">
          <div className="flex justify-between items-center mb-6">
             <div className="flex items-center gap-3">
                <Info size={16} className="text-slate-500" />
                <span className="text-xs font-bold text-white uppercase tracking-widest">Ledger History</span>
             </div>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3 scrollbar-hide">
             {transfers.map((tx, i) => (
                <div key={i} className="flex flex-col p-3 bg-white/[0.02] border border-white/5 rounded">
                   <div className="flex justify-between items-center mb-1">
                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${tx.type === 'INBOUND' ? 'bg-[#0091EA]/10 text-[#0091EA]' : 'bg-slate-500/10 text-slate-500'}`}>
                         {tx.type}
                      </span>
                      <span className="text-[8px] text-slate-600 font-mono">{tx.date}</span>
                   </div>
                   <div className="flex justify-between items-end">
                      <span className="text-[12px] font-bold text-white">{tx.amount} {tx.asset}</span>
                      <span className="text-[7px] text-[#00BFA5] font-black uppercase tracking-widest">{tx.status}</span>
                   </div>
                </div>
             ))}
          </div>
        </div>

      </div>

      {connected && (
        <div className="dashboard-card p-10 flex flex-col lg:flex-row items-center justify-between gap-10 animate-fadein border-[#00BFA5]/10 relative">
          {showLockAnim && (
                <div className="absolute inset-0 z-[100] bg-[#0D0F14]/95 flex flex-col items-center justify-center animate-fadein backdrop-blur-xl border border-[#00BFA5]/20 rounded-xl">
                    <div className="w-12 h-12 border border-[#00BFA5] rounded-full flex items-center justify-center mb-4 animate-pulse">
                        <ShieldCheck size={20} className="text-[#00BFA5]" />
                    </div>
                    <div className="text-[10px] font-black text-white uppercase tracking-[0.3em] mb-1">Funds Locked in TEE Enclave</div>
                    <div className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">Committing Secure Identity...</div>
                    <div className="mt-4 w-32 h-0.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-[#00BFA5] animate-grow" />
                    </div>
                </div>
          )}

          <div className="flex flex-col">
             <span className="text-[10px] text-slate-500 uppercase font-bold tracking-[0.2em] mb-2 lowercase">external_authority_session</span>
             <div className="flex items-center gap-4">
                <div className="w-2.5 h-2.5 rounded-full bg-[#00BFA5] shadow-[0_0_12px_#00BFA5]" />
                <span className="text-base font-mono text-cyan-400 font-bold tracking-tight">{formatAddress(userAddress)}</span>
             </div>
             <div className="flex items-center gap-3 mt-4">
                <span className="text-[10px] text-[#0091EA] font-bold uppercase">Liquidity Authority:</span>
                <span className="text-[10px] text-white/60 font-mono">{userBalance} ETH</span>
             </div>
          </div>

          <div className="flex items-center gap-6">
             <div className="flex flex-col items-end">
                <span className="text-[9px] text-slate-600 uppercase font-bold tracking-widest mb-1">Injection Value (ETH)</span>
                <div className="flex items-center gap-4">
                    <input
                        type="number"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        className="bg-black/30 border border-white/10 rounded px-4 py-2.5 text-sm text-[#00BFA5] w-28 text-right font-mono focus:outline-none focus:border-[#00BFA5]/20"
                    />
                    <button
                        onClick={handleManualActivate}
                        disabled={activating || !isFunded || showLockAnim}
                        className={`px-8 py-2.5 rounded text-[11px] font-bold uppercase tracking-widest transform active:scale-95 transition-all shadow-lg ${
                        (!isFunded || showLockAnim)
                            ? 'bg-white/5 text-slate-600 cursor-not-allowed opacity-40' 
                            : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-500/20'
                        }`}
                    >
                        {activating ? <LoadingSpinner size="sm" /> : (showLockAnim ? 'LOCKED_SECURE' : 'EXECUTE')}
                    </button>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
