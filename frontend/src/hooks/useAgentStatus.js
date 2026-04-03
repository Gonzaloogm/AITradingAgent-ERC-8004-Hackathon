import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/client';

export function useAgentStatus(pollInterval = 15000) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStatus = useCallback(async () => {
    const result = await apiClient.getStatus();
    if (result.success) {
      setStatus(result.data);
      setError(null);
    } else {
      setError(result.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, pollInterval);
    return () => clearInterval(id);
  }, [fetchStatus, pollInterval]);

  return { status, loading, error, refetch: fetchStatus };
}
