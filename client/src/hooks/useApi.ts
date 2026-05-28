import { useState, useCallback } from 'react';
import { sendChat, fetchTodayPlan, fetchTaste, fetchPrefs, savePrefs, type ChatResponse } from '../services/api.js';

export function useApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chat = useCallback(async (message: string): Promise<ChatResponse | null> => {
    setLoading(true); setError(null);
    try {
      return await sendChat(message);
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getPlan = useCallback(async () => {
    try { return await fetchTodayPlan(); } catch { return []; }
  }, []);

  const getTaste = useCallback(async () => {
    try { return await fetchTaste(); } catch { return {} as Record<string, unknown>; }
  }, []);

  const getPrefs = useCallback(async (): Promise<Record<string, string>> => {
    try { return await fetchPrefs(); } catch { return {}; }
  }, []);

  const updatePrefs = useCallback(async (prefs: Record<string, string>) => {
    try { return await savePrefs(prefs); } catch { return prefs; }
  }, []);

  return { loading, error, chat, getPlan, getTaste, getPrefs, updatePrefs };
}
