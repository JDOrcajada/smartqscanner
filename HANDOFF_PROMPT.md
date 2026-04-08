# SmartQ Attendance System — AI Handoff Prompt

You are continuing development on a **SmartQ Attendance System** project. This document contains the complete context of what has been built, the exact current state of every key file, and the specific next tasks to implement. Read everything before touching any code.

> Last updated: April 7, 2026 — Mobile Flutter app fully wired to API, Sunday auto-absent immunity confirmed, Manual Logout moved to bottom of nav, DB cleaned for deployment practice.

---

## 1. Project Overview

Two React + Vite applications and one Express backend, all in one monorepo:

```
C:\Users\JD\Documents\smartqproj\
├── smartqweb/          ← Web admin panel (React + Vite + Tailwind)
│   ├── src/app/components/   ← Page components
│   ├── server/               ← Express + TypeScript backend (ODBC/Firebird)
│   └── database/
│       ├── ATTENDANCE.FDB    ← Actual Firebird database file
│       └── schema.sql        ← Reference schema (keep in sync)
├── attendance-system/  ← Electron kiosk app (React + Vite + Tailwind)
│   ├── electron/main.cjs        ← Electron main process
│   ├── electron/preload.cjs     ← Exposes window.kioskConfig.serverUrl
│   └── release/                 ← Built installer (Attendance Kiosk Setup 0.0.1.exe)
└── mob_attendance/     ← Flutter mobile app (fully wired to Express API)
    └── lib/main.dart            ← API-driven; Settings screen for server URL; zero Dart errors
```

---

## 2. Ports & Connections

| Service | Port | Notes |
|---|---|---|
| Express backend (`server/`) | **5000** | Dev: `npm run dev` in `smartqweb/server/`. Prod: serves frontend too. |
| Web admin panel (`smartqweb/`) | **5173** | Dev only: `npm run dev` in `smartqweb/`. |
| Kiosk app (`attendance-system/`) | **5174** | Dev only: `npm run dev` in `attendance-system/`. |
| Firebird DB | **3050** | localhost, SuperServer |

Frontend API bases are environment-driven:

- `smartqweb/src/imports/api.ts` uses `VITE_API_BASE_URL` with fallback `http://localhost:5000/api`
- `attendance-system/src/imports/api.ts` uses `window.kioskConfig.serverUrl` (runtime, from userData/config.json) first, then `VITE_KIOSK_API_BASE_URL` / `VITE_API_BASE_URL`, then `http://localhost:5000/api/kiosk`

### Production (single-port — IMPLEMENTED)

**Build** (from `smartqweb/`):
```bash
npm run build:prod
# Runs: vite build && cd server && npm run build
```

**Run** (from `smartqweb/`):
```bash
npm run start:prod
# Runs: cd server && NODE_ENV=production node dist/index.js
```

Then open `http://localhost:5000`. Express serves the built frontend and handles all `/api/*` routes.

- `smartqweb/.env.production` sets `VITE_API_BASE_URL=/api` so the baked JS uses relative paths
- `server/src/index.ts` detects `NODE_ENV=production` → `express.static(distPath)` + catch-all `index.html`

### Database driver — ODBC (CRITICAL)

The backend uses the `odbc` npm package with a DSN-less connection string:
```
Driver={Firebird/InterBase(r) driver};Dbname=host/port:path;...
```

**The Firebird ODBC driver must be installed on every machine running the Express server.**
- Download: https://firebirdsql.org/en/odbc-driver/ (64-bit `Firebird_ODBC_*_x64.exe`)
- No DSN entry is needed — just install the driver
- Verify: ODBC Data Source Administrator → Drivers tab → `Firebird/InterBase(r) driver` listed

> NOTE: The backend was migrated from `node-firebird` to `odbc` specifically to support the planned mobile application. The mobile app will also hit the Express API — ODBC was chosen to keep the DB layer stable across multiple client types.

> NOTE: The old `firebird.conf` WireCrypt/AuthServer changes are **no longer required** since we no longer use `node-firebird` directly. ODBC handles its own wire protocol.

---

## 3. Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS v4, shadcn/ui (Radix), Lucide icons
- **Backend**: Node.js, Express 4, TypeScript, `tsx` (dev runner), **`odbc` npm package** (NOT node-firebird)
- **Database**: Firebird 5.0 SuperServer on Windows, accessed via ODBC driver
- **Auth**: `bcryptjs` for password hashing, `jsonwebtoken` (24h JWT in `localStorage` as `authToken`)
- **Kiosk**: Electron wrapper around the Vite app (`attendance-system/electron/main.cjs`)
- **Mobile**: Flutter (`mob_attendance/`) — fully wired to Express API

---

## 4. Firebird Configuration

The Firebird ODBC driver handles its own wire protocol — the old `WireCrypt`/`AuthServer` changes to `firebird.conf` that were needed for `node-firebird` **are no longer required**.

Only requirement: **Install the Firebird ODBC driver** on the machine running the server.
- Download: https://firebirdsql.org/en/odbc-driver/ (`Firebird_ODBC_*_x64.exe`, 64-bit)
- No DSN entry needed — DSN-less connection string is used
- After install, "Firebird/InterBase(r) driver" appears in ODBC Data Source Administrator → Drivers tab

**DB credentials**: user `SYSDBA`, password `masterkey`

**DB file path**: `C:/Users/JD/Documents/smartqproj/smartqweb/database/ATTENDANCE.FDB`

> When deploying to the target PC, these paths will differ. Set them via environment variables in `smartqweb/server/.env` (see `config.ts` for all supported variables).

---

## 5. Database Schema (Current Actual State in .fdb)

