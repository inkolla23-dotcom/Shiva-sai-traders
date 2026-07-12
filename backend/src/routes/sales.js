import express from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { logActivity } from '../utils/activity.js';

const router = express.Router();

// Helper to generate Invoice Number (e.g., SST-YYYYMMDD-0001)
async function generateInvoiceNumber(db) {
  const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const prefix = `SST-${dateStr}-`;

  const [last] = await db.query(
    'SELECT invoice_number FROM sales WHERE invoice_number LIKE ? ORDER BY id DESC LIMIT 1',
    [`${prefix}%`]
  );

  let seqNum = 1;
  if (last.length > 0) {
    const lastNum = last[0].invoice_number;
    const parts = lastNum.split('-');
    const lastSeq = parseInt(parts[parts.length - 1]);
    if (!isNaN(lastSeq)) {
      seqNum = lastSeq + 1;
    }
  }

  return `${prefix}${String(seqNum).padStart(4, '0')}`;
}

// Get sales list with filters
router.get('/', authenticateToken, async (req, res) => {
  const { search, customerId, startDate, endDate } = req.query;
  try {
    const db = getDb();
    let query = `
      SELECT s.*, c.shop_name, c.owner_name, c.phone, c.gst_number, c.address
      FROM sales s
      JOIN customers c ON s.customer_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (search && search.trim() !== '') {
      query += ' AND (s.invoice_number LIKE ? OR c.shop_name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (customerId && customerId !== '') {
      query += ' AND s.customer_id = ?';
      params.push(customerId);
    }

    if (startDate && startDate !== '') {
      query += ' AND s.sale_date >= ?';
      params.push(startDate);
    }

    if (endDate && endDate !== '') {
      query += ' AND s.sale_date <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY s.id DESC';

    const [sales] = await db.query(query, params);
    res.json(sales);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single sale details (Invoice breakdown)
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const db = getDb();

    // Fetch sale
    const [sales] = await db.query(
      `SELECT s.*, c.shop_name, c.owner_name, c.phone, c.gst_number as customer_gst, c.address as customer_address 
       FROM sales s
       JOIN customers c ON s.customer_id = c.id
       WHERE s.id = ?`,
      [id]
    );

    if (sales.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const sale = sales[0];

    // Fetch items
    const [items] = await db.query(
      `SELECT si.*, p.name as product_name, b.name as brand_name
       FROM sale_items si
       JOIN products p ON si.product_id = p.id
       LEFT JOIN brands b ON p.brand_id = b.id
       WHERE si.sale_id = ?`,
      [id]
    );

    // Fetch payments log
    const [payments] = await db.query(
      'SELECT * FROM payment_history WHERE sale_id = ? ORDER BY id ASC',
      [id]
    );

    res.json({ sale, items, payments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Record new sale
router.post('/', authenticateToken, async (req, res) => {
  const {
    customer_id,
    sale_date,
    remarks,
    due_date,
    items // array of { product_id, quantity, price }
  } = req.body;

  // Safely coerce to a real number to avoid string-concatenation / NaN bugs downstream
  const amount_received = Number(req.body.amount_received) || 0;

  if (!customer_id || !sale_date || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Customer, date, and items list are required' });
  }

  if (isNaN(amount_received) || amount_received < 0) {
    return res.status(400).json({ error: 'Amount received must be a valid non-negative number' });
  }

  const db = getDb();
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Double check inventory stock and compute taxable sums
    let taxable_amount = 0;
    const validatedItems = [];

    for (const item of items) {
      const { product_id, quantity, price } = item;
      if (!product_id || quantity <= 0 || price < 0) {
        throw new Error('Invalid item parameters: Quantity must be > 0 and price >= 0');
      }

      // Fetch product to verify stock
      const [prods] = await connection.query(
        'SELECT id, name, current_stock, min_stock FROM products WHERE id = ? FOR UPDATE',
        [product_id]
      );

      if (prods.length === 0) {
        throw new Error(`Product not found: ID ${product_id}`);
      }

      const prod = prods[0];
      if (prod.current_stock < quantity) {
        throw new Error(`Insufficient stock for ${prod.name}. Available: ${prod.current_stock}, Requested: ${quantity}`);
      }

      const itemTotal = quantity * price;
      taxable_amount += itemTotal;
      validatedItems.push({
        product_id,
        quantity,
        price,
        total_price: itemTotal,
        name: prod.name,
        current_stock: prod.current_stock
      });
    }

    // 2. GST Calculations (Standard 18% GST: 9% CGST + 9% SGST)
    const gst_amount = parseFloat((taxable_amount * 0.18).toFixed(2));
    const grand_total = parseFloat((taxable_amount + gst_amount).toFixed(2));
    const pending_amount = parseFloat((grand_total - amount_received).toFixed(2));

    let payment_status = 'Unpaid';
    if (amount_received >= grand_total) {
      payment_status = 'Paid';
    } else if (amount_received > 0) {
      payment_status = 'Partially Paid';
    }

    // Generate Invoice Number
    const invoice_number = await generateInvoiceNumber(connection);

    // 3. Insert Sale
    const [saleResult] = await connection.query(
      `INSERT INTO sales 
      (invoice_number, customer_id, sale_date, remarks, taxable_amount, gst_amount, grand_total, amount_received, pending_amount, due_date, payment_status) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        invoice_number,
        customer_id,
        sale_date,
        remarks || '',
        taxable_amount,
        gst_amount,
        grand_total,
        amount_received,
        pending_amount,
        due_date || null,
        payment_status
      ]
    );

    const saleId = saleResult.insertId;

    // 4. Save items & deduct stock
    for (const item of validatedItems) {
      await connection.query(
        'INSERT INTO sale_items (sale_id, product_id, quantity, price, total_price) VALUES (?, ?, ?, ?, ?)',
        [saleId, item.product_id, item.quantity, item.price, item.total_price]
      );

      // Decrement stock
      await connection.query(
        'UPDATE products SET current_stock = current_stock - ? WHERE id = ?',
        [item.quantity, item.product_id]
      );
    }

    // 5. If outstanding payment exists, create a record
    if (pending_amount > 0) {
      await connection.query(
        'INSERT INTO outstanding_payments (sale_id, customer_id, pending_amount, due_date, status) VALUES (?, ?, ?, ?, ?)',
        [
          saleId,
          customer_id,
          pending_amount,
          due_date || sale_date,
          new Date(due_date) < new Date() ? 'Overdue' : 'Pending'
        ]
      );
    }

    // 6. Record payment history if some amount is paid immediately
    if (amount_received > 0) {
      await connection.query(
        'INSERT INTO payment_history (sale_id, amount_paid, payment_date, payment_method, remarks) VALUES (?, ?, ?, ?, ?)',
        [saleId, amount_received, sale_date, 'Cash', 'Down Payment on Invoice creation']
      );
    }

    await connection.commit();

    await logActivity(
      req.user.email,
      'Sales',
      'Created Sale & Invoice',
      null,
      { invoice_number, grand_total, customer_id }
    );

    res.status(201).json({
      id: saleId,
      invoice_number,
      grand_total,
      pending_amount,
      payment_status,
      message: 'Sale recorded successfully'
    });
  } catch (err) {
    await connection.rollback();
    console.error('Sale Transaction failed:', err);
    res.status(400).json({ error: err.message });
  } finally {
    connection.release();
  }
});

// Delete Sale (Password Protected)
router.post('/:id/delete', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Password is required to delete sales invoice' });
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

    // Get sale and items to revert stock
    const [sales] = await connection.query('SELECT * FROM sales WHERE id = ?', [id]);
    if (sales.length === 0) {
      throw new Error('Sale not found');
    }

    const sale = sales[0];

    const [items] = await connection.query('SELECT * FROM sale_items WHERE sale_id = ?', [id]);

    // Restore products stock
    for (const item of items) {
      if (item.product_id) {
        await connection.query(
          'UPDATE products SET current_stock = current_stock + ? WHERE id = ?',
          [item.quantity, item.product_id]
        );
      }
    }

    // Delete sale (Cascade will remove sale_items, payment_history, and outstanding_payments)
    await connection.query('DELETE FROM sales WHERE id = ?', [id]);

    await connection.commit();

    await logActivity(req.user.email, 'Sales', 'Deleted Sale Invoice', sale.invoice_number, null);

    res.json({ message: 'Sale deleted successfully, and product stocks have been reverted.' });
  } catch (err) {
    await connection.rollback();
    res.status(400).json({ error: err.message });
  } finally {
    connection.release();
  }
});

export default router;
