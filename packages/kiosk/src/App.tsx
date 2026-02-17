import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { ErrorBoundary } from './components/ErrorBoundary';
import { I18nOverrideLoader } from './components/I18nOverrideLoader';
import { useInactivityReset } from './hooks/useInactivityReset';
import { useKioskStore } from './store/kiosk';

const NowPage = lazy(() => import('./pages/NowPage').then(m => ({ default: m.NowPage })));
const AgendaPage = lazy(() => import('./pages/AgendaPage').then(m => ({ default: m.AgendaPage })));
const SpeakersPage = lazy(() => import('./pages/SpeakersPage').then(m => ({ default: m.SpeakersPage })));
const MapPage = lazy(() => import('./pages/MapPage').then(m => ({ default: m.MapPage })));
const BoothsPage = lazy(() => import('./pages/BoothsPage').then(m => ({ default: m.BoothsPage })));
const SponsorsPage = lazy(() => import('./pages/SponsorsPage').then(m => ({ default: m.SponsorsPage })));
const SearchPage = lazy(() => import('./pages/SearchPage').then(m => ({ default: m.SearchPage })));

export function App() {
  const touch = useKioskStore((s) => s.touch);
  useInactivityReset();

  return (
    <div
      className="flex flex-col h-dvh bg-el-darker text-el-light font-sans"
      onTouchStart={touch}
      onClick={touch}
    >
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
            <Route path="/expo" element={<ErrorBoundary><BoothsPage /></ErrorBoundary>} />
            <Route path="/sponsors" element={<ErrorBoundary><SponsorsPage /></ErrorBoundary>} />
            <Route path="/search" element={<ErrorBoundary><SearchPage /></ErrorBoundary>} />
          </Routes>
        </Suspense>
      </main>

      <BottomNav />
    </div>
  );
}