```sql
CREATE TABLE EMPLOYEES (
  EMPLOYEE_ID BIGINT PRIMARY KEY,
  NAME        VARCHAR(255),                -- NOT NULL was dropped
  ROLE        VARCHAR(100),                -- renamed from DEPARTMENT
  PICTURE     BLOB SUB_TYPE TEXT,          -- stores base64 data URL
  QR_CODE     BLOB SUB_TYPE TEXT,          -- stores QR image data URL
  STATUS      VARCHAR(20) DEFAULT 'ACTIVE',
  CREATED_AT  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ADMINS (
  ADMIN_ID    INTEGER PRIMARY KEY,
  EMPLOYEE_ID BIGINT NOT NULL UNIQUE,
  ADMIN_ROLE  VARCHAR(20) DEFAULT 'ADMIN', -- ← new: 'ADMIN' | 'SUPERADMIN'
  CREATED_AT  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (EMPLOYEE_ID) REFERENCES EMPLOYEES(EMPLOYEE_ID)
);

CREATE TABLE ADMIN_CREDENTIALS (
  CREDENTIAL_ID INTEGER PRIMARY KEY,
  EMPLOYEE_ID   BIGINT NOT NULL UNIQUE,
  PASSWORD_HASH VARCHAR(255) NOT NULL,
  CREATED_AT    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UPDATED_AT    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (EMPLOYEE_ID) REFERENCES EMPLOYEES(EMPLOYEE_ID)
);

-- Pending signup queue — requests wait here until SuperAdmin approves/rejects
CREATE TABLE ADMIN_SIGNUP_REQUESTS (
  REQUEST_ID     INTEGER      NOT NULL PRIMARY KEY,
  EMPLOYEE_ID    BIGINT       NOT NULL,
  PASSWORD_HASH  VARCHAR(255) NOT NULL,
  REQUEST_STATUS VARCHAR(20)  DEFAULT 'PENDING',   -- 'PENDING' | 'APPROVED' | 'REJECTED'
  CREATED_AT     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  REVIEWED_AT    TIMESTAMP,
  REVIEWED_BY    BIGINT,                            -- EMPLOYEE_ID of the SuperAdmin who acted
  FOREIGN KEY (EMPLOYEE_ID) REFERENCES EMPLOYEES(EMPLOYEE_ID)
);

CREATE TABLE ATTENDANCE_LOGS (
  LOG_ID      INTEGER PRIMARY KEY,
  EMPLOYEE_ID BIGINT NOT NULL,
  TIME_IN     TIMESTAMP,
  TIME_OUT    TIMESTAMP,
  DATE_LOG    DATE NOT NULL,
  STATUS      VARCHAR(20) DEFAULT NULL,  -- NULL = compute dynamically; non-null = admin override
  LOCATION    VARCHAR(20),               -- 'OFFICE' or 'ONSITE'
  SITE        VARCHAR(100),              -- only meaningful when LOCATION='ONSITE'
  LEAVE_TYPE  VARCHAR(5),               -- ← new: 'SL' | 'VL' | NULL
  CREATED_AT  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UPDATED_AT  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (EMPLOYEE_ID) REFERENCES EMPLOYEES(EMPLOYEE_ID)
);

-- SL / VL balance per employee per calendar year (default 15 each)
CREATE TABLE EMPLOYEE_LEAVES (
  LEAVE_ID    INTEGER NOT NULL PRIMARY KEY,
  EMPLOYEE_ID BIGINT  NOT NULL,
  LEAVE_YEAR  INTEGER NOT NULL,
  SL_BALANCE  INTEGER DEFAULT 15,
  VL_BALANCE  INTEGER DEFAULT 15,
  UPDATED_AT  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (EMPLOYEE_ID) REFERENCES EMPLOYEES(EMPLOYEE_ID),
  CONSTRAINT UQ_LEAVE_EMP_YEAR UNIQUE (EMPLOYEE_ID, LEAVE_YEAR)
);

-- Public holidays — dates flagged so auto-absent logic can exclude them
CREATE TABLE HOLIDAYS (
  HOLIDAY_ID   INTEGER NOT NULL PRIMARY KEY,
  HOLIDAY_DATE DATE    NOT NULL,
  HOLIDAY_NAME VARCHAR(100),
  HOLIDAY_TYPE VARCHAR(30) DEFAULT 'REGULAR', -- ← 'REGULAR' | 'SPECIAL_NON_WORKING' | 'SPECIAL_WORKING'
  CREATED_AT   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT UQ_HOLIDAY_DATE UNIQUE (HOLIDAY_DATE)
);
```

> NOTE: `EMAIL` and `DEPARTMENT` columns no longer exist on EMPLOYEES. Do not reference them.

> NOTE: live schema is kept in sync via `migrate.ts` (7 idempotent steps run at server startup). All column additions and new tables above are already applied to the live `ATTENDANCE.FDB`.

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
- Routes: `/api/auth`, `/api/employees`, `/api/kiosk`, `/api/attendance`, `/api/leaves`, `/api/holidays`, `/api/superadmin`
- Health check: `GET /api/health`
- Starts by calling `initializeDbPool()` → `runMigrations()` → `app.listen(5000)`

### `migrate.ts` (NEW)
- Idempotent 7-step schema migration run once at every server startup via `runMigrations()`
- Uses `columnExists()` / `tableExists()` guards so each step is safe to re-run
- Steps:
  1. `ATTENDANCE_LOGS.LEAVE_TYPE VARCHAR(5)` — tracks SL/VL assigned to absent records
  2. `EMPLOYEE_LEAVES` table — SL/VL balances per employee per year
  3. `HOLIDAYS` table — holiday date registry
  4. `ADMINS.ADMIN_ROLE VARCHAR(20) DEFAULT 'ADMIN'`
  5. `ADMIN_SIGNUP_REQUESTS` table — pending signup queue
  6. `HOLIDAYS.HOLIDAY_TYPE VARCHAR(30) DEFAULT 'REGULAR'`
  7. **SuperAdmin bootstrap** — ensures Jonathan Gurap (`EMPLOYEE_ID = 2649694555`) has `ROLE='ADMIN'` in EMPLOYEES and `ADMIN_ROLE='SUPERADMIN'` in ADMINS; unconditional on every startup (UPDATE runs even if the row already exists to guarantee correctness)

