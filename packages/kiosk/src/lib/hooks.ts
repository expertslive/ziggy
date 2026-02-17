import { useQuery } from '@tanstack/react-query';
import {
  fetchAgenda,
  fetchNowSessions,
  fetchSpeakers,
  fetchBooths,
  fetchSearch,
  fetchSponsors,
  fetchFloorMaps,
  fetchEventConfig,
} from './api';
import type {
  Agenda,
  NowResponse,
  Speaker,
  Booth,
  AgendaSession,
  Sponsor,
  FloorMap,
  EventConfig,
} from './api';
import { useKioskStore } from '../store/kiosk';

function useSlug(): string {
  return useKioskStore((s) => s.eventSlug);
}

export function useAgenda() {
  const slug = useSlug();
  return useQuery<Agenda>({
    queryKey: ['agenda', slug],
    queryFn: () => fetchAgenda(slug),
  });
}

export function useNowSessions() {
  const slug = useSlug();
  return useQuery<NowResponse>({
    queryKey: ['now-sessions', slug],
    queryFn: () => fetchNowSessions(slug),
    refetchInterval: 30_000,
  });
}

export function useSpeakers() {
  const slug = useSlug();
  return useQuery<Speaker[]>({
    queryKey: ['speakers', slug],
    queryFn: () => fetchSpeakers(slug),
  });
}

export function useBooths() {
  const slug = useSlug();
  return useQuery<Booth[]>({
    queryKey: ['booths', slug],
    queryFn: () => fetchBooths(slug),
  });
}

export function useSearch(query: string) {
  const slug = useSlug();
  return useQuery<AgendaSession[]>({
    queryKey: ['search', slug, query],
    queryFn: () => fetchSearch(slug, query),
    enabled: query.length >= 4,
  });
}

export function useSponsors() {
  const slug = useSlug();
  return useQuery<Sponsor[]>({
    queryKey: ['sponsors', slug],
    queryFn: () => fetchSponsors(slug),
  });
}

export function useFloorMaps() {
  const slug = useSlug();
  return useQuery<FloorMap[]>({
    queryKey: ['floor-maps', slug],
    queryFn: () => fetchFloorMaps(slug),
  });
}

export function useEventConfig() {
  const slug = useSlug();
  return useQuery<EventConfig>({
    queryKey: ['event-config', slug],
    queryFn: () => fetchEventConfig(slug),
    staleTime: 300_000,
  });
}
