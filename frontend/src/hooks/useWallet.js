import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/client';
import { formatEth } from '../utils/formatters';

export function useWallet(pollInterval = 5000) {
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  const fetchWallet = useCallback(async () => {
    const result = await apiClient.getWallet();
    if (result.success && result.data?.address) {
      setWallet(result.data);
      setError(null);
      setLoading(false);
    } else {
      // If result is failure OR address is missing, we treat it as "still loading" enclave identity
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

  return { wallet, loading, error, formattedBalance, isFunded, refetch: fetchWallet };
}
