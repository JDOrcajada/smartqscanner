# SmartQ Attendance System — AI Handoff Prompt

You are continuing development on a **SmartQ Attendance System** project. This document contains the complete context of what has been built, the exact current state of every key file, and the specific next tasks to implement. Read everything before touching any code.

---

## 1. Project Overview

Two React + Vite applications and one Express backend, all in one monorepo:

```
C:\Users\JD\Documents\smartqproj\
├── smartqweb/          ← Web admin panel (React + Vite + Tailwind)
│   ├── src/app/components/   ← Page components
│   ├── server/               ← Express + TypeScript backend (node-firebird)
│   └── database/
│       ├── ATTENDANCE.FDB    ← Actual Firebird database file
│       └── schema.sql        ← Reference schema (keep in sync)
└── attendance-system/  ← Electron kiosk app (React + Vite + Tailwind)
    └── src/app/components/KioskHome.tsx
```

---

## 2. Ports & Connections

| Service | Port | Notes |
|---|---|---|
| Express backend (`server/`) | **5000** | Run with `npm run dev` in `smartqweb/server/` |
| Web admin panel (`smartqweb/`) | **5173** | Run with `npm run dev` in `smartqweb/` |
| Kiosk app (`attendance-system/`) | **5174** | Run with `npm run dev` in `attendance-system/` |
| Firebird DB | **3050** | localhost, SuperServer |

**All API calls in all frontends hardcode `http://localhost:5000/api`.**

---

## 3. Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS v4, shadcn/ui (Radix), Lucide icons
- **Backend**: Node.js, Express 4, TypeScript, `tsx` (dev runner), `node-firebird ^2.0.2`
- **Database**: Firebird 5.0 SuperServer on Windows
- **Auth**: `bcryptjs` for password hashing, `jsonwebtoken` (24h JWT in `localStorage` as `authToken`)
- **Kiosk**: Electron wrapper around the Vite app (`attendance-system/electron/main.cjs`)

---

## 4. Firebird Configuration (CRITICAL)

Default Firebird 5 uses `WireCrypt = Required` which is **incompatible with node-firebird**. This must be fixed:

File: `C:\Program Files\Firebird\Firebird_5_0\firebird.conf`

These two lines must be **uncommented** (remove the `#`):
```
WireCrypt = Enabled
AuthServer = Srp256, Srp, Legacy_Auth
```

After editing, restart the service:
```
net stop FirebirdServerDefaultInstance
net start FirebirdServerDefaultInstance
```

The server prints `✓ Connected to Firebird database` on success.

**DB credentials**: user `SYSDBA`, password `masterkey`

**DB file path**: `C:/Users/JD/Documents/smartqproj/smartqweb/database/ATTENDANCE.FDB`

---

## 5. Database Schema (Current Actual State in .fdb)

```sql
CREATE TABLE EMPLOYEES (
    EMPLOYEE_ID INTEGER PRIMARY KEY,
    NAME VARCHAR(255),                    -- NOT NULL was dropped
    ROLE VARCHAR(100),                    -- renamed from DEPARTMENT
    PICTURE BLOB SUB_TYPE TEXT,           -- added; stores base64 data URL
    STATUS VARCHAR(20) DEFAULT 'ACTIVE',
    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ADMINS (
    ADMIN_ID INTEGER PRIMARY KEY,
    EMPLOYEE_ID INTEGER NOT NULL UNIQUE,
    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (EMPLOYEE_ID) REFERENCES EMPLOYEES(EMPLOYEE_ID)
);

CREATE TABLE ADMIN_CREDENTIALS (
    CREDENTIAL_ID INTEGER PRIMARY KEY,
    EMPLOYEE_ID INTEGER NOT NULL UNIQUE,
    PASSWORD_HASH VARCHAR(255) NOT NULL,
    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (EMPLOYEE_ID) REFERENCES EMPLOYEES(EMPLOYEE_ID)
);

CREATE TABLE ATTENDANCE_LOGS (
    LOG_ID INTEGER PRIMARY KEY,
    EMPLOYEE_ID INTEGER NOT NULL,
    TIME_IN TIMESTAMP,
    TIME_OUT TIMESTAMP,
    DATE_LOG DATE NOT NULL,
    STATUS VARCHAR(20) DEFAULT NULL,  -- NULL = compute dynamically; non-null = admin override
    LOCATION VARCHAR(20),             -- 'OFFICE' or 'ONSITE'
    SITE VARCHAR(100),                -- site name (only relevant when LOCATION='ONSITE')
    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (EMPLOYEE_ID) REFERENCES EMPLOYEES(EMPLOYEE_ID)
);
```

