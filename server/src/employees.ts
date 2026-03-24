import { query, execute, getNextAvailableId } from './db.js';
import { normalizeEmployeeId } from './employeeId.js';

export interface Employee {
  id: number;
  name: string;
  role: string;
  picture: string | null;
  qrCode: string | null;
  status: string;
}

export const getAllEmployees = async (): Promise<Employee[]> => {
  const rows = await query<any>(
    'SELECT EMPLOYEE_ID, NAME, ROLE, PICTURE, QR_CODE, STATUS FROM EMPLOYEES ORDER BY NAME'
  );
  return rows.map((r) => ({
    id: r.employee_id,
    name: r.name ?? '',
    role: r.role ?? '',
    picture: r.picture ?? null,
    qrCode: r.qr_code ?? null,
    status: r.status ?? 'ACTIVE',
  }));
};

export const getEmployeeById = async (id: number): Promise<Employee | null> => {
  const rows = await query<any>(
    'SELECT EMPLOYEE_ID, NAME, ROLE, PICTURE, QR_CODE, STATUS FROM EMPLOYEES WHERE EMPLOYEE_ID = ?',
    [id]
  );
  if (!rows.length) return null;
  const r = rows[0];
  return {
    id: r.employee_id,
    name: r.name ?? '',
    role: r.role ?? '',
    picture: r.picture ?? null,
    qrCode: r.qr_code ?? null,
    status: r.status ?? 'ACTIVE',
  };
};

export const createEmployee = async (data: {
  id?: number;
  name: string;
  role?: string;
}): Promise<Employee> => {
  const requestedId = data.id !== undefined ? normalizeEmployeeId(data.id) : undefined;
  const newId = requestedId ?? await getNextAvailableId('EMPLOYEES', 'EMPLOYEE_ID');

  if (!Number.isSafeInteger(newId) || newId <= 0) {
    throw new Error('Employee ID must be a positive integer');
  }

  const existing = await getEmployeeById(newId);
  if (existing) {
    throw new Error('Employee ID already exists');
  }

  await execute(
    'INSERT INTO EMPLOYEES (EMPLOYEE_ID, NAME, ROLE, STATUS) VALUES (?, ?, ?, ?)',
    [newId, data.name, data.role ?? null, 'ACTIVE']
  );
  return {
    id: newId,
    name: data.name,
    role: data.role ?? '',
    picture: null,
    qrCode: null,
    status: 'ACTIVE',
  };
};

export const updateEmployee = async (
  id: number,
  data: Partial<{ employeeId: number; name: string; role: string; picture: string | null; qrCode: string | null }>
): Promise<Employee | null> => {
  const existing = await getEmployeeById(id);
  if (!existing) return null;

  const requestedEmployeeId = data.employeeId !== undefined
    ? normalizeEmployeeId(data.employeeId)
    : existing.id;

  if (!Number.isSafeInteger(requestedEmployeeId) || requestedEmployeeId <= 0) {
    throw new Error('Employee ID must be a positive integer');
  }

  if (requestedEmployeeId !== existing.id) {
    const duplicate = await getEmployeeById(requestedEmployeeId);
    if (duplicate) {
      throw new Error('Employee ID already exists');
    }
  }

  const updated = {
    id: requestedEmployeeId,
    name: data.name ?? existing.name,
    role: data.role ?? existing.role,
    picture: data.picture !== undefined ? data.picture : existing.picture,
    qrCode:
      data.qrCode !== undefined
        ? data.qrCode
        : requestedEmployeeId !== existing.id
        ? null
        : existing.qrCode,
  };

  if (updated.id !== existing.id) {
    await execute(
      'INSERT INTO EMPLOYEES (EMPLOYEE_ID, NAME, ROLE, PICTURE, QR_CODE, STATUS, CREATED_AT) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [updated.id, updated.name, updated.role || null, updated.picture || null, updated.qrCode || null, existing.status, new Date()]
    );

    await execute('UPDATE ATTENDANCE_LOGS SET EMPLOYEE_ID = ? WHERE EMPLOYEE_ID = ?', [updated.id, existing.id]);
    await execute('UPDATE ADMINS SET EMPLOYEE_ID = ? WHERE EMPLOYEE_ID = ?', [updated.id, existing.id]);
    await execute('UPDATE ADMIN_CREDENTIALS SET EMPLOYEE_ID = ? WHERE EMPLOYEE_ID = ?', [updated.id, existing.id]);
    await execute('DELETE FROM EMPLOYEES WHERE EMPLOYEE_ID = ?', [existing.id]);

    return {
      id: updated.id,
      name: updated.name,
      role: updated.role,
      picture: updated.picture,
      qrCode: updated.qrCode,
      status: existing.status,
    };
  }

  await execute(
    'UPDATE EMPLOYEES SET NAME = ?, ROLE = ?, PICTURE = ?, QR_CODE = ? WHERE EMPLOYEE_ID = ?',
    [updated.name, updated.role || null, updated.picture || null, updated.qrCode || null, id]
  );

  return {
    id: existing.id,
    name: updated.name,
    role: updated.role,
    picture: updated.picture,
    qrCode: updated.qrCode,
    status: existing.status,
  };
};

export const deleteEmployee = async (id: number): Promise<boolean> => {
  const existing = await getEmployeeById(id);
  if (!existing) return false;

  await execute('DELETE FROM ATTENDANCE_LOGS WHERE EMPLOYEE_ID = ?', [id]);
  await execute('DELETE FROM ADMIN_CREDENTIALS WHERE EMPLOYEE_ID = ?', [id]);
  await execute('DELETE FROM ADMINS WHERE EMPLOYEE_ID = ?', [id]);
  await execute('DELETE FROM EMPLOYEES WHERE EMPLOYEE_ID = ?', [id]);

  return true;
};

