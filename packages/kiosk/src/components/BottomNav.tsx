import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useKioskStore } from '../store/kiosk';

interface NavItem {
  to: string;
  labelKey: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/now', labelKey: 'nav.now', icon: '\u{1F534}' },
  { to: '/agenda', labelKey: 'nav.agenda', icon: '\u{1F4C5}' },
  { to: '/speakers', labelKey: 'nav.speakers', icon: '\u{1F3A4}' },
  { to: '/map', labelKey: 'nav.map', icon: '\u{1F5FA}' },
  { to: '/sponsors', labelKey: 'nav.sponsors', icon: '\u{2B50}' },
  { to: '/search', labelKey: 'nav.search', icon: '\u{1F50D}' },
];

export function BottomNav() {
  const { t } = useTranslation();
  const touch = useKioskStore((s) => s.touch);

  return (
    <nav className="flex items-stretch bg-el-dark border-t border-el-gray shrink-0">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={touch}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-1 min-h-[64px] py-2 transition-colors ${
              isActive
                ? 'text-el-red bg-el-gray/40 border-t-2 border-el-red'
                : 'text-el-light/60 hover:text-el-light hover:bg-el-gray/20 border-t-2 border-transparent'
            }`
          }
        >
          <span className="text-xl leading-none">{item.icon}</span>
          <span className="text-xs font-semibold">{t(item.labelKey)}</span>
        </NavLink>
      ))}
    </nav>
  );
}