> NOTE: `EMAIL` and `DEPARTMENT` columns no longer exist on EMPLOYEES. Do not reference them.

> CRITICAL: `STATUS` is **deliberately NULL** for all kiosk-written records. Status is computed dynamically at query time by `computeStatus()` in `attendanceRoutes.ts`. A non-null STATUS in the DB means an admin manually overrode it — do not overwrite it during computation.
>
> If you are inheriting an older DB with rows where STATUS = 'PENDING' / 'PRESENT' etc., you must clear them first:
> ```sql
> UPDATE ATTENDANCE_LOGS SET STATUS = NULL;
> COMMIT;
> ```

---

## 6. Backend — `smartqweb/server/src/`

### `index.ts`
- Express app with CORS allowing: `localhost:5173`, `localhost:5174`, `localhost:3000`, and no-origin (Electron)
- `express.json({ limit: '5mb' })` for base64 photo uploads
- Routes: `/api/auth`, `/api/employees`, `/api/kiosk`, `/api/attendance`
- Health check: `GET /api/health`
- Starts by calling `initializeDbPool()` first, then `app.listen(5000)`

### `db.ts`
- Firebird connection **pool of 5** via `node-firebird`
- `lowercase_keys: true` — all column names come back lowercase
- Exports: `initializeDbPool()`, `query<T>(sql, params)`, `execute(sql, params)`
- Has `resolveBlobs()` — BLOB fields in node-firebird return as callback functions; this resolves them to UTF-8 strings before returning rows

### `config.ts`
- Reads from `.env`. Key defaults: `PORT=5000`, `DB_DATABASE=C:/Users/JD/Documents/smartqproj/smartqweb/database/ATTENDANCE.FDB`, `DB_USER=SYSDBA`, `DB_PASSWORD=masterkey`, `CORS_ORIGIN=http://localhost:5173`

### `auth.ts`
- `signup(employeeIdStr, password)`: Creates EMPLOYEES row (blank name, ROLE='ADMIN', STATUS='ACTIVE') if not exists, then creates ADMINS + ADMIN_CREDENTIALS rows. Returns JWT.
- `login(employeeIdStr, password)`: Verifies EMPLOYEES exists, checks ADMIN_CREDENTIALS, bcrypt compare, returns JWT.

### `middleware.ts`
- `authenticate`: Extracts Bearer token from `Authorization` header, verifies JWT. Sets `req.user`. Returns 401 if missing/invalid.

### `employees.ts`
- Interface: `{ id: number, name: string, role: string, picture: string | null, status: string }`
- `getAllEmployees()`, `getEmployeeById(id)`, `createEmployee({name, role?})`, `updateEmployee(id, {name?, role?, picture?})`, `deleteEmployee(id)` (soft delete → INACTIVE)
- All IDs are `INTEGER` in DB

### `employeeRoutes.ts`
- All routes require JWT (`authenticate` middleware)
- `GET /api/employees` — list all
- `POST /api/employees` — `{ name, role }` → create
- `PUT /api/employees/:id` — `{ name?, role?, picture? }` → update
- `DELETE /api/employees/:id` — soft delete

### `kioskRoutes.ts`
- **No JWT auth** (public kiosk device)
- `GET /api/kiosk/employee/:id` — returns employee or 404/403 (inactive)
- `POST /api/kiosk/attendance` — body: `{ employeeId: number, action: 'IN' | 'OUT', location: 'OFFICE' | 'ONSITE', site?: string }`
  - **Regular IN (location=OFFICE)**: Inserts new ATTENDANCE_LOGS row with STATUS=NULL. 409 if already clocked in today.
  - **OUT**: Updates TIME_OUT and STATUS=NULL (status computed dynamically). 409 if no clock-in or already clocked out.
  - **Onsite service (action=IN, location=ONSITE)**: Updates LOCATION and SITE on the **existing** record only — does NOT create a new row. Returns 409 "Employee has not clocked in yet" if no record exists for today. Cannot create a fresh ONSITE record; employee must first scan their RFID (creates OFFICE record), then use Onsite Service to update.
  - All STATUS writes are NULL — never stores PENDING/PRESENT/etc.
  - Returns: `{ message, time: Date }`

