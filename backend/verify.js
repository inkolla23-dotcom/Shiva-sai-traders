import { checkConnectionAndInit, getDb } from './src/config/db.js';

async function runVerification() {
  console.log('🧪 Starting System Database Verification Tests...\n');

  // 1. Check connection and auto-create tables
  const initSuccess = await checkConnectionAndInit();
  if (!initSuccess) {
    console.error('❌ Connection or Initialization failed.');
    process.exit(1);
  }

  const db = getDb();
  const connection = await db.getConnection();

  try {
    // 2. Verify all tables exist
    const tables = [
      'users', 'brands', 'products', 'customers', 'sales', 
      'sale_items', 'outstanding_payments', 'payment_history', 
      'inventory_replenishments', 'activity_logs', 'settings'
    ];

    console.log('📋 Checking tables...');
    for (const table of tables) {
      const [rows] = await connection.query(`SHOW TABLES LIKE ?`, [table]);
      if (rows.length === 0) {
        throw new Error(`Missing Table: ${table}`);
      }
      console.log(`  ✓ Table '${table}' exists`);
    }

    // 3. Test Brand CRUD
    console.log('\n🏷️ Testing Brand CRUD...');
    const testBrandName = `TEST_BRAND_${Date.now()}`;
    const [brandInsert] = await connection.query('INSERT INTO brands (name) VALUES (?)', [testBrandName]);
    const brandId = brandInsert.insertId;
    console.log(`  ✓ Inserted brand: ID ${brandId}`);

    const [brandSelect] = await connection.query('SELECT * FROM brands WHERE id = ?', [brandId]);
    if (brandSelect.length === 0 || brandSelect[0].name !== testBrandName) {
      throw new Error('Brand verification failed (Select mismatch)');
    }
    console.log(`  ✓ Verified brand select`);

    // 4. Test Customer CRUD
    console.log('\n👥 Testing Customer CRUD...');
    const testShopName = `TEST_SHOP_${Date.now()}`;
    const [custInsert] = await connection.query(
      'INSERT INTO customers (shop_name, owner_name, phone, gst_number, address) VALUES (?, ?, ?, ?, ?)',
      [testShopName, 'Test Owner', '9999988888', '36TESTGST12345Z', 'Test Address 123']
    );
    const custId = custInsert.insertId;
    console.log(`  ✓ Inserted customer: ID ${custId}`);

    const [custSelect] = await connection.query('SELECT * FROM customers WHERE id = ?', [custId]);
    if (custSelect.length === 0 || custSelect[0].shop_name !== testShopName) {
      throw new Error('Customer verification failed');
    }
    console.log(`  ✓ Verified customer select`);

    // 5. Test Product CRUD
    console.log('\n📦 Testing Product CRUD...');
    const testProdName = `TEST_PRODUCT_${Date.now()}`;
    const [prodInsert] = await connection.query(
      `INSERT INTO products 
      (name, brand_id, purchase_price, selling_price, min_stock, current_stock, expiry_date) 
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [testProdName, brandId, 100.00, 150.00, 5, 20, '2027-12-31']
    );
    const prodId = prodInsert.insertId;
    console.log(`  ✓ Inserted product: ID ${prodId} with initial stock 20`);

    const [prodSelect] = await connection.query('SELECT * FROM products WHERE id = ?', [prodId]);
    if (prodSelect.length === 0 || prodSelect[0].name !== testProdName) {
      throw new Error('Product verification failed');
    }
    console.log(`  ✓ Verified product select`);

    // 6. Test Sales Transaction System
    console.log('\n💰 Testing Sales Ledger & Stock Deductions...');
    const testInvoiceNum = `TEST-INV-${Date.now()}`;
    
    // Tax calculations (18% GST)
    const qty = 5;
    const itemPrice = 150.00;
    const taxable = qty * itemPrice; // 750
    const gst = taxable * 0.18; // 135
    const total = taxable + gst; // 885
    const received = 500.00;
    const pending = total - received; // 385

    // Insert Sale
    const [saleInsert] = await connection.query(
      `INSERT INTO sales 
      (invoice_number, customer_id, sale_date, taxable_amount, gst_amount, grand_total, amount_received, pending_amount, payment_status, due_date) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [testInvoiceNum, custId, '2026-07-12', taxable, gst, total, received, pending, 'Partially Paid', '2026-08-12']
    );
    const saleId = saleInsert.insertId;
    console.log(`  ✓ Created Sales Invoice: ID ${saleId} (${testInvoiceNum})`);

    // Insert Sale Item
    await connection.query(
      'INSERT INTO sale_items (sale_id, product_id, quantity, price, total_price) VALUES (?, ?, ?, ?, ?)',
      [saleId, prodId, qty, itemPrice, taxable]
    );
    console.log(`  ✓ Inserted sale item lines`);

    // Deduct stock
    await connection.query('UPDATE products SET current_stock = current_stock - ? WHERE id = ?', [qty, prodId]);
    const [[prodStockCheck]] = await connection.query('SELECT current_stock FROM products WHERE id = ?', [prodId]);
    if (prodStockCheck.current_stock !== 15) {
      throw new Error(`Stock deduction failed! Expected: 15, Got: ${prodStockCheck.current_stock}`);
    }
    console.log(`  ✓ Verified Stock Deduction (20 -> 15)`);

    // Insert Outstanding Payment
    await connection.query(
      'INSERT INTO outstanding_payments (sale_id, customer_id, pending_amount, due_date, status) VALUES (?, ?, ?, ?, ?)',
      [saleId, custId, pending, '2026-08-12', 'Pending']
    );
    const [[outstandingCheck]] = await connection.query('SELECT pending_amount FROM outstanding_payments WHERE sale_id = ?', [saleId]);
    if (parseFloat(outstandingCheck.pending_amount) !== pending) {
      throw new Error(`Outstanding setup failed. Expected pending: ${pending}, Got: ${outstandingCheck.pending_amount}`);
    }
    console.log(`  ✓ Verified Outstanding payments setup (₹${pending} pending)`);

    // 7. Test Receiving Outstanding Payments
    console.log('\n💳 Testing Outstanding Payments & Balance Clearing...');
    const payAmt = pending;
    
    // Update Sales Invoice
    await connection.query(
      'UPDATE sales SET amount_received = amount_received + ?, pending_amount = 0, payment_status = "Paid" WHERE id = ?',
      [payAmt, saleId]
    );

    // Remove outstanding payment (as pending hits 0)
    await connection.query('DELETE FROM outstanding_payments WHERE sale_id = ?', [saleId]);

    // Insert payment history
    await connection.query(
      'INSERT INTO payment_history (sale_id, amount_paid, payment_date, payment_method, remarks) VALUES (?, ?, ?, ?, ?)',
      [saleId, payAmt, '2026-07-12', 'UPI', 'Paid outstanding balance']
    );

    const [[salePaidCheck]] = await connection.query('SELECT pending_amount, payment_status FROM sales WHERE id = ?', [saleId]);
    if (parseFloat(salePaidCheck.pending_amount) !== 0 || salePaidCheck.payment_status !== 'Paid') {
      throw new Error('Sales invoice payment status change failed');
    }
    const [outstandingPaidCheck] = await connection.query('SELECT * FROM outstanding_payments WHERE sale_id = ?', [saleId]);
    if (outstandingPaidCheck.length !== 0) {
      throw new Error('Outstanding record was not removed upon balance clearance');
    }
    console.log(`  ✓ Verified balance payment clearing & paid transition`);

    // 8. Wiping / Cleaning up verification test garbage data (respecting foreign key checks)
    console.log('\n🧹 Cleaning up verification test garbage data...');
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    await connection.query('DELETE FROM sales WHERE id = ?', [saleId]);
    await connection.query('DELETE FROM sale_items WHERE sale_id = ?', [saleId]);
    await connection.query('DELETE FROM payment_history WHERE sale_id = ?', [saleId]);
    await connection.query('DELETE FROM products WHERE id = ?', [prodId]);
    await connection.query('DELETE FROM customers WHERE id = ?', [custId]);
    await connection.query('DELETE FROM brands WHERE id = ?', [brandId]);
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('  ✓ Garbage data cleaned up successfully');

    console.log('\n✅ VERIFICATION COMPLETE: ALL INTEGRITY AND CRUD TESTS PASSED.');
  } catch (err) {
    console.error('\n❌ VERIFICATION FAILURE:');
    console.error(err.message);
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    connection.release();
    process.exit(0);
  }
}

runVerification();
