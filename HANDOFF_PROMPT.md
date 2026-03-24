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

Frontend API bases are now environment-driven, not hardcoded:

- `smartqweb/src/imports/api.ts` uses `VITE_API_BASE_URL` with fallback `http://localhost:5000/api`
- `attendance-system/src/imports/api.ts` uses `VITE_KIOSK_API_BASE_URL` or `VITE_API_BASE_URL`, with fallback `http://localhost:5000/api/kiosk`

In development this still behaves like:

- admin web → backend at `http://localhost:5000/api`
- kiosk app → backend kiosk routes at `http://localhost:5000/api/kiosk`

The still-pending production deployment work is to make the admin app run from a single backend-served port and to package the kiosk so it launches like a normal installed app.

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
  EMPLOYEE_ID BIGINT PRIMARY KEY,
    NAME VARCHAR(255),                    -- NOT NULL was dropped
    ROLE VARCHAR(100),                    -- renamed from DEPARTMENT
    PICTURE BLOB SUB_TYPE TEXT,           -- added; stores base64 data URL
  QR_CODE BLOB SUB_TYPE TEXT,           -- added; stores QR image data URL
    STATUS VARCHAR(20) DEFAULT 'ACTIVE',
    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ADMINS (
    ADMIN_ID INTEGER PRIMARY KEY,
  EMPLOYEE_ID BIGINT NOT NULL UNIQUE,
    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (EMPLOYEE_ID) REFERENCES EMPLOYEES(EMPLOYEE_ID)
);

CREATE TABLE ADMIN_CREDENTIALS (
    CREDENTIAL_ID INTEGER PRIMARY KEY,
  EMPLOYEE_ID BIGINT NOT NULL UNIQUE,
    PASSWORD_HASH VARCHAR(255) NOT NULL,
    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (EMPLOYEE_ID) REFERENCES EMPLOYEES(EMPLOYEE_ID)
);

