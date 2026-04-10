import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '../api/client';
import { formatEth } from '../utils/formatters';

export function useWallet(pollInterval = 10000) {
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  // Cache ref to prevent unnecessary state updates that cause flicker
  const prevWalletRef = useRef(null);

  const fetchWallet = useCallback(async () => {
    const result = await apiClient.getWallet();
    if (result.success && result.data?.address) {
      const incoming = result.data;
      const prev = prevWalletRef.current;

      // Only update state if something meaningful actually changed.
      // This prevents the button from flickering on every poll tick.
      const hasChanged =
        !prev ||
        prev.balance     !== incoming.balance ||
        prev.funded      !== incoming.funded  ||
        prev.margin_ready !== incoming.margin_ready ||
        prev.address     !== incoming.address ||
        prev.qr_code_data !== incoming.qr_code_data;

      if (hasChanged) {
        prevWalletRef.current = incoming;
        setWallet(incoming);
      }

      setError(null);
      setLoading(false);
    } else {
      // If result is failure OR address is missing, treat as "still loading" enclave identity
      if (!result.success && result.error !== 'Waiting for enclave data...') {
        setError(result.error);
        setLoading(false);
      }
      // Otherwise, keep loading = true so the UI stays in "initializing" state
    }
  }, []);

  useEffect(() => {
    fetchWallet();
    const id = setInterval(fetchWallet, pollInterval);
    return () => clearInterval(id);
  }, [fetchWallet, pollInterval]);

  const formattedBalance = wallet ? formatEth(wallet.balance) : '0.0000';
  const isFunded = wallet?.funded ?? false;
  const marginReady = wallet?.margin_ready ?? false;

  return { wallet, loading, error, formattedBalance, isFunded, marginReady, refetch: fetchWallet };
}
