import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { checkConnectionAndInit, getDbStatus } from './config/db.js';

// Route imports
import authRoutes from './routes/auth.js';
import brandRoutes from './routes/brands.js';
import productRoutes from './routes/products.js';
import customerRoutes from './routes/customers.js';
import saleRoutes from './routes/sales.js';
import outstandingRoutes from './routes/outstandings.js';
import replenishRoutes from './routes/replenish.js';
import reportRoutes from './routes/reports.js';
import settingsRoutes from './routes/settings.js';
import dashboardRoutes from './routes/dashboard.js';
import searchRoutes from './routes/search.js';
import businessRoutes from './routes/business.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Trust the reverse proxy (Render, etc.) so req.secure / req.ip work correctly
app.set('trust proxy', 1);

// ----- CORS CONFIGURATION -----
// Allowed origins come from the ALLOWED_ORIGINS env var (comma-separated list of
// exact origins, e.g. "https://myapp.vercel.app,https://mydomain.com"). In addition,
// any localhost/127.0.0.1 origin (any port) and any *.vercel.app preview/production
// deployment are always allowed automatically, so nothing is ever hardcoded here.
const extraAllowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

function isOriginAllowed(origin) {
  if (!origin) return true; // non-browser requests (curl, server-to-server, mobile apps)
  if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return true;
  if (/^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) return true;
  if (/^https:\/\/.*\.vercel\.app$/.test(origin)) return true;
  if (/^https:\/\/.*\.onrender\.com$/.test(origin)) return true;
  if (extraAllowedOrigins.includes(origin)) return true;
  return false;
}

app.use(cors({
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: Origin ${origin} is not allowed`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

// Explicit OPTIONS preflight handler to return successful preflight responses immediately
app.options('*', (req, res) => {
  const origin = req.headers.origin;
  if (origin && isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.sendStatus(204);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
    res.sendStatus(204);
  }
});

app.use(express.json({ limit: '15mb' }));

// Health check endpoint (unprotected)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Database connection diagnostics endpoint (unprotected)
app.get('/api/db-status', (req, res) => {
  res.json(getDbStatus());
});

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/brands', brandRoutes);
app.use('/api/products', productRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/outstandings', outstandingRoutes);
app.use('/api/replenish', replenishRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/business', businessRoutes);

// Base route
app.get('/', (req, res) => {
  res.json({ message: 'Shiva Sai Traders API is running' });
});

// 404 handler for unmatched routes (returns JSON instead of "Cannot GET ...")
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong: ' + err.message });
});

// Start server after verifying DB connection
async function startServer() {
  // Attempt db verification but do not crash on failure
  await checkConnectionAndInit();

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

startServer();