### `db.ts`
- Firebird connection **pool** via **`odbc`** npm package (DSN-less)
- Connection string: `Driver={Firebird/InterBase(r) driver};Dbname=host/port:path;Uid=...;Pwd=...;charset=UTF8`
- Pool: `initialSize: 2`, `maxSize: 5`, `connectionTimeout: 10`
- `normalizeRows()` — lowercases all column names (Firebird ODBC returns them uppercase), converts Buffer→UTF-8 string, converts BigInt→Number
- `serializeParams()` — converts JS Date objects to `'YYYY-MM-DD HH:MM:SS'` string format that ODBC expects
- Exports: `initializeDbPool()`, `query<T>(sql, params)`, `execute(sql, params)`, `getNextAvailableId(table, column)`
- `getNextAvailableId()` fills the **lowest missing numeric gap** for manual integer-key tables

### `config.ts`
- Reads from `.env`. Key defaults: `PORT=5000`, `DB_DATABASE=C:/Users/JD/Documents/smartqproj/smartqweb/database/ATTENDANCE.FDB`, `DB_USER=SYSDBA`, `DB_PASSWORD=masterkey`, `CORS_ORIGIN=http://localhost:5173`

### `auth.ts`
- `generateToken(employeeId, adminRole)` — embeds **both** `employeeId` and `adminRole` in JWT payload
- `signup(employeeIdStr, password)`:
  - Any employee found in EMPLOYEES can request signup (no ROLE check)
  - Checks for duplicate credentials (already has ADMIN_CREDENTIALS) — rejects
  - Checks if employee is SuperAdmin in ADMINS table — if so, creates account directly (no approval)
  - Otherwise checks for existing PENDING request and rejects duplicates
  - For non-SuperAdmin: inserts row into `ADMIN_SIGNUP_REQUESTS` as `PENDING` and returns `{ pending: true }`
  - Returns `{ success, message, token?, adminRole?, pending? }`
- `login(employeeIdStr, password)`: Verifies EMPLOYEES exists, requires both an ADMINS row and ADMIN_CREDENTIALS row, checks password, returns `{ token, adminRole }` where `adminRole` comes from `ADMINS.ADMIN_ROLE`
- `verifyAdminPassword(employeeId, password)`: Used by destructive employee delete flow for second-factor confirmation

### `employeeId.ts`
- Central employee ID parsing helper
- `parseEmployeeId(value)` accepts digit-only positive IDs and rejects invalid/non-safe-integer values
- `normalizeEmployeeId(value)` truncates a provided numeric value for controlled updates/inserts

### `middleware.ts`
- `authenticate`: Extracts Bearer token from `Authorization` header, verifies JWT. Sets `req.user = { employeeId, adminRole }`. Returns 401 if missing/invalid.
- `requireSuperAdmin`: NEW — Returns 403 if `req.user.adminRole !== 'SUPERADMIN'` (case-insensitive). Applied as a second middleware layer on all superadmin routes.

### `superadminRoutes.ts` (NEW)
- All routes apply `authenticate` + `requireSuperAdmin` as router-level middleware
- `GET /api/superadmin/requests` — returns all `PENDING` rows from `ADMIN_SIGNUP_REQUESTS` joined with employee name
- `POST /api/superadmin/requests/:id/approve` — creates ADMINS (with `ADMIN_ROLE='ADMIN'`) + ADMIN_CREDENTIALS rows, marks request `APPROVED`
- `POST /api/superadmin/requests/:id/reject` — marks request `REJECTED`

### `employees.ts`
- Interface: `{ id: number, name: string, role: string, picture: string | null, qrCode: string | null, status: string }`
- `getAllEmployees()`, `getEmployeeById(id)`, `createEmployee({ id?, name, role? })`, `updateEmployee(id, { employeeId?, name?, role?, picture?, qrCode? })`, `deleteEmployee(id)`
- Employee creation reuses the **lowest available free EMPLOYEE_ID** unless a manual ID is supplied
- Employee updates can change `EMPLOYEE_ID`; related rows in ATTENDANCE_LOGS, ADMINS, and ADMIN_CREDENTIALS migrate to the new ID
- If an employee ID changes, stored QR code is cleared unless a replacement QR is supplied
- Employee deletion is **permanent DB deletion** — also removes related ATTENDANCE_LOGS, ADMINS, and ADMIN_CREDENTIALS rows

### `employeeRoutes.ts`
- All routes require JWT (`authenticate` middleware)
- `GET /api/employees` — list all
- `POST /api/employees` — `{ employeeId?, name, role }` → create
- `PUT /api/employees/:id` — `{ employeeId?, name?, role?, picture?, qrCode? }` → update
- `DELETE /api/employees/:id` — permanent delete; requires body `{ password }` for logged-in admin confirmation
- If the logged-in admin changes their own employee ID, returns a fresh JWT so current session stays valid

### `leaveRoutes.ts`
- All routes require JWT
- `GET /api/leaves` — `?year=YYYY` (default current year); returns all active employees with their SL/VL balances (lazily creates EMPLOYEE_LEAVES row at 15/15 defaults if none exists)
- `POST /api/leaves/assign` — `{ employeeId, date, leaveType: 'SL' | 'VL' | null }`:
  - Finds or creates an `ATTENDANCE_LOGS` row for the date with `STATUS='ABSENT'`
  - Restores the previously assigned leave balance if switching types
  - Deducts 1 from the chosen leave balance (can go negative intentionally)
  - `leaveType: null` clears the assignment and restores balance
- `PATCH /api/leaves/balance` — `{ employeeId, year, slBalance, vlBalance }`: manual override of leave balances (SuperAdmin use)

### `holidayRoutes.ts`
- All routes require JWT
- `GET /api/holidays` — returns all holidays as `[{ id, date, name, type }]` ordered by date; `type` defaults to `'REGULAR'` if column is null
- `POST /api/holidays` — `{ date: 'YYYY-MM-DD', name: string, type: 'REGULAR' | 'SPECIAL_NON_WORKING' | 'SPECIAL_WORKING' }`: inserts holiday, rejects duplicates with 409
- `DELETE /api/holidays/:id` — removes holiday by ID

