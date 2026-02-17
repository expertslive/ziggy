import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from './api';

// ─── Sponsors ────────────────────────────────────────────────────────────────

export function useSponsors() {
  return useQuery({
    queryKey: ['sponsors'],
    queryFn: api.fetchSponsors,
  });
}

export function useCreateSponsor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.createSponsor(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sponsors'] }),
  });
}

export function useUpdateSponsor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateSponsor(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sponsors'] }),
  });
}

export function useDeleteSponsor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteSponsor(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sponsors'] }),
  });
}

// ─── Sponsor Tiers ───────────────────────────────────────────────────────────

export function useSponsorTiers() {
  return useQuery({
    queryKey: ['sponsor-tiers'],
    queryFn: api.fetchSponsorTiers,
  });
}

export function useCreateSponsorTier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.createSponsorTier(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sponsor-tiers'] }),
  });
}

export function useUpdateSponsorTier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateSponsorTier(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sponsor-tiers'] }),
  });
}

export function useDeleteSponsorTier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteSponsorTier(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sponsor-tiers'] }),
  });
}

// ─── Floor Maps ──────────────────────────────────────────────────────────────

export function useFloorMaps() {
  return useQuery({
    queryKey: ['floor-maps'],
    queryFn: api.fetchFloorMaps,
  });
}

export function useCreateFloorMap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.createFloorMap(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['floor-maps'] }),
  });
}

export function useUpdateFloorMap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateFloorMap(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['floor-maps'] }),
  });
}

export function useDeleteFloorMap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteFloorMap(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['floor-maps'] }),
  });
}

// ─── Event Config ────────────────────────────────────────────────────────────

export function useEventConfig() {
  return useQuery({
    queryKey: ['event-config'],
    queryFn: api.fetchEventConfig,
  });
}

export function useUpdateEventConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.updateEventConfig(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['event-config'] }),
  });
}
