/**
 * migrate.ts — Idempotent schema migrations for SmartQ Attendance.
 * Called once at server startup after the DB pool is ready.
 * Each step checks metadata before executing DDL, so rerunning is safe.
 */
import { query, execute } from './db.js';

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

async function tableExists(name: string): Promise<boolean> {
  const rows = await query<any>(
    `SELECT COUNT(*) AS CNT FROM RDB$RELATIONS WHERE RDB$RELATION_NAME = ?`,
    [name.toUpperCase()]
  );
  return Number(rows[0].cnt) > 0;
}

async function columnExists(table: string, column: string): Promise<boolean> {
  const rows = await query<any>(
    `SELECT COUNT(*) AS CNT FROM RDB$RELATION_FIELDS
     WHERE RDB$RELATION_NAME = ? AND RDB$FIELD_NAME = ?`,
    [table.toUpperCase(), column.toUpperCase()]
  );
  return Number(rows[0].cnt) > 0;
}

async function constraintExists(name: string): Promise<boolean> {
  const rows = await query<any>(
    `SELECT COUNT(*) AS CNT FROM RDB$RELATION_CONSTRAINTS WHERE RDB$CONSTRAINT_NAME = ?`,
    [name.toUpperCase()]
  );
  return Number(rows[0].cnt) > 0;
}

// ──────────────────────────────────────────────────────────────
// Migration steps
// ──────────────────────────────────────────────────────────────

export async function runMigrations(): Promise<void> {
  console.log('▶ Running schema migrations…');

  // 1. ATTENDANCE_LOGS.LEAVE_TYPE — tracks SL / VL assigned by admin
  if (!(await columnExists('ATTENDANCE_LOGS', 'LEAVE_TYPE'))) {
    await execute('ALTER TABLE ATTENDANCE_LOGS ADD LEAVE_TYPE VARCHAR(5)');
    console.log('  ✓ Added ATTENDANCE_LOGS.LEAVE_TYPE');
  }

  // 2. EMPLOYEE_LEAVES — SL / VL balance per employee per year
  if (!(await tableExists('EMPLOYEE_LEAVES'))) {
    await execute(`
      CREATE TABLE EMPLOYEE_LEAVES (
        LEAVE_ID    INTEGER NOT NULL PRIMARY KEY,
        EMPLOYEE_ID BIGINT  NOT NULL,
        LEAVE_YEAR  INTEGER NOT NULL,
        SL_BALANCE  INTEGER DEFAULT 15,
        VL_BALANCE  INTEGER DEFAULT 15,
        UPDATED_AT  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (EMPLOYEE_ID) REFERENCES EMPLOYEES(EMPLOYEE_ID)
      )
    `);
    // Unique constraint must be added in a separate statement for Firebird
    try {
      await execute(
        `ALTER TABLE EMPLOYEE_LEAVES ADD CONSTRAINT UQ_LEAVE_EMP_YEAR UNIQUE (EMPLOYEE_ID, LEAVE_YEAR)`
      );
    } catch (_) { /* may already exist */ }
    console.log('  ✓ Created EMPLOYEE_LEAVES table');
  }

  // 3. HOLIDAYS — dates where auto-absent should NOT be generated
  if (!(await tableExists('HOLIDAYS'))) {
    await execute(`
      CREATE TABLE HOLIDAYS (
        HOLIDAY_ID   INTEGER NOT NULL PRIMARY KEY,
        HOLIDAY_DATE DATE    NOT NULL,
        HOLIDAY_NAME VARCHAR(100),
        CREATED_AT   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    try {
      await execute(
        `ALTER TABLE HOLIDAYS ADD CONSTRAINT UQ_HOLIDAY_DATE UNIQUE (HOLIDAY_DATE)`
      );
    } catch (_) { /* may already exist */ }
    console.log('  ✓ Created HOLIDAYS table');
  }

  // 4. ADMINS.ADMIN_ROLE — distinguishes ADMIN from SUPER_ADMIN (for RBAC step)
  if (!(await columnExists('ADMINS', 'ADMIN_ROLE'))) {
    await execute(`ALTER TABLE ADMINS ADD ADMIN_ROLE VARCHAR(20) DEFAULT 'ADMIN'`);
    console.log('  ✓ Added ADMINS.ADMIN_ROLE');
  }

  // 5. ADMIN_SIGNUP_REQUESTS — pending signup queue for SuperAdmin approval
  if (!(await tableExists('ADMIN_SIGNUP_REQUESTS'))) {
    await execute(`
      CREATE TABLE ADMIN_SIGNUP_REQUESTS (
        REQUEST_ID      INTEGER      NOT NULL PRIMARY KEY,
        EMPLOYEE_ID     BIGINT       NOT NULL,
        PASSWORD_HASH   VARCHAR(255) NOT NULL,
        REQUEST_STATUS  VARCHAR(20)  DEFAULT 'PENDING',
        CREATED_AT      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
        REVIEWED_AT     TIMESTAMP,
        REVIEWED_BY     BIGINT,
        FOREIGN KEY (EMPLOYEE_ID) REFERENCES EMPLOYEES(EMPLOYEE_ID)
      )
    `);
    console.log('  ✓ Created ADMIN_SIGNUP_REQUESTS table');
  }

  console.log('▶ Migrations complete.');
}
