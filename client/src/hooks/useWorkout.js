import { useState, useEffect } from 'react';
import { workoutAPI } from '../lib/api/client';
import { formatDate } from '../lib/utils/formatters';

/**
 * Hook to fetch today's workout data
 */
export function useWorkout(date = null) {
  const [workout, setWorkout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchWorkout = async () => {
      try {
        setLoading(true);
        setError(null);
        const dateStr = date ? formatDate(date) : undefined;
        const data = await workoutAPI.getToday(dateStr);
        setWorkout(data);
      } catch (err) {
        setError(err.message);
        console.error('Fetch workout error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkout();

    // Refresh every 10 seconds to get latest updates
    const interval = setInterval(fetchWorkout, 10000);

    return () => clearInterval(interval);
  }, [date]);

  return { workout, loading, error, refetch: () => setLoading(true) };
}

/**
 * Hook to fetch workout history
 */
export function useWorkoutHistory(limit = 20) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await workoutAPI.getHistory(limit, 0);
        setHistory(data.sessions);
        setHasMore(data.hasMore);
      } catch (err) {
        setError(err.message);
        console.error('Fetch history error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [limit]);

  return { history, loading, error, hasMore };
}
