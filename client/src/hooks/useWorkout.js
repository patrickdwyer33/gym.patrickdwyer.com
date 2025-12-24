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

      // Get exercise group for this day
      const scheduleRow = query(
        `SELECT eg.*,
                e1.id as ex1_id, e1.name as ex1_name, e1.type as ex1_type,
                e1.primary_variant as ex1_primary, e1.alternate_variant as ex1_alternate,
                e1.no_equipment_variant as ex1_no_equipment,
                e2.id as ex2_id, e2.name as ex2_name, e2.type as ex2_type,
                e2.primary_variant as ex2_primary, e2.alternate_variant as ex2_alternate,
                e2.no_equipment_variant as ex2_no_equipment
         FROM schedule s
         JOIN exercise_groups eg ON s.workout_id = eg.id
         JOIN exercises e1 ON eg.exercise1_id = e1.id
         JOIN exercises e2 ON eg.exercise2_id = e2.id
         WHERE s.day_number = ?`,
        [dayNumber]
      )[0];

      if (!scheduleRow) {
        setError('No workout found for this day');
        setWorkout(null);
        return;
      }

      // Get session for this date if it exists
      const session = query(
        'SELECT * FROM workout_sessions WHERE session_date = ?',
        [dateStr]
      )[0] || null;

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
        exercises: [
          {
            id: scheduleRow.ex1_id,
            name: scheduleRow.ex1_name,
            type: scheduleRow.ex1_type,
            primaryVariant: scheduleRow.ex1_primary,
            alternateVariant: scheduleRow.ex1_alternate,
            noEquipmentVariant: scheduleRow.ex1_no_equipment,
          },
          {
            id: scheduleRow.ex2_id,
            name: scheduleRow.ex2_name,
            type: scheduleRow.ex2_type,
            primaryVariant: scheduleRow.ex2_primary,
            alternateVariant: scheduleRow.ex2_alternate,
            noEquipmentVariant: scheduleRow.ex2_no_equipment,
          },
        ],
      };

      setWorkout({
        date: dateStr,
        dayNumber,
        exerciseGroup,
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

    // Refresh when sync completes (no polling needed - sync handles it)
    const interval = setInterval(fetchWorkout, 30000); // Refresh every 30s

    return () => clearInterval(interval);
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
