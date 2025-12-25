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

      // Calculate day number
      const dayNumber = calculateDayNumber(dateStr, cycleStartDate);

      console.log('Workout query debug:', { dateStr, cycleStartDate, dayNumber });

      // Get exercise group for this day
      const scheduleRow = query(
        `SELECT eg.*
         FROM schedule s
         JOIN exercise_groups eg ON s.workout_id = eg.id
         WHERE s.day_number = ?`,
        [dayNumber]
      )[0];

      if (!scheduleRow) {
        console.error('No workout found for day', dayNumber);
        // Debug: check what's in the schedule table
        const allSchedule = query('SELECT * FROM schedule');
        console.log('Schedule table contents:', allSchedule);
        setError('No workout found for this day');
        setWorkout(null);
        return;
      }

      console.log('Found workout for day', dayNumber, scheduleRow);

      // Get ALL exercises for muscle_group1
      const muscleGroup1Exercises = query(
        `SELECT id, name, muscle_group, type, equipment_level
         FROM exercises
         WHERE muscle_group = ?
         ORDER BY equipment_level DESC, name`,
        [scheduleRow.muscle_group1]
      );

      // Get ALL exercises for muscle_group2
      const muscleGroup2Exercises = query(
        `SELECT id, name, muscle_group, type, equipment_level
         FROM exercises
         WHERE muscle_group = ?
         ORDER BY equipment_level DESC, name`,
        [scheduleRow.muscle_group2]
      );

      // Get session for this date if it exists
      const session = query(
        'SELECT * FROM workout_sessions WHERE session_date = ?',
        [dateStr]
      )[0] || null;

      // Get selected exercises if session exists
      let selectedExercises = [];
      if (session) {
        selectedExercises = query(
          `SELECT se.*, e.name, e.muscle_group, e.type, e.equipment_level
           FROM session_exercises se
           JOIN exercises e ON se.exercise_id = e.id
           WHERE se.session_id = ?
           ORDER BY se.selection_order`,
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

      // Format response to match API structure
      const exerciseGroup = {
        id: scheduleRow.id,
        name: scheduleRow.name,
        muscleGroups: [
          {
            name: scheduleRow.muscle_group1,
            exercises: muscleGroup1Exercises,
          },
          {
            name: scheduleRow.muscle_group2,
            exercises: muscleGroup2Exercises,
          },
        ],
      };

      setWorkout({
        date: dateStr,
        dayNumber,
        exerciseGroup,
        selectedExercises,
        session,
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