### `attendanceRoutes.ts`
- Requires JWT
- **`computeStatus(timeIn, timeOut, dateStr, location)`** — pure function that derives record status. Rules in priority order:
  | Condition | Status |
  |---|---|
  | `timeIn >= 13:00` | ABSENT |
  | `timeIn 09:00–12:59` and `timeOut < 17:00` | ABSENT |
  | `timeIn 09:00–12:59` and `timeOut >= 17:00` | HALF DAY |
  | `timeOut < 17:00` (any time-in before 09:00) | UNDERTIME |
  | OFFICE + `timeOut > 17:00` | OVERTIME (calculates `N HR` or `N HRS`) |
  | ONSITE + any `timeOut > 17:00` | capped to 17:00; no OVERTIME possible |
  | No `timeOut` yet, today's date | CLOCKED IN |
  | No `timeOut`, past date (ONSITE) | auto-5PM used for computation |
  | `timeIn < 08:30` and `timeOut >= 17:00` | PRESENT |
  | `timeIn >= 08:30` and `timeOut >= 17:00` | LATE |
  
  Also returns `isLate: boolean` (true if `timeIn >= 08:30`, regardless of final status).
  
  **Override logic**: If DB row has a non-null STATUS, treat it as an admin override — skip computation and return it as-is. (CLOCKED IN is never stored; it is always a computed result.)

- `GET /api/attendance` — JOINs ATTENDANCE_LOGS with EMPLOYEES, runs `computeStatus()` on each row, returns array of:
  ```ts
  { logId, employeeId, employeeName, date, timeIn, timeOut, status, isLate, location, site }
  ```
  Ordered by DATE_LOG DESC, TIME_IN DESC.

- `POST /api/attendance/admin` — **Admin upsert** (requires JWT). Body:
  ```ts
  { employeeId: number, date: string, timeIn: string, timeOut?: string, location?: string, site?: string, status?: string }
  ```
  - `date` format: `YYYY-MM-DD`, `timeIn`/`timeOut` format: `HH:MM`
  - Checks for existing record for same `employeeId + date`:
    - If exists → UPDATE (overwrites TIME_IN, TIME_OUT, LOCATION, SITE, STATUS)
    - If not → INSERT new row
  - Pass `status: null` (or omit) for auto-compute; pass a specific status string for admin override.

---

## 7. Web Admin Panel — `smartqweb/src/app/components/`

### `LoginPage.tsx` / `SignUpPage.tsx`
- POST to `/api/auth/login` and `/api/auth/signup`
- JWT stored in `localStorage` as `authToken`

### `EmployeeList.tsx`
- Fetches `GET /api/employees`, displays table with columns: Employee ID, Name, Role, Photo, Status
- CRUD: Insert (POST), Edit (PUT), Delete (soft delete via DELETE)
- Photo cell: click opens picture modal → file input → reads as base64 → PUT to `/api/employees/:id` with `{ picture: base64 }`
- All requests use `Authorization: Bearer <token>` header

### `TimeInOut.tsx`
- **Admin manual attendance entry form** (NOT a kiosk-style UI — does not wrap the kiosk API)
- Fields:
  - Employee ID (number input)
  - Date (date picker, defaults to today)
  - Time In (required, `HH:MM`)
  - Time Out (optional, `HH:MM`)
  - Location dropdown: `OFFICE` / `ONSITE`
  - Site (text input, disabled when Location = OFFICE)
  - Status Override dropdown: Auto-compute, Present, Late, Half Day, Undertime, Absent, Clocked In, Overtime 1–6 hrs
