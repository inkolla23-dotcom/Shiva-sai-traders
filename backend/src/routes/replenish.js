import express from 'express';
import { getDb } from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { logActivity } from '../utils/activity.js';

const router = express.Router();

// List replenishment timeline history
router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const [history] = await db.query(
      `SELECT ir.*, p.name as product_name, b.name as brand_name
       FROM inventory_replenishments ir
       JOIN products p ON ir.product_id = p.id
       LEFT JOIN brands b ON p.brand_id = b.id
       ORDER BY ir.date_added DESC, ir.id DESC`
    );
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Replenish stock for a product
router.post('/', authenticateToken, async (req, res) => {
  const { product_id, purchase_price, quantity_added, expiry_date, date_added } = req.body;

  if (!product_id || purchase_price === undefined || !quantity_added || quantity_added <= 0) {
    return res.status(400).json({ error: 'Product, purchase price, and positive quantity are required' });
  }

  const db = getDb();
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // Verify product exists
    const [prods] = await connection.query('SELECT name, current_stock FROM products WHERE id = ?', [product_id]);
    if (prods.length === 0) {
      throw new Error('Product not found');
    }
    const product = prods[0];

    const finalDateAdded = date_added || new Date().toISOString().split('T')[0];

    // 1. Insert replenishment log
    await connection.query(
      'INSERT INTO inventory_replenishments (product_id, purchase_price, quantity_added, expiry_date, date_added) VALUES (?, ?, ?, ?, ?)',
      [product_id, purchase_price, quantity_added, expiry_date || null, finalDateAdded]
    );

    // 2. Update product stock and purchase price
    // Note: If expiry date is updated, we also update the product's expiry date
    let updateQuery = 'UPDATE products SET current_stock = current_stock + ?, purchase_price = ?';
    const params = [quantity_added, purchase_price];

    if (expiry_date) {
      updateQuery += ', expiry_date = ?';
      params.push(expiry_date);
    }
    updateQuery += ' WHERE id = ?';
    params.push(product_id);

    await connection.query(updateQuery, params);

    await connection.commit();

    await logActivity(
      req.user.email,
      'Inventory',
      `Replenished ${product.name}`,
      { stock: product.current_stock },
      { stock: product.current_stock + quantity_added, added: quantity_added, cost: purchase_price }
    );

    res.json({ message: 'Stock replenished successfully' });
  } catch (err) {
    await connection.rollback();
    res.status(400).json({ error: err.message });
  } finally {
    connection.release();
  }
});

export default router;
