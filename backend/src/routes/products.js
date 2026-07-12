import express from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { logActivity } from '../utils/activity.js';

const router = express.Router();

// List products with search and filters
router.get('/', authenticateToken, async (req, res) => {
  const { search, brandId, stockStatus, expiryStatus } = req.query;
  try {
    const db = getDb();
    let query = `
      SELECT p.*, b.name as brand_name 
      FROM products p
      LEFT JOIN brands b ON p.brand_id = b.id
      WHERE 1=1
    `;
    const params = [];

    if (search && search.trim() !== '') {
      query += ' AND (p.name LIKE ? OR b.name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (brandId && brandId !== '') {
      query += ' AND p.brand_id = ?';
      params.push(brandId);
    }

    if (stockStatus) {
      if (stockStatus === 'low') {
        query += ' AND p.current_stock <= p.min_stock AND p.current_stock > 0';
      } else if (stockStatus === 'out') {
        query += ' AND p.current_stock = 0';
      } else if (stockStatus === 'ok') {
        query += ' AND p.current_stock > p.min_stock';
      }
    }

    if (expiryStatus) {
      const today = new Date().toISOString().split('T')[0];
      const soon = new Date();
      soon.setDate(soon.getDate() + 30);
      const soonStr = soon.toISOString().split('T')[0];

      if (expiryStatus === 'expired') {
        query += ' AND p.expiry_date < ?';
        params.push(today);
      } else if (expiryStatus === 'expiring') {
        query += ' AND p.expiry_date >= ? AND p.expiry_date <= ?';
        params.push(today, soonStr);
      } else if (expiryStatus === 'good') {
        query += ' AND p.expiry_date > ?';
        params.push(soonStr);
      }
    }

    query += ' ORDER BY p.name ASC';

    const [products] = await db.query(query, params);
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single product
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const [products] = await db.query(
      'SELECT p.*, b.name as brand_name FROM products p LEFT JOIN brands b ON p.brand_id = b.id WHERE p.id = ?',
      [req.params.id]
    );

    if (products.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(products[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create product (supports auto brand resolution)
router.post('/', authenticateToken, async (req, res) => {
  const {
    name,
    brand_id,
    brand_name,
    purchase_price,
    selling_price,
    min_stock,
    current_stock,
    mfg_date,
    expiry_date,
    expected_sales_completion_date
  } = req.body;

  if (!name || purchase_price === undefined || selling_price === undefined) {
    return res.status(400).json({ error: 'Name, purchase price, and selling price are required' });
  }

  try {
    const db = getDb();
    let finalBrandId = brand_id || null;

    // Brand management dropdown fallback - if dynamic custom brand text is entered
    if (!finalBrandId && brand_name && brand_name.trim() !== '') {
      const bName = brand_name.trim();
      const [existing] = await db.query('SELECT * FROM brands WHERE LOWER(name) = ?', [bName.toLowerCase()]);
      if (existing.length > 0) {
        finalBrandId = existing[0].id;
      } else {
        const [brandResult] = await db.query('INSERT INTO brands (name) VALUES (?)', [bName]);
        finalBrandId = brandResult.insertId;
        await logActivity(req.user.email, 'Brands', 'Created Brand dynamically', null, bName);
      }
    }

    const [result] = await db.query(
      `INSERT INTO products 
      (name, brand_id, purchase_price, selling_price, min_stock, current_stock, mfg_date, expiry_date, expected_sales_completion_date) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        finalBrandId,
        purchase_price,
        selling_price,
        min_stock || 0,
        current_stock || 0,
        mfg_date || null,
        expiry_date || null,
        expected_sales_completion_date || null
      ]
    );

    const newId = result.insertId;

    // Log replenishment if initial stock is > 0
    if (current_stock > 0) {
      const today = new Date().toISOString().split('T')[0];
      await db.query(
        'INSERT INTO inventory_replenishments (product_id, purchase_price, quantity_added, expiry_date, date_added) VALUES (?, ?, ?, ?, ?)',
        [newId, purchase_price, current_stock, expiry_date || null, today]
      );
    }

    await logActivity(req.user.email, 'Products', 'Created Product', null, name);

    res.status(201).json({ id: newId, message: 'Product created successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update product
router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const {
    name,
    brand_id,
    brand_name,
    purchase_price,
    selling_price,
    min_stock,
    current_stock,
    mfg_date,
    expiry_date,
    expected_sales_completion_date
  } = req.body;

  if (!name || purchase_price === undefined || selling_price === undefined) {
    return res.status(400).json({ error: 'Name, purchase price, and selling price are required' });
  }

  try {
    const db = getDb();
    let finalBrandId = brand_id || null;

    if (!finalBrandId && brand_name && brand_name.trim() !== '') {
      const bName = brand_name.trim();
      const [existing] = await db.query('SELECT * FROM brands WHERE LOWER(name) = ?', [bName.toLowerCase()]);
      if (existing.length > 0) {
        finalBrandId = existing[0].id;
      } else {
        const [brandResult] = await db.query('INSERT INTO brands (name) VALUES (?)', [bName]);
        finalBrandId = brandResult.insertId;
        await logActivity(req.user.email, 'Brands', 'Created Brand dynamically', null, bName);
      }
    }

    // Get original details for history logs
    const [orig] = await db.query('SELECT * FROM products WHERE id = ?', [id]);
    if (orig.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    await db.query(
      `UPDATE products 
       SET name = ?, brand_id = ?, purchase_price = ?, selling_price = ?, min_stock = ?, current_stock = ?, mfg_date = ?, expiry_date = ?, expected_sales_completion_date = ? 
       WHERE id = ?`,
      [
        name,
        finalBrandId,
        purchase_price,
        selling_price,
        min_stock,
        current_stock,
        mfg_date || null,
        expiry_date || null,
        expected_sales_completion_date || null,
        id
      ]
    );

    // If stock increases, insert replenishment record
    const diffStock = current_stock - orig[0].current_stock;
    if (diffStock > 0) {
      const today = new Date().toISOString().split('T')[0];
      await db.query(
        'INSERT INTO inventory_replenishments (product_id, purchase_price, quantity_added, expiry_date, date_added) VALUES (?, ?, ?, ?, ?)',
        [id, purchase_price, diffStock, expiry_date || null, today]
      );
    }

    await logActivity(req.user.email, 'Products', 'Updated Product', orig[0], req.body);

    res.json({ message: 'Product updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete product (Password Protected)
router.post('/:id/delete', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Password is required to delete' });
  }

  try {
    const db = getDb();

    // Verify Password
    const [users] = await db.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (users.length === 0 || !bcrypt.compareSync(password, users[0].password)) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    const [products] = await db.query('SELECT * FROM products WHERE id = ?', [id]);
    if (products.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    await db.query('DELETE FROM products WHERE id = ?', [id]);

    await logActivity(req.user.email, 'Products', 'Deleted Product', products[0].name, null);

    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Product history endpoint
router.get('/:id/history', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const db = getDb();
    
    // Replenishments
    const [replenish] = await db.query(
      'SELECT date_added as date, "Replenishment" as type, quantity_added as quantity, purchase_price as price FROM inventory_replenishments WHERE product_id = ? ORDER BY date_added DESC',
      [id]
    );

    // Sales
    const [sales] = await db.query(
      `SELECT s.sale_date as date, "Sale" as type, si.quantity, si.price, s.invoice_number 
       FROM sale_items si
       JOIN sales s ON si.sale_id = s.id
       WHERE si.product_id = ? 
       ORDER BY s.sale_date DESC`,
      [id]
    );

    // Combine history and sort by date descending
    const history = [...replenish, ...sales].sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