- Calls `POST /api/attendance/admin` with JWT (`getAuthHeaders()`)
- On success: shows a confirmation message, auto-resets after 5 seconds
- Intended for correcting records, entering past-day data, or forcing a specific status

### `SearchAttendance.tsx`
- Loads all records from `GET /api/attendance` on mount (with JWT)
- Live filter by name/ID string match and date picker
- `AttendanceLog` interface includes: `logId, employeeId, employeeName, date, timeIn, timeOut, status, isLate, location, site`
- Time In cell: rendered in **red** (`#DC2626`) when `record.isLate === true`
- Status badge colors:
  - PRESENT → green
  - LATE → amber
  - HALF DAY / UNDERTIME → orange
  - ABSENT → red
  - CLOCKED IN → blue
  - OVERTIME → purple
- Table columns: Log ID, Employee Name, Employee ID, Date, Time In, Time Out, Status, Location, Site

### `GenerateReports.tsx`
- Date range picker → fetch `GET /api/attendance` → filter by date range in-memory
- `AttendanceLog` interface same as SearchAttendance (includes `isLate`, `location`, `site`)
- Preview table with same columns + isLate red Time In text + status badge colors (same as SearchAttendance)
- **CSV export**:
  - Prepends UTF-8 BOM (`\uFEFF`) so Excel opens it correctly without encoding issues
  - Date column formatted as `Mar 20, 2026` (avoids Excel `########` on narrow columns)
  - Includes Location and Site columns
  - Filename: `attendance_STARTDATE_to_ENDDATE.csv`
- Print/PDF via `window.print()`

### `ManualLogout.tsx`
- Admin-side manual logout (requires JWT, not the same as the kiosk manual logout screen)
- Verified correct — calls `GET /api/kiosk/employee/:id` then `POST /api/kiosk/attendance` with `action: 'OUT'`
- No mock/localStorage code

### `Layout.tsx`
- App shell with sidebar navigation

---

## 8. Kiosk App — `attendance-system/src/app/components/KioskHome.tsx`

- All localStorage/mock data removed. Fully API-driven.
- API base: `http://localhost:5000/api/kiosk`
- Screen states: `home`, `success`, `manual-logout`, `onsite-service`
- **Main scan flow** (home screen):
  - RFID reader emulates keyboard → input has `autoFocus` + `Enter` key submit
  - Input value → `parseInt(value.trim(), 10)` → `GET /api/kiosk/employee/:id`
  - Then `POST /api/kiosk/attendance` with `action: 'IN', location: 'OFFICE'`
  - If response is 409 "Already clocked in today" → automatically retries with `action: 'OUT', location: 'OFFICE'`
  - Success screen shows employee name, employee picture (base64 from DB, or User icon fallback)
- **Manual logout screen**: Separate ID input → `POST /api/kiosk/attendance` with `action: 'OUT', location: 'OFFICE'` directly
- **Onsite service screen**:
  - Inputs: Employee ID + Site name only (no time fields — time is not set here)
  - Calls `POST /api/kiosk/attendance` with `{ action: 'IN', location: 'ONSITE', site: onsiteSite }`
  - This is an **update-only** operation — it updates LOCATION and SITE on an existing record; it does NOT create a new attendance row
  - Returns 409 if the employee has not yet clocked in today (they must tap their RFID card first)
  - Success screen shows: "LOCATION UPDATED TO ONSITE" + site name
- Clock in top-left, date below it, company logo
- Auto-reset to home after success (timeout)

---

## 9. What Is Fully Completed

