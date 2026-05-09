import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { App } from './App';
import { queryClient, persister, BUILD_HASH } from './lib/queryClient';
import './i18n';
import './index.css';

// /nominate runs outside the kiosk shell — no Header/BottomNav, no idle-reset,
// no pair overlay, no analytics. Reachable only via direct URL or QR.
const NominatePage = lazy(() =>
  import('./pages/NominatePage').then((m) => ({ default: m.NominatePage })),
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, buster: BUILD_HASH, maxAge: 24 * 60 * 60 * 1000 }}
    >
      <BrowserRouter>
        <Routes>
          <Route
            path="/nominate"
            element={
              <Suspense fallback={null}>
                <NominatePage />
              </Suspense>
            }
          />
          <Route path="*" element={<App />} />
        </Routes>
      </BrowserRouter>
    </PersistQueryClientProvider>
  </StrictMode>,
);
