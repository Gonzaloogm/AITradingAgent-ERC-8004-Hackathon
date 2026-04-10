import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import { ToastProvider } from './components/ui/Toast';
import DashboardPage    from './pages/DashboardPage';
import ResultsPage      from './pages/ResultsPage';
import LiquidityPage    from './pages/LiquidityPage';
import SecurityAuditPage from './pages/SecurityAuditPage';

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Layout>
          <Routes>
            <Route path="/"            element={<DashboardPage />} />
            <Route path="/results"     element={<ResultsPage />} />
            <Route path="/liquidity"   element={<LiquidityPage />} />
            <Route path="/audit"       element={<SecurityAuditPage />} />
            <Route path="*"            element={<DashboardPage />} />
          </Routes>
        </Layout>
      </ToastProvider>
    </BrowserRouter>
  );
}
