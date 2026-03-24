export const parseEmployeeId = (value: unknown): number | null => {
  const normalized = String(value ?? '').trim();

  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

export const normalizeEmployeeId = (value: number): number => Math.trunc(value);