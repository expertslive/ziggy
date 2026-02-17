const BASE_URL = import.meta.env.VITE_API_URL || '';

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// Types matching run.events API responses (proxied through our Hono API)

export interface SpeakerRef {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  tagline?: string;
  profilePicture?: string;
}

export interface Session {
  id: string;
  title: string;
  description?: string;
  abstract?: string;
  startsAt: string;
  endsAt: string;
  room?: string;
  roomId?: string;
  track?: string;
  level?: string;
  labels?: string[];
  speakers?: SpeakerRef[];
}

export interface Timeslot {
  startsAt: string;
  endsAt: string;
  sessions: Session[];
}

export interface AgendaDay {
  date: string;
  timeslots: Timeslot[];
}

export interface Agenda {
  days: AgendaDay[];
}

export interface Speaker {
  id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  fullName: string;
  tagline?: string;
  biography?: string;
  profilePicture?: string;
  sessions?: SessionRef[];
  labels?: string[];
}

export interface SessionRef {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  room?: string;
}

export interface Booth {
  id: string;
  name: string;
  description?: string;
  boothNumber?: string;
  location?: string;
  organization?: string;
  logoUrl?: string;
  website?: string;
}

export interface Sponsor {
  id: string;
  name: string;
  tierId: string;
  logoUrl: string;
  website?: string;
  boothNumber?: string;
  description: Record<string, string>;
  sortOrder: number;
}

export interface FloorMap {
  id: string;
  name: string;
  imageUrl: string;
  label: Record<string, string>;
  hotspots: Array<{
    id: string;
    roomName: string;
    label: Record<string, string>;
    points: [number, number][];
  }>;
}

export interface EventConfig {
  slug: string;
  name: string;
  timezone: string;
  languages: string[];
  defaultLanguage: string;
  branding: {
    primaryColor: string;
    secondaryColor: string;
    backgroundColor: string;
    textColor: string;
    logoUrl?: string;
    fontFamily?: string;
  };
  days: Array<{
    date: string;
    label: Record<string, string>;
  }>;
}

export function fetchAgenda(slug: string): Promise<Agenda> {
  return fetchJson<Agenda>(`/api/events/${slug}/agenda`);
}

export function fetchNowSessions(slug: string): Promise<Session[]> {
  return fetchJson<Session[]>(`/api/events/${slug}/sessions/now`);
}

export function fetchSpeakers(slug: string): Promise<Speaker[]> {
  return fetchJson<Speaker[]>(`/api/events/${slug}/speakers`);
}

export function fetchBooths(slug: string): Promise<Booth[]> {
  return fetchJson<Booth[]>(`/api/events/${slug}/booths`);
}

export function fetchSearch(slug: string, query: string): Promise<Session[]> {
  const encoded = encodeURIComponent(query);
  return fetchJson<Session[]>(`/api/events/${slug}/search?q=${encoded}`);
}

export function fetchSponsors(slug: string): Promise<Sponsor[]> {
  return fetchJson<Sponsor[]>(`/api/events/${slug}/sponsors`);
}

export function fetchFloorMaps(slug: string): Promise<FloorMap[]> {
  return fetchJson<FloorMap[]>(`/api/events/${slug}/floor-maps`);
}

export function fetchEventConfig(slug: string): Promise<EventConfig> {
  return fetchJson<EventConfig>(`/api/events/${slug}/config`);
}
