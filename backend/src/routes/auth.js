import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { logActivity } from '../utils/activity.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'shivasaitraders_secret_key_2026';

// Login route
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

if (!email || !password) {
  return res.status(400).json({
    error: 'Email and password are required'
  });
}

try {
  const db = getDb();
  const [users] = await db.query(
    'SELECT * FROM users WHERE email = ?',
    [email]
  );

  if (users.length === 0) {
    return res.status(401).json({
      error: 'Invalid email or password'
    });
  }

    const user = users[0];
    const isPasswordValid = bcrypt.compareSync(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    await logActivity(user.email, 'Auth', 'Login Successful', null, null);

    res.json({
      token,
      user: {
        id: user.id,
        role: user.role,
        email: user.email
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login: ' + err.message });
  }
});

// Verify token / fetch fresh profile (includes email, which isn't stored in the JWT)
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const [users] = await db.query('SELECT id, role, email FROM users WHERE id = ?', [req.user.id]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user: users[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Change Password
router.post('/change-password', authenticateToken, async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Old password and new password are required' });
  }

  try {
    const db = getDb();
    const [users] = await db.query('SELECT * FROM users WHERE id = ?', [req.user.id]);

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];
    const isPasswordValid = bcrypt.compareSync(oldPassword, user.password);

    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Incorrect old password' });
    }

    const hashedNewPassword = bcrypt.hashSync(newPassword, 10);
    await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedNewPassword, user.id]);

    await logActivity(req.user.email, 'Auth', 'Password Changed', null, null);

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('Password change error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Change Admin Email
router.post('/change-email', authenticateToken, async (req, res) => {
  const { currentPassword, newEmail } = req.body;

  if (!currentPassword || !newEmail) {
    return res.status(400).json({ error: 'Current password and new email are required' });
  }

  const emailTrimmed = newEmail.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailTrimmed)) {
    return res.status(400).json({ error: 'Please enter a valid email address' });
  }

  try {
    const db = getDb();
    const [users] = await db.query('SELECT * FROM users WHERE id = ?', [req.user.id]);

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];
    const isPasswordValid = bcrypt.compareSync(currentPassword, user.password);

    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Incorrect current password' });
    }

    // Validate duplicate email (excluding self)
    const [existing] = await db.query('SELECT id FROM users WHERE email = ? AND id != ?', [emailTrimmed, user.id]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'This email address is already in use by another account' });
    }

    const oldEmail = user.email || '(not set)';
    await db.query('UPDATE users SET email = ? WHERE id = ?', [emailTrimmed, user.id]);

    await logActivity(emailTrimmed, 'Auth', 'Email Address Changed', oldEmail, emailTrimmed);

    const token = jwt.sign(
      { id: user.id, email: emailTrimmed, role: user.role },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      message: 'Email updated successfully',
      token,
      user: { id: user.id, role: user.role, email: emailTrimmed }
    });
  } catch (err) {
    console.error('Email change error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Verify admin/user password for delete security
router.post('/verify-password', authenticateToken, async (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }

  try {
    const db = getDb();
    const [users] = await db.query('SELECT * FROM users WHERE id = ?', [req.user.id]);

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];
    const isPasswordValid = bcrypt.compareSync(password, user.password);

    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Incorrect password' });
    }

    res.json({ success: true, message: 'Password verified' });
  } catch (err) {
    console.error('Password verify error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

export default router;
