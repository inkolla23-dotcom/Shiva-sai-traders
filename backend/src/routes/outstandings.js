import express from 'express';
import { getDb } from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { logActivity } from '../utils/activity.js';

const router = express.Router();

// List all active outstanding payments
router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const [outstandings] = await db.query(
      `SELECT op.*, s.invoice_number, s.grand_total, s.amount_received, c.shop_name, c.owner_name, c.phone, c.gst_number, c.address 
       FROM outstanding_payments op
       JOIN sales s ON op.sale_id = s.id
       JOIN customers c ON op.customer_id = c.id
       WHERE op.pending_amount > 0
       ORDER BY op.due_date ASC`
    );
    res.json(outstandings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Record a payment against an outstanding balance
router.post('/:id/payment', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { payment_date, payment_method = 'Cash', remarks } = req.body;

  // Safely convert incoming payment amount to a real number (it may arrive as a string)
  const amountPaidNum = Number(req.body.amount_paid);

  if (!req.body.amount_paid || isNaN(amountPaidNum) || amountPaidNum <= 0) {
    return res.status(400).json({ error: 'Valid payment amount is required' });
  }

  const db = getDb();
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Fetch outstanding record
    const [ops] = await connection.query(
      'SELECT * FROM outstanding_payments WHERE id = ? FOR UPDATE',
      [id]
    );

    if (ops.length === 0) {
      throw new Error('Outstanding payment record not found');
    }

    const op = ops[0];
    const saleId = op.sale_id;

    // DECIMAL columns come back from mysql2 as strings, so convert them safely to numbers
    const pendingAmountNum = Number(op.pending_amount) || 0;

    if (isNaN(pendingAmountNum)) {
      throw new Error('Invalid pending amount on record. Please contact support.');
    }

    // Allow a tiny rounding tolerance so legitimate "pay in full" clicks aren't rejected
    if (amountPaidNum > pendingAmountNum + 0.01) {
      throw new Error(`Payment amount (${amountPaidNum}) exceeds pending balance (${pendingAmountNum})`);
    }

    // 2. Fetch sale details
    const [sales] = await connection.query('SELECT * FROM sales WHERE id = ? FOR UPDATE', [saleId]);
    if (sales.length === 0) {
      throw new Error('Invoice not found');
    }
    const sale = sales[0];

    // Convert decimal (string) values from the database safely before doing arithmetic
    const amountReceivedNum = Number(sale.amount_received) || 0;

    if (isNaN(amountReceivedNum)) {
      throw new Error('Invalid amount received on record. Please contact support.');
    }

    let newPending = parseFloat((pendingAmountNum - amountPaidNum).toFixed(2));
    // Clamp tiny rounding remainders (e.g. -0.00 or 0.001) to exactly zero
    if (newPending < 0.01) {
      newPending = 0;
    }
    const newAmountReceived = parseFloat((amountReceivedNum + amountPaidNum).toFixed(2));

    let newStatus = 'Unpaid';
    if (newPending === 0) {
      newStatus = 'Paid';
    } else if (newAmountReceived > 0) {
      newStatus = 'Partially Paid';
    }

    // 3. Update Sale
    await connection.query(
      'UPDATE sales SET amount_received = ?, pending_amount = ?, payment_status = ? WHERE id = ?',
      [newAmountReceived, newPending, newStatus, saleId]
    );

    // 4. Update Outstanding record
    if (newPending === 0) {
      // Fully paid: remove the outstanding record entirely so it immediately disappears
      // from the Outstanding Payments page, the Payment Requests page, and Outstanding Reports.
      await connection.query('DELETE FROM outstanding_payments WHERE id = ?', [id]);
    } else {
      await connection.query(
        'UPDATE outstanding_payments SET pending_amount = ? WHERE id = ?',
        [newPending, id]
      );
    }

    // 5. Insert payment history record
    await connection.query(
      'INSERT INTO payment_history (sale_id, amount_paid, payment_date, payment_method, remarks) VALUES (?, ?, ?, ?, ?)',
      [saleId, amountPaidNum, payment_date || new Date().toISOString().split('T')[0], payment_method, remarks || 'Payment received']
    );

    await connection.commit();

    await logActivity(
      req.user.email,
      'Sales',
      'Received Outstanding Payment',
      { invoice: sale.invoice_number, remaining: pendingAmountNum },
      { invoice: sale.invoice_number, paid: amountPaidNum, remaining: newPending }
    );

    res.json({
      message: 'Payment recorded successfully',
      remaining_balance: newPending,
      payment_status: newStatus
    });
  } catch (err) {
    await connection.rollback();
    res.status(400).json({ error: err.message });
  } finally {
    connection.release();
  }
});

export default router;
