import { exec } from 'child_process';
import { promisify } from 'util';
import { config } from './config.js';

const execAsync = promisify(exec);

// SQL queries to execute via isql
const buildIsqlCommand = (sql: string): string => {
  const escapedSql = sql.replace(/"/g, '\\"');
  return `isql -user ${config.DB_USER} -password ${config.DB_PASSWORD} "${config.DB_DATABASE}" -c "${escapedSql}"`;
};

export const initializeDbPool = async (): Promise<void> => {
  try {
    // Test connection
    const testSql = 'SELECT COUNT(*) FROM EMPLOYEES;';
    await query(testSql);
    console.log('✓ Connected to Firebird database');
  } catch (error) {
    console.error('Failed to connect to Firebird database:', error);
    throw error;
  }
};

export const query = async (sql: string, params?: any[]): Promise<any[]> => {
  try {
    // Simple parameter replacement (be careful with this in production)
    let finalSql = sql;
    if (params && params.length > 0) {
      params.forEach((param) => {
        const value = typeof param === 'string' ? `'${param.replace(/'/g, "''")}'` : param;
        finalSql = finalSql.replace('?', value);
      });
    }

    const command = buildIsqlCommand(finalSql);
    const { stdout } = await execAsync(command);
    
    // Parse the output (basic parsing)
    const lines = stdout.trim().split('\n').filter(line => line.trim());
    return lines;
  } catch (error: any) {
    console.error('Query error:', error.message);
    throw error;
  }
};

export const execute = async (sql: string, params?: any[]): Promise<void> => {
  try {
    // Simple parameter replacement
    let finalSql = sql;
    if (params && params.length > 0) {
      params.forEach((param) => {
        const value = typeof param === 'string' ? `'${param.replace(/'/g, "''")}'` : param;
        finalSql = finalSql.replace('?', value);
      });
    }

    const command = buildIsqlCommand(finalSql);
    await execAsync(command);
  } catch (error: any) {
    console.error('Execute error:', error.message);
    throw error;
  }
};

export const getDb = () => null;


