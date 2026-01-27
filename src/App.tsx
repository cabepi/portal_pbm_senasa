import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { Home } from './pages/Home';
import { Consultation } from './pages/Consultation';
import { HistoryPage } from './pages/History';
import { ClaimSearchPage } from './pages/ClaimSearch';
import { PharmacyProvider } from './contexts/PharmacyContext';

function App() {
  return (
    <PharmacyProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Home />} />
            <Route path="consultar" element={<Consultation />} />
            <Route path="consultar-solicitudes" element={<ClaimSearchPage />} />
            <Route path="historial" element={<HistoryPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </PharmacyProvider>
  );
}

export default App;
