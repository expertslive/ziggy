/** run.events API response types */

export interface RunEventsSession {
  id: string
  title: string
  description?: string
  abstract?: string
  aiSummary?: string
  publicNote?: string
  startsAt: string
  endsAt: string
  room?: string
  roomId?: string
  track?: string
  level?: string
  labels?: string[]
  speakers?: RunEventsSpeakerRef[]
  materials?: RunEventsMaterial[]
}

export interface RunEventsSpeakerRef {
  id: string
  firstName: string
  lastName: string
  fullName: string
  tagline?: string
  profilePicture?: string
}

export interface RunEventsMaterial {
  name: string
  url: string
  type?: string
}

export interface RunEventsSpeaker {
  id: string
  firstName: string
  middleName?: string
  lastName: string
  fullName: string
  tagline?: string
  biography?: string
  aiSummary?: string
  profilePicture?: string
  socialMedia?: RunEventsSocialMedia[]
  sessions?: RunEventsSessionRef[]
  labels?: string[]
}

export interface RunEventsSocialMedia {
  type: string
  url: string
}

export interface RunEventsSessionRef {
  id: string
  title: string
  startsAt: string
  endsAt: string
  room?: string
}

export interface RunEventsTimeslot {
  startsAt: string
  endsAt: string
  sessions: RunEventsSession[]
}

export interface RunEventsAgendaDay {
  date: string
  timeslots: RunEventsTimeslot[]
}

export interface RunEventsAgenda {
  days: RunEventsAgendaDay[]
}

export interface RunEventsBooth {
  id: string
  name: string
  description?: string
  boothNumber?: string
  location?: string
  organization?: string
  logoUrl?: string
  website?: string
  labels?: string[]
  resources?: RunEventsBoothResource[]
}

export interface RunEventsBoothResource {
  name: string
  url: string
  type?: string
}

export interface RunEventsPartnership {
  id: string
  organizationName: string
  level?: string
  description?: string
  logoUrl?: string
  website?: string
  boothNumber?: string
  contacts?: RunEventsPartnerContact[]
  sessions?: RunEventsSessionRef[]
  labels?: string[]
}

export interface RunEventsPartnerContact {
  name: string
  email?: string
  role?: string
}
