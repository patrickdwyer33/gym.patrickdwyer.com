import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkout } from '../../hooks/useWorkout';
import { useWorkoutMutations } from '../../hooks/useWorkoutData';
import { useRestTimer, requestNotificationPermission } from '../../hooks/useRestTimer';
import { formatReadableDate, formatTime } from '../../lib/utils/formatters';

export default function WorkoutEntry() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { workout, loading: workoutLoading, error, refetch } = useWorkout();
  const { createSession, createSet } = useWorkoutMutations();
  const [session, setSession] = useState(null);
  const [sets, setSets] = useState([]);
  const [currentExerciseId, setCurrentExerciseId] = useState(null);
  const [currentSetNumber, setCurrentSetNumber] = useState(1);
  const [reps, setReps] = useState(12);
  const [weight, setWeight] = useState(45);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { timeRemaining, isRunning, isComplete, start, pause, reset, setDuration } = useRestTimer(90);

  // Request notification permission on mount
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // Initialize session when workout loads
  useEffect(() => {
    if (workout && !session) {
      if (workout.session) {
        setSession(workout.session);
        setSets(workout.sets || []);
        // Set current exercise to first exercise if no sets yet
        if (!workout.sets || workout.sets.length === 0) {
          setCurrentExerciseId(workout.exerciseGroup.exercises[0].id);
        }
      } else {
        // Create a new session
        createNewSession();
      }
    }
  }, [workout]);

  const createNewSession = async () => {
    if (!workout) return;

    try {
      const newSession = await createSession(
        workout.date,
        workout.dayNumber,
        workout.exerciseGroup.id
      );
      setSession(newSession);
      setCurrentExerciseId(workout.exerciseGroup.exercises[0].id);
      // Refetch to get updated data
      refetch();
    } catch (err) {
      console.error('Failed to create session:', err);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  const handleAddSet = async (e) => {
    e.preventDefault();
    if (!session || !currentExerciseId) return;

    setSubmitting(true);

    try {
      const newSet = await createSet({
        sessionId: session.id,
        exerciseId: currentExerciseId,
        setNumber: currentSetNumber,
        reps,
        weight,
        notes,
        completed: true,
      });

      setSets([...sets, newSet]);
      setCurrentSetNumber(currentSetNumber + 1);
      setNotes('');

      // Refetch to get updated data
      refetch();

      // Start rest timer
      reset();
      start();
    } catch (err) {
      console.error('Failed to add set:', err);
      alert(`Failed to add set: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const incrementValue = (setter, current, amount) => {
    setter(Math.max(0, current + amount));
  };

  if (workoutLoading) {
    return <div className="loading">Loading workout...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  if (!workout || !session) {
    return <div>No workout session available</div>;
  }

  const { exerciseGroup, dayNumber } = workout;
  const currentExercise = exerciseGroup.exercises.find((ex) => ex.id === currentExerciseId);

  // Get sets for current exercise
  const currentExerciseSets = sets.filter((s) => s.exercise_id === currentExerciseId);

  return (
    <div className="workout-entry">
      <div className="admin-header">
        <h1>Day {dayNumber}: {exerciseGroup.name}</h1>
        <button onClick={handleLogout} className="logout-btn">Logout</button>
      </div>

      <p className="date">{formatReadableDate(workout.date)}</p>

      {/* Exercise Selection */}
      <div className="exercise-selector">
        {exerciseGroup.exercises.map((exercise, idx) => (
          <button
            key={exercise.id}
            className={`exercise-btn ${currentExerciseId === exercise.id ? 'active' : ''}`}
            onClick={() => {
              setCurrentExerciseId(exercise.id);
              const exerciseSets = sets.filter((s) => s.exercise_id === exercise.id);
              setCurrentSetNumber(exerciseSets.length + 1);
            }}
          >
            Exercise {idx + 1}: {exercise.name}
          </button>
        ))}
      </div>

      {/* Current Exercise Info */}
      {currentExercise && (
        <div className="current-exercise">
          <h2>{currentExercise.name}</h2>
          <div className="exercise-variants">
            <p><strong>Primary:</strong> {currentExercise.primaryVariant}</p>
            <p><strong>Alternate:</strong> {currentExercise.alternateVariant}</p>
          </div>
        </div>
      )}

      {/* Completed Sets */}
      {currentExerciseSets.length > 0 && (
        <div className="completed-sets">
          <h3>Completed Sets:</h3>
          {currentExerciseSets.map((set) => (
            <div key={set.id} className="set-summary">
              Set {set.set_number}: {set.reps} reps × {set.weight} lbs
              {set.notes && ` - ${set.notes}`}
            </div>
          ))}
        </div>
      )}

      {/* Set Entry Form */}
      <form onSubmit={handleAddSet} className="set-form">
        <h3>Set {currentSetNumber}</h3>

        <div className="input-group">
          <label>Reps</label>
          <div className="stepper">
            <button type="button" onClick={() => incrementValue(setReps, reps, -1)}>-</button>
            <input
              type="number"
              value={reps}
              onChange={(e) => setReps(parseInt(e.target.value) || 0)}
              inputMode="numeric"
            />
            <button type="button" onClick={() => incrementValue(setReps, reps, 1)}>+</button>
          </div>
        </div>

        <div className="input-group">
          <label>Weight (lbs)</label>
          <div className="stepper">
            <button type="button" onClick={() => incrementValue(setWeight, weight, -5)}>-5</button>
            <button type="button" onClick={() => incrementValue(setWeight, weight, -2.5)}>-2.5</button>
            <input
              type="number"
              value={weight}
              onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}
              step="0.5"
              inputMode="decimal"
            />
            <button type="button" onClick={() => incrementValue(setWeight, weight, 2.5)}>+2.5</button>
            <button type="button" onClick={() => incrementValue(setWeight, weight, 5)}>+5</button>
          </div>
        </div>

        <div className="input-group">
          <label>Notes (optional)</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g., felt strong, good form"
          />
        </div>

        <button type="submit" className="submit-set-btn" disabled={submitting}>
          {submitting ? 'Saving...' : 'Complete Set'}
        </button>
      </form>

      {/* Rest Timer */}
      <div className={`rest-timer ${isRunning ? 'running' : ''} ${isComplete ? 'complete' : ''}`}>
        <div className="timer-display">
          <span className="timer-label">Rest Timer:</span>
          <span className="timer-value">{formatTime(timeRemaining)}</span>
        </div>
        <div className="timer-controls">
          {!isRunning && !isComplete && (
            <button onClick={start}>Start</button>
          )}
          {isRunning && (
            <button onClick={pause}>Pause</button>
          )}
          <button onClick={reset}>Reset</button>
          <div className="timer-presets">
            <button onClick={() => { setDuration(60); reset(); }}>1min</button>
            <button onClick={() => { setDuration(90); reset(); }}>90s</button>
            <button onClick={() => { setDuration(120); reset(); }}>2min</button>
          </div>
        </div>
      </div>

      <div className="navigation-links">
        <a href="/">← View Public Page</a>
      </div>
    </div>
  );
}
