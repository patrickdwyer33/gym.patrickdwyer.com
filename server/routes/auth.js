import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Single admin user (in production, store this in database)
const ADMIN_USER = {
  username: process.env.ADMIN_USERNAME,
  passwordHash: process.env.ADMIN_PASSWORD_HASH
};

/**
 * POST /api/auth/login
 * Login with username and password
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    if (username !== ADMIN_USER.username) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, ADMIN_USER.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { username: ADMIN_USER.username },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { username: ADMIN_USER.username },
      expiresIn: 7 * 24 * 60 * 60 // 7 days in seconds
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * POST /api/auth/logout
 * Logout (client-side token removal)
 */
router.post('/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
});

/**
 * GET /api/auth/verify
 * Verify token validity
 */
router.get('/verify', authenticate, (req, res) => {
  res.json({
    valid: true,
    user: req.user
  });
});

export default router;