### `kioskRoutes.ts`
- **No JWT auth** (public kiosk device)
- `GET /api/kiosk/employee/:id` — returns employee or 404/403 (inactive)
- `POST /api/kiosk/attendance` — body: `{ employeeId: number | string, action: 'IN' | 'OUT', location: 'OFFICE' | 'ONSITE', site?: string }`
  - **Regular IN (location=OFFICE)**: Inserts new ATTENDANCE_LOGS row with STATUS=NULL. 409 if already clocked in today.
  - **OUT**: Updates TIME_OUT and STATUS=NULL (status computed dynamically). 409 if no clock-in or already clocked out.
  - **Onsite service (action=IN, location=ONSITE)**: Updates LOCATION and SITE on the **existing** record only — does NOT create a new row. Returns 409 "Employee has not clocked in yet" if no record exists for today.
  - All STATUS writes are NULL — never stores PENDING/PRESENT/etc.
  - Returns: `{ message, time: Date }`
- Uses `parseEmployeeId()` instead of raw `parseInt()` so backend ID validation stays consistent with the `BIGINT` migration

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

### Auth flow (localStorage)
- `authToken` — 24h JWT signed with `{ employeeId, adminRole }`
- `employeeId` — logged-in admin's employee ID (string)
- `adminRole` — `'SUPERADMIN'` or `'ADMIN'`; written on login and on SuperAdmin direct signup
- Cleared together on logout

### `LoginPage.tsx`
- POST to `/api/auth/login` with `{ employeeId, password }`
- On success stores `authToken`, `employeeId`, and `adminRole` in localStorage
- API base from `src/imports/api.ts`

### `SignUpPage.tsx`
- POST to `/api/auth/signup` with `{ employeeId, password }`
- If response carries `pending: true` → renders a "Request Submitted, awaiting SuperAdmin approval" screen (no auto-login)
- If response carries a `token` (SuperAdmin direct signup) → stores credentials and navigates to home

### `Layout.tsx`
- App shell with sidebar navigation
- Reads `adminRole` from localStorage; derives `isSuperAdmin = adminRole === 'SUPERADMIN'`
- **SuperAdmin-only nav items** (only visible when `isSuperAdmin`):
  - Admin Approval (`/admin-approval`) — Shield icon
  - Holiday Calendar (`/holidays`) — CalendarDays icon
  - Leave Manager (`/leave-manager`) — ClipboardList icon
- Upper-right admin avatar reflects the logged-in admin's `PICTURE` from EMPLOYEES

### `AdminApproval.tsx` (NEW — SuperAdmin only)
- Fetches pending requests from `GET /api/superadmin/requests`
- Table columns: Employee ID, Name, Requested At, Actions
- Per row: **Approve** button → `POST /api/superadmin/requests/:id/approve`; **Reject** button → `POST /api/superadmin/requests/:id/reject`
- Refreshes the list after each action

### `HolidayManager.tsx` (NEW — SuperAdmin only)
- Full interactive monthly calendar grid (7-column, prev/next month navigation)
- **Add holiday**: click an empty day → inline action panel appears with a Type dropdown and Name input; press Enter or click Add
- **Remove holiday**: click an existing holiday day → shows holiday name + Remove button
- **Color coding by type**:
  - Regular → red badge
  - Special Non-Working → orange badge
  - Special Working → blue badge
- Today's date highlighted with a green circle
- Legend bar at bottom with all 3 holiday types + Today marker
- Calls `GET /api/holidays` on mount; `POST /api/holidays` to add; `DELETE /api/holidays/:id` to remove

### `LeaveManager.tsx` (NEW — SuperAdmin only)
- Year selector + employee search/filter
- Table showing all active employees with SL and VL balances for the selected year
- Per-row inline edit mode: click Edit → numeric inputs for SL and VL → Save calls `PATCH /api/leaves/balance` / Cancel discards
- Negative balances shown in red
- Calls `GET /api/leaves?year=YYYY` on mount/year change

### `EmployeeList.tsx`
- Fetches `GET /api/employees`, displays table with columns: Employee ID, Name, Role, Photo, QR Code, Status
- CRUD: Insert (POST), Edit (PUT), Delete (permanent delete via DELETE)
- Supports manual employee ID entry on insert and edit
- Insert requires all visible required fields, and Add Employee stays disabled until required fields are complete
- Photo cell: click opens picture modal → file input → reads as base64 → PUT to `/api/employees/:id` with `{ picture: base64 }`
- Delete flow is now double-confirmed:
  - First modal: delete confirmation
  - Second modal: admin must re-enter their password
- QR flow:
  - Select employee → `Generate QR`
  - QR code is generated from employee ID
  - Stored back to `EMPLOYEES.QR_CODE`
  - Previewable and printable later from the same screen
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

### `routes.tsx`
- Declares all page routes using React Router
- Added three new routes:
  - `/admin-approval` → `AdminApproval`
  - `/holidays` → `HolidayManager`
  - `/leave-manager` → `LeaveManager`

---

## 8. Kiosk App — `attendance-system/src/app/components/KioskHome.tsx`

- All localStorage/mock data removed. Fully API-driven.
- API base resolved at runtime from `window.kioskConfig.serverUrl` (set by preload from userData/config.json), then env vars, then `http://localhost:5000/api/kiosk`
- Screen states: `home`, `success`, `manual-logout`, `onsite-service`
- **Main scan flow** (home screen):
  - RFID reader emulates keyboard → input has `autoFocus` + `Enter` key submit
  - Input value → `parseInt(value.trim(), 10)` → `GET /api/kiosk/employee/:id`
  - Then `POST /api/kiosk/attendance` with `action: 'IN', location: 'OFFICE'`
  - If response is 409 "Already clocked in today" → automatically retries with `action: 'OUT', location: 'OFFICE'`
  - Success screen shows employee name, employee picture (base64 from DB, or User icon fallback)
- **Manual logout screen**: Separate ID input → `POST /api/kiosk/attendance` with `action: 'OUT', location: 'OFFICE'` directly
- **Onsite service screen**: Inputs: Employee ID + Site name. Calls `POST /api/kiosk/attendance` with `{ action: 'IN', location: 'ONSITE', site }`. Update-only — returns 409 if not clocked in today.
- Clock in top-left, date below it, company logo

