import express from 'express';
import { getAll, getOne, run } from '../db/database.js';
import { calculateDayNumber } from '../utils/dayCalculator.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/workouts/today
 * Get today's workout (exercise group, exercises, and session if exists)
 */
router.get('/today', async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];

    // Get cycle start date
    const configRow = getOne('SELECT value FROM app_config WHERE key = ?', ['cycle_start_date']);
    const cycleStartDate = configRow?.value || date;

    // Calculate day number
    const dayNumber = calculateDayNumber(date, cycleStartDate);

    // Get exercise group for this day
    const scheduleRow = getOne(`
      SELECT eg.*,
             e1.id as ex1_id, e1.name as ex1_name, e1.type as ex1_type,
             e1.primary_variant as ex1_primary, e1.alternate_variant as ex1_alternate,
             e1.no_equipment_variant as ex1_no_equipment,
             e2.id as ex2_id, e2.name as ex2_name, e2.type as ex2_type,
             e2.primary_variant as ex2_primary, e2.alternate_variant as ex2_alternate,
             e2.no_equipment_variant as ex2_no_equipment
      FROM schedule s
      JOIN exercise_groups eg ON s.workout_id = eg.id
      JOIN exercises e1 ON eg.exercise1_id = e1.id
      JOIN exercises e2 ON eg.exercise2_id = e2.id
      WHERE s.day_number = ?
    `, [dayNumber]);

    if (!scheduleRow) {
      return res.status(404).json({ error: 'No workout found for this day' });
    }

    // Get session for this date if it exists
    const session = getOne(`
      SELECT * FROM workout_sessions
      WHERE session_date = ?
    `, [date]);

    // Get sets for this session if it exists
    let sets = [];
    if (session) {
      sets = getAll(`
        SELECT * FROM workout_sets
        WHERE session_id = ?
        ORDER BY exercise_id, set_number
      `, [session.id]);
    }

    // Format response
    const exerciseGroup = {
      id: scheduleRow.id,
      name: scheduleRow.name,
      exercises: [
        {
          id: scheduleRow.ex1_id,
          name: scheduleRow.ex1_name,
          type: scheduleRow.ex1_type,
          primaryVariant: scheduleRow.ex1_primary,
          alternateVariant: scheduleRow.ex1_alternate,
          noEquipmentVariant: scheduleRow.ex1_no_equipment
        },
        {
          id: scheduleRow.ex2_id,
          name: scheduleRow.ex2_name,
          type: scheduleRow.ex2_type,
          primaryVariant: scheduleRow.ex2_primary,
          alternateVariant: scheduleRow.ex2_alternate,
          noEquipmentVariant: scheduleRow.ex2_no_equipment
        }
      ]
    };

    res.json({
      date,
      dayNumber,
      exerciseGroup,
      session,
      sets
    });
  } catch (error) {
    console.error('Get today workout error:', error);
    res.status(500).json({ error: 'Failed to get today\'s workout' });
  }
});

/**
 * GET /api/workouts/history
 * Get historical workout sessions
 */
router.get('/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    const sessions = getAll(`
      SELECT ws.*,
             eg.name as exercise_group_name,
             COUNT(wset.id) as total_sets
      FROM workout_sessions ws
      JOIN exercise_groups eg ON ws.exercise_group_id = eg.id
      LEFT JOIN workout_sets wset ON ws.id = wset.session_id
      GROUP BY ws.id
      ORDER BY ws.session_date DESC
      LIMIT ? OFFSET ?
    `, [limit, offset]);

    const total = getOne('SELECT COUNT(*) as count FROM workout_sessions');

    res.json({
      sessions,
      total: total.count,
      hasMore: offset + sessions.length < total.count
    });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: 'Failed to get workout history' });
  }
});

/**
 * GET /api/workouts/session/:id
 * Get a specific session with all sets
 */
router.get('/session/:id', async (req, res) => {
  try {
    const session = getOne(`
      SELECT ws.*, eg.name as exercise_group_name
      FROM workout_sessions ws
      JOIN exercise_groups eg ON ws.exercise_group_id = eg.id
      WHERE ws.id = ?
    `, [req.params.id]);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const sets = getAll(`
      SELECT wset.*, e.name as exercise_name
      FROM workout_sets wset
      JOIN exercises e ON wset.exercise_id = e.id
      WHERE wset.session_id = ?
      ORDER BY wset.exercise_id, wset.set_number
    `, [req.params.id]);

    res.json({ session, sets });
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ error: 'Failed to get session' });
  }
});

/**
 * POST /api/workouts/session
 * Create a new workout session (admin only)
 */
router.post('/session', authenticate, async (req, res) => {
  try {
    const { date, dayNumber, exerciseGroupId } = req.body;

    if (!date || !dayNumber || !exerciseGroupId) {
      return res.status(400).json({ error: 'Date, day number, and exercise group ID required' });
    }

    const result = run(`
      INSERT INTO workout_sessions (session_date, day_number, exercise_group_id, status, started_at, updated_at)
      VALUES (?, ?, ?, 'in_progress', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [date, dayNumber, exerciseGroupId]);

    const session = getOne('SELECT * FROM workout_sessions WHERE id = ?', [result.lastInsertRowid]);

    res.status(201).json({ session });
  } catch (error) {
    console.error('Create session error:', error);
    if (error.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'Session already exists for this date' });
    }
    res.status(500).json({ error: 'Failed to create session' });
  }
});

