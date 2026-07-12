import express from 'express';
import { getDb } from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { logActivity } from '../utils/activity.js';

const router = express.Router();

// Get business details.
// Intentionally unauthenticated: invoices (including the Public Invoice page,
// which has no login token) need to display the shop logo/name/GST/etc.
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const [rows] = await db.query('SELECT * FROM business_details WHERE id = 1');

    if (rows.length === 0) {
      return res.json({
        id: 1,
        shop_name: '',
        owner_name: '',
        mobile: '',
        email: '',
        gst_number: '',
        upi_id: '',
        logo: null
      });
    }

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create/Update business details (single record, upsert on id = 1)
router.put('/', authenticateToken, async (req, res) => {
  const { shop_name, owner_name, mobile, email, gst_number, upi_id, logo } = req.body;

  if (!shop_name || !shop_name.trim() || !owner_name || !owner_name.trim() || !mobile || !mobile.trim()) {
    return res.status(400).json({ error: 'Shop name, owner name, and mobile number are required' });
  }

  if (email && email.trim() !== '') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ error: 'Please enter a valid business email address' });
    }
  }

  try {
    const db = getDb();
    const [existing] = await db.query('SELECT * FROM business_details WHERE id = 1');

    await db.query(
      `INSERT INTO business_details (id, shop_name, owner_name, mobile, email, gst_number, upi_id, logo)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         shop_name = VALUES(shop_name),
         owner_name = VALUES(owner_name),
         mobile = VALUES(mobile),
         email = VALUES(email),
         gst_number = VALUES(gst_number),
         upi_id = VALUES(upi_id),
         logo = VALUES(logo)`,
      [
        shop_name.trim(),
        owner_name.trim(),
        mobile.trim(),
        email ? email.trim() : null,
        gst_number ? gst_number.trim() : null,
        upi_id ? upi_id.trim() : null,
        logo || null
      ]
    );

    await logActivity(
      req.user.email,
      'Business Details',
      existing.length > 0 ? 'Updated Business Details' : 'Created Business Details',
      existing[0] || null,
      { shop_name, owner_name, mobile, email, gst_number, upi_id }
    );

    const [updated] = await db.query('SELECT * FROM business_details WHERE id = 1');
    res.json({ message: 'Business details saved successfully', business: updated[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
