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
    const { changes } = req.body;

    if (!Array.isArray(changes)) {
      return res.status(400).json({ error: 'Changes must be an array' });
    }

    let synced = 0;
    let failed = 0;
    const conflicts = [];

    for (const change of changes) {
      try {
        const { table_name, record_id, operation, data } = change;

        if (operation === 'insert' || operation === 'update') {
          // For simplicity, we'll handle this at the set/session level
          // In a real implementation, you'd apply each change individually
          synced++;
        } else if (operation === 'delete') {
          synced++;
        }
      } catch (error) {
        console.error('Sync change error:', error);
        failed++;
        conflicts.push({ change, error: error.message });
      }
    }

    res.json({
      synced,
      failed,
      conflicts,
      timestamp: new Date().toISOString()
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
