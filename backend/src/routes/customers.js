import express from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { logActivity } from '../utils/activity.js';

const router = express.Router();

// List customers with search
router.get('/', authenticateToken, async (req, res) => {
  const { search } = req.query;
  try {
    const db = getDb();
    let query = 'SELECT * FROM customers WHERE 1=1';
    const params = [];

    if (search && search.trim() !== '') {
      query += ' AND (shop_name LIKE ? OR owner_name LIKE ? OR phone LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY shop_name ASC';

    const [customers] = await db.query(query, params);
    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single customer details
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const [customers] = await db.query('SELECT * FROM customers WHERE id = ?', [req.params.id]);

    if (customers.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json(customers[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create Customer
router.post('/', authenticateToken, async (req, res) => {
  const { shop_name, owner_name, phone, gst_number, address } = req.body;

  if (!shop_name || !owner_name || !phone) {
    return res.status(400).json({ error: 'Shop name, owner name, and phone number are required' });
  }

  try {
    const db = getDb();
    
    // Check if shop name exists
    const [existing] = await db.query('SELECT * FROM customers WHERE shop_name = ?', [shop_name.trim()]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Customer shop name already registered' });
    }

    const [result] = await db.query(
      'INSERT INTO customers (shop_name, owner_name, phone, gst_number, address) VALUES (?, ?, ?, ?, ?)',
      [shop_name.trim(), owner_name.trim(), phone.trim(), gst_number ? gst_number.trim() : null, address || null]
    );

    await logActivity(req.user.email, 'Customers', 'Created Customer', null, shop_name);

    res.status(201).json({ id: result.insertId, message: 'Customer created successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Customer
router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { shop_name, owner_name, phone, gst_number, address } = req.body;

  if (!shop_name || !owner_name || !phone) {
    return res.status(400).json({ error: 'Shop name, owner name, and phone number are required' });
  }

  try {
    const db = getDb();

    const [orig] = await db.query('SELECT * FROM customers WHERE id = ?', [id]);
    if (orig.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Check unique shop name
    const [existing] = await db.query('SELECT * FROM customers WHERE shop_name = ? AND id != ?', [shop_name.trim(), id]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Shop name already registered for another customer' });
    }

    await db.query(
      'UPDATE customers SET shop_name = ?, owner_name = ?, phone = ?, gst_number = ?, address = ? WHERE id = ?',
      [shop_name.trim(), owner_name.trim(), phone.trim(), gst_number ? gst_number.trim() : null, address || null, id]
    );

    await logActivity(req.user.email, 'Customers', 'Updated Customer', orig[0], req.body);

    res.json({ message: 'Customer updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Customer (Password Protected)
router.post('/:id/delete', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Password required to delete customer' });
  }

  try {
    const db = getDb();

    // Verify Password
    const [users] = await db.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (users.length === 0 || !bcrypt.compareSync(password, users[0].password)) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    const [customers] = await db.query('SELECT * FROM customers WHERE id = ?', [id]);
    if (customers.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    await db.query('DELETE FROM customers WHERE id = ?', [id]);

    await logActivity(req.user.email, 'Customers', 'Deleted Customer', customers[0].shop_name, null);

    res.json({ message: 'Customer deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Customer purchase & outstanding history
router.get('/:id/history', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const db = getDb();
    
    // Invoices list
    const [sales] = await db.query(
      'SELECT id, invoice_number, sale_date, grand_total, amount_received, pending_amount, payment_status, due_date FROM sales WHERE customer_id = ? ORDER BY sale_date DESC',
      [id]
    );

    // Payments history list
    const [payments] = await db.query(
      `SELECT ph.payment_date, ph.amount_paid, ph.payment_method, ph.remarks, s.invoice_number 
       FROM payment_history ph
       JOIN sales s ON ph.sale_id = s.id
       WHERE s.customer_id = ?
       ORDER BY ph.payment_date DESC`,
      [id]
    );

    res.json({ sales, payments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
