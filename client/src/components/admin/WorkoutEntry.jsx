import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSync } from '../../contexts/SyncContext';
import { useWorkoutAPI } from '../../hooks/useWorkoutAPI';
import { useWorkoutMutations } from '../../hooks/useWorkoutData';
import { useRestTimer, requestNotificationPermission } from '../../hooks/useRestTimer';
import { formatReadableDate, formatTime } from '../../lib/utils/formatters';
import ExerciseCarousel from '../shared/ExerciseCarousel';

export default function WorkoutEntry() {
  const { logout } = useAuth();
  const { syncNow, syncing } = useSync();
  const navigate = useNavigate();
  const { workout, loading: workoutLoading, error, refetch } = useWorkoutAPI();
  const { createSession, toggleDay, selectExercises, createSet } = useWorkoutMutations();

  // Session state
  const [session, setSession] = useState(null);
  const [activeDays, setActiveDays] = useState([]);
  const [sets, setSets] = useState([]);

  // Exercise selection state (per day)
  const [selectedExercisesByDay, setSelectedExercisesByDay] = useState({});
  const [confirmingDay, setConfirmingDay] = useState(null);

  // Workout entry state
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
        setActiveDays(workout.activeDays || []);
        setSets(workout.sets || []);

        // Initialize selected exercises from workout data
        if (workout.selectedExercises && workout.selectedExercises.length > 0) {
          const exercisesByDay = {};
          workout.selectedExercises.forEach(ex => {
            if (!exercisesByDay[ex.day_number]) {
              exercisesByDay[ex.day_number] = {};
            }
            exercisesByDay[ex.day_number][ex.selection_order] = ex.exercise_id;
          });
          setSelectedExercisesByDay(exercisesByDay);

          // Set current exercise to first selected
          setCurrentExerciseId(workout.selectedExercises[0].exercise_id);
        }
      } else {
        // Create a new session with current day selected
        createNewSession();
      }
    }
  }, [workout]);

  const createNewSession = async () => {
    if (!workout) return;

    try {
      const newSession = await createSession(workout.date);
      setSession(newSession);

      // Auto-select current day
      const currentDay = workout.scheduleDays.find(d => d.day_number === workout.currentDayNumber);
      if (currentDay) {
        await handleToggleDay(workout.currentDayNumber, currentDay.exercise_group_id);
      }

      refetch();
    } catch (err) {
      console.error('Failed to create session:', err);
    }
  };

  const handleToggleDay = async (dayNumber, exerciseGroupId) => {
    if (!session) return;

    try {
      const result = await toggleDay(session.id, dayNumber, exerciseGroupId);
      setActiveDays(result.activeDays);

      // Clear selections for this day if it was removed
      const isDayActive = result.activeDays.some(d => d.day_number === dayNumber);
      if (!isDayActive) {
        setSelectedExercisesByDay(prev => {
          const updated = { ...prev };
          delete updated[dayNumber];
          return updated;
        });
      }

      refetch();
    } catch (err) {
      console.error('Failed to toggle day:', err);
    }
  };

  const handleConfirmSelection = async (dayNumber) => {
    if (!session) return;

    const daySelections = selectedExercisesByDay[dayNumber];
    if (!daySelections || !daySelections[1] || !daySelections[2]) {
      alert('Please select both exercises for this day');
      return;
    }

    setConfirmingDay(dayNumber);
    try {
      await selectExercises(session.id, dayNumber, daySelections[1], daySelections[2]);

      // Set current exercise to first selected if not already set
      if (!currentExerciseId) {
        setCurrentExerciseId(daySelections[1]);
      }

      await refetch();
    } catch (err) {
      console.error('Failed to select exercises:', err);
      alert(`Failed to select exercises: ${err.message}`);
    } finally {
      setConfirmingDay(null);
    }
  };

  const handleSelectExercise = (dayNumber, selectionOrder, exerciseId) => {
    setSelectedExercisesByDay(prev => ({
      ...prev,
      [dayNumber]: {
        ...prev[dayNumber],
        [selectionOrder]: exerciseId
      }
    }));
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

  const { scheduleDays, exercisesByMuscleGroup, selectedExercises, currentDayNumber } = workout;

  // Get all selected exercises (across all days)
  const allSelectedExercises = selectedExercises || [];
  const hasAnySelectedExercises = allSelectedExercises.length > 0;

  return (
    <div className="workout-entry">
      <div className="admin-header">
        <h1>Workout Session</h1>
        <div className="admin-actions">
          <button onClick={syncNow} className="sync-btn" disabled={syncing}>
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
          <button onClick={handleLogout} className="logout-btn">Logout</button>
        </div>
      </div>

      <p className="date">{formatReadableDate(workout.date)}</p>

      {/* Day Selector */}
      <div className="day-selector">
        <h3>Select Days to Work On:</h3>
        <div className="day-checkboxes">
          {scheduleDays.map(day => {
            const isActive = activeDays.some(d => d.day_number === day.day_number);
            const isCurrent = day.day_number === currentDayNumber;
            return (
              <label
                key={day.day_number}
                className={`day-checkbox ${isActive ? 'active' : ''} ${isCurrent ? 'current' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={() => handleToggleDay(day.day_number, day.exercise_group_id)}
                />
                <span className="day-label">
                  Day {day.day_number}
                  {isCurrent && ' (Today)'}
                </span>
                <span className="day-muscles">{day.muscle_group1} / {day.muscle_group2}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Show carousels for each active day */}
      {activeDays.length === 0 && (
        <div className="no-active-days">
          <p>No days selected. Please select at least one day above to begin.</p>
        </div>
      )}

      {activeDays.map(activeDay => {
        const dayNumber = activeDay.day_number;
        const daySelections = selectedExercisesByDay[dayNumber] || {};
        const daySelectedExercises = allSelectedExercises.filter(ex => ex.day_number === dayNumber);
        const hasConfirmedExercises = daySelectedExercises.length === 2;

        const muscleGroup1Exercises = exercisesByMuscleGroup[activeDay.muscle_group1] || [];
        const muscleGroup2Exercises = exercisesByMuscleGroup[activeDay.muscle_group2] || [];

        return (
          <div key={dayNumber} className="day-section">
            <h2>Day {dayNumber}: {activeDay.name}</h2>

            {!hasConfirmedExercises ? (
              <>
                <p style={{ textAlign: 'center', marginBottom: '1rem' }}>
                  Select one exercise from each muscle group:
                </p>

                <ExerciseCarousel
                  exercises={muscleGroup1Exercises}
                  selectedId={daySelections[1]}
                  onSelect={(id) => handleSelectExercise(dayNumber, 1, id)}
                  locked={false}
                  muscleGroup={activeDay.muscle_group1}
                />

                <ExerciseCarousel
                  exercises={muscleGroup2Exercises}
                  selectedId={daySelections[2]}
                  onSelect={(id) => handleSelectExercise(dayNumber, 2, id)}
                  locked={false}
                  muscleGroup={activeDay.muscle_group2}
                />

                <button
                  onClick={() => handleConfirmSelection(dayNumber)}
                  disabled={!daySelections[1] || !daySelections[2] || confirmingDay === dayNumber}
                  style={{
                    width: '100%',
                    padding: '1rem',
                    fontSize: '1.125rem',
                    marginTop: '1rem',
                    marginBottom: '2rem',
                  }}
                >
                  {confirmingDay === dayNumber ? 'Confirming...' : `Confirm Day ${dayNumber} Exercises`}
                </button>
              </>
            ) : (
              <div className="day-exercises-confirmed">
                <p style={{ textAlign: 'center', color: '#28a745', fontWeight: 'bold' }}>
                  ✓ Exercises confirmed for Day {dayNumber}
                </p>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  {daySelectedExercises.map(ex => (
                    <div key={ex.exercise_id} style={{ padding: '0.5rem 1rem', background: '#e8f5e9', borderRadius: '4px' }}>
                      {ex.muscle_group}: {ex.name}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Workout Entry Section (only show if at least one day has confirmed exercises) */}
      {hasAnySelectedExercises && (
        <>
          <div style={{ borderTop: '2px solid #ccc', paddingTop: '2rem', marginTop: '2rem' }}>
            <h2 style={{ textAlign: 'center' }}>Log Your Sets</h2>

            {/* Exercise Selection */}
            <div className="exercise-selector">
              {allSelectedExercises.map(ex => (
                <button
                  key={ex.exercise_id}
                  className={`exercise-btn ${currentExerciseId === ex.exercise_id ? 'active' : ''}`}
                  onClick={() => {
                    setCurrentExerciseId(ex.exercise_id);
                    const exerciseSets = sets.filter((s) => s.exercise_id === ex.exercise_id);
                    setCurrentSetNumber(exerciseSets.length + 1);
                  }}
                >
                  Day {ex.day_number} - {ex.muscle_group}: {ex.name}
                </button>
              ))}
            </div>

            {/* Current Exercise Info */}
            {currentExerciseId && (() => {
              const currentExercise = allSelectedExercises.find((ex) => ex.exercise_id === currentExerciseId);
              const currentExerciseSets = sets.filter((s) => s.exercise_id === currentExerciseId);

              return (
                <>
                  <div className="current-exercise">
                    <h2>{currentExercise.name}</h2>
                    <div className="exercise-meta">
                      <span className="exercise-type">{currentExercise.type}</span>
                      <span className="exercise-type">Day {currentExercise.day_number}</span>
                    </div>
                  </div>

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
                </>
              );
            })()}
          </div>

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
        </>
      )}

      <div className="navigation-links">
        <a href="/">← View Public Page</a>
      </div>
    </div>
  );
}
