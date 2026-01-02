import express from 'express';
import { getAll, run } from '../db/database.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

/**
 * POST /api/sync/push
 * Push changes from client to server (admin only)
 */
router.post('/push', authenticate, async (req, res) => {
  try {
    const { sessions = [], sets = [], sessionDays = [], sessionExercises = [] } = req.body;

    let synced = 0;
    let failed = 0;
    const conflicts = [];

    // Sync sessions
    for (const session of sessions) {
      try {
        run(
          `INSERT OR REPLACE INTO workout_sessions (
            id, session_date, status, notes, started_at, completed_at,
            created_at, updated_at, sync_version, last_synced_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            session.id,
            session.session_date,
            session.status,
            session.notes,
            session.started_at,
            session.completed_at,
            session.created_at,
            session.updated_at,
            (session.sync_version || 0) + 1,
            new Date().toISOString(),
          ]
        );
        synced++;
      } catch (error) {
        console.error('Sync session error:', error);
        failed++;
        conflicts.push({ type: 'session', id: session.id, error: error.message });
      }
    }

    // Sync session days
    for (const sessionDay of sessionDays) {
      try {
        run(
          `INSERT OR REPLACE INTO session_days (
            id, session_id, day_number, exercise_group_id,
            created_at, sync_version, last_synced_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            sessionDay.id,
            sessionDay.session_id,
            sessionDay.day_number,
            sessionDay.exercise_group_id,
            sessionDay.created_at,
            (sessionDay.sync_version || 0) + 1,
            new Date().toISOString(),
          ]
        );
        synced++;
      } catch (error) {
        console.error('Sync session day error:', error);
        failed++;
        conflicts.push({ type: 'session_day', id: sessionDay.id, error: error.message });
      }
    }

    // Sync session exercises
    for (const sessionExercise of sessionExercises) {
      try {
        run(
          `INSERT OR REPLACE INTO session_exercises (
            id, session_id, day_number, muscle_group, exercise_id, selection_order,
            created_at, sync_version, last_synced_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            sessionExercise.id,
            sessionExercise.session_id,
            sessionExercise.day_number,
            sessionExercise.muscle_group,
            sessionExercise.exercise_id,
            sessionExercise.selection_order,
            sessionExercise.created_at,
            (sessionExercise.sync_version || 0) + 1,
            new Date().toISOString(),
          ]
        );
        synced++;
      } catch (error) {
        console.error('Sync session exercise error:', error);
        failed++;
        conflicts.push({ type: 'session_exercise', id: sessionExercise.id, error: error.message });
      }
    }

    // Sync sets
    for (const set of sets) {
      try {
        run(
          `INSERT OR REPLACE INTO workout_sets (
            id, session_id, exercise_id, set_number, reps, weight,
            duration_seconds, notes, completed, created_at, updated_at,
            sync_version, last_synced_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            set.id,
            set.session_id,
            set.exercise_id,
            set.set_number,
            set.reps,
            set.weight,
            set.duration_seconds,
            set.notes,
            set.completed,
            set.created_at,
            set.updated_at,
            (set.sync_version || 0) + 1,
            new Date().toISOString(),
          ]
        );
        synced++;
      } catch (error) {
        console.error('Sync set error:', error);
        failed++;
        conflicts.push({ type: 'set', id: set.id, error: error.message });
      }
    }

    const response = {
      synced,
      failed,
      conflicts,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error) {
    console.error('Push sync error:', error);
    res.status(500).json({ error: 'Failed to push changes' });
  }
});

/**
 * GET /api/sync/pull
 * Pull updates from server to client
 */
router.get('/pull', async (req, res) => {
  try {
    const since = req.query.since || '1970-01-01T00:00:00.000Z';

    // Get updated sessions since timestamp
    const sessions = getAll(`
      SELECT * FROM workout_sessions
      WHERE updated_at > ?
      ORDER BY updated_at ASC
    `, [since]);

    // Get session days (no updated_at, use created_at)
    const sessionDays = getAll(`
      SELECT * FROM session_days
      WHERE created_at > ?
      ORDER BY created_at ASC
    `, [since]);

    // Get session exercises (no updated_at, use created_at)
    const sessionExercises = getAll(`
      SELECT * FROM session_exercises
      WHERE created_at > ?
      ORDER BY created_at ASC
    `, [since]);

    // Get updated sets since timestamp
    const sets = getAll(`
      SELECT * FROM workout_sets
      WHERE updated_at > ?
      ORDER BY updated_at ASC
    `, [since]);

    res.json({
      sessions,
      sessionDays,
      sessionExercises,
      sets,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Pull sync error:', error);
    res.status(500).json({ error: 'Failed to pull updates' });
  }
});

export default router;
