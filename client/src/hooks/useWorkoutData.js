/**
 * Hook for querying workout data from local database
 */

import { useState, useEffect, useCallback } from 'react';
import { query, run, saveDBToIndexedDB } from '../lib/db/localDB';
import { useSync } from '../contexts/SyncContext';

/**
 * Get today's workout session
 */
export function useTodayWorkout(date = null) {
  const [workout, setWorkout] = useState(null);
  const [loading, setLoading] = useState(true);
  const { dbReady } = useSync();

  const loadWorkout = useCallback(() => {
    if (!dbReady) return;

    try {
      setLoading(true);
      const sessionDate = date || new Date().toISOString().split('T')[0];

      const session = query(
        `SELECT ws.*, eg.name as group_name, eg.exercise1_id, eg.exercise2_id
         FROM workout_sessions ws
         LEFT JOIN exercise_groups eg ON ws.exercise_group_id = eg.id
         WHERE ws.session_date = ?`,
        [sessionDate]
      )[0];

      if (session) {
        // Get sets for this session
        const sets = query(
          `SELECT ws.*, e.name as exercise_name
           FROM workout_sets ws
           LEFT JOIN exercises e ON ws.exercise_id = e.id
           WHERE ws.session_id = ?
           ORDER BY ws.exercise_id, ws.set_number`,
          [session.id]
        );

        setWorkout({ ...session, sets });
      } else {
        setWorkout(null);
      }
    } catch (error) {
      console.error('Failed to load workout:', error);
      setWorkout(null);
    } finally {
      setLoading(false);
    }
  }, [date, dbReady]);

  useEffect(() => {
    loadWorkout();
  }, [loadWorkout]);

  return { workout, loading, refresh: loadWorkout };
}

/**
 * Get workout history
 */
export function useWorkoutHistory(limit = 20) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const { dbReady } = useSync();

  const loadHistory = useCallback(() => {
    if (!dbReady) return;

    try {
      setLoading(true);
      const sessions = query(
        `SELECT ws.*, eg.name as group_name
         FROM workout_sessions ws
         LEFT JOIN exercise_groups eg ON ws.exercise_group_id = eg.id
         WHERE ws.status = 'completed'
         ORDER BY ws.session_date DESC
         LIMIT ?`,
        [limit]
      );

      setHistory(sessions);
    } catch (error) {
      console.error('Failed to load history:', error);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [limit, dbReady]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  return { history, loading, refresh: loadHistory };
}

/**
 * Create or update workout session
 */
export function useWorkoutMutations() {
  const { pushUpdates } = useSync();

  const createSession = useCallback(
    async (date, dayNumber, exerciseGroupId) => {
      try {
        const now = new Date().toISOString();
        run(
          `INSERT INTO workout_sessions (
          session_date, day_number, exercise_group_id, status,
          created_at, updated_at, sync_version
        ) VALUES (?, ?, ?, 'in_progress', ?, ?, 0)`,
          [date, dayNumber, exerciseGroupId, now, now]
        );

        await saveDBToIndexedDB();
        await pushUpdates(); // Sync to server

        // Get the created session
        return query(
          'SELECT * FROM workout_sessions WHERE session_date = ?',
          [date]
        )[0];
      } catch (error) {
        console.error('Failed to create session:', error);
        throw error;
      }
    },
    [pushUpdates]
  );

  const updateSession = useCallback(
    async (id, updates) => {
      try {
        const now = new Date().toISOString();
        const fields = Object.keys(updates);
        const values = Object.values(updates);

        const setClause = fields.map((f) => `${f} = ?`).join(', ');
        run(
          `UPDATE workout_sessions
           SET ${setClause}, updated_at = ?, sync_version = sync_version + 1
           WHERE id = ?`,
          [...values, now, id]
        );

        await saveDBToIndexedDB();
        await pushUpdates(); // Sync to server
      } catch (error) {
        console.error('Failed to update session:', error);
        throw error;
      }
    },
    [pushUpdates]
  );

  const createSet = useCallback(
    async (setData) => {
      try {
        const now = new Date().toISOString();
        run(
          `INSERT INTO workout_sets (
          session_id, exercise_id, set_number, reps, weight,
          duration_seconds, notes, completed, created_at, updated_at, sync_version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
          [
            setData.sessionId,
            setData.exerciseId,
            setData.setNumber,
            setData.reps || null,
            setData.weight || null,
            setData.durationSeconds || null,
            setData.notes || null,
            setData.completed || 0,
            now,
            now,
          ]
        );

        await saveDBToIndexedDB();
        await pushUpdates(); // Sync to server

        // Get the created set
        return query(
          'SELECT * FROM workout_sets WHERE session_id = ? AND exercise_id = ? AND set_number = ?',
          [setData.sessionId, setData.exerciseId, setData.setNumber]
        )[0];
      } catch (error) {
        console.error('Failed to create set:', error);
        throw error;
      }
    },
    [pushUpdates]
  );

  const updateSet = useCallback(
    async (id, updates) => {
      try {
        const now = new Date().toISOString();
        const fields = Object.keys(updates);
        const values = Object.values(updates);

        const setClause = fields.map((f) => `${f} = ?`).join(', ');
        run(
          `UPDATE workout_sets
           SET ${setClause}, updated_at = ?, sync_version = sync_version + 1
           WHERE id = ?`,
          [...values, now, id]
        );

        await saveDBToIndexedDB();
        await pushUpdates(); // Sync to server
      } catch (error) {
        console.error('Failed to update set:', error);
        throw error;
      }
    },
    [pushUpdates]
  );

  const deleteSet = useCallback(
    async (id) => {
      try {
        run('DELETE FROM workout_sets WHERE id = ?', [id]);

        await saveDBToIndexedDB();
        await pushUpdates(); // Sync to server
      } catch (error) {
        console.error('Failed to delete set:', error);
        throw error;
      }
    },
    [pushUpdates]
  );

  return {
    createSession,
    updateSession,
    createSet,
    updateSet,
    deleteSet,
  };
}
