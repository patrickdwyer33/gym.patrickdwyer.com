/**
 * Hook for querying workout data from local database
 */

import { useState, useEffect, useCallback } from 'react';
import { query } from '../lib/db/localDB';
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
        `SELECT * FROM workout_sessions WHERE session_date = ?`,
        [sessionDate]
      )[0];

      if (session) {
        // Get active days for this session
        const activeDays = query(
          `SELECT sd.*, eg.name, eg.muscle_group1, eg.muscle_group2
           FROM session_days sd
           JOIN exercise_groups eg ON sd.exercise_group_id = eg.id
           WHERE sd.session_id = ?
           ORDER BY sd.day_number`,
          [session.id]
        );

        // Get selected exercises
        const selectedExercises = query(
          `SELECT se.*, e.name, e.muscle_group, e.type
           FROM session_exercises se
           JOIN exercises e ON se.exercise_id = e.id
           WHERE se.session_id = ?
           ORDER BY se.day_number, se.selection_order`,
          [session.id]
        );

        // Get sets for this session
        const sets = query(
          `SELECT ws.*, e.name as exercise_name
           FROM workout_sets ws
           LEFT JOIN exercises e ON ws.exercise_id = e.id
           WHERE ws.session_id = ?
           ORDER BY ws.exercise_id, ws.set_number`,
          [session.id]
        );

        setWorkout({ ...session, activeDays, selectedExercises, sets });
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
        `SELECT ws.*
         FROM workout_sessions ws
         WHERE ws.status = 'completed'
         ORDER BY ws.session_date DESC
         LIMIT ?`,
        [limit]
      );

      // For each session, get the active days info
      const sessionsWithDetails = sessions.map(session => {
        const activeDays = query(
          `SELECT sd.day_number, eg.name as group_name
           FROM session_days sd
           JOIN exercise_groups eg ON sd.exercise_group_id = eg.id
           WHERE sd.session_id = ?
           ORDER BY sd.day_number`,
          [session.id]
        );

        return {
          ...session,
          activeDays,
          group_name: activeDays.map(d => `Day ${d.day_number}`).join(', ')
        };
      });

      setHistory(sessionsWithDetails);
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
 * Create or update workout session - uses API for multi-day support
 */
export function useWorkoutMutations() {
  const { pullUpdates } = useSync();

  const createSession = useCallback(
    async (date) => {
      try {
        const { workoutAPI } = await import('../lib/api/client');
        const result = await workoutAPI.createSession(date);

        // Pull updates to sync the server changes to local DB
        await pullUpdates();

        return result.session;
      } catch (error) {
        console.error('Failed to create session:', error);
        throw error;
      }
    },
    [pullUpdates]
  );

  const toggleDay = useCallback(
    async (sessionId, dayNumber, exerciseGroupId) => {
      try {
        const { workoutAPI } = await import('../lib/api/client');
        const result = await workoutAPI.toggleDay(sessionId, dayNumber, exerciseGroupId);

        // Pull updates to sync the server changes to local DB
        await pullUpdates();

        return result;
      } catch (error) {
        console.error('Failed to toggle day:', error);
        throw error;
      }
    },
    [pullUpdates]
  );

  const selectExercises = useCallback(
    async (sessionId, dayNumber, exercise1Id, exercise2Id) => {
      try {
        const { workoutAPI } = await import('../lib/api/client');
        const result = await workoutAPI.selectExercises(sessionId, dayNumber, exercise1Id, exercise2Id);

        // Pull updates to sync the server changes to local DB
        await pullUpdates();

        return result.selectedExercises;
      } catch (error) {
        console.error('Failed to select exercises:', error);
        throw error;
      }
    },
    [pullUpdates]
  );

  const updateSession = useCallback(
    async (id, updates) => {
      try {
        const { workoutAPI } = await import('../lib/api/client');
        const result = await workoutAPI.updateSession(id, updates);

        // Pull updates to sync the server changes to local DB
        await pullUpdates();

        return result.session;
      } catch (error) {
        console.error('Failed to update session:', error);
        throw error;
      }
    },
    [pullUpdates]
  );

  const createSet = useCallback(
    async (setData) => {
      try {
        const { workoutAPI } = await import('../lib/api/client');
        const result = await workoutAPI.createSet(setData);

        // Pull updates to sync the server changes to local DB
        await pullUpdates();

        return result.set;
      } catch (error) {
        console.error('Failed to create set:', error);
        throw error;
      }
    },
    [pullUpdates]
  );

  const updateSet = useCallback(
    async (id, updates) => {
      try {
        const { workoutAPI } = await import('../lib/api/client');
        const result = await workoutAPI.updateSet(id, updates);

        // Pull updates to sync the server changes to local DB
        await pullUpdates();

        return result.set;
      } catch (error) {
        console.error('Failed to update set:', error);
        throw error;
      }
    },
    [pullUpdates]
  );

  const deleteSet = useCallback(
    async (id) => {
      try {
        const { workoutAPI } = await import('../lib/api/client');
        await workoutAPI.deleteSet(id);

        // Pull updates to sync the server changes to local DB
        await pullUpdates();
      } catch (error) {
        console.error('Failed to delete set:', error);
        throw error;
      }
    },
    [pullUpdates]
  );

  return {
    createSession,
    toggleDay,
    selectExercises,
    updateSession,
    createSet,
    updateSet,
    deleteSet,
  };
}
