import { useWorkout } from '../../hooks/useWorkout';
import { formatReadableDate, formatWeight, formatReps } from '../../lib/utils/formatters';

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

  const { date, dayNumber, exerciseGroup, session, sets } = workout;

  // Group sets by exercise
  const setsByExercise = sets.reduce((acc, set) => {
    if (!acc[set.exercise_id]) {
      acc[set.exercise_id] = [];
    }
    acc[set.exercise_id].push(set);
    return acc;
  }, {});

  return (
    <div className="today-workout">
      <div className="workout-header">
        <h2>Day {dayNumber}: {exerciseGroup.name}</h2>
        <p className="date">{formatReadableDate(date)}</p>
      </div>

      <div className="exercises">
        {exerciseGroup.exercises.map((exercise, idx) => (
          <div key={exercise.id} className="exercise-card">
            <h3>Exercise {idx + 1}: {exercise.name}</h3>
            <div className="exercise-variants">
              <p><strong>Primary:</strong> {exercise.primaryVariant}</p>
              <p><strong>Alternate:</strong> {exercise.alternateVariant}</p>
              <p><strong>No Equipment:</strong> {exercise.noEquipmentVariant}</p>
            </div>

            {setsByExercise[exercise.id] && (
              <div className="sets-completed">
                <h4>Sets Completed:</h4>
                <div className="sets-list">
                  {setsByExercise[exercise.id].map((set) => (
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
        ))}
      </div>

      {session && (
        <div className="session-status">
          <p>Status: <strong>{session.status}</strong></p>
          {session.notes && <p>Notes: {session.notes}</p>}
        </div>
      )}

      {!session && (
        <div className="no-session">
          <p>No workout logged yet today.</p>
        </div>
      )}
    </div>
  );
}
