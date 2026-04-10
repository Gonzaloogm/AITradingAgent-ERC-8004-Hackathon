import Navbar from './Navbar';
import StrategicInquiry from '../agent/StrategicInquiry';

export default function Layout({ children }) {
  return (
    <div className="min-h-screen relative bg-[#0D0F14] overflow-hidden flex flex-col">
      <div className="retro-grid opacity-20" />
      
      <div className="relative z-10 flex flex-col flex-1 min-h-0 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Navbar />
        
        <div className="flex-1 flex gap-6 min-h-0 mt-4 h-[calc(100vh-140px)]">
          {/* Main Content (75%) */}
          <main className="flex-[75] min-w-0 overflow-y-auto pr-2 scrollbar-hide">
            {children}
          </main>
          
          {/* Strategic Inquiry Panel (25%) */}
          <aside className="flex-[25] min-w-[300px] h-full hidden lg:block">
            <StrategicInquiry />
          </aside>
        </div>

        <footer className="mt-6 pb-2 text-center text-[9px] font-mono text-gray-600 uppercase tracking-widest opacity-50">
          AI Trading Agent · ERC-8004 · Intel TDX · Sepolia Testnet · Strykr Hub
        </footer>
      </div>
    </div>
  );
}
