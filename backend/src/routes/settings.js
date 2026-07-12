import express from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { logActivity } from '../utils/activity.js';

const router = express.Router();

// Retrieve Activity Logs
router.get('/logs', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const [logs] = await db.query('SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 500');
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Clear Activity Logs (Password Protected)
router.post('/logs/clear', authenticateToken, async (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'Password confirmation required' });
  }

  try {
    const db = getDb();
    const [users] = await db.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (users.length === 0 || !bcrypt.compareSync(password, users[0].password)) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    await db.query('TRUNCATE TABLE activity_logs');
    await logActivity(req.user.email, 'Settings', 'Cleared Activity Logs', null, null);
    res.json({ message: 'Activity logs cleared successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Database Backup (JSON Export)
router.get('/backup', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const tables = [
      'users',
      'brands',
      'products',
      'customers',
      'sales',
      'sale_items',
      'outstanding_payments',
      'payment_history',
      'inventory_replenishments',
      'settings'
    ];

    const backupData = {
      backupDate: new Date().toISOString(),
      generator: 'Shiva Sai Traders Backup Tool',
      tables: {}
    };

    for (const table of tables) {
      const [rows] = await db.query(`SELECT * FROM ${table}`);
      backupData.tables[table] = rows;
    }

    res.setHeader('Content-disposition', `attachment; filename=sst_backup_${Date.now()}.json`);
    res.setHeader('Content-type', 'application/json');
    res.write(JSON.stringify(backupData, null, 2));
    res.end();
  } catch (err) {
    console.error('Backup error:', err);
    res.status(500).json({ error: 'Backup failed: ' + err.message });
  }
});

// Database Restore (JSON Import)
router.post('/restore', authenticateToken, async (req, res) => {
  const { backupData, password } = req.body;

  if (!password || !backupData) {
    return res.status(400).json({ error: 'Password and backup data are required' });
  }

  const db = getDb();
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // Verify Password
    const [users] = await connection.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (users.length === 0 || !bcrypt.compareSync(password, users[0].password)) {
      throw new Error('Incorrect password');
    }

    // Parse backup json
    const data = typeof backupData === 'string' ? JSON.parse(backupData) : backupData;
    if (!data.tables) {
      throw new Error('Invalid backup file structure');
    }

    // Disable foreign key checks for restore
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    for (const [table, rows] of Object.entries(data.tables)) {
      // 1. Truncate table
      await connection.query(`TRUNCATE TABLE ${table}`);

      // 2. Insert records
      if (rows && rows.length > 0) {
        const columns = Object.keys(rows[0]);
        const placeholders = columns.map(() => '?').join(', ');
        const insertQuery = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;

        for (const row of rows) {
          const values = columns.map(col => row[col]);
          await connection.query(insertQuery, values);
        }
      }
    }

    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    await connection.commit();

    await logActivity(req.user.email, 'Settings', 'Database Restored from Backup', null, null);
    res.json({ message: 'Database restored successfully' });
  } catch (err) {
    await connection.rollback();
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    res.status(400).json({ error: 'Restore failed: ' + err.message });
  } finally {
    connection.release();
  }
});

// Reset Utility - Wipes all operational data except Users & Brands (Password Protected)
router.post('/reset', authenticateToken, async (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'Password confirmation required' });
  }

  const db = getDb();
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // Verify password
    const [users] = await connection.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (users.length === 0 || !bcrypt.compareSync(password, users[0].password)) {
      throw new Error('Incorrect password');
    }

    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    
    // Truncate tables
    await connection.query('TRUNCATE TABLE sales');
    await connection.query('TRUNCATE TABLE sale_items');
    await connection.query('TRUNCATE TABLE outstanding_payments');
    await connection.query('TRUNCATE TABLE payment_history');
    await connection.query('TRUNCATE TABLE inventory_replenishments');
    await connection.query('TRUNCATE TABLE products');
    await connection.query('TRUNCATE TABLE customers');
    await connection.query('TRUNCATE TABLE brands');
    
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    await connection.commit();

    await logActivity(req.user.email, 'Settings', 'Full Database Reset Performed', null, null);
    res.json({ message: 'Database reset successfully. Operational tables are cleared.' });
  } catch (err) {
    await connection.rollback();
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    res.status(400).json({ error: err.message });
  } finally {
    connection.release();
  }
});

// Sales Cleanup Utility - Deletes all invoice records but keeps products and customer lists (Password Protected)
router.post('/sales-cleanup', authenticateToken, async (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'Password confirmation required' });
  }

  const db = getDb();
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // Verify password
    const [users] = await connection.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (users.length === 0 || !bcrypt.compareSync(password, users[0].password)) {
      throw new Error('Incorrect password');
    }

    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    
    // Wipe sales structures
    await connection.query('TRUNCATE TABLE sales');
    await connection.query('TRUNCATE TABLE sale_items');
    await connection.query('TRUNCATE TABLE outstanding_payments');
    await connection.query('TRUNCATE TABLE payment_history');

    // Reset current_stock on products to 0 or leave as is? Usually sales cleanup sets all stock to default/original purchase stock.
    // Let's reset product stock to 0 to keep inventory clean or let it remain. Let's reset stock.
    await connection.query('UPDATE products SET current_stock = 0');
    
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    await connection.commit();

    await logActivity(req.user.email, 'Settings', 'Sales History Cleaned Up', null, null);
    res.json({ message: 'Sales and transaction records cleaned up successfully. Product stock counts have been reset to 0.' });
  } catch (err) {
    await connection.rollback();
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    res.status(400).json({ error: err.message });
  } finally {
    connection.release();
  }
});

export default router;
