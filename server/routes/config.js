import express from 'express';
import { getOne, getAll, run } from '../db/database.js';
import { calculateDayNumber } from '../utils/dayCalculator.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/config/static-data
 * Get all static reference data (exercises, groups, schedule)
 */
router.get('/static-data', (req, res) => {
  try {
    const exercises = getAll('SELECT * FROM exercises ORDER BY id');
    const exerciseGroups = getAll('SELECT * FROM exercise_groups ORDER BY id');
    const schedule = getAll('SELECT * FROM schedule ORDER BY day_number');

    res.json({
      exercises,
      exerciseGroups,
      schedule,
    });
  } catch (error) {
    console.error('Get static data error:', error);
    res.status(500).json({ error: 'Failed to get static data' });
  }
});

/**
 * GET /api/config/cycle-start
 * Get cycle start date and current day number
 */
router.get('/cycle-start', (req, res) => {
  try {
    const row = getOne('SELECT value FROM app_config WHERE key = ?', ['cycle_start_date']);
    const startDate = row?.value || new Date().toISOString().split('T')[0];
    const currentDay = calculateDayNumber(new Date(), startDate);

    res.json({ startDate, currentDay });
  } catch (error) {
    console.error('Get cycle start error:', error);
    res.status(500).json({ error: 'Failed to get cycle start date' });
  }
});

/**
 * PUT /api/config/cycle-start
 * Update cycle start date (admin only)
 */
router.put('/cycle-start', authenticate, (req, res) => {
  try {
    const { startDate } = req.body;

    if (!startDate) {
      return res.status(400).json({ error: 'Start date required' });
    }

    run(
      'INSERT OR REPLACE INTO app_config (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
      ['cycle_start_date', startDate]
    );

    const currentDay = calculateDayNumber(new Date(), startDate);

    res.json({ startDate, currentDay });
  } catch (error) {
    console.error('Update cycle start error:', error);
    res.status(500).json({ error: 'Failed to update cycle start date' });
  }
});

export default router;
