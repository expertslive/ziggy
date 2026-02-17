import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useKioskStore } from '../store/kiosk';
import { useEventConfig } from '../lib/hooks';

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
  const { i18n } = useTranslation();
  const touch = useKioskStore((s) => s.touch);
  const setLanguage = useKioskStore((s) => s.setLanguage);
  const { data: config } = useEventConfig();

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    setLanguage(lang);
    touch();
  };

  const time = useClock();
  const logoUrl = config?.branding?.logoUrl;
  const languages = config?.languages ?? ['nl', 'en'];

  return (
    <header className="flex items-center justify-between px-6 py-4 bg-el-dark border-b border-el-gray shrink-0">
      {/* Left: Logo */}
      <div className="flex items-center gap-2">
        {logoUrl ? (
          <img src={logoUrl} alt={config?.name || 'Experts Live'} className="h-10 w-auto" />
        ) : (
          <span className="text-2xl font-extrabold tracking-tight">
            <span className="text-el-navy">Experts</span>
            <span className="text-el-blue"> Live</span>
          </span>
        )}
      </div>

      {/* Center: Clock */}
      <div className="text-3xl font-bold tabular-nums text-el-light">
        {time}
      </div>

      {/* Right: Language switcher */}
      <div className="flex items-center gap-2">
        {languages.map((lang) => (
          <button
            key={lang}
            onClick={() => changeLanguage(lang)}
            className={`min-w-[48px] min-h-[48px] flex items-center justify-center rounded-xl text-sm font-bold transition-colors ${
              i18n.language === lang
                ? 'bg-el-blue text-white'
                : 'bg-el-gray text-el-light active:bg-el-gray-light'
            }`}
          >
            {lang.toUpperCase()}
          </button>
        ))}
      </div>
    </header>
  );
}
