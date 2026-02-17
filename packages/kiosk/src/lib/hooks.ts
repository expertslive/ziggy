import { useQuery } from '@tanstack/react-query';
import {
  fetchAgenda,
  fetchNowSessions,
  fetchSpeakers,
  fetchBooths,
  fetchSearch,
  fetchSponsors,
  fetchSponsorTiers,
  fetchFloorMaps,
  fetchEventConfig,
  fetchI18nOverrides,
} from './api';
import type {
  Agenda,
  NowResponse,
  Speaker,
  Booth,
  AgendaSession,
  Sponsor,
  SponsorTier,
  FloorMap,
  EventConfig,
  I18nOverrides,
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

export function useSponsorTiers() {
  const slug = useSlug();
  return useQuery<SponsorTier[]>({
    queryKey: ['sponsor-tiers', slug],
    queryFn: () => fetchSponsorTiers(slug),
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

export function useI18nOverrides() {
  const slug = useSlug();
  return useQuery<I18nOverrides[]>({
    queryKey: ['i18n-overrides', slug],
    queryFn: () => fetchI18nOverrides(slug),
    staleTime: 300_000,
  });
}
