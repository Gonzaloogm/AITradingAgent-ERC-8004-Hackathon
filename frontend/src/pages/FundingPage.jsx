import { useState, useEffect, useRef } from 'react';
import GlassCard from '../components/ui/GlassCard';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useWallet } from '../hooks/useWallet';
import { useToast } from '../components/ui/Toast';
import { apiClient } from '../api/client';
import { formatEth, formatAddress, copyToClipboard } from '../utils/formatters';
import { WalletManager } from '../utils/walletManager';
import { QRCodeSVG as QRCode } from 'qrcode.react';

export default function FundingPage() {
  const toast = useToast();
  const { wallet, loading: walletLoading, error: walletError, formattedBalance, isFunded, refetch } = useWallet(5000);
  const [chainConfig, setChainConfig] = useState(null);
  const [walletMgr, setWalletMgr] = useState(null);
  const [connected, setConnected] = useState(false);
  const [userAddress, setUserAddress] = useState('');
  const [userBalance, setUserBalance] = useState('0');
  const [amount, setAmount] = useState('0.01');
  const [txStatus, setTxStatus] = useState(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await apiClient.getChainConfig();
      if (r.success) {
        setChainConfig(r.data);
        setWalletMgr(new WalletManager(r.data));
      }
    })();
  }, []);

  const handleCopy = async () => {
    if (!wallet?.address) return;
    const ok = await copyToClipboard(wallet.address);
    toast(ok ? 'Address copied!' : 'Copy failed', ok ? 'success' : 'error');
  };

  const handleConnect = async () => {
    try {
      const addr = await walletMgr.connect();
      setUserAddress(addr);
      const bal = await walletMgr.getBalance(addr);
      setUserBalance(formatEth(bal));
      setConnected(true);
      toast('Wallet connected!', 'success');
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const handleDisconnect = () => {
    walletMgr.disconnect();
    setConnected(false);
    setUserAddress('');
    toast('Disconnected', 'info');
  };

  const handleSend = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast('Enter a valid amount', 'error'); return; }
    if (!wallet?.address) { toast('Agent wallet not loaded', 'error'); return; }
    setSending(true);
    setTxStatus({ type: 'pending', message: 'Processing transaction...' });
    try {
      const txHash = await walletMgr.sendTransaction(wallet.address, amt);
      const explorerBase = chainConfig?.block_explorer_urls?.[0];
      const explorerUrl = explorerBase ? `${explorerBase}/tx/${txHash}` : null;
      setTxStatus({ type: 'success', message: 'Transaction sent!', txHash, explorerUrl });
      toast('Transaction sent!', 'success');
      setTimeout(() => { refetch(); setTxStatus(null); }, 6000);
    } catch (e) {
      setTxStatus({ type: 'error', message: e.message });
      toast('Transaction failed: ' + e.message, 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold gradient-text tracking-tight">Wallet Funding</h1>
        <p className="text-gray-500 mt-1 text-sm">Fund your agent wallet to enable on-chain registration</p>
      </div>

      {/* Wallet Address Card */}
      <GlassCard>
        <h2 className="text-lg font-bold mb-4 cyan-text">Wallet Address</h2>
        {walletLoading ? (
          <div className="flex items-center gap-3 text-gray-400">
            <LoadingSpinner size="sm" /> Loading...
          </div>
        ) : walletError ? (
          <p className="text-red-400 text-sm">❌ {walletError}</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <code className="flex-1 bg-black/30 border border-white/[0.08] px-4 py-3 rounded-lg text-sm font-mono text-gray-200 break-all">
                {wallet?.address}
              </code>
              <button
                onClick={handleCopy}
                className="flex-shrink-0 bg-cyan-600/20 border border-cyan-500/40 hover:bg-cyan-600/30 text-cyan-400 px-4 py-3 rounded-lg text-sm transition-all"
              >
                Copy
              </button>
            </div>
            {wallet?.address && (
              <div className="flex justify-center py-2">
                <div className="p-3 bg-white rounded-xl">
                  <QRCode value={wallet.qr_code_data || wallet.address} size={180} />
                </div>
              </div>
            )}
          </div>
        )}
      </GlassCard>

      {/* Balance Card */}
      <GlassCard>
        <h2 className="text-lg font-bold mb-4 cyan-text">Balance</h2>
        <div className="flex items-end gap-3 mb-3">
          <span className="font-mono text-4xl font-bold text-white">{formattedBalance}</span>
          <span className="text-gray-400 text-xl mb-1">ETH</span>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Minimum required: <span className="text-white">{wallet?.minimum_balance || '0.001'}</span> ETH
        </p>
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${isFunded ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-red-500'}`} />
          <span className={`text-sm font-medium ${isFunded ? 'text-emerald-400' : 'text-red-400'}`}>
            {isFunded ? '✓ Wallet funded' : 'Waiting for funds...'}
          </span>
        </div>
        {isFunded && (
          <a href="/" className="inline-block mt-4 bg-emerald-600 hover:bg-emerald-700 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all">
            Continue to Registration →
          </a>
        )}
      </GlassCard>

      {/* Network Info Card */}
      {chainConfig && (
        <GlassCard>
          <h2 className="text-lg font-bold mb-4 cyan-text">Network Info</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Chain</p>
              <p className="font-mono text-sm text-gray-200">{wallet?.chain_name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Chain ID</p>
              <p className="font-mono text-sm text-gray-200">{wallet?.chain_id}</p>
            </div>
            {chainConfig.faucet_url && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Get testnet ETH</p>
                <a href={chainConfig.faucet_url} target="_blank" rel="noopener noreferrer"
                   className="text-cyan-400 hover:text-cyan-300 text-sm transition-colors">
                  Faucet →
                </a>
              </div>
            )}
          </div>
        </GlassCard>
      )}

      {/* MetaMask Send Card */}
      <GlassCard>
        <h2 className="text-lg font-bold mb-4 cyan-text">Send from MetaMask</h2>
        {!connected ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-400">Connect your MetaMask wallet to send ETH directly to the agent wallet.</p>
            <button
              onClick={handleConnect}
              disabled={!walletMgr}
              className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed
                px-6 py-3 rounded-xl font-semibold text-sm transition-all
                shadow-[0_0_20px_rgba(157,0,255,0.2)] hover:shadow-[0_0_30px_rgba(157,0,255,0.35)]"
            >
              Connect MetaMask
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Connected wallet info */}
            <div className="bg-black/20 border border-white/[0.06] rounded-lg px-4 py-3">
              <p className="text-xs text-gray-500 mb-1">Connected Wallet</p>
              <p className="font-mono text-sm text-gray-200">{formatAddress(userAddress)}</p>
              <p className="text-xs text-gray-500 mt-1">Balance: <span className="text-white">{userBalance} ETH</span></p>
            </div>

            {/* Amount Input */}
            <div>
              <label className="block text-xs text-gray-500 mb-2">Amount to Send (ETH)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  step="0.001"
                  min="0.001"
                  placeholder="0.01"
                  className="flex-1 bg-black/30 border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500/50 transition-colors font-mono"
                />
                {['0.001', '0.01', '0.1'].map(v => (
                  <button key={v} onClick={() => setAmount(v)}
                    className="bg-white/[0.04] border border-white/[0.08] hover:border-cyan-500/30 px-3 rounded-lg text-xs text-gray-400 hover:text-cyan-400 transition-colors">
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Transaction Status */}
            {txStatus && (
              <div className={`px-4 py-3 rounded-lg text-sm ${
                txStatus.type === 'success' ? 'bg-emerald-900/30 border border-emerald-500/30 text-emerald-400' :
                txStatus.type === 'error'   ? 'bg-red-900/30 border border-red-500/30 text-red-400' :
                'bg-blue-900/30 border border-blue-500/30 text-blue-400'
              }`}>
                {txStatus.message}
                {txStatus.explorerUrl && (
                  <a href={txStatus.explorerUrl} target="_blank" rel="noopener noreferrer"
                     className="block text-xs text-cyan-400 hover:text-cyan-300 mt-1">
                    View on explorer →
                  </a>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={handleSend} disabled={sending}
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2">
                {sending ? <><LoadingSpinner size="sm" /> Sending...</> : 'Send ETH'}
              </button>
              <button onClick={handleDisconnect}
                className="bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] px-4 py-3 rounded-xl text-sm transition-colors text-gray-400">
                Disconnect
              </button>
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
