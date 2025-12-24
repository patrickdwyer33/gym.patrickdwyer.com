import { useState, useEffect, useCallback } from 'react';

/**
 * Hook for rest timer functionality
 */
export function useRestTimer(defaultDuration = 90) {
  const [timeRemaining, setTimeRemaining] = useState(defaultDuration);
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!isRunning || timeRemaining <= 0) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          setIsRunning(false);
          setIsComplete(true);

          // Trigger notification
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Rest Complete!', {
              body: 'Time to start your next set',
              icon: '/favicon.svg',
            });
          }

          // Play sound (optional)
          try {
            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZURE=');
            audio.play();
          } catch (e) {
            // Ignore audio errors
          }

          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, timeRemaining]);

  const start = useCallback(() => {
    setIsRunning(true);
    setIsComplete(false);
  }, []);

  const pause = useCallback(() => {
    setIsRunning(false);
  }, []);

  const reset = useCallback(() => {
    setTimeRemaining(defaultDuration);
    setIsRunning(false);
    setIsComplete(false);
  }, [defaultDuration]);

  const setDuration = useCallback((duration) => {
    setTimeRemaining(duration);
    setIsComplete(false);
  }, []);

  return {
    timeRemaining,
    isRunning,
    isComplete,
    start,
    pause,
    reset,
    setDuration,
  };
}

/**
 * Request notification permission on first use
 */
export function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}
