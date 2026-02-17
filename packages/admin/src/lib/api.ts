const BASE_URL = import.meta.env.VITE_API_URL || '';

function getToken(): string | null {
  return localStorage.getItem('ziggy_admin_token');
}

export function setToken(token: string) {
  localStorage.setItem('ziggy_admin_token', token);
}

export function clearToken() {
  localStorage.removeItem('ziggy_admin_token');
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

async function fetchJson<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options?.headers as Record<string, string>) || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  if (res.status === 401) {
    clearToken();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json() as Promise<T>;
}

// Auth
export function login(email: string, password: string) {
  return fetchJson<{ token: string; expiresAt: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function setupAdmin(email: string, password: string) {
  return fetchJson<{ token: string; expiresAt: string }>('/api/auth/setup', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

// Sponsors
const slug = 'experts-live-netherlands-2026';

export function fetchSponsors() {
  return fetchJson<any[]>(`/api/admin/events/${slug}/sponsors`);
}
export function createSponsor(data: any) {
  return fetchJson(`/api/admin/events/${slug}/sponsors`, { method: 'POST', body: JSON.stringify(data) });
}
export function updateSponsor(id: string, data: any) {
  return fetchJson(`/api/admin/events/${slug}/sponsors/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}
export function deleteSponsor(id: string) {
  return fetchJson(`/api/admin/events/${slug}/sponsors/${id}`, { method: 'DELETE' });
}

// Sponsor Tiers
export function fetchSponsorTiers() {
  return fetchJson<any[]>(`/api/admin/events/${slug}/sponsor-tiers`);
}
export function createSponsorTier(data: any) {
  return fetchJson(`/api/admin/events/${slug}/sponsor-tiers`, { method: 'POST', body: JSON.stringify(data) });
}
export function updateSponsorTier(id: string, data: any) {
  return fetchJson(`/api/admin/events/${slug}/sponsor-tiers/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}
export function deleteSponsorTier(id: string) {
  return fetchJson(`/api/admin/events/${slug}/sponsor-tiers/${id}`, { method: 'DELETE' });
}

// Floor Maps
export function fetchFloorMaps() {
  return fetchJson<any[]>(`/api/admin/events/${slug}/floor-maps`);
}
export function createFloorMap(data: any) {
  return fetchJson(`/api/admin/events/${slug}/floor-maps`, { method: 'POST', body: JSON.stringify(data) });
}
export function updateFloorMap(id: string, data: any) {
  return fetchJson(`/api/admin/events/${slug}/floor-maps/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}
export function deleteFloorMap(id: string) {
  return fetchJson(`/api/admin/events/${slug}/floor-maps/${id}`, { method: 'DELETE' });
}
export async function fetchFloorMap(id: string) {
  const maps = await fetchFloorMaps();
  const map = maps.find((m: any) => m.id === id);
  if (!map) throw new Error('Floor map not found');
  return map;
}

// Upload
export async function uploadImage(file: File): Promise<{ url: string }> {
  const token = getToken();
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${BASE_URL}/api/admin/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (res.status === 401) {
    clearToken();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return res.json();
}

// Event Config
export function fetchEventConfig() {
  return fetchJson<any>(`/api/admin/events/${slug}/config`);
}
export function updateEventConfig(data: any) {
  return fetchJson(`/api/admin/events/${slug}/config`, { method: 'PUT', body: JSON.stringify(data) });
}

// I18n Overrides
export function fetchI18nOverrides() {
  return fetchJson<any[]>(`/api/admin/events/${slug}/i18n-overrides`);
}
export function updateI18nOverrides(lang: string, overrides: Record<string, string>) {
  return fetchJson(`/api/admin/events/${slug}/i18n-overrides/${lang}`, {
    method: 'PUT',
    body: JSON.stringify({ overrides }),
  });
}
