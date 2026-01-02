/**
 * Hook to fetch workout data from local database
 * Replaces old API-based implementation with offline-first approach
 */

import { useState, useEffect, useCallback } from 'react';
import { query } from '../lib/db/localDB';
import { useSync } from '../contexts/SyncContext';
import { formatDate } from '../lib/utils/formatters';

/**
 * Calculate day number in 10-day cycle
 */
function calculateDayNumber(date, cycleStartDate) {
  const start = new Date(cycleStartDate);
  const current = new Date(date);
  const diffTime = current - start;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return (diffDays % 10) + 1;
}

/**
 * Hook to fetch today's workout data
 */
export function useWorkout(date = null) {
  const [workout, setWorkout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { dbReady } = useSync();

  const fetchWorkout = useCallback(async () => {
    if (!dbReady) return;

    try {
      setLoading(true);
      setError(null);
      const dateStr = date ? formatDate(date) : new Date().toISOString().split('T')[0];

      // Get cycle start date
      const configRow = query(
        'SELECT value FROM app_config WHERE key = ?',
        ['cycle_start_date']
      )[0];
      const cycleStartDate = configRow?.value || dateStr;

      // Calculate current day number
      const currentDayNumber = calculateDayNumber(dateStr, cycleStartDate);

      // Get ALL schedule days with their exercise groups
      const scheduleDays = query(
        `SELECT s.day_number, s.workout_id, eg.id as exercise_group_id,
                eg.name, eg.muscle_group1, eg.muscle_group2
         FROM schedule s
         JOIN exercise_groups eg ON s.workout_id = eg.id
         ORDER BY s.day_number`
      );

      // Get all exercises grouped by muscle group
      const allExercises = query('SELECT * FROM exercises ORDER BY muscle_group, name');
      const exercisesByMuscleGroup = allExercises.reduce((acc, ex) => {
        if (!acc[ex.muscle_group]) {
          acc[ex.muscle_group] = [];
        }
        acc[ex.muscle_group].push(ex);
        return acc;
      }, {});

      // Get session for this date if it exists
      const session = query(
        'SELECT * FROM workout_sessions WHERE session_date = ?',
        [dateStr]
      )[0] || null;

      // Get active days for this session
      let activeDays = [];
      if (session) {
        activeDays = query(
          `SELECT sd.*, eg.name, eg.muscle_group1, eg.muscle_group2
           FROM session_days sd
           JOIN exercise_groups eg ON sd.exercise_group_id = eg.id
           WHERE sd.session_id = ?
           ORDER BY sd.day_number`,
          [session.id]
        );
      }

      // Get selected exercises if session exists
      let selectedExercises = [];
      if (session) {
        selectedExercises = query(
          `SELECT se.*, e.name, e.muscle_group, e.type
           FROM session_exercises se
           JOIN exercises e ON se.exercise_id = e.id
           WHERE se.session_id = ?
           ORDER BY se.day_number, se.selection_order`,
          [session.id]
        );
      }

      // Get sets for this session if it exists
      let sets = [];
      if (session) {
        sets = query(
          `SELECT * FROM workout_sets
           WHERE session_id = ?
           ORDER BY exercise_id, set_number`,
          [session.id]
        );
      }

      setWorkout({
        date: dateStr,
        currentDayNumber,
        scheduleDays,
        exercisesByMuscleGroup,
        session,
        activeDays,
        selectedExercises,
        sets,
      });
    } catch (err) {
      setError(err.message);
      console.error('Fetch workout error:', err);
    } finally {
      setLoading(false);
    }
  }, [date, dbReady]);

  useEffect(() => {
    fetchWorkout();
    // No interval needed - workout will refresh when sync updates happen
  }, [fetchWorkout]);

  return { workout, loading, error, refetch: fetchWorkout };
}

/**
 * Hook to fetch workout history
 */
export function useWorkoutHistory(limit = 20) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const { dbReady } = useSync();

  const fetchHistory = useCallback(async () => {
    if (!dbReady) return;

    try {
      setLoading(true);
      setError(null);

      const sessions = query(
        `SELECT ws.*, eg.name as group_name
         FROM workout_sessions ws
         LEFT JOIN exercise_groups eg ON ws.exercise_group_id = eg.id
         WHERE ws.status = 'completed'
         ORDER BY ws.session_date DESC
         LIMIT ?`,
        [limit + 1] // Get one extra to check if there are more
      );

      const hasMoreResults = sessions.length > limit;
      const limitedSessions = sessions.slice(0, limit);

      setHistory(limitedSessions);
      setHasMore(hasMoreResults);
    } catch (err) {
      setError(err.message);
      console.error('Fetch history error:', err);
    } finally {
      setLoading(false);
    }
  }, [limit, dbReady]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return { history, loading, error, hasMore };
}
