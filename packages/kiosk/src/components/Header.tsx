import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useKioskStore } from '../store/kiosk';
import { useEventConfig } from '../lib/hooks';
import { getSimulatedNow } from '../lib/clock';
import { AccessibilityMenu } from './AccessibilityMenu';
import { LanguageSwitcher } from './LanguageSwitcher';

function useHeaderClock(): { display: string; simulated: boolean } {
  // Re-read URL on every render so the override stays in sync with location
  // changes (incl. the / → /now redirect that may briefly include or drop
  // the query string).
  const override =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('now')
      : null;
  const simulated = !!override;
  // Use a tick counter to force re-renders for the live clock (when no
  // override). When override is set, we don't tick — display is frozen.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (simulated) return;
    const t = setInterval(() => setTick((n) => n + 1), 1_000);
    return () => clearInterval(t);
  }, [simulated]);

  const display = formatTime(getSimulatedNow(override));
  return { display, simulated };
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('nl-NL', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/Amsterdam',
  });
}

export function Header() {
  const touch = useKioskStore((s) => s.touch);
  const { data: config } = useEventConfig();

  const { display: time, simulated } = useHeaderClock();
  const logoUrl = config?.branding?.logoUrl;
  const languages = config?.languages ?? ['nl', 'en'];

  return (
    <header className="flex items-center justify-between px-6 py-4 bg-el-dark border-b border-el-gray shrink-0">
      {/* Left: Logo */}
      <Link
        to={{ pathname: '/info', search: typeof window !== 'undefined' ? window.location.search : '' }}
        onClick={touch}
        className="flex items-center gap-2 active:opacity-70 transition-opacity"
      >
        {logoUrl ? (
          <img src={logoUrl} alt={config?.name || 'Experts Live'} className="h-8 sm:h-10 w-auto" />
        ) : (
          <span className="text-xl sm:text-2xl font-extrabold tracking-tight text-el-blue">
            Experts Live
          </span>
        )}
      </Link>

      {/* Center: Clock (with TEST badge when ?now= override is active) */}
      <div className="hidden sm:flex items-center gap-2">
        {simulated && (
          <span className="rounded-full bg-pink-500/20 text-pink-300 text-[10px] font-bold px-2 py-0.5 uppercase tracking-wide">
            Test
          </span>
        )}
        <span className="text-3xl font-bold tabular-nums text-el-light">{time}</span>
      </div>

      {/* Right: Language switcher */}
      <div className="flex items-center gap-2">
        <button
          aria-label="Refresh"
          onClick={() => {
            touch();
            window.location.reload();
          }}
          className="min-w-[44px] min-h-[44px] sm:min-w-[48px] sm:min-h-[48px] rounded-xl bg-el-gray text-el-light flex items-center justify-center text-xl font-bold active:bg-el-gray-light"
        >
          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M5 9a8 8 0 0114-3M19 15a8 8 0 01-14 3" />
          </svg>
        </button>
        <AccessibilityMenu />
        <LanguageSwitcher languages={languages} />
      </div>
    </header>
  );
}
