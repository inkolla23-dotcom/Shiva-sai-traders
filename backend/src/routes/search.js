import express from 'express';
import { getDb } from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  const { query } = req.query;

  if (!query || query.trim() === '') {
    return res.json({ products: [], brands: [], customers: [], sales: [] });
  }

  const searchTerm = `%${query.trim()}%`;
  try {
    const db = getDb();

    // 1. Search Products
    const [products] = await db.query(
      'SELECT p.*, b.name as brand_name FROM products p LEFT JOIN brands b ON p.brand_id = b.id WHERE p.name LIKE ? LIMIT 10',
      [searchTerm]
    );

    // 2. Search Brands
    const [brands] = await db.query(
      'SELECT * FROM brands WHERE name LIKE ? LIMIT 10',
      [searchTerm]
    );

    // 3. Search Customers
    const [customers] = await db.query(
      'SELECT * FROM customers WHERE shop_name LIKE ? OR owner_name LIKE ? OR phone LIKE ? LIMIT 10',
      [searchTerm, searchTerm, searchTerm]
    );

    // 4. Search Sales
    const [sales] = await db.query(
      'SELECT s.*, c.shop_name FROM sales s JOIN customers c ON s.customer_id = c.id WHERE s.invoice_number LIKE ? LIMIT 10',
      [searchTerm]
    );

    res.json({
      products,
      brands,
      customers,
      sales
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
