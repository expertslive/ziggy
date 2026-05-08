import { Routes, Route, Navigate, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { isAuthenticated, clearToken } from './lib/api';
import { ToastProvider } from './components/Toast';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { SponsorsPage } from './pages/SponsorsPage';
import { SponsorTiersPage } from './pages/SponsorTiersPage';
import { ShopItemsPage } from './pages/ShopItemsPage';
import { FloorMapsPage } from './pages/FloorMapsPage';
import { HotspotEditorPage } from './pages/HotspotEditorPage';
import { EventConfigPage } from './pages/EventConfigPage';
import { I18nOverridesPage } from './pages/I18nOverridesPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { SnapshotsPage } from './pages/SnapshotsPage';
import { TrashPage } from './pages/TrashPage';
import { ProfilePage } from './pages/ProfilePage';
import { UsersPage } from './pages/UsersPage';
import { ImagesPage } from './pages/ImagesPage';
import { CommandPalette } from './components/CommandPalette';
import type { ReactNode } from 'react';

function ProtectedRoute({ children }: { children: ReactNode }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

const navItems = [
  { to: '/', label: 'Dashboard', icon: DashboardIcon },
  { to: '/sponsors', label: 'Sponsors', icon: SponsorsIcon },
  { to: '/tiers', label: 'Tiers', icon: TiersIcon },
  { to: '/shop-items', label: 'Shop Items', icon: ShopItemsIcon },
  { to: '/floor-maps', label: 'Floor Maps', icon: FloorMapsIcon },
  { to: '/images', label: 'Images', icon: ImagesIcon },
  { to: '/config', label: 'Config', icon: ConfigIcon },
  { to: '/i18n', label: 'Translations', icon: TranslationsIcon },
  { to: '/analytics', label: 'Analytics', icon: AnalyticsIcon },
  { to: '/snapshots', label: 'Snapshots', icon: SnapshotsIcon },
  { to: '/trash', label: 'Trash', icon: TrashIcon },
  { to: '/users', label: 'Admins', icon: UsersIcon },
  { to: '/profile', label: 'Profile', icon: ProfileIcon },
];

function AdminLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    clearToken();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-surface-alt">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col border-r border-border bg-white">
        <div className="flex h-16 items-center gap-3 border-b border-border px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-sm font-bold text-white">
            EL
          </div>
          <span className="text-lg font-bold text-secondary">Experts Live Admin</span>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-gray-600 hover:bg-surface-alt hover:text-secondary'
                }`
              }
            >
              <item.icon active={location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to))} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-border p-3">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-surface-alt hover:text-secondary"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3-3l3-3m0 0l-3-3m3 3H9" />
            </svg>
            Log out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-8 py-8">{children}</div>
      </main>
      <CommandPalette />
    </div>
  );
}

export function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/floor-maps/:id"
          element={
            <ProtectedRoute>
              <HotspotEditorPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <Routes>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/sponsors" element={<SponsorsPage />} />
                  <Route path="/tiers" element={<SponsorTiersPage />} />
                  <Route path="/shop-items" element={<ShopItemsPage />} />
                  <Route path="/floor-maps" element={<FloorMapsPage />} />
                  <Route path="/config" element={<EventConfigPage />} />
                  <Route path="/i18n" element={<I18nOverridesPage />} />
                  <Route path="/analytics" element={<AnalyticsPage />} />
                  <Route path="/snapshots" element={<SnapshotsPage />} />
                  <Route path="/trash" element={<TrashPage />} />
                  <Route path="/users" element={<UsersPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/images" element={<ImagesPage />} />
                </Routes>
              </AdminLayout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </ToastProvider>
  );
}

// ─── Nav Icons ───────────────────────────────────────────────────────────────

function DashboardIcon({ active }: { active: boolean }) {
  return (
    <svg className={`h-5 w-5 ${active ? 'text-primary' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  );
}

function SponsorsIcon({ active }: { active: boolean }) {
  return (
    <svg className={`h-5 w-5 ${active ? 'text-primary' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21m-3.75 3H21" />
    </svg>
  );
}

function TiersIcon({ active }: { active: boolean }) {
  return (
    <svg className={`h-5 w-5 ${active ? 'text-primary' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
    </svg>
  );
}

function ShopItemsIcon({ active }: { active: boolean }) {
  return (
    <svg className={`h-5 w-5 ${active ? 'text-primary' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l-1 12H6L5 9z" />
    </svg>
  );
}

function FloorMapsIcon({ active }: { active: boolean }) {
  return (
    <svg className={`h-5 w-5 ${active ? 'text-primary' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
    </svg>
  );
}

function ImagesIcon({ active }: { active: boolean }) {
  return (
    <svg className={`h-5 w-5 ${active ? 'text-primary' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
  );
}

function ConfigIcon({ active }: { active: boolean }) {
  return (
    <svg className={`h-5 w-5 ${active ? 'text-primary' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function TranslationsIcon({ active }: { active: boolean }) {
  return (
    <svg className={`h-5 w-5 ${active ? 'text-primary' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802" />
    </svg>
  );
}

function AnalyticsIcon({ active }: { active: boolean }) {
  return (
    <svg className={`h-5 w-5 ${active ? 'text-primary' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

function SnapshotsIcon({ active }: { active: boolean }) {
  return (
    <svg className={`h-5 w-5 ${active ? 'text-primary' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  );
}

function TrashIcon({ active }: { active: boolean }) {
  return (
    <svg className={`h-5 w-5 ${active ? 'text-primary' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  );
}

function UsersIcon({ active }: { active: boolean }) {
  return (
    <svg className={`h-5 w-5 ${active ? 'text-primary' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  );
}

function ProfileIcon({ active }: { active: boolean }) {
  return (
    <svg className={`h-5 w-5 ${active ? 'text-primary' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
