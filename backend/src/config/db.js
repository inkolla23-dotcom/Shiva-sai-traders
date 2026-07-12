import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'shiva_sai_traders',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

let pool = null;
let isConnected = false;
let dbError = null;

try {
  pool = mysql.createPool(dbConfig);
} catch (err) {
  dbError = err.message;
}

export async function checkConnectionAndInit() {
  if (!pool) {
    console.error('❌ Database Connection Pool failed to initialize: ' + dbError);
    return false;
  }

  try {
    // Attempt to connect and run a simple query
    const connection = await pool.getConnection();
    isConnected = true;
    connection.release();

    // Run table creation scripts
    await verifyAndCreateTables();

    console.log('✓ Connected to MySQL');
    console.log(`✓ Database: ${dbConfig.database}`);
    console.log('✓ Tables Verified');
    console.log('✓ Backend Ready');
    return true;
  } catch (err) {
    dbError = err.message;
    console.error('\n=========================================');
    console.error('❌ DATABASE CONNECTION ERROR:');
    console.error(err.message);
    console.error('Please verify details in .env file:');
    console.error(`Host: ${dbConfig.host}`);
    console.error(`Port: ${dbConfig.port}`);
    console.error(`User: ${dbConfig.user}`);
    console.error(`Database: ${dbConfig.database}`);
    console.error('=========================================\n');
    return false;
  }
}