- [x] Firebird connection layer (`db.ts`) with pool, BLOB resolver, typed query/execute helpers
- [x] All employee CRUD wired to DB (no flat files)
- [x] Auth: signup creates employee row, login checks ADMIN_CREDENTIALS, JWT issued
- [x] Kiosk API endpoints: employee lookup + clock IN/OUT with duplicate detection
- [x] Web admin: EmployeeList, SearchAttendance, GenerateReports — all wired to real API
- [x] KioskHome.tsx: RFID-ready, smart IN→fallback-to-OUT, manual logout, error display
- [x] LOCATION + SITE columns added to schema and all layers (routes + UI)
- [x] Onsite service in kiosk: update-only (LOCATION/SITE), no time fields
- [x] Status computation engine: `computeStatus()` covers 7 statuses + `isLate` flag (see attendanceRoutes.ts section)
- [x] Admin attendance override endpoint: `POST /api/attendance/admin` (upsert by employee+date)
- [x] TimeInOut.tsx rewritten as admin manual entry form (calls admin endpoint, not kiosk API)
- [x] SearchAttendance.tsx: isLate red Time In text, full status badge colors, Location + Site columns
- [x] GenerateReports.tsx: same visual improvements + CSV UTF-8 BOM + human-readable date format
- [x] ManualLogout.tsx: verified correct (admin JWT flow)
- [x] Port separation: smartqweb=5173, attendance-system=5174, server=5000
- [x] CORS allows Electron (no-origin) and both Vite ports
- [x] `tsc --noEmit` passes with no type errors on server

---

## 10. Pending Tasks

### STEP 5 — RFID ID Type Alignment

RFID card readers emit strings that may have leading zeros (e.g. `"00123456"`). The DB `EMPLOYEE_ID` is `INTEGER`.

**Current behavior**: `KioskHome.tsx` does `parseInt(employeeId.trim(), 10)` which strips leading zeros. The server also does `parseInt(String(employeeId), 10)`.

**Decision needed from user**: Should EMPLOYEE_IDs stored in DB match the raw RFID string (meaning store as VARCHAR) or strip leading zeros (keep INTEGER)?

- If keeping INTEGER: current behavior is correct. Just document that employee IDs must be assigned by stripping leading zeros from the RFID card number.
- If switching to VARCHAR: `EMPLOYEE_ID` column type must change, all `parseInt()` calls removed, and related code updated.

**Recommended action**: Ask the user which RFID cards they're using and confirm the ID format. Do not change the schema until confirmed.

---

### STEP — End-to-End Smoke Test

Before running, if inheriting an old DB, reset stored statuses:
```sql
UPDATE ATTENDANCE_LOGS SET STATUS = NULL;
COMMIT;
```

Test checklist:
1. Start all three services:
   - `cd smartqweb/server && npm run dev`
   - `cd smartqweb && npm run dev`
   - `cd attendance-system && npm run dev`
2. Sign up an admin → verify employee row created in DB via EmployeeList
3. Add a real employee in EmployeeList
4. On kiosk (localhost:5174), scan/type the employee ID → confirm IN recorded
5. Check SearchAttendance (localhost:5173) → confirm record appears with status CLOCKED IN, correct time
6. Scan again on kiosk → confirm auto-detects OUT, status computes (PRESENT/LATE/UNDERTIME etc.)
7. Use Onsite Service → enter ID + site → confirm Location/Site updated in SearchAttendance
8. Use admin TimeInOut form → enter a past-date record with status override → confirm in SearchAttendance
9. Generate report for today → confirm CSV downloads with BOM, readable dates, Location/Site columns

---

### STEP — Electron Dev Port Fix (Minor)

`attendance-system/electron/main.cjs` may still reference port `5173` instead of `5174` for the `electron:dev` script. Verify and update if needed.

---

### STEP — Production Build Notes (Future)

- **Kiosk**: `npm run electron:build` in `attendance-system/` — produces NSIS installer in `release/`
  - `electron/main.cjs` loads `./dist/index.html`; the Vite base is `'./'`
  - Must hardcode the server IP (not localhost) in `KioskHome.tsx` for production if server runs on a different machine
- **Web panel**: `npm run build` in `smartqweb/` → `dist/`. Serve with nginx or `serve -s dist`
- **Server**: `npm run build` then `node dist/index.js` in `smartqweb/server/`
- **On admin PC**: install Firebird 5, apply same `firebird.conf` edits, copy `.fdb`, update `.env` with correct absolute path

---

## 11. Known Issues & Gotchas

1. **Firebird WireCrypt**: If server throws `gdscode 335544472` ("username and password not defined"), the `firebird.conf` fix was not applied or the service was not restarted.

2. **BLOB resolver**: `node-firebird` returns BLOB columns as async callback functions, not values. The `resolveBlobs()` function in `db.ts` handles this. Any new query returning a BLOB column (like `PICTURE`) must go through `query()` which already calls `resolveBlobs`.

