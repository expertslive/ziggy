import { Routes, Route, Navigate } from 'react-router-dom';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { NowPage } from './pages/NowPage';
import { AgendaPage } from './pages/AgendaPage';
import { SpeakersPage } from './pages/SpeakersPage';
import { MapPage } from './pages/MapPage';
import { SponsorsPage } from './pages/SponsorsPage';
import { SearchPage } from './pages/SearchPage';

export function App() {
  return (
    <div className="flex flex-col h-dvh bg-el-darker text-el-light font-sans">
      <Header />

      <main className="flex-1 min-h-0">
        <Routes>
          <Route path="/" element={<Navigate to="/now" replace />} />
          <Route path="/now" element={<NowPage />} />
          <Route path="/agenda" element={<AgendaPage />} />
          <Route path="/speakers" element={<SpeakersPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/sponsors" element={<SponsorsPage />} />
          <Route path="/search" element={<SearchPage />} />
        </Routes>
      </main>

      <BottomNav />
    </div>
  );
}
