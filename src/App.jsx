import { useState, useEffect, Component } from 'react';
import { Toaster } from 'react-hot-toast';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Memes from './pages/Memes';
import Pools from './pages/Pools';
import Trade from './pages/Trade';
import BotTrader from './pages/BotTrader';
import Vault from './pages/Vault';
import MyTokens from './pages/MyTokens';
import XRPRewards from './pages/XRPRewards';
import Airdropper from './pages/Airdropper';
import Analytics from './pages/Analytics';
import Top10 from './pages/Top10';
import KingsList from './pages/KingsList';
import About from './pages/About';
import WalletManagement from './components/WalletManagement';
import Setup from './pages/Setup';
import AIChat from './pages/AIChat';
import Social from './pages/Social';
import TokenProfile from './pages/TokenProfile';
import { imageCacheManager } from './utils/imageCache';
import { startGlobalBotExecutor, stopGlobalBotExecutor } from './utils/botExecutor';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('React Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
          <div className="glass rounded-lg p-8 max-w-md text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-purple-200 mb-4">Something went wrong</h1>
            <p className="text-purple-400 mb-6">
              The app encountered an error. Please refresh the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="btn-primary px-6 py-3 rounded-lg"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [selectedTradeToken, setSelectedTradeToken] = useState(null);
  const [pageKey, setPageKey] = useState(0);
  const [tokenSlug, setTokenSlug] = useState(null);

  useEffect(() => {
    const path = window.location.pathname;
    if (path.startsWith('/token/')) {
      const slug = path.replace('/token/', '');
      setTokenSlug(slug);
      setCurrentPage('tokenprofile');
    }

    const handlePopState = () => {
      const path = window.location.pathname;
      if (path.startsWith('/token/')) {
        const slug = path.replace('/token/', '');
        setTokenSlug(slug);
        setCurrentPage('tokenprofile');
      } else {
        setCurrentPage('dashboard');
        setTokenSlug(null);
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  useEffect(() => {
    const handleError = (event) => {
      console.error('Global error caught:', event.error);
      event.preventDefault();
    };

    const handleUnhandledRejection = (event) => {
      console.error('Unhandled promise rejection:', event.reason);
      event.preventDefault();
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    const cleanupInterval = setInterval(() => {
      imageCacheManager.cleanOldEntries();
    }, 60 * 60 * 1000);

    const checkWalletAndStartBots = () => {
      const walletData = localStorage.getItem('connectedWallet');
      if (walletData) {
        try {
          const wallet = JSON.parse(walletData);
          if (wallet.address) {
            startGlobalBotExecutor(wallet.address);
          }
        } catch (error) {
          console.error('Error starting bot executor:', error);
        }
      }
    };

    checkWalletAndStartBots();

    const handleWalletConnected = () => {
      setTimeout(checkWalletAndStartBots, 1000);
    };

    const handleWalletDisconnected = () => {
      stopGlobalBotExecutor();
    };

    window.addEventListener('walletConnected', handleWalletConnected);
    window.addEventListener('walletDisconnected', handleWalletDisconnected);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('walletConnected', handleWalletConnected);
      window.removeEventListener('walletDisconnected', handleWalletDisconnected);
      clearInterval(cleanupInterval);
      stopGlobalBotExecutor();
    };
  }, []);

  useEffect(() => {
    const handleNavigateToTrade = (event) => {
      handlePageChange('trade');
      if (event.detail) {
        setSelectedTradeToken(event.detail);
      }
    };

    const handleNavigateToPage = (event) => {
      handlePageChange(event.detail);
      if (event.detail !== 'trade') {
        setSelectedTradeToken(null);
      }
    };

    const handleNavigateToToken = (event) => {
      setTokenSlug(event.detail);
      handlePageChange('tokenprofile');
      window.history.pushState({}, '', `/token/${event.detail}`);
    };

    window.addEventListener('navigateToTrade', handleNavigateToTrade);
    window.addEventListener('navigateToPage', handleNavigateToPage);
    window.addEventListener('navigateToToken', handleNavigateToToken);

    return () => {
      window.removeEventListener('navigateToTrade', handleNavigateToTrade);
      window.removeEventListener('navigateToPage', handleNavigateToPage);
      window.removeEventListener('navigateToToken', handleNavigateToToken);
    };
  }, []);

  const handlePageChange = (page) => {
    setCurrentPage(page);
    setPageKey(prev => prev + 1);
    if (page !== 'tokenprofile') {
      window.history.pushState({}, '', '/');
    }
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard key={pageKey} />;
      case 'memes':
        return <Memes key={pageKey} />;
      case 'pools':
        return <Pools key={pageKey} />;
      case 'trade':
        return <Trade key={pageKey} preselectedToken={selectedTradeToken} />;
      case 'bottrader':
        return <BotTrader key={pageKey} />;
      case 'vault':
        return <Vault key={pageKey} />;
      case 'mytokens':
        return <MyTokens key={pageKey} />;
      case 'xrprewards':
        return <XRPRewards key={pageKey} />;
      case 'airdropper':
        return <Airdropper key={pageKey} />;
      case 'analytics':
        return <Analytics key={pageKey} />;
      case 'top10':
        return <Top10 key={pageKey} />;
      case 'kingslist':
        return <KingsList key={pageKey} />;
      case 'about':
        return <About key={pageKey} />;
      case 'wallets':
        return <WalletManagement key={pageKey} />;
      case 'setup':
        return <Setup key={pageKey} />;
      case 'aichat':
        return <AIChat key={pageKey} />;
      case 'social':
        return <Social key={pageKey} />;
      case 'tokenprofile':
        return <TokenProfile key={pageKey} tokenSlug={tokenSlug} />;
      default:
        return <Dashboard key={pageKey} />;
    }
  };

  return (
    <ErrorBoundary>
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

        <Sidebar currentPage={currentPage} onNavigate={handlePageChange} />

        <div className="lg:ml-64 pt-20 lg:pt-6 p-3 sm:p-4 md:p-6 lg:p-8">
          <div className="w-full mx-auto">
            {renderPage()}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
