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
      SELECT eg.*
      FROM schedule s
      JOIN exercise_groups eg ON s.workout_id = eg.id
      WHERE s.day_number = ?
    `, [dayNumber]);

    if (!scheduleRow) {
      return res.status(404).json({ error: 'No workout found for this day' });
    }

    // Get ALL exercises for muscle_group1
    const muscleGroup1Exercises = getAll(`
      SELECT id, name, muscle_group, type, equipment_level
      FROM exercises
      WHERE muscle_group = ?
      ORDER BY equipment_level DESC, name
    `, [scheduleRow.muscle_group1]);

    // Get ALL exercises for muscle_group2
    const muscleGroup2Exercises = getAll(`
      SELECT id, name, muscle_group, type, equipment_level
      FROM exercises
      WHERE muscle_group = ?
      ORDER BY equipment_level DESC, name
    `, [scheduleRow.muscle_group2]);

    // Get session for this date if it exists
    const session = getOne(`
      SELECT * FROM workout_sessions
      WHERE session_date = ?
    `, [date]);

    // Get selected exercises if session exists
    let selectedExercises = [];
    if (session) {
      selectedExercises = getAll(`
        SELECT se.*, e.name, e.muscle_group, e.type, e.equipment_level
        FROM session_exercises se
        JOIN exercises e ON se.exercise_id = e.id
        WHERE se.session_id = ?
        ORDER BY se.selection_order
      `, [session.id]);
    }

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
      muscleGroups: [
        {
          name: scheduleRow.muscle_group1,
          exercises: muscleGroup1Exercises
        },
        {
          name: scheduleRow.muscle_group2,
          exercises: muscleGroup2Exercises
        }
      ]
    };

    res.json({
      date,
      dayNumber,
      exerciseGroup,
      selectedExercises,
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
 * POST /api/workouts/session/:id/select-exercises
 * Select exercises for a workout session (admin only)
 */
router.post('/session/:id/select-exercises', authenticate, async (req, res) => {
  try {
    const sessionId = req.params.id;
    const { exercise1Id, exercise2Id } = req.body;

    if (!exercise1Id || !exercise2Id) {
      return res.status(400).json({ error: 'Both exercise IDs required' });
    }

    // Get session to verify it exists and get exercise group
    const session = getOne(`
      SELECT ws.*, eg.muscle_group1, eg.muscle_group2
      FROM workout_sessions ws
      JOIN exercise_groups eg ON ws.exercise_group_id = eg.id
      WHERE ws.id = ?
    `, [sessionId]);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Get the exercises to validate they match the muscle groups
    const exercise1 = getOne('SELECT * FROM exercises WHERE id = ?', [exercise1Id]);
    const exercise2 = getOne('SELECT * FROM exercises WHERE id = ?', [exercise2Id]);

    if (!exercise1 || !exercise2) {
      return res.status(404).json({ error: 'One or both exercises not found' });
    }

    // Validate exercises match the session's muscle groups
    if (exercise1.muscle_group !== session.muscle_group1) {
      return res.status(400).json({
        error: `Exercise 1 must be from muscle group: ${session.muscle_group1}`
      });
    }
    if (exercise2.muscle_group !== session.muscle_group2) {
      return res.status(400).json({
        error: `Exercise 2 must be from muscle group: ${session.muscle_group2}`
      });
    }

    // Delete existing selections
    run('DELETE FROM session_exercises WHERE session_id = ?', [sessionId]);

    // Insert new selections
    run(`
      INSERT INTO session_exercises (session_id, muscle_group, exercise_id, selection_order)
      VALUES (?, ?, ?, 1)
    `, [sessionId, exercise1.muscle_group, exercise1Id]);

    run(`
      INSERT INTO session_exercises (session_id, muscle_group, exercise_id, selection_order)
      VALUES (?, ?, ?, 2)
    `, [sessionId, exercise2.muscle_group, exercise2Id]);

    // Get the selections to return
    const selectedExercises = getAll(`
      SELECT se.*, e.name, e.muscle_group, e.type, e.equipment_level
      FROM session_exercises se
      JOIN exercises e ON se.exercise_id = e.id
      WHERE se.session_id = ?
      ORDER BY se.selection_order
    `, [sessionId]);

    res.json({ selectedExercises });
  } catch (error) {
    console.error('Select exercises error:', error);
    res.status(500).json({ error: 'Failed to select exercises' });
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
