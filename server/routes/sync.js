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
    const { sessions = [], sets = [] } = req.body;

    let synced = 0;
    let failed = 0;
    const conflicts = [];

    // Sync sessions
    for (const session of sessions) {
      try {
        run(
          `INSERT OR REPLACE INTO workout_sessions (
            id, session_date, day_number, exercise_group_id, status,
            notes, started_at, completed_at, created_at, updated_at,
            sync_version, last_synced_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            session.id,
            session.session_date,
            session.day_number,
            session.exercise_group_id,
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

    res.json({
      synced,
      failed,
      conflicts,
      timestamp: new Date().toISOString(),
    });
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

    // Get updated sets since timestamp
    const sets = getAll(`
      SELECT * FROM workout_sets
      WHERE updated_at > ?
      ORDER BY updated_at ASC
    `, [since]);

    res.json({
      sessions,
      sets,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Pull sync error:', error);
    res.status(500).json({ error: 'Failed to pull updates' });
  }
});

export default router;