async function verifyAndCreateTables() {
  const connection = await pool.getConnection();
  try {
    // 1. Users Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'admin',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    // 2. Brands Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS brands (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    // 3. Products Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        brand_id INT,
        purchase_price DECIMAL(10, 2) NOT NULL,
        selling_price DECIMAL(10, 2) NOT NULL,
        min_stock INT DEFAULT 5,
        current_stock INT DEFAULT 0,
        mfg_date DATE,
        expiry_date DATE,
        expected_sales_completion_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE SET NULL,
        INDEX idx_product_expiry (expiry_date),
        INDEX idx_product_stock (current_stock)
      ) ENGINE=InnoDB;
    `);

    // 4. Customers Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        shop_name VARCHAR(150) UNIQUE NOT NULL,
        owner_name VARCHAR(100) NOT NULL,
        phone VARCHAR(15) NOT NULL,
        gst_number VARCHAR(15),
        address TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    // 5. Sales Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS sales (
        id INT AUTO_INCREMENT PRIMARY KEY,
        invoice_number VARCHAR(50) UNIQUE NOT NULL,
        customer_id INT,
        sale_date DATE NOT NULL,
        remarks TEXT,
        taxable_amount DECIMAL(10, 2) NOT NULL,
        gst_amount DECIMAL(10, 2) NOT NULL,
        grand_total DECIMAL(10, 2) NOT NULL,
        amount_received DECIMAL(10, 2) NOT NULL,
        pending_amount DECIMAL(10, 2) NOT NULL,
        due_date DATE,
        payment_status ENUM('Paid', 'Partially Paid', 'Unpaid') DEFAULT 'Unpaid',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
      ) ENGINE=InnoDB;
    `);

    // 6. Sale Items Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS sale_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sale_id INT,
        product_id INT,
        quantity INT NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        total_price DECIMAL(10, 2) NOT NULL,
        FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
      ) ENGINE=InnoDB;
    `);

    // 7. Outstanding Payments Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS outstanding_payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sale_id INT UNIQUE,
        customer_id INT,
        pending_amount DECIMAL(10, 2) NOT NULL,
        due_date DATE NOT NULL,
        status ENUM('Pending', 'Overdue', 'Paid') DEFAULT 'Pending',
        FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
        INDEX idx_outstanding_due (due_date)
      ) ENGINE=InnoDB;
    `);

    // 8. Payment History Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS payment_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sale_id INT,
        amount_paid DECIMAL(10, 2) NOT NULL,
        payment_date DATE NOT NULL,
        payment_method VARCHAR(50) DEFAULT 'Cash',
        remarks TEXT,
        FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // 9. Inventory Replenishments Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS inventory_replenishments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT,
        purchase_price DECIMAL(10, 2) NOT NULL,
        quantity_added INT NOT NULL,
        expiry_date DATE,
        date_added DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // 10. Activity Logs Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        user VARCHAR(150) NOT NULL,
        module VARCHAR(50) NOT NULL,
        action VARCHAR(100) NOT NULL,
        old_value TEXT,
        new_value TEXT
      ) ENGINE=InnoDB;
    `);

    // 11. Settings Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key_name VARCHAR(100) PRIMARY KEY,
        value_data TEXT
      ) ENGINE=InnoDB;
    `);

    // 12. Business Details Table (single record, id fixed to 1)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS business_details (
        id INT PRIMARY KEY DEFAULT 1,
        shop_name VARCHAR(150),
        owner_name VARCHAR(100),
        mobile VARCHAR(15),
        email VARCHAR(150),
        gst_number VARCHAR(15),
        upi_id VARCHAR(100),
        logo LONGTEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    // Make username column nullable for backward compatibility
    try {
      await connection.query(`ALTER TABLE users MODIFY COLUMN username VARCHAR(50) NULL`);
    } catch (err) {
      console.warn('Could not modify username column to NULL:', err.message);
    }

    // Migration: add email column to users table if it doesn't already exist
    const [emailCol] = await connection.query(
      `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'email'`
    );
    if (emailCol[0].cnt === 0) {
      await connection.query(`ALTER TABLE users ADD COLUMN email VARCHAR(150) UNIQUE NULL AFTER username`);
      console.log('✓ Migration: Added email column to users table');
    }

    // Migration: fix any existing users with NULL or blank email (legacy username-only accounts)
    // so the UNIQUE + NOT NULL constraint can be safely applied without breaking the DB.
    const [nullEmailUsers] = await connection.query(
      `SELECT id FROM users WHERE email IS NULL OR TRIM(email) = ''`
    );
    if (nullEmailUsers.length > 0) {
      // If more than one legacy user has a missing email, only the first can take the
      // default admin address (email is UNIQUE); subsequent ones get a derived placeholder
      // that an admin can update later from Settings.
      for (let i = 0; i < nullEmailUsers.length; i++) {
        const targetEmail = i === 0
          ? 'shivasai26@gmail.com'
          : `user${nullEmailUsers[i].id}@shivasaitraders.local`;

        // Avoid violating the UNIQUE constraint if that email is already taken
        const [clash] = await connection.query('SELECT id FROM users WHERE email = ?', [targetEmail]);
        const finalEmail = clash.length > 0 ? `user${nullEmailUsers[i].id}@shivasaitraders.local` : targetEmail;

        await connection.query('UPDATE users SET email = ? WHERE id = ?', [finalEmail, nullEmailUsers[i].id]);
        console.log(`✓ Migration: Set missing email for user id ${nullEmailUsers[i].id} -> ${finalEmail}`);
      }
    }

    // Migration: now that no NULL emails remain, enforce NOT NULL at the DB level
    try {
      await connection.query(`ALTER TABLE users MODIFY COLUMN email VARCHAR(150) UNIQUE NOT NULL`);
    } catch (err) {
      console.warn('Could not enforce NOT NULL on users.email column:', err.message);
    }

    // Migration: increase size of user column in activity_logs
    try {
      await connection.query(`ALTER TABLE activity_logs MODIFY COLUMN user VARCHAR(150) NOT NULL`);
    } catch (err) {
      console.warn('Could not modify activity_logs user column size:', err.message);
    }

    // Seed default admin user if users table is empty
    const [users] = await connection.query('SELECT * FROM users LIMIT 1');
    if (users.length === 0) {
      const hashedPassword = bcrypt.hashSync('shivasai@2026', 10);
      await connection.query('INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)', ['admin', 'shivasai26@gmail.com', hashedPassword, 'admin']);
      console.log('✓ Default Admin User Seeded (email: shivasai26@gmail.com, password: shivasai@2026)');
    }
  } finally {
    connection.release();
  }
}

export function getDb() {
  if (!isConnected) {
    throw new Error('Database is not connected. Details: ' + (dbError || 'Unknown Error'));
  }
  return pool;
}

export function getDbStatus() {
  return {
    connected: isConnected,
    error: dbError,
    database: dbConfig.database,
    host: dbConfig.host
  };
}