### Electron Main (`electron/main.cjs`)

- Detects packaged vs dev via `!app.isPackaged`
- **Reads `userData/config.json`** for `serverUrl` at runtime (no rebuild needed to change server IP)
- Writes a default `config.json` on first launch if none exists
- Passes `--kiosk-server-url=<serverUrl>` via `additionalArguments` to the renderer
- Preload: `electron/preload.cjs` exposes `window.kioskConfig = { serverUrl }` via `contextBridge`
- Window: `kiosk: true`, `fullscreen: true`, `frame: false`

### Kiosk Server URL Configuration (target PC)

Edit `C:\Users\<user>\AppData\Roaming\Attendance Kiosk\config.json`:
```json
{ "serverUrl": "http://192.168.1.100:5000" }
```
Restart the kiosk app. No rebuild required.

### Packaging

- **Built installer**: `release/Attendance Kiosk Setup 0.0.1.exe` (~80 MB NSIS installer)
- Build command: `npm run electron:build` (in `attendance-system/`)
- NSIS config: `oneClick: false`, creates Desktop + Start Menu shortcuts
- Icon: `assets/logo.ico` generated from `src/assets/logo.png` (padded to square by `generate-icon.js`)

> NOTE: The kiosk flow works in typed-input testing. **Real RFID reader validation is still pending** against actual hardware.

---

## 10. What Is Fully Completed

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
- [x] Electron dev mode fixed: correct kiosk port (`5174`) and reliable `!app.isPackaged` dev detection
- [x] Employee deletion now permanently removes rows from DB and reuses freed employee IDs on later inserts
- [x] Employee delete requires second confirmation via admin password re-entry
- [x] Admin avatar in web header reflects the admin employee photo from DB
- [x] Employee IDs expanded to `BIGINT` in source schema and live Firebird DB
- [x] Shared employee ID parsing added across auth, employee, kiosk, and attendance routes
- [x] Manual employee ID insert/edit support added in EmployeeList and backend
- [x] Frontend API bases moved to env-backed helpers instead of hardcoded localhost strings
- [x] QR generation, persistence, preview, and printing added to EmployeeList
- [x] Live DB migration to add `EMPLOYEES.QR_CODE` completed and verified
- [x] **RBAC system**: `ADMINS.ADMIN_ROLE` distinguishes `'ADMIN'` from `'SUPERADMIN'`
- [x] **JWT now carries `adminRole`**: `generateToken(employeeId, adminRole)` embeds both fields
- [x] **SuperAdmin bootstrap**: Jonathan Gurap (ID `2649694555`) unconditionally ensured as SUPERADMIN on every server start via `migrate.ts` step 7
- [x] **`migrate.ts`**: 7 idempotent migration steps run at server startup
- [x] **Admin signup approval flow**: non-SuperAdmin signups go to `ADMIN_SIGNUP_REQUESTS` as PENDING; SuperAdmin direct-signup bypasses approval
- [x] **`requireSuperAdmin` middleware**: 403 if caller is not SUPERADMIN
- [x] **`superadminRoutes.ts`**: list/approve/reject pending signup requests
- [x] **`AdminApproval.tsx`**: SuperAdmin-only UI for approving/rejecting pending admin signups
- [x] **`HolidayManager.tsx`**: interactive monthly calendar; click to add/remove holidays; 3 types (Regular/Special Non-Working/Special Working) with color coding; today highlighted; legend bar
- [x] **`LeaveManager.tsx`**: year selector + per-employee SL/VL balance display; inline edit with Save/Cancel; calls `PATCH /api/leaves/balance`
- [x] **`leaveRoutes.ts`**: SL/VL balance read + assign (deducts balance, restores on type change) + manual balance override
- [x] **`holidayRoutes.ts`**: GET/POST/DELETE with `HOLIDAY_TYPE` support (3 types)
- [x] Layout conditional SuperAdmin nav items (Admin Approval, Holiday Calendar, Leave Manager)
- [x] **ODBC migration**: backend moved from `node-firebird` to `odbc` package; DSN-less connection; handles uppercase column names, Buffer/BigInt normalization
- [x] **Generate Reports** date range fix: `GET /api/attendance?dateFrom=...&dateTo=...` now used
- [x] **Generate Reports** PDF print: `window.open()` new blank window; A4 landscape HTML (header, table, stat cards, signature block)
- [x] **Single-port production runtime**: `NODE_ENV=production` → Express serves `dist/` + catch-all; `.env.production` sets `VITE_API_BASE_URL=/api`; `build:prod` + `start:prod` scripts; verified ✅
- [x] **Electron kiosk packaged**: `release/Attendance Kiosk Setup 0.0.1.exe` (~80 MB NSIS); runtime server URL from `userData/config.json`; preload exposes `window.kioskConfig.serverUrl`; icon fixed
- [x] **Flutter mobile app wired**: complete rewrite of `lib/main.dart`; `http` package; Settings screen for runtime server URL; IN→OUT fallback; Onsite 2-field flow; base64 photo decode; zero Dart errors
- [x] **Sunday auto-absent immunity confirmed**: `isWeekend()` in `attendanceRoutes.ts` already covers `day === 0` (Sunday) and `day === 6` (Saturday) — no code change needed
- [x] **Manual Logout moved to bottom of nav**: now appears after all SuperAdmin items for both Admin and SuperAdmin roles
- [x] **DB cleaned for deployment practice**: ATTENDANCE_LOGS, EMPLOYEE_LEAVES, HOLIDAYS, ADMIN_SIGNUP_REQUESTS all cleared; EMPLOYEES (5), ADMINS (2), ADMIN_CREDENTIALS (2) preserved

## 9. Mobile App — `mob_attendance/`

Flutter app originally cloned from `https://github.com/matthewcandoy/mob_attendance`.

**Current state: FULLY WIRED to the Express API. Zero Dart analysis errors.**

### Architecture (`lib/main.dart` — ~770 lines)