3. **IDs are auto-incremented manually**: No SEQUENCE/GENERATOR is used. All INSERTs do `SELECT COALESCE(MAX(ID), 0) + 1 AS NEW_ID FROM TABLE` first. This is not race-safe but acceptable for a single-office deployment.

4. **STATUS = NULL migration**: If you inherit a DB where rows already have STATUS = 'PENDING', 'PRESENT', etc. (written by the old code), the dynamic `computeStatus()` will be skipped for those rows because non-null STATUS is treated as an admin override. Run this in isql before testing:
   ```sql
   UPDATE ATTENDANCE_LOGS SET STATUS = NULL;
   COMMIT;
   ```

5. **ONSITE requires prior clock-in**: Onsite Service cannot create an attendance record from scratch. The employee must first tap their RFID card (creating an OFFICE record), then use Onsite Service to update LOCATION/SITE. If they've never clocked in today, Onsite Service returns 409.

6. **ONSITE employees never get OVERTIME**: `computeStatus()` caps effective TIME_OUT at 17:00 for ONSITE records, so extra hours are silently absorbed. This is by design.

7. **Past-date ONSITE with no TIME_OUT**: `computeStatus()` uses 17:00 as the effective TIME_OUT for past-date ONSITE records that are still open (NULL TIME_OUT). The DB record is not updated — this is purely a display-time computation.

8. **JWT stored in localStorage**: Cleared on browser close. If an admin gets logged out unexpectedly, they need to log in again. This is acceptable for the current use case.

9. **Duplicate stale code bug**: When editing component files, be careful not to leave old function implementations or `return` statements after the component's closing `}`. This has been a recurring issue — always check for orphaned code after edits. Pattern to fix: find the duplicate declaration line with `Select-String`, truncate with `$lines[0..N] | Set-Content`.

10. **Electron dev port**: `attendance-system` kiosk runs on port **5174** (not 5173). The `electron:dev` script in `package.json` still references `wait-on http://localhost:5173` — this needs to be updated to 5174 before running in Electron dev mode.

11. **Module resolution**: Server uses `"type": "module"` in `package.json` so all imports must use `.js` extensions (e.g. `import { query } from './db.js'` even though the source file is `.ts`). TypeScript handles this via `moduleResolution: node`.

---

## 12. File Tree Reference

```
smartqweb/
├── server/
│   ├── .env                        ← DB path, JWT secret, PORT=5000
│   ├── package.json                ← "dev": "tsx src/index.ts"
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts                ← App entrypoint, registers all routers
│       ├── config.ts               ← Reads .env, exports config object
│       ├── db.ts                   ← node-firebird pool, query/execute, resolveBlobs
│       ├── auth.ts                 ← signup, login, generateToken, verifyToken
│       ├── middleware.ts           ← authenticate (JWT middleware)
│       ├── routes.ts               ← /api/auth router (signup, login)
│       ├── employees.ts            ← Employee interface + DB functions
│       ├── employeeRoutes.ts       ← /api/employees CRUD (JWT required)
│       ├── kioskRoutes.ts          ← /api/kiosk (no JWT)
│       └── attendanceRoutes.ts     ← /api/attendance (JWT required)
├── database/
│   ├── ATTENDANCE.FDB              ← ACTUAL database
│   └── schema.sql                  ← Reference schema (keep in sync with .fdb)
└── src/app/components/
    ├── Layout.tsx
    ├── LoginPage.tsx
    ├── SignUpPage.tsx
    ├── EmployeeList.tsx            ← DONE: full CRUD + photo upload
    ├── TimeInOut.tsx               ← DONE: admin manual entry form (POST /api/attendance/admin)
    ├── SearchAttendance.tsx        ← DONE: loads from API, live filter, isLate, status colors
    ├── GenerateReports.tsx         ← DONE: fetches from API, CSV (BOM + human date) + print
    └── ManualLogout.tsx            ← DONE: verified correct (admin JWT flow)

attendance-system/
└── src/app/components/
    └── KioskHome.tsx               ← DONE: RFID-ready, full API flow
```
