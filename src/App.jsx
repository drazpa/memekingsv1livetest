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
import Analytics from './pages/Analytics';
import Top10 from './pages/Top10';
import KingsList from './pages/KingsList';
import About from './pages/About';
import WalletManagement from './components/WalletManagement';
import Setup from './pages/Setup';
import AIChat from './pages/AIChat';
import Social from './pages/Social';

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

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  useEffect(() => {
    const handleNavigateToTrade = (event) => {
      setCurrentPage('trade');
      if (event.detail) {
        setSelectedTradeToken(event.detail);
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
      case 'mytokens':
        return <MyTokens />;
      case 'analytics':
        return <Analytics />;
      case 'top10':
        return <Top10 />;
      case 'kingslist':
        return <KingsList />;
      case 'about':
        return <About />;
      case 'wallets':
        return <WalletManagement />;
      case 'setup':
        return <Setup />;
      case 'aichat':
        return <AIChat />;
      case 'social':
        return <Social />;
      default:
        return <Dashboard />;
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

        <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />

        <div className="lg:ml-64 pt-20 lg:pt-6 p-3 sm:p-4 md:p-6 lg:p-8">
          <div className="w-full mx-auto">
            {renderPage()}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
