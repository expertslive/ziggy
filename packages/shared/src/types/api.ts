/** run.events API response types — matches actual API responses */

/** A label attached to sessions or speakers */
export interface RunEventsLabel {
  id: number
  entityId: number
  image: string | null
  name: string
  color: string
  showInElement: boolean
}

/** Speaker reference as returned within agenda items */
export interface RunEventsSpeakerRef {
  id: number
  uniqueId: number
  image: string
  name: string
  tagline: string | null
  company: string | null
  isFeatured: boolean
  eventId: number
  biography: string | null
  labels: RunEventsLabel[] | null
}

/** A single agenda element (session or non-content block) */
export interface RunEventsAgendaItem {
  id: number
  guid: string
  eventId: number
  roomName: string
  roomGuid: string
  /** 1 = Session, 2 = NonContent */
  elementType: number
  sessionId: number | null
  nonContentBlockId: number | null
  title: string
  description: string | null
  /** ISO datetime without timezone, e.g. "2026-06-01T08:30:00" */
  startDate: string
  /** ISO datetime without timezone */
  endDate: string
  /** Time group for display, e.g. "08:30" */
  startTimeGroup: string
  timeZone: string
  icon: string | null
  color: string | null
  labels: RunEventsLabel[] | null
  speakers: RunEventsSpeakerRef[] | null
  materials: RunEventsMaterial[] | null
  elementTypeName: string
}

export interface RunEventsMaterial {
  name: string
  url: string
  type?: string
}

/** Speaker as returned by the /speakers endpoint */
export interface RunEventsSpeaker {
  id: number
  uniqueId: number
  image: string
  name: string
  tagline: string | null
  company: string | null
  isFeatured: boolean
  eventId: number
  biography: string
  labels: RunEventsLabel[]
}

/** Booth as returned by the /booths endpoint */
export interface RunEventsBooth {
  id: number
  name: string
  description?: string
  boothNumber?: string
  location?: string
  organization?: string
  logoUrl?: string
  website?: string
  labels?: RunEventsLabel[]
}

/** Partnership as returned by the /partnerships endpoint */
export interface RunEventsPartnership {
  id: number
  organizationName: string
  level?: string
  description?: string
  logoUrl?: string
  website?: string
  boothNumber?: string
  labels?: RunEventsLabel[]
}

// ---------------------------------------------------------------------------
// Transformed types (what our API serves to the kiosk)
// ---------------------------------------------------------------------------

/** A session in our transformed agenda format */
export interface AgendaSession {
  id: number
  guid: string
  title: string
  description: string | null
  roomName: string
  roomGuid: string
  startDate: string
  endDate: string
  startTimeGroup: string
  elementType: number
  elementTypeName: string
  color: string | null
  icon: string | null
  labels: RunEventsLabel[]
  speakers: RunEventsSpeakerRef[]
}

/** A timeslot grouping sessions by startTimeGroup */
export interface AgendaTimeslot {
  startTimeGroup: string
  startDate: string
  endDate: string
  sessions: AgendaSession[]
}

/** A single day in the transformed agenda */
export interface AgendaDay {
  date: string
  timeslots: AgendaTimeslot[]
}

/** The structured agenda our API returns */
export interface Agenda {
  days: AgendaDay[]
  timeZone: string
}
