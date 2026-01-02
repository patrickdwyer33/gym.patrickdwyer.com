/**
 * Hook to fetch workout data from API (for admin use)
 */

import { useState, useEffect, useCallback } from 'react';
import { workoutAPI } from '../lib/api/client';

/**
 * Hook to fetch today's workout data from API
 */
export function useWorkoutAPI(date = null) {
  const [workout, setWorkout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchWorkout = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const dateStr = date || new Date().toISOString().split('T')[0];

      const data = await workoutAPI.getToday(dateStr);
      setWorkout(data);
    } catch (err) {
      setError(err.message);
      console.error('Fetch workout error:', err);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchWorkout();
  }, [fetchWorkout]);

  return { workout, loading, error, refetch: fetchWorkout };
}