- `getServerUrl()` / `saveServerUrl()` — reads/writes server URL from SharedPreferences (key: `serverUrl`, default: `http://192.168.1.1:5000`)
- `fetchEmployee(serverUrl, empId)` — `GET /api/kiosk/employee/:id`
- `postAttendance(serverUrl, {employeeId, action, location, site?})` — `POST /api/kiosk/attendance`
- `_submitManualId()` — tries IN, if 409 retries with OUT (same pattern as Electron kiosk)
- `_submitOnsite()` — 2 fields only (Employee ID + Site), no time fields
- Settings screen (⚙️ gear icon) — lets user type server IP, saves to SharedPreferences
- Success screen — decodes base64 photo from DB (`MemoryImage`), shows name/role/ID/time

### Screens
`AppView.home`, `AppView.success`, `AppView.manualInput`, `AppView.onsiteService`, `AppView.settings`

### pubspec.yaml dependencies
- `http: ^1.2.0` ← added
- `intl: ^0.19.0` ← kept
- `shared_preferences: ^2.2.0` ← kept (for server URL only)
- `image_picker` ← removed

### Internet access
The Settings screen accepts any URL. See **Section 12, Step 12** of the Installation Guide for the full DuckDNS + port forwarding setup. No code changes needed — just update the URL in mobile Settings.

## 11. Pending Tasks

The system is feature-complete for core attendance use. Remaining work is hardware validation, target PC deployment, and facial recognition.

### STEP — Real RFID / QR Hardware Validation

Kiosk and QR work in typed-input testing but real hardware not yet validated:
1. Test RFID reader in keyboard-emulation mode (confirm Enter suffix, timing, focus stability)
2. Test QR scanner against generated QR codes
3. Decide if leading-zero RFID strings need a separate field (currently numeric only)

### STEP — Facial Recognition

Do not begin until RFID/QR hardware is validated and the target PC deployment is stable. This is intentionally last.

---

## 12. Installation & Deployment Guide

This is a complete step-by-step guide to moving the system from the development machine to the target production PC (Admin PC) and Mini PC (kiosk). Covers the web application, kiosk app, mobile app, and enabling internet access.

---

### Prerequisites — Install on the Admin PC (Target Server Machine)

#### 1. Node.js LTS
- Download from https://nodejs.org → choose the LTS version
- Run the installer, keep all defaults
- Verify: open PowerShell → `node -v` and `npm -v` should both print version numbers

#### 2. Firebird 5 SuperServer
- Download from https://firebirdsql.org/en/firebird-5-0/ (Windows 64-bit installer)
- Install with defaults — choose **SuperServer** when asked
- After install, Firebird service should run automatically
- Verify: open Services (`services.msc`) → look for **Firebird Server** → Status: Running

#### 3. Firebird ODBC Driver (64-bit — CRITICAL)
- Download from https://firebirdsql.org/en/odbc-driver/
- File: `Firebird_ODBC_*_x64.exe` (64-bit, must match Node.js which is 64-bit)
- Install with defaults
- Verify: open **ODBC Data Source Administrator (64-bit)** → Drivers tab → `Firebird/InterBase(r) driver` must be listed
- If NOT listed, `npm run start:prod` will fail with a connection error

#### 4. Git (optional but recommended)
- Download from https://git-scm.com
- Lets you clone directly instead of copying files manually

---

### Step 1 — Copy the Repository to the Admin PC

**Option A — Git clone (recommended)**
```powershell
cd C:\AttendanceSystem
git clone git@github.com:JDOrcajada/smartqweb.git
```
This creates `C:\AttendanceSystem\smartqweb\`.

**Option B — Manual copy**
- Copy the entire `smartqweb/` folder from the dev machine to the Admin PC
- Destination: anywhere, e.g. `C:\AttendanceSystem\smartqweb\`

---

### Step 2 — Copy the Database File

- Copy `smartqweb/database/ATTENDANCE.FDB` to the same relative location on the Admin PC: `C:\AttendanceSystem\smartqweb\database\ATTENDANCE.FDB`
- This file contains all employees, admins, and credentials
- **Do not overwrite it** with a blank database later

---

### Step 3 — Create the `.env` File

Create the file `C:\AttendanceSystem\smartqweb\server\.env` with this content:

```env
PORT=5000
DB_HOST=localhost
DB_PORT=3050
DB_DATABASE=C:/AttendanceSystem/smartqweb/database/ATTENDANCE.FDB
DB_USER=SYSDBA
DB_PASSWORD=masterkey
JWT_SECRET=replace_this_with_any_long_random_string
NODE_ENV=production
CORS_ORIGIN=http://localhost:5000
```

> CRITICAL: Use **forward slashes** in `DB_DATABASE` path even on Windows. Backslashes cause ODBC errors.
> CRITICAL: Change `JWT_SECRET` to a unique random string. Any long string works (e.g. 40+ random characters).

---

### Step 4 — Install Dependencies

Open PowerShell on the Admin PC:

```powershell
# Install web frontend dependencies
cd C:\AttendanceSystem\smartqweb
npm install

# Install server dependencies
cd C:\AttendanceSystem\smartqweb\server
npm install
```

Both should complete without errors. If you see ODBC-related errors at this stage, ignore them — they only occur at runtime.

---

### Step 5 — Build the Production Bundle

```powershell
cd C:\AttendanceSystem\smartqweb
npm run build:prod
```

This runs `vite build` (compiles React frontend into `dist/`) then `tsc` (compiles Express server into `server/dist/`). Should take 30–60 seconds. No errors expected.

---

### Step 6 — Open Firewall Port

Running this once on the Admin PC allows the kiosk (Mini PC) and mobile to reach the server:

```powershell
New-NetFirewallRule -DisplayName "SmartQ Server" -Direction Inbound -Protocol TCP -LocalPort 5000 -Action Allow
```

---

### Step 7 — Start the Server

```powershell
cd C:\AttendanceSystem\smartqweb
npm run start:prod
```

Expected output:
```
✓ DB pool ready
✓ Migrations complete
Server running on port 5000
```

Open a browser on the Admin PC → `http://localhost:5000` → SmartQ login page should appear.

> If you see a Firebird connection error, the ODBC driver is not installed or the `DB_DATABASE` path is wrong.

