import * as Firebird from 'node-firebird';
import { config } from './config.js';

const options: Firebird.Options = {
  host: String(config.DB_HOST),
  port: Number(config.DB_PORT),
  database: String(config.DB_DATABASE),
  user: String(config.DB_USER),
  password: String(config.DB_PASSWORD),
  lowercase_keys: true,
};

const pool = Firebird.pool(5, options);

// Resolves any BLOB fields returned by node-firebird (they come back as functions)
const resolveBlobs = (rows: any[]): Promise<any[]> =>
  Promise.all(
    rows.map((row) => {
      const blobKeys = Object.keys(row).filter((k) => typeof row[k] === 'function');
      if (!blobKeys.length) return Promise.resolve(row);
      return Promise.all(
        blobKeys.map(
          (key) =>
            new Promise<void>((res) => {
              (row[key] as Function)((err: any, _: string, e: any) => {
                if (err || !e) { row[key] = null; res(); return; }
                const chunks: Buffer[] = [];
                e.on('data', (c: Buffer) => chunks.push(c));
                e.on('end', () => { row[key] = Buffer.concat(chunks).toString('utf8'); res(); });
                e.on('error', () => { row[key] = null; res(); });
              });
            })
        )
      ).then(() => row);
    })
  );

export const initializeDbPool = (): Promise<void> =>
  new Promise((resolve, reject) => {
    pool.get((err, db) => {
      if (err) {
        console.error('Failed to connect to Firebird database:', err);
        return reject(err);
      }
      db.detach();
      console.log('✓ Connected to Firebird database');
      resolve();
    });
  });

export const query = <T = any>(sql: string, params: any[] = []): Promise<T[]> =>
  new Promise((resolve, reject) => {
    pool.get((err, db) => {
      if (err) return reject(err);
      db.query(sql, params, (err, result) => {
        db.detach();
        if (err) return reject(err);
        resolveBlobs(result ?? []).then((rows) => resolve(rows as T[])).catch(reject);
      });
    });
  });

export const execute = (sql: string, params: any[] = []): Promise<void> =>
  new Promise((resolve, reject) => {
    pool.get((err, db) => {
      if (err) return reject(err);
      db.execute(sql, params, (err) => {
        db.detach();
        if (err) return reject(err);
        resolve();
      });
    });
  });

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


