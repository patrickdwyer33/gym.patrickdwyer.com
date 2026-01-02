import { useWorkout } from '../../hooks/useWorkout';
import { formatReadableDate, formatWeight, formatReps } from '../../lib/utils/formatters';
import ExerciseCarousel from '../shared/ExerciseCarousel';

export default function TodayWorkout() {
  const { workout, loading, error } = useWorkout();

  if (loading) {
    return <div className="loading">Loading today's workout...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  if (!workout) {
    return <div>No workout found</div>;
  }

  const { date, currentDayNumber, scheduleDays, exercisesByMuscleGroup, session, selectedExercises, sets } = workout;
  const hasSelectedExercises = selectedExercises && selectedExercises.length > 0;

  // Group sets by exercise
  const setsByExercise = sets ? sets.reduce((acc, set) => {
    if (!acc[set.exercise_id]) {
      acc[set.exercise_id] = [];
    }
    acc[set.exercise_id].push(set);
    return acc;
  }, {}) : {};

  // Get today's scheduled day info
  const todaySchedule = scheduleDays.find(d => d.day_number === currentDayNumber);

  // If exercises are selected, show them grouped by day
  if (hasSelectedExercises) {
    // Group selected exercises by day
    const exercisesByDay = selectedExercises.reduce((acc, ex) => {
      if (!acc[ex.day_number]) {
        acc[ex.day_number] = [];
      }
      acc[ex.day_number].push(ex);
      return acc;
    }, {});

    return (
      <div className="today-workout">
        <div className="workout-header">
          <h2>Workout Session</h2>
          <p className="date">{formatReadableDate(date)}</p>
          {todaySchedule && (
            <p style={{ fontSize: '0.875rem', color: 'var(--theme-brown-dark)', marginTop: '0.5rem' }}>
              Scheduled: Day {currentDayNumber} - {todaySchedule.name}
            </p>
          )}
        </div>

        {/* Show exercises grouped by day */}
        {Object.keys(exercisesByDay).sort((a, b) => parseInt(a) - parseInt(b)).map(dayNum => {
          const dayExercises = exercisesByDay[dayNum];
          const dayInfo = scheduleDays.find(d => d.day_number === parseInt(dayNum));

          return (
            <div key={dayNum} className="day-section" style={{ marginBottom: '2rem' }}>
              <h2>Day {dayNum}: {dayInfo?.name || 'Workout'}</h2>

              <div className="exercises">
                {dayExercises.map(exercise => {
                  const muscleGroupExercises = exercisesByMuscleGroup[exercise.muscle_group] || [];
                  const exerciseSets = setsByExercise[exercise.exercise_id] || [];

                  return (
                    <div key={exercise.exercise_id} style={{ marginBottom: '2rem' }}>
                      <ExerciseCarousel
                        exercises={muscleGroupExercises}
                        selectedId={exercise.exercise_id}
                        locked={true}
                        muscleGroup={exercise.muscle_group}
                      />

                      {exerciseSets.length > 0 && (
                        <div className="sets-completed">
                          <h4>Sets Completed:</h4>
                          <div className="sets-list">
                            {exerciseSets.map((set) => (
                              <div key={set.id} className="set-item">
                                <span className="set-number">Set {set.set_number}:</span>
                                <span className="set-details">
                                  {formatReps(set.reps)} × {formatWeight(set.weight)}
                                  {set.notes && <span className="set-notes"> - {set.notes}</span>}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {session && (
          <div className="session-status">
            <p>Status: <strong>{session.status}</strong></p>
            {session.notes && <p>Notes: {session.notes}</p>}
          </div>
        )}
      </div>
    );
  }

  // No selections yet - show today's scheduled workout preview
  if (todaySchedule) {
    const muscleGroup1Exercises = exercisesByMuscleGroup[todaySchedule.muscle_group1] || [];
    const muscleGroup2Exercises = exercisesByMuscleGroup[todaySchedule.muscle_group2] || [];

    return (
      <div className="today-workout">
        <div className="workout-header">
          <h2>Day {currentDayNumber}: {todaySchedule.name}</h2>
          <p className="date">{formatReadableDate(date)}</p>
        </div>

        <div className="exercises">
          {/* Browsable carousel for muscle group 1 */}
          <ExerciseCarousel
            exercises={muscleGroup1Exercises}
            selectedId={null}
            onSelect={undefined}
            locked={false}
            muscleGroup={todaySchedule.muscle_group1}
          />

          {/* Browsable carousel for muscle group 2 */}
          <ExerciseCarousel
            exercises={muscleGroup2Exercises}
            selectedId={null}
            onSelect={undefined}
            locked={false}
            muscleGroup={todaySchedule.muscle_group2}
          />
        </div>

        {!session && (
          <div className="no-session">
            <p>No workout logged yet today.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="today-workout">
      <div className="workout-header">
        <h2>Workout</h2>
        <p className="date">{formatReadableDate(date)}</p>
      </div>
      <div className="no-session">
        <p>No workout schedule found.</p>
      </div>
    </div>
  );
}
