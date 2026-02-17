import { useSponsors, useSponsorTiers, useFloorMaps } from '../lib/hooks';

export function DashboardPage() {
  const sponsors = useSponsors();
  const tiers = useSponsorTiers();
  const floorMaps = useFloorMaps();

  const cards = [
    {
      label: 'Sponsors',
      count: sponsors.data?.length ?? '-',
      loading: sponsors.isLoading,
      color: 'bg-blue-50 text-blue-700',
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21m-3.75 3H21" />
        </svg>
      ),
    },
    {
      label: 'Sponsor Tiers',
      count: tiers.data?.length ?? '-',
      loading: tiers.isLoading,
      color: 'bg-purple-50 text-purple-700',
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
        </svg>
      ),
    },
    {
      label: 'Floor Maps',
      count: floorMaps.data?.length ?? '-',
      loading: floorMaps.isLoading,
      color: 'bg-emerald-50 text-emerald-700',
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
        </svg>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-secondary">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">Overview of your event configuration</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">{card.label}</p>
                <p className="mt-1 text-3xl font-bold text-secondary">
                  {card.loading ? (
                    <span className="inline-block h-8 w-12 animate-pulse rounded bg-gray-200" />
                  ) : (
                    card.count
                  )}
                </p>
              </div>
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${card.color}`}>
                {card.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {(sponsors.isError || tiers.isError || floorMaps.isError) && (
        <div className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load some data. Make sure the API server is running.
        </div>
      )}
    </div>
  );
}
