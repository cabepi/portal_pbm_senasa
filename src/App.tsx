import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { Home } from './pages/Home';
import { Consultation } from './pages/Consultation';
import { HistoryPage } from './pages/History';
import { ClaimSearchPage } from './pages/ClaimSearch';
import HistoricalData from './pages/HistoricalData';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';
import { PharmacyProvider } from './contexts/PharmacyContext';

function App() {
  return (
    <PharmacyProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Route */}
          <Route path="/login" element={<Login />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<MainLayout />}>
              <Route index element={<Home />} />
              <Route path="consultar" element={<Consultation />} />
              <Route path="consultar-solicitudes" element={<ClaimSearchPage />} />
              <Route path="data-historica" element={<HistoricalData />} />
              <Route path="historial" element={<HistoryPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </PharmacyProvider>
  );
}

export default App;
