/**
 * Calculate which day in the 10-day cycle a given date falls on
 * @param {Date|string} targetDate - The date to calculate
 * @param {Date|string} cycleStartDate - The start date of the cycle
 * @returns {number} - Day number (1-10)
 */
export function calculateDayNumber(targetDate = new Date(), cycleStartDate) {
  const start = new Date(cycleStartDate);
  const target = new Date(targetDate);

  // Reset to midnight for accurate day comparison
  start.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);

  // Calculate days difference
  const diffTime = target.getTime() - start.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  // Map to 1-10 cycle (modulo 10, then add 1)
  const dayNumber = ((diffDays % 10) + 10) % 10 + 1;

  return dayNumber;
}
