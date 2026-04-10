import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import Layout from './components/layout/Layout';
import { ToastProvider } from './components/ui/Toast';
import LandingPage       from './pages/LandingPage';
import DashboardPage     from './pages/DashboardPage';
import ResultsPage       from './pages/ResultsPage';
import LiquidityPage     from './pages/LiquidityPage';
import SecurityAuditPage from './pages/SecurityAuditPage';

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="bottom-right" theme="dark" expand={true} richColors />
      <ToastProvider>
        <Routes>
          {/* Landing page: no Navbar/Layout wrapper */}
          <Route
            path="/"
            element={
              <div className="min-h-screen bg-[#0D0F14] overflow-hidden">
                <div className="retro-grid opacity-20 fixed inset-0 pointer-events-none" />
                <LandingPage />
              </div>
            }
          />

          {/* App shell with Navbar */}
          <Route
            path="/*"
            element={
              <Layout>
                <Routes>
                  <Route path="/dashboard"  element={<DashboardPage />} />
                  <Route path="/results"    element={<ResultsPage />} />
                  <Route path="/liquidity"  element={<LiquidityPage />} />
                  <Route path="/audit"      element={<SecurityAuditPage />} />
                  <Route path="*"           element={<DashboardPage />} />
                </Routes>
              </Layout>
            }
          />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}
