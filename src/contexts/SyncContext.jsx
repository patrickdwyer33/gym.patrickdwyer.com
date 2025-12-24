import { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { syncAPI } from '../lib/api/client';

const SyncContext = createContext();

export function SyncProvider({ children }) {
  const [lastSync, setLastSync] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [data, setData] = useState({ sessions: [], sets: [] });

  // Pull updates from server
  const pullUpdates = useCallback(async () => {
    try {
      setSyncing(true);
      const since = lastSync || new Date(0).toISOString();
      const updates = await syncAPI.pull(since);

      // Merge updates with existing data
      setData((prev) => {
        const sessionMap = new Map(prev.sessions.map((s) => [s.id, s]));
        const setMap = new Map(prev.sets.map((s) => [s.id, s]));

        // Update sessions
        updates.sessions.forEach((session) => {
          sessionMap.set(session.id, session);
        });

        // Update sets
        updates.sets.forEach((set) => {
          setMap.set(set.id, set);
        });

        return {
          sessions: Array.from(sessionMap.values()),
          sets: Array.from(setMap.values()),
        };
      });

      setLastSync(updates.timestamp);
    } catch (error) {
      console.error('Sync pull error:', error);
    } finally {
      setSyncing(false);
    }
  }, [lastSync]);

  // Auto-sync every 10 seconds
  useEffect(() => {
    // Initial sync
    pullUpdates();

    // Set up interval for periodic sync
    const interval = setInterval(pullUpdates, 10000);

    return () => clearInterval(interval);
  }, [pullUpdates]);

  const value = {
    lastSync,
    syncing,
    data,
    pullUpdates,
  };

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync() {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within SyncProvider');
  }
  return context;
}