/**
 * PUT /api/workouts/session/:id
 * Update a workout session (admin only)
 */
router.put('/session/:id', authenticate, async (req, res) => {
  try {
    const { status, notes, completedAt } = req.body;
    const updates = [];
    const params = [];

    if (status) {
      updates.push('status = ?');
      params.push(status);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      params.push(notes);
    }
    if (completedAt) {
      updates.push('completed_at = ?');
      params.push(completedAt);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(req.params.id);

    run(`UPDATE workout_sessions SET ${updates.join(', ')} WHERE id = ?`, params);

    const session = getOne('SELECT * FROM workout_sessions WHERE id = ?', [req.params.id]);

    res.json({ session });
  } catch (error) {
    console.error('Update session error:', error);
    res.status(500).json({ error: 'Failed to update session' });
  }
});

/**
 * POST /api/workouts/set
 * Create a new workout set (admin only)
 */
router.post('/set', authenticate, async (req, res) => {
  try {
    const { sessionId, exerciseId, setNumber, reps, weight, durationSeconds, notes, completed } = req.body;

    if (!sessionId || !exerciseId || !setNumber) {
      return res.status(400).json({ error: 'Session ID, exercise ID, and set number required' });
    }

    const result = run(`
      INSERT INTO workout_sets
      (session_id, exercise_id, set_number, reps, weight, duration_seconds, notes, completed, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [sessionId, exerciseId, setNumber, reps || null, weight || null, durationSeconds || null, notes || null, completed || 1]);

    const set = getOne('SELECT * FROM workout_sets WHERE id = ?', [result.lastInsertRowid]);

    res.status(201).json({ set });
  } catch (error) {
    console.error('Create set error:', error);
    if (error.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'Set already exists for this session/exercise/set number' });
    }
    res.status(500).json({ error: 'Failed to create set' });
  }
});

/**
 * PUT /api/workouts/set/:id
 * Update a workout set (admin only)
 */
router.put('/set/:id', authenticate, async (req, res) => {
  try {
    const { reps, weight, durationSeconds, notes, completed } = req.body;
    const updates = [];
    const params = [];

    if (reps !== undefined) {
      updates.push('reps = ?');
      params.push(reps);
    }
    if (weight !== undefined) {
      updates.push('weight = ?');
      params.push(weight);
    }
    if (durationSeconds !== undefined) {
      updates.push('duration_seconds = ?');
      params.push(durationSeconds);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      params.push(notes);
    }
    if (completed !== undefined) {
      updates.push('completed = ?');
      params.push(completed ? 1 : 0);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(req.params.id);

    run(`UPDATE workout_sets SET ${updates.join(', ')} WHERE id = ?`, params);

    const set = getOne('SELECT * FROM workout_sets WHERE id = ?', [req.params.id]);

    res.json({ set });
  } catch (error) {
    console.error('Update set error:', error);
    res.status(500).json({ error: 'Failed to update set' });
  }
});

/**
 * DELETE /api/workouts/set/:id
 * Delete a workout set (admin only)
 */
router.delete('/set/:id', authenticate, async (req, res) => {
  try {
    run('DELETE FROM workout_sets WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete set error:', error);
    res.status(500).json({ error: 'Failed to delete set' });
  }
});

export default router;
