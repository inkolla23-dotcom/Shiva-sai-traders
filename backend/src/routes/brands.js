import express from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { logActivity } from '../utils/activity.js';

const router = express.Router();

// Get all brands
router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const [brands] = await db.query('SELECT * FROM brands ORDER BY name ASC');
    res.json(brands);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add new brand
router.post('/', authenticateToken, async (req, res) => {
  const { name } = req.body;
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Brand name is required' });
  }

  const brandName = name.trim();

  try {
    const db = getDb();
    // Prevent duplicate brands (case insensitive check)
    const [existing] = await db.query('SELECT * FROM brands WHERE LOWER(name) = ?', [brandName.toLowerCase()]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Brand already exists' });
    }

    const [result] = await db.query('INSERT INTO brands (name) VALUES (?)', [brandName]);
    const newId = result.insertId;

    await logActivity(req.user.email, 'Brands', 'Created Brand', null, brandName);

    res.status(201).json({ id: newId, name: brandName });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete brand (Password Protected)
router.post('/:id/delete', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Password confirmation required to delete' });
  }

  try {
    const db = getDb();
    
    // Verify password
    const [users] = await db.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (users.length === 0 || !bcrypt.compareSync(password, users[0].password)) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    // Get brand name for logs
    const [brands] = await db.query('SELECT * FROM brands WHERE id = ?', [id]);
    if (brands.length === 0) {
      return res.status(404).json({ error: 'Brand not found' });
    }
    const brand = brands[0];

    // Delete brand
    await db.query('DELETE FROM brands WHERE id = ?', [id]);

    await logActivity(req.user.email, 'Brands', 'Deleted Brand', brand.name, null);

    res.json({ message: 'Brand deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
