const normalizeBaseUrl = (value: string): string => value.replace(/\/+$/, '');

const configuredApiBase = import.meta.env.VITE_API_BASE_URL?.trim();

export const API_BASE = normalizeBaseUrl(
  configuredApiBase && configuredApiBase.length > 0
    ? configuredApiBase
    : 'http://localhost:5000/api'
);

export const KIOSK_API_BASE = `${API_BASE}/kiosk`;