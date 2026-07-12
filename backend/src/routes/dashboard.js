import express from 'express';
import { getDb } from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    
    // 1. Total Products
    const [[{ totalProducts }]] = await db.query('SELECT COUNT(*) as totalProducts FROM products');

    // 2. Total Customers
    const [[{ totalCustomers }]] = await db.query('SELECT COUNT(*) as totalCustomers FROM customers');

    // 3. Total Sales
    const [[{ totalSales }]] = await db.query('SELECT COUNT(*) as totalSales FROM sales');

    // 4. Outstanding Payments
    const [[{ outstandingPayments }]] = await db.query('SELECT COALESCE(SUM(pending_amount), 0) as outstandingPayments FROM outstanding_payments WHERE pending_amount > 0');

    // 5. Low Stock Products
    const [[{ lowStockCount }]] = await db.query('SELECT COUNT(*) as lowStockCount FROM products WHERE current_stock <= min_stock AND current_stock > 0');

    // 6. Expiring Products (within next 30 days)
    const today = new Date().toISOString().split('T')[0];
    const soon = new Date();
    soon.setDate(soon.getDate() + 30);
    const soonStr = soon.toISOString().split('T')[0];
    const [[{ expiringCount }]] = await db.query('SELECT COUNT(*) as expiringCount FROM products WHERE expiry_date >= ? AND expiry_date <= ?', [today, soonStr]);

    // 7. Inventory Value
    const [[{ inventoryValue }]] = await db.query('SELECT COALESCE(SUM(current_stock * purchase_price), 0) as inventoryValue FROM products');

    // 8. Recent Activities
    const [recentActivities] = await db.query('SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 7');

    res.json({
      totalProducts,
      totalCustomers,
      totalSales,
      outstandingPayments: parseFloat(outstandingPayments),
      lowStockCount,
      expiringCount,
      inventoryValue: parseFloat(inventoryValue),
      recentActivities
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
