import express from 'express';
import { getDb } from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Sales Report Endpoint
router.get('/sales', authenticateToken, async (req, res) => {
  const { startDate, endDate } = req.query;
  try {
    const db = getDb();
    let query = `
      SELECT s.*, c.shop_name 
      FROM sales s
      JOIN customers c ON s.customer_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (startDate && startDate !== '') {
      query += ' AND s.sale_date >= ?';
      params.push(startDate);
    }
    if (endDate && endDate !== '') {
      query += ' AND s.sale_date <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY s.sale_date DESC';
    const [sales] = await db.query(query, params);

    // Calculate Summary totals
    let totalSalesVal = 0;
    let totalTaxableVal = 0;
    let totalGstVal = 0;
    let totalReceivedVal = 0;
    let totalPendingVal = 0;

    sales.forEach(s => {
      totalSalesVal += parseFloat(s.grand_total);
      totalTaxableVal += parseFloat(s.taxable_amount);
      totalGstVal += parseFloat(s.gst_amount);
      totalReceivedVal += parseFloat(s.amount_received);
      totalPendingVal += parseFloat(s.pending_amount);
    });

    res.json({
      summary: {
        totalSales: totalSalesVal,
        totalTaxable: totalTaxableVal,
        totalGst: totalGstVal,
        totalReceived: totalReceivedVal,
        totalPending: totalPendingVal,
        invoiceCount: sales.length
      },
      data: sales
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Inventory Report Endpoint
router.get('/inventory', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const [products] = await db.query(`
      SELECT p.*, b.name as brand_name 
      FROM products p
      LEFT JOIN brands b ON p.brand_id = b.id
      ORDER BY p.current_stock DESC, p.name ASC
    `);

    let totalItemsVal = 0;
    let totalPurchaseVal = 0;
    let totalSalesVal = 0;
    let lowStockCount = 0;

    products.forEach(p => {
      totalItemsVal += p.current_stock;
      totalPurchaseVal += p.current_stock * parseFloat(p.purchase_price);
      totalSalesVal += p.current_stock * parseFloat(p.selling_price);
      if (p.current_stock <= p.min_stock) {
        lowStockCount++;
      }
    });

    res.json({
      summary: {
        totalProducts: products.length,
        totalStockQty: totalItemsVal,
        totalPurchaseValue: totalPurchaseVal,
        totalSalesValue: totalSalesVal,
        lowStockAlerts: lowStockCount
      },
      data: products
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Outstanding Report Endpoint
router.get('/outstanding', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const [outstandings] = await db.query(`
      SELECT op.*, s.invoice_number, s.grand_total, s.amount_received, c.shop_name, c.owner_name, c.phone 
      FROM outstanding_payments op
      JOIN sales s ON op.sale_id = s.id
      JOIN customers c ON op.customer_id = c.id
      WHERE op.pending_amount > 0
      ORDER BY op.due_date ASC
    `);

    let totalOutstandingVal = 0;
    let overdueCount = 0;
    const today = new Date();

    outstandings.forEach(op => {
      totalOutstandingVal += parseFloat(op.pending_amount);
      const dueDate = new Date(op.due_date);
      if (dueDate < today) {
        overdueCount++;
        op.is_overdue = true;
        op.days_overdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
      } else {
        op.is_overdue = false;
        op.days_overdue = 0;
      }
    });

    res.json({
      summary: {
        totalOutstanding: totalOutstandingVal,
        activeAccounts: outstandings.length,
        overdueAccounts: overdueCount
      },
      data: outstandings
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Expiry Report Endpoint
router.get('/expiry', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const [products] = await db.query(`
      SELECT p.*, b.name as brand_name 
      FROM products p
      LEFT JOIN brands b ON p.brand_id = b.id
      WHERE p.expiry_date IS NOT NULL
      ORDER BY p.expiry_date ASC
    `);

    const today = new Date();
    const soon = new Date();
    soon.setDate(soon.getDate() + 30);

    const expiredList = [];
    const expiringSoonList = [];

    products.forEach(p => {
      const expDate = new Date(p.expiry_date);
      const timeDiff = expDate - today;
      const daysRemaining = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
      p.days_remaining = daysRemaining;

      if (daysRemaining < 0) {
        expiredList.push(p);
      } else if (daysRemaining <= 30) {
        expiringSoonList.push(p);
      }
    });

    res.json({
      summary: {
        totalExpired: expiredList.length,
        totalExpiringSoon: expiringSoonList.length
      },
      expired: expiredList,
      expiringSoon: expiringSoonList
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