---

### Step 8 — Run as a Windows Service (NSSM — so it starts automatically)

This keeps the server running after reboot without anyone manually running `npm run start:prod`.

#### 8a. Download NSSM
- Go to https://nssm.cc/download → download `nssm-2.24.zip` (or latest)
- Extract, copy `nssm.exe` to `C:\Windows\System32\` (so it's on PATH)

#### 8b. Install the service
```powershell
# Open PowerShell as Administrator
nssm install SmartQServer
```

A GUI appears. Fill in:
- **Path**: `C:\Program Files\nodejs\node.exe`
- **Startup directory**: `C:\AttendanceSystem\smartqweb\server`
- **Arguments**: `dist/index.js`

Then click the **Environment** tab and add:
```
NODE_ENV=production
```

Click **Install service**, then:
```powershell
nssm start SmartQServer
```

#### 8c. Verify
```powershell
nssm status SmartQServer
# Should print: SERVICE_RUNNING
```

Now the server auto-starts on boot. To stop/restart:
```powershell
nssm stop SmartQServer
nssm restart SmartQServer
```

---

### Step 9 — Find the Admin PC's Local IP

```powershell
ipconfig | findstr "IPv4"
```

Note the IP, e.g. `192.168.1.50`. This is what the kiosk and mobile need.

---

### Step 10 — Install the Kiosk on the Mini PC

1. Copy `attendance-system/release/Attendance Kiosk Setup 0.0.1.exe` to the Mini PC
2. Run the installer — installs to `C:\Users\<user>\AppData\Local\Programs\Attendance Kiosk\`
3. Creates a Desktop shortcut and Start Menu entry
4. Edit the config file to point at the Admin PC:
   - Path: `C:\Users\<user>\AppData\Roaming\Attendance Kiosk\config.json`
   - Content:
     ```json
     { "serverUrl": "http://192.168.1.50:5000" }
     ```
   - Replace `192.168.1.50` with the actual IP from Step 9
5. Launch **Attendance Kiosk** from the Desktop shortcut
6. Should load the kiosk UI and connect to the server

> If the kiosk shows a blank screen or connection error: check the IP in `config.json`, confirm the server is running, and confirm the firewall rule from Step 6 was applied.

---

### Step 11 — Configure the Mobile App

1. Install the Flutter app on the employee phones (APK sideload or via Flutter `adb install`)
2. Open the app → tap ⚙️ icon → type `http://192.168.1.50:5000` → tap Save
3. Test time-in: enter an employee ID → should show success with employee photo

> Mobile app only works on same WiFi during this phase. For internet access over mobile data, complete Step 12 below after the system is stable on local WiFi.

---

### Step 12 — Enable Mobile Internet Access (DuckDNS + Port Forwarding)

**No code changes required.** Only network configuration and a URL update in the mobile app Settings.

#### 1. Register a free DuckDNS hostname

1. Go to https://www.duckdns.org → log in with Google
2. Create a subdomain, e.g. `smartq-attendance` → you get `smartq-attendance.duckdns.org`
3. Note your **token** (shown on the DuckDNS dashboard) — needed for the auto-update task

#### 2. Install DuckDNS auto-updater on the Target PC

Run this once in PowerShell as Administrator (replace `YOUR_SUBDOMAIN` and `YOUR_TOKEN`):

```powershell
$subdomain = "smartq-attendance"
$token = "YOUR_DUCKDNS_TOKEN_HERE"
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-WindowStyle Hidden -Command `"Invoke-WebRequest -Uri 'https://www.duckdns.org/update?domains=$subdomain&token=$token&ip=' -UseBasicParsing`""
$trigger = New-ScheduledTaskTrigger -RepetitionInterval (New-TimeSpan -Minutes 5) -Once -At (Get-Date)
Register-ScheduledTask -TaskName "DuckDNS Update" -Action $action -Trigger $trigger -RunLevel Highest -Force
```

This runs every 5 minutes and keeps DuckDNS pointing to the current public IP of the office.

#### 3. Forward port 5000 on the office router

1. Log into the router admin page (usually `http://192.168.1.1`)
2. Find **Port Forwarding** (may be under NAT, Firewall, or Virtual Servers)
3. Add a rule:
   - External port: `5000`
   - Internal IP: Target PC's local IP (run `ipconfig | findstr "IPv4"` on the Target PC to find it)
   - Internal port: `5000`
   - Protocol: TCP
4. Save and apply

#### 4. Update mobile app

Open mobile app → ⚙️ gear icon → type `http://smartq-attendance.duckdns.org:5000` → Save

#### Verify it works

From a phone on **mobile data** (not WiFi), open the app and try clocking in. If it connects, internet access is working.

#### Troubleshooting

| Symptom | Fix |
|---|---|
| App times out / can't connect | Check port forwarding rule is saved on router |
| DuckDNS hostname doesn't resolve | Check scheduled task ran (`Task Scheduler` → `DuckDNS Update`) |
| Connection refused | Confirm the SmartQ firewall rule (Step 6 of this guide) is applied on the Target PC |
| Works on WiFi but not mobile data | ISP may be blocking the port — try an alternate external port (e.g. 8080 mapped to 5000 internally) |

---

### Step 13 — Verify Everything End-to-End

| Test | Expected result |
|---|---|
| Browser on Admin PC → `http://localhost:5000` | SmartQ login page |
| Login with SuperAdmin credentials | Dashboard loads, all nav items visible |
| Kiosk on Mini PC → launch app | Kiosk home screen, clock visible |
| Type an employee ID in kiosk | Success screen with employee name and photo |
| Mobile app → type ID | Success screen |
| Web admin → Search Attendance | Shows today's records |
| Web admin → Employee List | Shows all 5 employees |
| Reboot Admin PC | Server auto-restarts (NSSM), kiosk reconnects |

---

### Troubleshooting Quick Reference

