import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import authRouter from './routes.js';
import employeeRouter from './employeeRoutes.js';

const app = express();

// Middleware
app.use(cors({
  origin: config.CORS_ORIGIN,
  credentials: true,
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRouter);
app.use('/api/employees', employeeRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Start server
const startServer = async () => {
  try {
    app.listen(config.PORT, () => {
      console.log(`✓ Server running on http://localhost:${config.PORT}`);
      console.log(`✓ CORS enabled for ${config.CORS_ORIGIN}`);
      console.log(`✓ Using file-based credential storage`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
