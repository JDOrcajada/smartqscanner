import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { initializeDbPool } from './db.js';
import authRouter from './routes.js';
import employeeRouter from './employeeRoutes.js';
import kioskRouter from './kioskRoutes.js';
import attendanceRouter from './attendanceRoutes.js';

const app = express();

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow web frontend, kiosk Electron app (no origin), and localhost variants
    const allowed = [config.CORS_ORIGIN, 'http://localhost:5174', 'http://localhost:3000'];
    if (!origin || allowed.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '5mb' })); // 5mb for base64 photo uploads

// Routes
app.use('/api/auth', authRouter);
app.use('/api/employees', employeeRouter);
app.use('/api/kiosk', kioskRouter);
app.use('/api/attendance', attendanceRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Start server
const startServer = async () => {
  try {
    await initializeDbPool();
    app.listen(config.PORT, () => {
      console.log(`✓ Server running on http://localhost:${config.PORT}`);
      console.log(`✓ CORS enabled for ${config.CORS_ORIGIN}`);
      console.log(`✓ Firebird database: ${config.DB_DATABASE}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
