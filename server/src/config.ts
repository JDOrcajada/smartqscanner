import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server config
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',

  // JWT Secret
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  JWT_EXPIRY: process.env.JWT_EXPIRY || '24h',

  // Firebird Database config
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: process.env.DB_PORT || 3050,
  DB_DATABASE: process.env.DB_DATABASE || 'C:/Users/JD/Documents/smartqweb/database/attendance.fdb',
  DB_USER: process.env.DB_USER || 'SYSDBA',
  DB_PASSWORD: process.env.DB_PASSWORD || 'masterkey',

  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
};
