import odbc from 'odbc';
import { config } from './config.js';

// DSN-less Firebird ODBC connection string.
// The Firebird ODBC driver accepts DBNAME as host/port:path (same as isql).
const connectionString =
  `Driver={Firebird/InterBase(r) driver};` +
  `Dbname=${config.DB_HOST}/${config.DB_PORT}:${config.DB_DATABASE};` +
  `Uid=${config.DB_USER};` +
  `Pwd=${config.DB_PASSWORD};` +
  `charset=UTF8;`;

let pool: odbc.Pool;

// Firebird ODBC returns column names in uppercase — lowercase them for
// compatibility with all existing route code (same contract as before).
// BLOBs come back as Buffer objects — convert to UTF-8 string.
// BigInt values (e.g. BIGINT PKs, COUNT results) are safe integers in our
// schema, so convert them to Number so JSON.stringify never throws.
function normalizeRows(rows: any[]): any[] {
  return rows.map((row) => {
    const out: Record<string, any> = {};
    for (const key of Object.keys(row)) {
      const val = row[key];
      if (Buffer.isBuffer(val)) {
        out[key.toLowerCase()] = val.toString('utf8');
      } else if (typeof val === 'bigint') {
        out[key.toLowerCase()] = Number(val);
      } else {
        out[key.toLowerCase()] = val;
      }
    }
    return out;
  });
}

export const initializeDbPool = async (): Promise<void> => {
  pool = await odbc.pool({
    connectionString,
    initialSize: 2,
    maxSize: 5,
    connectionTimeout: 10,
    loginTimeout: 10,
  });
  // Smoke-test one round-trip
  const conn = await pool.connect();
  await conn.close();
  console.log('✓ Connected to Firebird database (ODBC)');
};

// Firebird ODBC cannot bind JS Date objects directly — convert them to the
// 'YYYY-MM-DD HH:MM:SS' string format that the driver expects.
// Also converts null/undefined consistently.
function serializeParams(params: any[]): any[] {
  return params.map((p) => {
    if (p instanceof Date) {
      // 'YYYY-MM-DD HH:MM:SS' — Firebird ODBC timestamp literal format
      const pad = (n: number) => String(n).padStart(2, '0');
      return (
        `${p.getFullYear()}-${pad(p.getMonth() + 1)}-${pad(p.getDate())} ` +
        `${pad(p.getHours())}:${pad(p.getMinutes())}:${pad(p.getSeconds())}`
      );
    }
    return p ?? null;
  });
}

export const query = async <T = any>(sql: string, params: any[] = []): Promise<T[]> => {
  const conn = await pool.connect();
  try {
    const result = await conn.query<T>(sql, serializeParams(params));
    return normalizeRows(Array.from(result)) as T[];
  } finally {
    await conn.close();
  }
};

export const execute = async (sql: string, params: any[] = []): Promise<void> => {
  const conn = await pool.connect();
  try {
    await conn.query(sql, serializeParams(params));
  } finally {
    await conn.close();
  }
};

const assertIdentifier = (value: string): string => {
  if (!/^[A-Z_][A-Z0-9_]*$/i.test(value)) {
    throw new Error(`Invalid SQL identifier: ${value}`);
  }

  return value;
};

export const getNextAvailableId = async (
  tableName: string,
  columnName: string
): Promise<number> => {
  const safeTableName = assertIdentifier(tableName);
  const safeColumnName = assertIdentifier(columnName);

  const rows = await query<any>(
    `SELECT ${safeColumnName} FROM ${safeTableName} ORDER BY ${safeColumnName}`
  );

  let nextId = 1;
  for (const row of rows) {
    const currentId = Number(row[safeColumnName.toLowerCase()]);
    if (!Number.isInteger(currentId) || currentId <= 0) {
      continue;
    }

    if (currentId > nextId) {
      break;
    }

    if (currentId === nextId) {
      nextId += 1;
    }
  }

  return nextId;
};


