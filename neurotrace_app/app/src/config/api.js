const DEV_API_URL = 'http://localhost:8000';
const PROD_API_URL = 'https://api.tremora.app';

const fallbackBaseUrl = import.meta.env.PROD ? PROD_API_URL : DEV_API_URL;

export const API_BASE_URL = (import.meta.env.VITE_API_URL || fallbackBaseUrl).replace(/\/+$/, '');

export function apiUrl(path = '') {
  if (!path) return API_BASE_URL;
  const normalisedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalisedPath}`;
}
