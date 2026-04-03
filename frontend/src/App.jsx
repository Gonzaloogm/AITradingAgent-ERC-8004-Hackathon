import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import { ToastProvider } from './components/ui/Toast';
import DashboardPage  from './pages/DashboardPage';
import FundingPage    from './pages/FundingPage';
import DeveloperPage  from './pages/DeveloperPage';
import ResultsPage    from './pages/ResultsPage';

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Layout>
          <Routes>
            <Route path="/"          element={<DashboardPage />} />
            <Route path="/funding"   element={<FundingPage />} />
            <Route path="/developer" element={<DeveloperPage />} />
            <Route path="/results"   element={<ResultsPage />} />
            {/* Fallback */}
            <Route path="*"          element={<DashboardPage />} />
          </Routes>
        </Layout>
      </ToastProvider>
    </BrowserRouter>
  );
}
