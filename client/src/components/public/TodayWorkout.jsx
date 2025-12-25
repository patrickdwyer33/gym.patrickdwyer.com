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

  const { date, dayNumber, exerciseGroup, session, sets, selectedExercises } = workout;
  const hasSelectedExercises = selectedExercises && selectedExercises.length === 2;

  // Group sets by exercise
  const setsByExercise = sets ? sets.reduce((acc, set) => {
    if (!acc[set.exercise_id]) {
      acc[set.exercise_id] = [];
    }
    acc[set.exercise_id].push(set);
    return acc;
  }, {}) : {};

  const muscleGroup1 = exerciseGroup.muscleGroups[0];
  const muscleGroup2 = exerciseGroup.muscleGroups[1];

  // If exercises are selected, show locked carousels
  if (hasSelectedExercises) {
    const selectedExercise1 = selectedExercises[0];
    const selectedExercise2 = selectedExercises[1];

    return (
      <div className="today-workout">
        <div className="workout-header">
          <h2>Day {dayNumber}: {exerciseGroup.name}</h2>
          <p className="date">{formatReadableDate(date)}</p>
        </div>

        <div className="exercises">
          {/* Locked carousel for selected exercise 1 */}
          <div style={{ marginBottom: '2rem' }}>
            <ExerciseCarousel
              exercises={muscleGroup1.exercises}
              selectedId={selectedExercise1.exercise_id}
              locked={true}
              muscleGroup={selectedExercise1.muscle_group}
            />

            {setsByExercise[selectedExercise1.exercise_id] && (
              <div className="sets-completed">
                <h4>Sets Completed:</h4>
                <div className="sets-list">
                  {setsByExercise[selectedExercise1.exercise_id].map((set) => (
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

          {/* Locked carousel for selected exercise 2 */}
          <div style={{ marginBottom: '2rem' }}>
            <ExerciseCarousel
              exercises={muscleGroup2.exercises}
              selectedId={selectedExercise2.exercise_id}
              locked={true}
              muscleGroup={selectedExercise2.muscle_group}
            />

            {setsByExercise[selectedExercise2.exercise_id] && (
              <div className="sets-completed">
                <h4>Sets Completed:</h4>
                <div className="sets-list">
                  {setsByExercise[selectedExercise2.exercise_id].map((set) => (
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
        </div>

        {session && (
          <div className="session-status">
            <p>Status: <strong>{session.status}</strong></p>
            {session.notes && <p>Notes: {session.notes}</p>}
          </div>
        )}
      </div>
    );
  }

  // No selections yet - show browsable carousels (no select button)
  return (
    <div className="today-workout">
      <div className="workout-header">
        <h2>Day {dayNumber}: {exerciseGroup.name}</h2>
        <p className="date">{formatReadableDate(date)}</p>
      </div>

      <div className="exercises">
        {/* Browsable carousel for muscle group 1 */}
        <ExerciseCarousel
          exercises={muscleGroup1.exercises}
          selectedId={null}
          onSelect={undefined}
          locked={false}
          muscleGroup={muscleGroup1.name}
        />

        {/* Browsable carousel for muscle group 2 */}
        <ExerciseCarousel
          exercises={muscleGroup2.exercises}
          selectedId={null}
          onSelect={undefined}
          locked={false}
          muscleGroup={muscleGroup2.name}
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
