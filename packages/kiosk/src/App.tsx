import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { ErrorBoundary } from './components/ErrorBoundary';
import { I18nOverrideLoader } from './components/I18nOverrideLoader';
import { ReconnectingBanner } from './components/ReconnectingBanner';
import { WarmupOverlay } from './components/WarmupOverlay';
import { useInactivityReset } from './hooks/useInactivityReset';
import { useKioskStore } from './store/kiosk';

const NowPage = lazy(() => import('./pages/NowPage').then(m => ({ default: m.NowPage })));
const AgendaPage = lazy(() => import('./pages/AgendaPage').then(m => ({ default: m.AgendaPage })));
const SpeakersPage = lazy(() => import('./pages/SpeakersPage').then(m => ({ default: m.SpeakersPage })));
const MapPage = lazy(() => import('./pages/MapPage').then(m => ({ default: m.MapPage })));
const SponsorsPage = lazy(() => import('./pages/SponsorsPage').then(m => ({ default: m.SponsorsPage })));
const ShopPage = lazy(() => import('./pages/ShopPage').then(m => ({ default: m.ShopPage })));
const SearchPage = lazy(() => import('./pages/SearchPage').then(m => ({ default: m.SearchPage })));
const InfoPage = lazy(() => import('./pages/InfoPage').then(m => ({ default: m.InfoPage })));

export function App() {
  const touch = useKioskStore((s) => s.touch);
  const fontScale = useKioskStore((s) => s.fontScale);
  const theme = useKioskStore((s) => s.theme);
  useInactivityReset();

  useEffect(() => {
    document.documentElement.style.fontSize = `${fontScale * 18}px`;
  }, [fontScale]);

  return (
    <div
      className="flex flex-col h-dvh bg-el-darker text-el-light font-sans"
      data-theme={theme}
      onTouchStart={touch}
      onClick={touch}
    >
      <ReconnectingBanner />
      <WarmupOverlay />
      <I18nOverrideLoader />
      <Header />

      <main className="flex-1 min-h-0">
        <Suspense fallback={
          <div className="flex items-center justify-center h-full">
            <div className="animate-pulse text-el-light/60 text-lg">Loading...</div>
          </div>
        }>
          <Routes>
            <Route path="/" element={<Navigate to="/now" replace />} />
            <Route path="/now" element={<ErrorBoundary><NowPage /></ErrorBoundary>} />
            <Route path="/agenda" element={<ErrorBoundary><AgendaPage /></ErrorBoundary>} />
            <Route path="/speakers" element={<ErrorBoundary><SpeakersPage /></ErrorBoundary>} />
            <Route path="/map" element={<ErrorBoundary><MapPage /></ErrorBoundary>} />
            <Route path="/sponsors" element={<ErrorBoundary><SponsorsPage /></ErrorBoundary>} />
            <Route path="/shop" element={<ErrorBoundary><ShopPage /></ErrorBoundary>} />
            <Route path="/search" element={<ErrorBoundary><SearchPage /></ErrorBoundary>} />
            <Route path="/info" element={<ErrorBoundary><InfoPage /></ErrorBoundary>} />
          </Routes>
        </Suspense>
      </main>

      <BottomNav />
    </div>
  );
}
