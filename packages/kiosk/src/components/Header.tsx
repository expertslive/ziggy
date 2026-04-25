import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useKioskStore } from '../store/kiosk';
import { useEventConfig } from '../lib/hooks';
import { AccessibilityMenu } from './AccessibilityMenu';
import { LanguageSwitcher } from './LanguageSwitcher';

function useClock(): string {
  const [time, setTime] = useState(() => formatTime(new Date()));

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(formatTime(new Date()));
    }, 1_000);
    return () => clearInterval(timer);
  }, []);

  return time;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('nl-NL', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function Header() {
  const touch = useKioskStore((s) => s.touch);
  const { data: config } = useEventConfig();

  const time = useClock();
  const logoUrl = config?.branding?.logoUrl;
  const languages = config?.languages ?? ['nl', 'en'];

  return (
    <header className="flex items-center justify-between px-6 py-4 bg-el-dark border-b border-el-gray shrink-0">
      {/* Left: Logo */}
      <Link to="/info" onClick={touch} className="flex items-center gap-2 active:opacity-70 transition-opacity">
        {logoUrl ? (
          <img src={logoUrl} alt={config?.name || 'Experts Live'} className="h-10 w-auto" />
        ) : (
          <span className="text-2xl font-extrabold tracking-tight">
            <span className="text-el-navy">Experts</span>
            <span className="text-el-blue"> Live</span>
          </span>
        )}
      </Link>

      {/* Center: Clock */}
      <div className="hidden sm:block text-3xl font-bold tabular-nums text-el-light">
        {time}
      </div>

      {/* Right: Language switcher */}
      <div className="flex items-center gap-2">
        <button
          aria-label="Refresh"
          onClick={() => {
            touch();
            window.location.reload();
          }}
          className="min-w-[48px] min-h-[48px] rounded-xl bg-el-gray text-el-light flex items-center justify-center text-xl font-bold active:bg-el-gray-light"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M5 9a8 8 0 0114-3M19 15a8 8 0 01-14 3" />
          </svg>
        </button>
        <AccessibilityMenu />
        <LanguageSwitcher languages={languages} />
      </div>
    </header>
  );
}
