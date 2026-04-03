import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/client';
import { formatEth } from '../utils/formatters';

export function useWallet(pollInterval = 5000) {
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  const fetchWallet = useCallback(async () => {
    const result = await apiClient.getWallet();
    if (result.success) {
      setWallet(result.data);
      setError(null);
    } else {
      setError(result.error);
    }
    setLoading(false);
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
