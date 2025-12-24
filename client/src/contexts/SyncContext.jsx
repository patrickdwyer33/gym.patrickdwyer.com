import { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { syncAPI } from '../lib/api/client';
import { initDB, query, run, saveDBToIndexedDB } from '../lib/db/localDB';

const SyncContext = createContext();

export function SyncProvider({ children }) {
  const [lastSync, setLastSync] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [dbReady, setDbReady] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Initialize local database
  useEffect(() => {
    initDB()
      .then(() => {
        setDbReady(true);
        console.log('Local database initialized');
      })
      .catch((error) => {
        console.error('Failed to initialize local database:', error);
      });
  }, []);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      console.log('App is online - syncing...');
      pullUpdates();
    };

    const handleOffline = () => {
      setIsOnline(false);
      console.log('App is offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Pull updates from server and merge into local DB
  const pullUpdates = useCallback(async () => {
    if (!dbReady || !isOnline) return;

    try {
      setSyncing(true);
      const since = lastSync || new Date(0).toISOString();
      const updates = await syncAPI.pull(since);

      // Merge sessions into local DB
      updates.sessions.forEach((session) => {
        const existing = query(
          'SELECT sync_version FROM workout_sessions WHERE id = ?',
          [session.id]
        )[0];

        if (!existing || existing.sync_version < session.sync_version) {
          // Insert or update session
          run(
            `INSERT OR REPLACE INTO workout_sessions (
              id, session_date, day_number, exercise_group_id, status,
              notes, started_at, completed_at, created_at, updated_at,
              sync_version, last_synced_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              session.id,
              session.session_date,
              session.day_number,
              session.exercise_group_id,
              session.status,
              session.notes,
              session.started_at,
              session.completed_at,
              session.created_at,
              session.updated_at,
              session.sync_version,
              new Date().toISOString(),
            ]
          );
        }
      });

      // Merge sets into local DB
      updates.sets.forEach((set) => {
        const existing = query(
          'SELECT sync_version FROM workout_sets WHERE id = ?',
          [set.id]
        )[0];

        if (!existing || existing.sync_version < set.sync_version) {
          run(
            `INSERT OR REPLACE INTO workout_sets (
              id, session_id, exercise_id, set_number, reps, weight,
              duration_seconds, notes, completed, created_at, updated_at,
              sync_version, last_synced_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              set.id,
              set.session_id,
              set.exercise_id,
              set.set_number,
              set.reps,
              set.weight,
              set.duration_seconds,
              set.notes,
              set.completed,
              set.created_at,
              set.updated_at,
              set.sync_version,
              new Date().toISOString(),
            ]
          );
        }
      });

      await saveDBToIndexedDB();
      setLastSync(updates.timestamp);
      console.log('Sync completed:', updates);
    } catch (error) {
      console.error('Sync pull error:', error);
    } finally {
      setSyncing(false);
    }
  }, [lastSync, dbReady, isOnline]);

  // Push local changes to server
  const pushUpdates = useCallback(async () => {
    if (!dbReady || !isOnline) return;

    try {
      setSyncing(true);

      // Get unsync changes (where last_synced_at is null or less than updated_at)
      const unsyncedSessions = query(
        `SELECT * FROM workout_sessions
         WHERE last_synced_at IS NULL OR last_synced_at < updated_at`
      );

      const unsyncedSets = query(
        `SELECT * FROM workout_sets
         WHERE last_synced_at IS NULL OR last_synced_at < updated_at`
      );

      if (unsyncedSessions.length === 0 && unsyncedSets.length === 0) {
        return; // Nothing to push
      }

      // Push to server
      await syncAPI.push({
        sessions: unsyncedSessions,
        sets: unsyncedSets,
      });

      // Mark as synced
      const now = new Date().toISOString();
      unsyncedSessions.forEach((session) => {
        run(
          'UPDATE workout_sessions SET last_synced_at = ? WHERE id = ?',
          [now, session.id]
        );
      });

      unsyncedSets.forEach((set) => {
        run('UPDATE workout_sets SET last_synced_at = ? WHERE id = ?', [
          now,
          set.id,
        ]);
      });

      await saveDBToIndexedDB();
      console.log('Pushed local changes to server');
    } catch (error) {
      console.error('Sync push error:', error);
    } finally {
      setSyncing(false);
    }
  }, [dbReady, isOnline]);

  // Auto-sync: pull every 30 seconds, push immediately after local changes
  useEffect(() => {
    if (!dbReady || !isOnline) return;

    // Initial sync
    pullUpdates();

    // Set up interval for periodic pull
    const interval = setInterval(pullUpdates, 30000);

    return () => clearInterval(interval);
  }, [pullUpdates, dbReady, isOnline]);

  const value = {
    lastSync,
    syncing,
    dbReady,
    isOnline,
    pullUpdates,
    pushUpdates,
    syncNow: async () => {
      await pushUpdates();
      await pullUpdates();
    },
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
