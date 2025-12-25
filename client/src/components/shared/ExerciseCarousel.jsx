import { useState, useEffect } from 'react';

/**
 * ExerciseCarousel - A carousel component for displaying and selecting exercises
 *
 * @param {Object} props
 * @param {Array} props.exercises - Array of exercise objects
 * @param {number} props.selectedId - ID of currently selected exercise
 * @param {function} props.onSelect - Callback when exercise is selected
 * @param {boolean} props.locked - If true, shows only selected exercise (no navigation)
 * @param {string} props.muscleGroup - Muscle group name for display
 */
export default function ExerciseCarousel({
  exercises = [],
  selectedId,
  onSelect,
  locked = false,
  muscleGroup,
}) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // If locked mode, show only the selected exercise
  const displayExercises = locked && selectedId
    ? exercises.filter((ex) => ex.id === selectedId)
    : exercises;

  // Update current index when selectedId changes
  useEffect(() => {
    if (selectedId && !locked) {
      const index = exercises.findIndex((ex) => ex.id === selectedId);
      if (index !== -1) {
        setCurrentIndex(index);
      }
    }
  }, [selectedId, exercises, locked]);

  // Reset to first exercise if exercises change
  useEffect(() => {
    if (!selectedId && exercises.length > 0) {
      setCurrentIndex(0);
    }
  }, [exercises, selectedId]);

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? exercises.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === exercises.length - 1 ? 0 : prev + 1));
  };

  const handleDotClick = (index) => {
    setCurrentIndex(index);
  };

  const handleSelect = () => {
    if (onSelect && exercises[currentIndex]) {
      onSelect(exercises[currentIndex].id);
    }
  };

  if (displayExercises.length === 0) {
    return (
      <div className="carousel carousel-empty">
        <p>No exercises available for {muscleGroup}</p>
      </div>
    );
  }

  const currentExercise = locked && selectedId
    ? displayExercises[0]
    : exercises[currentIndex];

  if (!currentExercise) {
    return null;
  }

  const isSelected = currentExercise.id === selectedId;

  return (
    <div className={`carousel ${locked ? 'carousel-locked' : ''}`}>
      <div className="carousel-header">
        <h3>{muscleGroup}</h3>
        {!locked && (
          <span className="carousel-count">
            {currentIndex + 1} / {exercises.length}
          </span>
        )}
      </div>

      <div className="carousel-container">
        {!locked && exercises.length > 1 && (
          <button
            className="carousel-nav carousel-nav-prev"
            onClick={handlePrevious}
            aria-label="Previous exercise"
          >
            ‹
          </button>
        )}

        <div className="carousel-track">
          <div
            className="carousel-slides"
            style={{
              transform: locked ? 'translateX(0)' : `translateX(-${currentIndex * 100}%)`,
            }}
          >
            {(locked ? displayExercises : exercises).map((exercise) => (
              <div key={exercise.id} className="carousel-slide">
                <div className="carousel-card">
                  <h4 className="exercise-name">{exercise.name}</h4>
                  <div className="exercise-meta">
                    <span className={`equipment-badge equipment-${exercise.equipment_level}`}>
                      {exercise.equipment_level === 'full' && 'Full Equipment'}
                      {exercise.equipment_level === 'minimal' && 'Minimal Equipment'}
                      {exercise.equipment_level === 'none' && 'No Equipment'}
                    </span>
                    <span className="exercise-type">{exercise.type}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {!locked && exercises.length > 1 && (
          <button
            className="carousel-nav carousel-nav-next"
            onClick={handleNext}
            aria-label="Next exercise"
          >
            ›
          </button>
        )}
      </div>

      {!locked && exercises.length > 1 && (
        <div className="carousel-indicators">
          {exercises.map((_, index) => (
            <button
              key={index}
              className={`carousel-dot ${index === currentIndex ? 'active' : ''}`}
              onClick={() => handleDotClick(index)}
              aria-label={`Go to exercise ${index + 1}`}
            />
          ))}
        </div>
      )}

      {!locked && onSelect && (
        <button
          className={`carousel-select-btn ${isSelected ? 'selected' : ''}`}
          onClick={handleSelect}
        >
          {isSelected ? '✓ Selected' : 'Select This Exercise'}
        </button>
      )}

      {locked && (
        <div className="carousel-locked-badge">
          Selected Exercise
        </div>
      )}
    </div>
  );
}