CREATE TABLE ATTENDANCE_LOGS (
    LOG_ID INTEGER PRIMARY KEY,
  EMPLOYEE_ID BIGINT NOT NULL,
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

> NOTE: live schema and source schema are aligned for the current handoff state. The `BIGINT` employee ID migration and the `QR_CODE` column migration have already been applied to the live `ATTENDANCE.FDB` used during development.

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
- Exports: `initializeDbPool()`, `query<T>(sql, params)`, `execute(sql, params)`, `getNextAvailableId(table, column)`
- Has `resolveBlobs()` — BLOB fields in node-firebird return as callback functions; this resolves them to UTF-8 strings before returning rows
- `getNextAvailableId()` now fills the **lowest missing numeric gap** for manual integer-key tables instead of using `MAX(ID) + 1`

### `config.ts`
- Reads from `.env`. Key defaults: `PORT=5000`, `DB_DATABASE=C:/Users/JD/Documents/smartqproj/smartqweb/database/ATTENDANCE.FDB`, `DB_USER=SYSDBA`, `DB_PASSWORD=masterkey`, `CORS_ORIGIN=http://localhost:5173`

### `auth.ts`
- `signup(employeeIdStr, password)`: Restricted to valid admin signup paths only.
  - Existing EMPLOYEE_ID may sign up only if its EMPLOYEES.ROLE is already `ADMIN`
  - First-account bootstrap is still allowed only when there are no rows yet in `ADMIN_CREDENTIALS`
  - Creates ADMINS + ADMIN_CREDENTIALS rows and returns JWT
- `login(employeeIdStr, password)`: Verifies EMPLOYEES exists, requires both `ROLE='ADMIN'` and an ADMINS row, checks ADMIN_CREDENTIALS, returns JWT.
- `verifyAdminPassword(employeeId, password)`: Used by destructive employee delete flow to require second-factor confirmation from the logged-in admin
- Uses shared numeric parsing from `employeeId.ts` so large IDs are accepted safely as long as they are positive safe integers

### `employeeId.ts`
- Central employee ID parsing helper
- `parseEmployeeId(value)` accepts digit-only positive IDs and rejects invalid/non-safe-integer values
- `normalizeEmployeeId(value)` truncates a provided numeric value for controlled updates/inserts

### `middleware.ts`
- `authenticate`: Extracts Bearer token from `Authorization` header, verifies JWT. Sets `req.user`. Returns 401 if missing/invalid.

### `employees.ts`
- Interface: `{ id: number, name: string, role: string, picture: string | null, qrCode: string | null, status: string }`
- `getAllEmployees()`, `getEmployeeById(id)`, `createEmployee({ id?, name, role? })`, `updateEmployee(id, { employeeId?, name?, role?, picture?, qrCode? })`, `deleteEmployee(id)`
- Employee creation reuses the **lowest available free EMPLOYEE_ID** unless a manual employee ID is supplied
- Employee updates can now change `EMPLOYEE_ID`; related rows in ATTENDANCE_LOGS, ADMINS, and ADMIN_CREDENTIALS are migrated to the new ID
- If an employee ID changes, stored QR code is cleared unless a replacement QR is explicitly supplied
- Employee deletion is **permanent DB deletion**, not soft delete; it also removes related ATTENDANCE_LOGS, ADMINS, and ADMIN_CREDENTIALS rows
- Employee IDs are `BIGINT` in DB and are handled in code as positive safe integers

### `employeeRoutes.ts`
- All routes require JWT (`authenticate` middleware)
- `GET /api/employees` — list all
- `POST /api/employees` — `{ employeeId?, name, role }` → create
- `PUT /api/employees/:id` — `{ employeeId?, name?, role?, picture?, qrCode? }` → update
- `DELETE /api/employees/:id` — permanent delete
  - Requires body `{ password }`
  - Verifies the currently logged-in admin password before deleting
- If the logged-in admin changes their own employee ID, the route returns a fresh JWT so the current session stays valid

### `kioskRoutes.ts`
- **No JWT auth** (public kiosk device)
- `GET /api/kiosk/employee/:id` — returns employee or 404/403 (inactive)
- `POST /api/kiosk/attendance` — body: `{ employeeId: number | string, action: 'IN' | 'OUT', location: 'OFFICE' | 'ONSITE', site?: string }`
  - **Regular IN (location=OFFICE)**: Inserts new ATTENDANCE_LOGS row with STATUS=NULL. 409 if already clocked in today.
  - **OUT**: Updates TIME_OUT and STATUS=NULL (status computed dynamically). 409 if no clock-in or already clocked out.
  - **Onsite service (action=IN, location=ONSITE)**: Updates LOCATION and SITE on the **existing** record only — does NOT create a new row. Returns 409 "Employee has not clocked in yet" if no record exists for today. Cannot create a fresh ONSITE record; employee must first scan their RFID (creates OFFICE record), then use Onsite Service to update.
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

### `LoginPage.tsx` / `SignUpPage.tsx`
- POST to `/api/auth/login` and `/api/auth/signup`
- JWT stored in `localStorage` as `authToken`
- Non-admin employee IDs are blocked from both login and signup paths
- API base now comes from `src/imports/api.ts` instead of component-local hardcoded localhost strings

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

### `Layout.tsx`
- App shell with sidebar navigation
- Upper-right admin avatar now reflects the logged-in admin's `PICTURE` from EMPLOYEES and refreshes after photo changes in EmployeeList
- Uses the current `picture` field shape, not the older `profilePicture` name

---

## 8. Kiosk App — `attendance-system/src/app/components/KioskHome.tsx`

- All localStorage/mock data removed. Fully API-driven.
- API base is environment-driven through `attendance-system/src/imports/api.ts`
- Default dev fallback remains `http://localhost:5000/api/kiosk`
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
- Electron dev wiring has been corrected to use the kiosk Vite port `5174`, and `electron:dev` now attaches to an already-running kiosk dev server instead of starting a second Vite instance
- The kiosk is still a development flow until packaged; production installer/distribution is still pending

> NOTE: The kiosk flow is implemented and testable by typed ID input, but it has **not yet been validated against a real RFID reader device** in this handoff phase.

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
- [x] Electron dev mode fixed: correct kiosk port (`5174`) and reliable `!app.isPackaged` dev detection
- [x] Employee deletion now permanently removes rows from DB and reuses freed employee IDs on later inserts
- [x] Employee delete requires second confirmation via admin password re-entry
- [x] Admin avatar in web header reflects the admin employee photo from DB
- [x] Admin auth hardened so non-admin employee IDs cannot gain access through login or signup
- [x] Employee IDs expanded to `BIGINT` in source schema and live Firebird DB
- [x] Shared employee ID parsing added across auth, employee, kiosk, and attendance routes
- [x] Manual employee ID insert/edit support added in EmployeeList and backend
- [x] Frontend API bases moved to env-backed helpers instead of hardcoded localhost strings
- [x] QR generation, persistence, preview, and printing added to EmployeeList
- [x] Live DB migration to add `EMPLOYEES.QR_CODE` completed and verified

---

## 10. Pending Tasks

The system is feature-complete enough for core attendance use, but these are the important remaining items before calling deployment finished.

### STEP — Real RFID Validation

The kiosk flow works in code and in typed-input testing, but real scanner behavior is still not locked down.

Validation still needed:
1. Test with the actual RFID reader in keyboard-emulation mode
2. Confirm suffix behavior such as automatic `Enter`, timing, and focus stability
3. Confirm whether the raw scanned identifier should remain a numeric employee ID or whether a separate RFID/string field is needed

Important current behavior:
1. The backend now validates IDs through `parseEmployeeId()` rather than loose `parseInt()` usage
2. Employee IDs are still treated as numeric values even after the `BIGINT` migration
3. Leading-zero RFID strings are still a business-rule decision, not yet finalized

### STEP — QR Scanner Validation

Admin-side QR generation/storage is already implemented. What is still pending is validating how the target QR scanner behaves and whether kiosk-side scanning should read:

1. Plain employee ID only
2. A richer payload in the future

The safest current assumption is to keep QR payloads as employee ID only until the target scanner hardware is tested.

### STEP — Single-Port Admin Runtime

This is the main remaining web deployment task.

Goal:
1. Visiting one localhost port on the target PC should open the working admin app
2. No separate Vite frontend terminal should be needed in production

Target shape:
1. Build `smartqweb`
2. Serve its built assets from the Express backend in production
3. Keep development mode split as it is today, but collapse production into one backend-served runtime

### STEP — Packaged Kiosk Application

This is the main remaining kiosk deployment task.

Goal:
1. The kiosk should run like a normal installed app
2. The user should not need VS Code or a dev server to open it

Current status:
1. Electron dev flow is fixed
2. `npm run electron:build` exists
3. Production packaging and target-PC validation are still pending

### STEP — Laptop To Target-PC Transition

This deployment handoff is still partially procedural and should be treated as active remaining work.

Target-PC checklist:
1. Install Node.js
2. Install Firebird 5 and apply the same `firebird.conf` compatibility changes
3. Copy the working `ATTENDANCE.FDB` with its populated employee/admin data
4. Copy the application repositories or release artifacts
5. Configure production API base values for the kiosk and admin runtime
6. Run the backend as the host process for the admin app
7. Install the packaged kiosk app on the kiosk machine

The intended end state is:
1. Admin app: one port, one backend process
2. Kiosk app: one installed application
3. Database: copied with the existing employee/RFID data already loaded
4. No requirement to manually open four development terminals on the destination system

### STEP — End-to-End Smoke Test

Before running, if inheriting an old DB, reset stored statuses:
```sql
UPDATE ATTENDANCE_LOGS SET STATUS = NULL;
COMMIT;
```

Test checklist:
1. Start the current development stack:
   - `cd smartqweb/server && npm run dev`
   - `cd smartqweb && npm run dev`
   - `cd attendance-system && npm run dev`
2. Verify admin login/signup still works only for admin-role employees
3. Add or edit an employee with manual ID, photo, and QR generation
4. On kiosk, scan/type the employee ID and verify IN then OUT flow
5. Verify SearchAttendance and GenerateReports show correct status, location, site, and late-state behavior
6. Verify printed QR scans correctly with intended hardware

### STEP — Facial Recognition

Facial recognition is intentionally last.

Do not begin it until:
1. single-port admin deployment is done
2. packaged kiosk deployment is done
3. real RFID and QR hardware behavior are validated
4. the copied database flow on the target PC is stable

---

## 11. Known Issues & Gotchas

1. **Firebird WireCrypt**: If server throws `gdscode 335544472` ("username and password not defined"), the `firebird.conf` fix was not applied or the service was not restarted.

2. **BLOB resolver**: `node-firebird` returns BLOB columns as async callback functions, not values. The `resolveBlobs()` function in `db.ts` handles this. Any new query returning a BLOB column (like `PICTURE`) must go through `query()` which already calls `resolveBlobs`.

3. **IDs are still managed manually**: No SEQUENCE/GENERATOR is used. The code now uses shared gap-filling logic through `getNextAvailableId()` so the lowest missing numeric ID is reused. This is still not race-safe, but acceptable for the current single-office deployment model.

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

10. **Electron dev startup model**: `attendance-system` kiosk runs on port **5174**. Current `electron:dev` expects the kiosk Vite dev server to already be running, then launches Electron against it.

11. **Permanent employee deletion**: Deleting an employee now removes related attendance logs and admin credential/admin rows. This is intentional but destructive; do not assume old soft-delete semantics.

12. **Admin avatar source**: The web header avatar reads from EMPLOYEES.PICTURE via `/api/employees`, not from a separate profile store.

13. **Module resolution**: Server uses `"type": "module"` in `package.json` so all imports must use `.js` extensions (e.g. `import { query } from './db.js'` even though the source file is `.ts`). TypeScript handles this via `moduleResolution: node`.

14. **Generated files should not be committed**: `node_modules/`, `dist/`, and local DB backup `.bak` files are local artifacts. Keep repo commits focused on source, migration scripts, and documentation.

15. **Live DB transfer is separate from source control**: the working `ATTENDANCE.FDB` is part of deployment handoff data, not something to rely on as the primary transport mechanism inside git history.

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