| Symptom | Fix |
|---|---|
| `ODBC driver not found` on server start | Install `Firebird_ODBC_*_x64.exe` from firebirdsql.org |
| `Connection refused` on kiosk/mobile | Check IP in `config.json`, check firewall rule, check NSSM status |
| Blank kiosk screen | Check `config.json` path and serverUrl format (`http://` not `https://`) |
| Server starts but DB errors | Check `DB_DATABASE` path in `.env` (forward slashes, no quotes) |
| Admin login fails | Ensure `ATTENDANCE.FDB` from dev machine was copied (has credentials) |
| NSSM service not starting | Check Event Viewer → Windows Logs → Application for Node.js errors |

---

## 13. Known Issues & Gotchas

1. **ODBC driver must be installed**: If server fails to connect, the Firebird ODBC driver is not installed on this machine. Download and install from https://firebirdsql.org/en/odbc-driver/ (64-bit). No DSN entry needed.

2. **Uppercase column names**: Firebird ODBC returns column names in UPPERCASE. `normalizeRows()` in `db.ts` lowercases them. All route code expects lowercase.

3. **BLOB columns come back as Buffer**: `normalizeRows()` converts Buffer→UTF-8 string automatically.

4. **BigInt columns**: Firebird BIGINT returns as JS `BigInt`. `normalizeRows()` converts to `Number`. `JSON.stringify` would fail on raw `BigInt`.

5. **Date params to ODBC**: Use `serializeParams()` in `db.ts` — converts JS Date to `'YYYY-MM-DD HH:MM:SS'` string before binding.

6. **IDs are still managed manually**: No SEQUENCE/GENERATOR. `getNextAvailableId()` fills lowest available gap. Not race-safe, acceptable for single-office.

7. **STATUS = NULL convention**: Deliberately NULL for all kiosk-written records. `computeStatus()` derives at query time. Non-null STATUS = admin override. If inheriting old DB:
   ```sql
   UPDATE ATTENDANCE_LOGS SET STATUS = NULL;
   COMMIT;
   ```

8. **ONSITE requires prior clock-in**: 409 returned if no attendance record exists for today.

9. **ONSITE never gets OVERTIME**: `computeStatus()` caps TIME_OUT at 17:00 for ONSITE by design.

10. **Past-date ONSITE with no TIME_OUT**: 17:00 used as effective TIME_OUT for display only. DB not modified.

11. **JWT in localStorage**: Cleared on browser close. Admins need to re-login after session ends.

12. **Duplicate stale code**: After large edits, check for orphaned code (extra `return` statements, duplicate function bodies after closing `}`).

13. **Electron dev port**: Kiosk Vite dev server runs on **5174**. `electron:dev` expects it already running.

14. **Permanent employee deletion**: Also removes related ATTENDANCE_LOGS, ADMINS, ADMIN_CREDENTIALS rows.

15. **SuperAdmin bootstrap is unconditional**: `migrate.ts` step 7 always ensures Jonathan Gurap (ID `2649694555`) is SUPERADMIN on every server start.

16. **adminRole must be in localStorage**: If missing, user is treated as ADMIN with no SuperAdmin nav. Fix: log out and log back in.

17. **Module resolution**: Server uses ESM. Imports must use `.js` extensions even for `.ts` source files.

18. **Mobile app server URL default**: Default is `http://192.168.1.1:5000` (router IP). Must be changed in Settings screen to actual server IP before use.

19. **Mobile internet access**: Currently WiFi-only. To enable remote access: use ngrok, port forwarding + DuckDNS, or Cloudflare Tunnel. No code changes needed — just update the Settings URL.

---

## 14. File Tree Reference

```
smartqweb/
├── .env.production                 ← VITE_API_BASE_URL=/api (for production build)
├── server/
│   ├── .env                        ← DB path, JWT secret, PORT=5000 (create on target PC)
│   ├── package.json                ← "start": "NODE_ENV=production node dist/index.js"
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts                ← App entrypoint; in production serves dist/ + catch-all
│       ├── config.ts               ← Reads .env, exports config object
│       ├── db.ts                   ← ODBC pool, normalizeRows, serializeParams, query/execute
│       ├── migrate.ts              ← 7-step idempotent migrations (run at startup)
│       ├── auth.ts                 ← signup (pending flow), login (returns adminRole), generateToken
│       ├── middleware.ts           ← authenticate + requireSuperAdmin
│       ├── routes.ts               ← /api/auth router
│       ├── employees.ts            ← Employee interface + DB functions
│       ├── employeeRoutes.ts       ← /api/employees CRUD (JWT required)
│       ├── employeeId.ts           ← Shared BIGINT ID parsing helpers
│       ├── kioskRoutes.ts          ← /api/kiosk (no JWT — used by kiosk AND mobile app)
│       ├── attendanceRoutes.ts     ← /api/attendance (JWT required)
│       ├── leaveRoutes.ts          ← /api/leaves (GET, POST /assign, PATCH /balance)
│       ├── holidayRoutes.ts        ← /api/holidays (GET, POST, DELETE)
│       └── superadminRoutes.ts     ← /api/superadmin/requests (list/approve/reject)
├── database/
│   ├── ATTENDANCE.FDB              ← ACTUAL database
│   └── schema.sql                  ← Reference schema
└── src/app/
    ├── routes.tsx
    └── components/
        ├── Layout.tsx
        ├── LoginPage.tsx
        ├── SignUpPage.tsx
        ├── EmployeeList.tsx
        ├── TimeInOut.tsx
        ├── SearchAttendance.tsx
        ├── GenerateReports.tsx     ← PDF via window.open() new window
        ├── ManualLogout.tsx
        ├── AdminApproval.tsx
        ├── HolidayManager.tsx
        └── LeaveManager.tsx

attendance-system/
├── electron/
│   ├── main.cjs                    ← Reads userData/config.json for serverUrl
│   └── preload.cjs                 ← Exposes window.kioskConfig.serverUrl
├── release/
│   └── Attendance Kiosk Setup 0.0.1.exe   ← ~80 MB NSIS installer
└── src/app/components/
    └── KioskHome.tsx

mob_attendance/                     ← Flutter mobile app (fully wired to Express API)
└── lib/main.dart                   ← Settings screen for runtime server URL; zero Dart errors
```
