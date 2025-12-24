/**
 * Format date as YYYY-MM-DD
 */
export function formatDate(date) {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

/**
 * Format date as readable string (e.g., "Monday, December 24, 2025")
 */
export function formatReadableDate(date) {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format time in seconds to MM:SS
 */
export function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format weight with units
 */
export function formatWeight(weight, unit = 'lbs') {
  if (!weight) return '-';
  return `${weight} ${unit}`;
}

/**
 * Format reps
 */
export function formatReps(reps) {
  if (!reps) return '-';
  return `${reps} reps`;
}
