import { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Memes from './pages/Memes';
import Pools from './pages/Pools';
import Trade from './pages/Trade';
import BotTrader from './pages/BotTrader';
import Vault from './pages/Vault';
import MyTokens from './pages/MyTokens';
import Analytics from './pages/Analytics';
import About from './pages/About';
import WalletManagement from './components/WalletManagement';
import Setup from './pages/Setup';

export default function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');

  useEffect(() => {
    const handleNavigateToTrade = () => {
      setCurrentPage('trade');
    };

    window.addEventListener('navigateToTrade', handleNavigateToTrade);

    return () => {
      window.removeEventListener('navigateToTrade', handleNavigateToTrade);
    };
  }, []);

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'memes':
        return <Memes />;
      case 'pools':
        return <Pools />;
      case 'trade':
        return <Trade />;
      case 'bottrader':
        return <BotTrader />;
      case 'vault':
        return <Vault />;
      case 'mytokens':
        return <MyTokens />;
      case 'analytics':
        return <Analytics />;
      case 'about':
        return <About />;
      case 'wallets':
        return <WalletManagement />;
      case 'setup':
        return <Setup />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'rgba(88, 28, 135, 0.9)',
            color: '#e9d5ff',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            backdropFilter: 'blur(10px)'
          },
          success: {
            iconTheme: {
              primary: '#a78bfa',
              secondary: '#581c87'
            }
          },
          error: {
            iconTheme: {
              primary: '#f87171',
              secondary: '#581c87'
            }
          }
        }}
      />

      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />

      <div className="lg:ml-64 pt-20 lg:pt-6 p-4 sm:p-6 lg:p-8">
        <div className="w-full mx-auto">
          {renderPage()}
        </div>
      </div>
    </div>
  );
}
