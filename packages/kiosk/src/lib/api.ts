const BASE_URL = import.meta.env.VITE_API_URL || '';

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// Types matching the actual run.events API responses (via our Hono backend)

export interface Label {
  id: number;
  entityId: number;
  image: string | null;
  name: string;
  color: string;
  showInElement: boolean;
}

export interface SpeakerRef {
  id: number;
  uniqueId: number;
  image: string;
  name: string;
  tagline: string | null;
  company: string | null;
  isFeatured: boolean;
  eventId: number;
  biography: string | null;
  labels: Label[] | null;
}

export interface AgendaSession {
  id: number;
  guid: string;
  title: string;
  description: string | null;
  roomName: string;
  roomGuid: string;
  startDate: string;
  endDate: string;
  startTimeGroup: string;
  elementType: number;
  elementTypeName: string;
  color: string | null;
  icon: string | null;
  labels: Label[];
  speakers: SpeakerRef[];
}

export interface AgendaTimeslot {
  startTimeGroup: string;
  startDate: string;
  endDate: string;
  sessions: AgendaSession[];
}

export interface AgendaDay {
  date: string;
  timeslots: AgendaTimeslot[];
}

export interface Agenda {
  days: AgendaDay[];
  timeZone: string;
}

export interface NowResponse {
  current: AgendaSession[];
  upNext: AgendaSession[];
  timeZone: string;
}

export interface Speaker {
  id: number;
  uniqueId: number;
  image: string;
  name: string;
  tagline: string | null;
  company: string | null;
  isFeatured: boolean;
  eventId: number;
  biography: string;
  labels: Label[];
}

export interface Booth {
  id: number;
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

export function fetchNowSessions(slug: string): Promise<NowResponse> {
  return fetchJson<NowResponse>(`/api/events/${slug}/sessions/now`);
}

export function fetchSpeakers(slug: string): Promise<Speaker[]> {
  return fetchJson<Speaker[]>(`/api/events/${slug}/speakers`);
}

export function fetchBooths(slug: string): Promise<Booth[]> {
  return fetchJson<Booth[]>(`/api/events/${slug}/booths`);
}

export function fetchSearch(slug: string, query: string): Promise<AgendaSession[]> {
  const encoded = encodeURIComponent(query);
  return fetchJson<AgendaSession[]>(`/api/events/${slug}/search?q=${encoded}`);
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
