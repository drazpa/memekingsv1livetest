import { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Memes from './pages/Memes';
import Pools from './pages/Pools';
import Trade from './pages/Trade';
import BotTrader from './pages/BotTrader';
import Vault from './pages/Vault';
import KingsList from './pages/KingsList';
import MyTokens from './pages/MyTokens';
import Analytics from './pages/Analytics';
import Top10 from './pages/Top10';
import About from './pages/About';
import WalletManagement from './components/WalletManagement';
import Setup from './pages/Setup';
import AIChat from './pages/AIChat';

export default function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [selectedTradeToken, setSelectedTradeToken] = useState(null);

  useEffect(() => {
    const handleNavigateToTrade = (event) => {
      setCurrentPage('trade');
      if (event.detail && event.detail.token) {
        setSelectedTradeToken(event.detail.token);
      }
    };

    const handleNavigateToPage = (event) => {
      setCurrentPage(event.detail);
      if (event.detail !== 'trade') {
        setSelectedTradeToken(null);
      }
    };

    window.addEventListener('navigateToTrade', handleNavigateToTrade);
    window.addEventListener('navigateToPage', handleNavigateToPage);

    return () => {
      window.removeEventListener('navigateToTrade', handleNavigateToTrade);
      window.removeEventListener('navigateToPage', handleNavigateToPage);
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
        return <Trade preselectedToken={selectedTradeToken} />;
      case 'bottrader':
        return <BotTrader />;
      case 'vault':
        return <Vault />;
      case 'kingslist':
        return <KingsList />;
      case 'mytokens':
        return <MyTokens />;
      case 'analytics':
        return <Analytics />;
      case 'top10':
        return <Top10 />;
      case 'about':
        return <About />;
      case 'wallets':
        return <WalletManagement />;
      case 'setup':
        return <Setup />;
      case 'aichat':
        return <AIChat />;
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
