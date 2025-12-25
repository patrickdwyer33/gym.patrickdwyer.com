import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSync } from '../../contexts/SyncContext';
import { useWorkout } from '../../hooks/useWorkout';
import { useWorkoutMutations } from '../../hooks/useWorkoutData';
import { useRestTimer, requestNotificationPermission } from '../../hooks/useRestTimer';
import { formatReadableDate, formatTime } from '../../lib/utils/formatters';
import ExerciseCarousel from '../shared/ExerciseCarousel';

export default function WorkoutEntry() {
  const { logout } = useAuth();
  const { syncNow, syncing } = useSync();
  const navigate = useNavigate();
  const { workout, loading: workoutLoading, error, refetch } = useWorkout();
  const { createSession, createSet, selectExercises } = useWorkoutMutations();

  // Session state
  const [session, setSession] = useState(null);
  const [sets, setSets] = useState([]);

  // Phase 1: Exercise selection state
  const [selectedExercise1Id, setSelectedExercise1Id] = useState(null);
  const [selectedExercise2Id, setSelectedExercise2Id] = useState(null);
  const [confirmingSelection, setConfirmingSelection] = useState(false);

  // Phase 2: Workout entry state
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

        // If exercises are selected, set current exercise to first selected
        if (workout.selectedExercises && workout.selectedExercises.length > 0) {
          setCurrentExerciseId(workout.selectedExercises[0].exercise_id);
          setSelectedExercise1Id(workout.selectedExercises[0].exercise_id);
          if (workout.selectedExercises.length > 1) {
            setSelectedExercise2Id(workout.selectedExercises[1].exercise_id);
          }
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
      refetch();
    } catch (err) {
      console.error('Failed to create session:', err);
    }
  };

  const handleConfirmSelection = async () => {
    if (!session || !selectedExercise1Id || !selectedExercise2Id) return;

    setConfirmingSelection(true);
    try {
      await selectExercises(session.id, selectedExercise1Id, selectedExercise2Id);

      // Set current exercise to first selected
      setCurrentExerciseId(selectedExercise1Id);

      // Refetch to get updated data with selections
      await refetch();
    } catch (err) {
      console.error('Failed to select exercises:', err);
      alert(`Failed to select exercises: ${err.message}`);
    } finally {
      setConfirmingSelection(false);
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

  const { exerciseGroup, dayNumber, selectedExercises } = workout;
  const hasSelectedExercises = selectedExercises && selectedExercises.length === 2;

  // Debug logging
  console.log('Workout data:', workout);
  console.log('Exercise group:', exerciseGroup);
  console.log('Muscle groups:', exerciseGroup?.muscleGroups);

  // Phase 1: Exercise Selection
  if (!hasSelectedExercises) {
    const muscleGroup1 = exerciseGroup.muscleGroups?.[0];
    const muscleGroup2 = exerciseGroup.muscleGroups?.[1];
    const canConfirm = selectedExercise1Id && selectedExercise2Id;

    console.log('Muscle group 1:', muscleGroup1);
    console.log('Muscle group 2:', muscleGroup2);

    // Safety check for muscle groups
    if (!muscleGroup1 || !muscleGroup2) {
      return (
        <div className="error">
          <p>Error: Muscle groups not loaded correctly.</p>
          <p>exerciseGroup.muscleGroups: {JSON.stringify(exerciseGroup?.muscleGroups)}</p>
          <button onClick={refetch}>Retry</button>
        </div>
      );
    }

    return (
      <div className="workout-entry">
        <div className="admin-header">
          <h1>Day {dayNumber}: {exerciseGroup.name}</h1>
          <div className="admin-actions">
            <button onClick={syncNow} className="sync-btn" disabled={syncing}>
              {syncing ? 'Syncing...' : 'Sync Now'}
            </button>
            <button onClick={handleLogout} className="logout-btn">Logout</button>
          </div>
        </div>

        <p className="date">{formatReadableDate(workout.date)}</p>

        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <h2>Select Your Exercises</h2>
          <p>Choose one exercise from each carousel, then confirm to begin your workout.</p>
        </div>

        {/* Carousel for muscle group 1 */}
        <ExerciseCarousel
          exercises={muscleGroup1.exercises}
          selectedId={selectedExercise1Id}
          onSelect={setSelectedExercise1Id}
          locked={false}
          muscleGroup={muscleGroup1.name}
        />

        {/* Carousel for muscle group 2 */}
        <ExerciseCarousel
          exercises={muscleGroup2.exercises}
          selectedId={selectedExercise2Id}
          onSelect={setSelectedExercise2Id}
          locked={false}
          muscleGroup={muscleGroup2.name}
        />

        <button
          onClick={handleConfirmSelection}
          disabled={!canConfirm || confirmingSelection}
          style={{
            width: '100%',
            padding: '1rem',
            fontSize: '1.125rem',
            marginTop: '1rem',
          }}
        >
          {confirmingSelection ? 'Confirming...' : 'Confirm Exercise Selection'}
        </button>

        <div className="navigation-links">
          <a href="/">← View Public Page</a>
        </div>
      </div>
    );
  }

  // Phase 2: Workout Entry
  const selectedExercise1 = selectedExercises[0];
  const selectedExercise2 = selectedExercises[1];
  const currentExercise = selectedExercises.find((ex) => ex.exercise_id === currentExerciseId);

  // Get sets for current exercise
  const currentExerciseSets = sets.filter((s) => s.exercise_id === currentExerciseId);

  return (
    <div className="workout-entry">
      <div className="admin-header">
        <h1>Day {dayNumber}: {exerciseGroup.name}</h1>
        <div className="admin-actions">
          <button onClick={syncNow} className="sync-btn" disabled={syncing}>
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
          <button onClick={handleLogout} className="logout-btn">Logout</button>
        </div>
      </div>

      <p className="date">{formatReadableDate(workout.date)}</p>

      {/* Exercise Selection */}
      <div className="exercise-selector">
        <button
          className={`exercise-btn ${currentExerciseId === selectedExercise1.exercise_id ? 'active' : ''}`}
          onClick={() => {
            setCurrentExerciseId(selectedExercise1.exercise_id);
            const exerciseSets = sets.filter((s) => s.exercise_id === selectedExercise1.exercise_id);
            setCurrentSetNumber(exerciseSets.length + 1);
          }}
        >
          {selectedExercise1.muscle_group}: {selectedExercise1.name}
        </button>
        <button
          className={`exercise-btn ${currentExerciseId === selectedExercise2.exercise_id ? 'active' : ''}`}
          onClick={() => {
            setCurrentExerciseId(selectedExercise2.exercise_id);
            const exerciseSets = sets.filter((s) => s.exercise_id === selectedExercise2.exercise_id);
            setCurrentSetNumber(exerciseSets.length + 1);
          }}
        >
          {selectedExercise2.muscle_group}: {selectedExercise2.name}
        </button>
      </div>

      {/* Current Exercise Info */}
      {currentExercise && (
        <div className="current-exercise">
          <h2>{currentExercise.name}</h2>
          <div className="exercise-meta">
            <span className={`equipment-badge equipment-${currentExercise.equipment_level}`}>
              {currentExercise.equipment_level === 'full' && 'Full Equipment'}
              {currentExercise.equipment_level === 'minimal' && 'Minimal Equipment'}
              {currentExercise.equipment_level === 'none' && 'No Equipment'}
            </span>
            <span className="exercise-type">{currentExercise.type}</span>
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
