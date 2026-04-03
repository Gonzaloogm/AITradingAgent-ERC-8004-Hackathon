import Navbar from './Navbar';

export default function Layout({ children }) {
  return (
    <div className="min-h-screen relative">
      <div className="retro-grid" />
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Navbar />
        <main>{children}</main>
        <footer className="mt-16 pb-6 text-center text-xs font-mono text-gray-600">
          AI Trading Agent · ERC-8004 · Intel TDX · Sepolia Testnet
        </footer>
      </div>
    </div>
  );
}
