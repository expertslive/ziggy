import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useKioskStore } from '../store/kiosk';

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

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    setLanguage(lang);
    touch();
  };

  const time = useClock();

  return (
    <header className="flex items-center justify-between px-6 py-4 bg-el-dark border-b border-el-gray shrink-0">
      {/* Left: Logo */}
      <div className="flex items-center gap-2">
        <span className="text-2xl font-extrabold tracking-tight">
          <span className="text-el-red">Experts</span>
          <span className="text-el-light"> Live</span>
        </span>
      </div>

      {/* Center: Clock */}
      <div className="text-3xl font-bold tabular-nums text-el-light">
        {time}
      </div>

      {/* Right: Language switcher */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => changeLanguage('nl')}
          className={`min-w-[48px] min-h-[48px] flex items-center justify-center rounded-xl text-sm font-bold transition-colors ${
            i18n.language === 'nl'
              ? 'bg-el-red text-white'
              : 'bg-el-gray text-el-light active:bg-el-gray-light'
          }`}
        >
          NL
        </button>
        <button
          onClick={() => changeLanguage('en')}
          className={`min-w-[48px] min-h-[48px] flex items-center justify-center rounded-xl text-sm font-bold transition-colors ${
            i18n.language === 'en'
              ? 'bg-el-red text-white'
              : 'bg-el-gray text-el-light active:bg-el-gray-light'
          }`}
        >
          EN
        </button>
      </div>
    </header>
  );
}
