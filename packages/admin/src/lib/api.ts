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

/** A zod-issue-aware error so admin forms can render per-field errors.
 * `issues` is the raw `parsed.error.issues` array the API returns on
 * 400 — each issue has `path: (string|number)[]` and `message`. */
export interface ZodIssue {
  path: (string | number)[]
  message: string
  code?: string
}
export class ApiError extends Error {
  status: number
  issues?: ZodIssue[]
  constructor(status: number, message: string, issues?: ZodIssue[]) {
    super(message)
    this.status = status
    this.issues = issues
  }
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
    throw new ApiError(401, 'Unauthorized');
  }
  if (!res.ok) {
    let body: { error?: string; issues?: ZodIssue[] } = {}
    try {
      body = await res.json()
    } catch {
      // non-JSON error body — fall through with empty
    }
    throw new ApiError(res.status, body.error || `API error ${res.status}`, body.issues)
  }
  return res.json() as Promise<T>;
}

/** Find the first error message for a given form-field path within a
 * thrown ApiError. Returns undefined if there's no error there.
 * Pass the dotted/array path the form uses, e.g. `['description', 'nl']`
 * or `'name'`. */
export function fieldErrorAt(
  err: unknown,
  path: string | (string | number)[],
): string | undefined {
  if (!(err instanceof ApiError) || !err.issues) return undefined
  const target = Array.isArray(path) ? path : [path]
  const hit = err.issues.find((i) => {
    if (i.path.length < target.length) return false
    return target.every((seg, idx) => String(i.path[idx]) === String(seg))
  })
  return hit?.message
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

// Shop Items
export function fetchShopItems() {
  return fetchJson<any[]>(`/api/admin/events/${slug}/shop-items`);
}
export function createShopItem(data: any) {
  return fetchJson(`/api/admin/events/${slug}/shop-items`, { method: 'POST', body: JSON.stringify(data) });
}
export function updateShopItem(id: string, data: any) {
  return fetchJson(`/api/admin/events/${slug}/shop-items/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}
export function deleteShopItem(id: string) {
  return fetchJson(`/api/admin/events/${slug}/shop-items/${id}`, { method: 'DELETE' });
}

// Admin user management
export interface AdminUser {
  id: string
  email: string
  displayName?: string
  lastLoginAt?: string
  disabled?: boolean
  createdAt: string
}
export function fetchMe() {
  return fetchJson<AdminUser>('/api/admin/me')
}
export function updateMe(displayName: string) {
  return fetchJson<AdminUser>('/api/admin/me', {
    method: 'PUT',
    body: JSON.stringify({ displayName }),
  })
}
export function changeOwnPassword(currentPassword: string, newPassword: string) {
  return fetchJson<{ ok: boolean }>('/api/admin/me/password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  })
}
export function fetchAdmins() {
  return fetchJson<AdminUser[]>('/api/admin/users')
}
export function createAdminUser(data: {
  email: string
  displayName?: string
  password: string
}) {
  return fetchJson<AdminUser>('/api/admin/users', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}
export function updateAdminUser(
  id: string,
  data: { displayName?: string; disabled?: boolean },
) {
  return fetchJson<AdminUser>(`/api/admin/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}
export function resetUserPassword(id: string, newPassword: string) {
  return fetchJson<{ ok: boolean }>(`/api/admin/users/${id}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ newPassword }),
  })
}
export function deleteAdminUser(id: string) {
  return fetchJson<{ ok: boolean }>(`/api/admin/users/${id}`, { method: 'DELETE' })
}

// Rooms (read-only, derived from run.events agenda)
export interface RoomEntry {
  guid: string
  name: string
  sessionCount: number
}
export function fetchRooms() {
  return fetchJson<RoomEntry[]>(`/api/admin/events/${slug}/rooms`)
}

// Trash (soft-deleted records)
export type TrashTarget = 'sponsors' | 'sponsor-tiers' | 'floor-maps' | 'shop-items'
export interface TrashBundle {
  sponsors: Array<{ id: string; name: string; deletedAt?: string }>
  'sponsor-tiers': Array<{ id: string; name: string; deletedAt?: string }>
  'floor-maps': Array<{ id: string; name: string; deletedAt?: string; hotspots?: unknown[] }>
  'shop-items': Array<{ id: string; name: string; deletedAt?: string }>
}
export function fetchTrash() {
  return fetchJson<TrashBundle>(`/api/admin/events/${slug}/trash`)
}
export function restoreFromTrash(target: TrashTarget, id: string) {
  return fetchJson<{ ok: boolean }>(
    `/api/admin/events/${slug}/trash/${target}/${id}/restore`,
    { method: 'POST' },
  )
}
export function permanentDelete(target: TrashTarget, id: string) {
  return fetchJson<{ ok: boolean }>(
    `/api/admin/events/${slug}/trash/${target}/${id}`,
    { method: 'DELETE' },
  )
}

// Cache + readiness (dashboard)
export interface CacheStatusEntry {
  key: string
  expiresAt: number
  remainingMs: number
}
export function fetchCacheStatus() {
  return fetchJson<{ now: number; entries: CacheStatusEntry[] }>('/api/admin/cache')
}
export function refreshCache() {
  return fetchJson<{ ok: boolean; cleared: number }>('/api/admin/cache/refresh', {
    method: 'POST',
  })
}

export interface ReadinessCheck {
  id: string
  label: string
  status: 'ok' | 'warn' | 'fail'
  detail: string
}
export function fetchReadiness() {
  return fetchJson<{ checks: ReadinessCheck[]; i18nOverrideCount: number }>(
    `/api/admin/events/${slug}/readiness`,
  )
}

// Audit log
export interface AuditEntry {
  id: string
  eventSlug: string
  ts: number
  actor: string
  action: string
  target: string
  recordId?: string
  summary: string
  meta?: Record<string, unknown>
}
export function fetchAuditLog(limit = 50) {
  return fetchJson<AuditEntry[]>(`/api/admin/events/${slug}/audit-log?limit=${limit}`)
}

// Snapshots (Cosmos backup blobs)
export interface SnapshotMeta {
  name: string
  capturedAt: string
  capturedBy: string
  reason?: string
  sizeBytes: number
}
export function fetchSnapshots() {
  return fetchJson<SnapshotMeta[]>(`/api/admin/events/${slug}/snapshots`)
}
export function takeSnapshot(reason?: string) {
  return fetchJson<SnapshotMeta>(`/api/admin/events/${slug}/snapshots`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}
export function restoreSnapshot(name: string) {
  return fetchJson<{ restored: Record<string, number>; preRestoreSnapshot: string }>(
    `/api/admin/events/${slug}/snapshots/${encodeURIComponent(name)}/restore`,
    { method: 'POST' },
  )
}
export function deleteSnapshot(name: string) {
  return fetchJson<{ ok: boolean }>(
    `/api/admin/events/${slug}/snapshots/${encodeURIComponent(name)}`,
    { method: 'DELETE' },
  )
}

// Analytics — extra reports
export interface HourlySeriesPoint {
  bucket: string // e.g. "2026-06-02T14"
  events: number
  pageviews: number
}
export interface HourlyResponse {
  now: number
  hours: number
  tz: string
  series: HourlySeriesPoint[]
}
export function fetchHourly(hours = 24) {
  return fetchJson<HourlyResponse>(`/api/admin/analytics/hourly?hours=${hours}`)
}

export interface HotspotTap {
  hotspotId: string
  mapId?: string
  roomName?: string
  count: number
}
export function fetchHotspotHeatmap() {
  return fetchJson<{ since: number; taps: HotspotTap[] }>(
    '/api/admin/analytics/hotspot-heatmap',
  )
}

export interface SearchFunnel {
  since: number
  searches: number
  noResults: number
  resultTaps: number
}
export function fetchSearchFunnel() {
  return fetchJson<SearchFunnel>('/api/admin/analytics/search-funnel')
}

export interface LangSplit {
  since: number
  langs: { lang: string; count: number }[]
}
export function fetchLanguageSplit() {
  return fetchJson<LangSplit>('/api/admin/analytics/language-split')
}

export interface KioskTimeline {
  since: number
  hours: number
  events: { kioskId: string; ts: number; path?: string }[]
}
export function fetchKioskTimeline(hours = 6) {
  return fetchJson<KioskTimeline>(
    `/api/admin/analytics/kiosk-timeline?hours=${hours}`,
  )
}

// Analytics
export interface AnalyticsSummary {
  now: number
  totalLastHour: number
  perKiosk: { kioskId: string; count: number }[]
  topSessions: { sessionId: number; count: number; title?: string }[]
  searchNoResults: { len: number; count: number }[]
  lastHeartbeats: Record<string, number>
}
export function fetchAnalyticsSummary() {
  return fetchJson<AnalyticsSummary>('/api/admin/analytics/summary')
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
