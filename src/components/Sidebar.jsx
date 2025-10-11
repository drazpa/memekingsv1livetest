import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { getXRPBalance } from '../utils/xrplBalance';
import { getAvailableServers, getCurrentServer, setManualServer, loadSavedServer } from '../utils/xrplClient';

export default function Sidebar({ currentPage, onNavigate }) {
  const [xrpPrice, setXrpPrice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connectedWallet, setConnectedWallet] = useState(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState(null);
  const [showNetworkDropdown, setShowNetworkDropdown] = useState(false);
  const mobileMenuRef = useRef(null);
  const networkDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target)) {
        setMobileMenuOpen(false);
      }
      if (networkDropdownRef.current && !networkDropdownRef.current.contains(event.target)) {
        setShowNetworkDropdown(false);
      }
    };

    if (mobileMenuOpen || showNetworkDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [mobileMenuOpen, showNetworkDropdown]);

  useEffect(() => {
    fetchXRPPrice();
    const interval = setInterval(fetchXRPPrice, 30000);
    loadConnectedWallet();

    const savedServer = loadSavedServer();
    if (savedServer) {
      setSelectedNetwork(savedServer);
    } else {
      setSelectedNetwork(getCurrentServer());
    }

    const handleWalletChange = () => loadConnectedWallet();
    const handleNetworkChange = (event) => setSelectedNetwork(event.detail);

    window.addEventListener('walletConnected', handleWalletChange);
    window.addEventListener('walletDisconnected', handleWalletChange);
    window.addEventListener('networkChanged', handleNetworkChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('walletConnected', handleWalletChange);
      window.removeEventListener('walletDisconnected', handleWalletChange);
      window.removeEventListener('networkChanged', handleNetworkChange);
    };
  }, []);

  useEffect(() => {
    if (connectedWallet?.address) {
      fetchWalletBalance();
      const interval = setInterval(fetchWalletBalance, 10000);
      return () => clearInterval(interval);
    } else {
      setWalletBalance(0);
    }
  }, [connectedWallet]);

  const loadConnectedWallet = () => {
    const stored = localStorage.getItem('connectedWallet');
    if (stored) {
      setConnectedWallet(JSON.parse(stored));
    } else {
      setConnectedWallet(null);
    }
  };

  const fetchWalletBalance = async () => {
    if (!connectedWallet?.address) return;
    try {
      const balance = await getXRPBalance(connectedWallet.address);
      setWalletBalance(balance);
    } catch (error) {
      console.error('Error fetching wallet balance:', error);
    }
  };

  const fetchXRPPrice = async () => {
    try {
      const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd&include_24hr_change=true');
      setXrpPrice({
        price: response.data.ripple.usd,
        change: response.data.ripple.usd_24h_change
      });
      setLoading(false);
    } catch (error) {
      console.error('Error fetching XRP price:', error);
      setLoading(false);
    }
  };

  const handleNetworkChange = async (index) => {
    try {
      await setManualServer(index);
      const servers = getAvailableServers();
      setSelectedNetwork(servers[index]);
      setShowNetworkDropdown(false);
    } catch (error) {
      console.error('Error changing network:', error);
    }
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'top10', label: 'Top 10', icon: '🏆' },
    { id: 'kingslist', label: 'Kings List', icon: '👑' },
    { id: 'memes', label: 'Memes', icon: '🚀' },
    { id: 'pools', label: 'Pools', icon: '🏊' },
    { id: 'trade', label: 'Trade', icon: '💱' },
    { id: 'bottrader', label: 'Bot Trader', icon: '🤖' },
    { id: 'vault', label: 'Vault', icon: '🏦' },
    { id: 'mytokens', label: 'My Tokens', icon: '💎' },
    { id: 'analytics', label: 'Analytics', icon: '📈' },
    { id: 'aichat', label: 'AI Chat', icon: '💬' },
    { id: 'about', label: 'About', icon: 'ℹ️' },
    { id: 'wallets', label: 'Wallets', icon: '💼' },
    { id: 'setup', label: 'Setup', icon: '⚙️' }
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:block fixed left-0 top-0 h-screen w-64 glass flex-col border-r border-purple-500/20">
        <div className="p-6 border-b border-purple-500/20">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">
              <span className="text-white">MEME</span>
              <span className="bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">KINGS</span>
            </h1>
            <span className="text-3xl" style={{
              filter: 'drop-shadow(0 0 8px rgba(168, 85, 247, 0.8))',
              textShadow: '0 0 12px rgba(168, 85, 247, 0.6)'
            }}>👑</span>
          </div>
          <p className="text-purple-300/60 text-xs mt-1">XRPL Meme Token Factory</p>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 ${
                currentPage === item.id
                  ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg shadow-purple-500/50'
                  : 'text-purple-300 hover:bg-purple-900/30 hover:text-purple-200'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-purple-500/20 space-y-3">
          {connectedWallet && (
            <div className="glass rounded-lg p-4 bg-green-500/10 border border-green-500/30">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                <span className="text-green-300 text-xs font-medium">Connected Wallet</span>
              </div>
              <div className="text-purple-200 font-bold text-sm mb-1">{connectedWallet.name}</div>
              <div className="text-purple-300 text-xs font-mono break-all">
                {connectedWallet.address.slice(0, 10)}...{connectedWallet.address.slice(-8)}
              </div>
              <div className="text-purple-400 text-xs mt-2">
                {walletBalance.toFixed(3)} XRP
              </div>
            </div>
          )}

          <div ref={networkDropdownRef} className="glass rounded-lg p-4 relative">
            <div className="flex items-center justify-between mb-2">
              <span className="text-purple-300 text-sm font-medium">Network Node</span>
              <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></div>
            </div>
            <button
              onClick={() => setShowNetworkDropdown(!showNetworkDropdown)}
              className="w-full flex items-center justify-between text-purple-200 text-sm hover:text-purple-100 transition-colors"
            >
              <span className="truncate">{selectedNetwork?.name || 'Loading...'}</span>
              <span className="ml-2">{showNetworkDropdown ? '▲' : '▼'}</span>
            </button>
            {showNetworkDropdown && (
              <div className="absolute left-0 right-0 mt-2 bg-gray-900 rounded-lg border border-purple-500/50 shadow-2xl z-[100] max-h-64 overflow-y-auto">
                {getAvailableServers().map((server, index) => (
                  <button
                    key={index}
                    onClick={() => handleNetworkChange(index)}
                    className={`w-full text-left px-4 py-3 text-sm transition-colors border-b border-purple-500/20 last:border-b-0 ${
                      selectedNetwork?.url === server.url
                        ? 'bg-purple-600 text-white'
                        : 'text-purple-300 hover:bg-purple-900/60'
                    }`}
                  >
                    {server.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="glass rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-purple-300 text-sm font-medium">XRP/USD</span>
              {!loading && xrpPrice && (
                <span className={`text-xs font-medium ${xrpPrice.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {xrpPrice.change >= 0 ? '↑' : '↓'} {Math.abs(xrpPrice.change).toFixed(2)}%
                </span>
              )}
            </div>
            {loading ? (
              <div className="text-purple-400 text-lg animate-pulse">Loading...</div>
            ) : xrpPrice ? (
              <div className="text-2xl font-bold text-purple-200">
                ${xrpPrice.price.toFixed(4)}
              </div>
            ) : (
              <div className="text-purple-400 text-sm">Unable to load</div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Top Bar with Dropdown Menu */}
      <div ref={mobileMenuRef} className="lg:hidden fixed top-0 left-0 right-0 glass border-b border-purple-500/20 z-50 backdrop-blur-lg">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">
              <span className="text-white">MEME</span>
              <span className="bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">KINGS</span>
            </h1>
            <span className="text-2xl" style={{
              filter: 'drop-shadow(0 0 8px rgba(168, 85, 247, 0.8))',
              textShadow: '0 0 12px rgba(168, 85, 247, 0.6)'
            }}>👑</span>
          </div>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-purple-300 hover:bg-purple-900/30 transition-all duration-200 touch-manipulation active:scale-95"
            aria-label="Toggle menu"
          >
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Dropdown Menu */}
        <div
          className={`transition-all duration-300 ease-in-out overflow-hidden ${
            mobileMenuOpen ? 'max-h-[calc(100vh-80px)] opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="px-2 pb-3 space-y-1 max-h-[calc(100vh-100px)] overflow-y-auto">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 touch-manipulation active:scale-98 text-base ${
                  currentPage === item.id
                    ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg'
                    : 'text-purple-300 hover:bg-purple-900/30'
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </button>
            ))}

            {/* Mobile Wallet Info */}
            {connectedWallet && (
              <div className="glass rounded-lg p-4 bg-green-500/10 border border-green-500/30 mt-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                  <span className="text-green-300 text-xs font-medium">Connected Wallet</span>
                </div>
                <div className="text-purple-200 font-bold text-sm mb-1">{connectedWallet.name}</div>
                <div className="text-purple-300 text-xs font-mono break-all">
                  {connectedWallet.address.slice(0, 10)}...{connectedWallet.address.slice(-8)}
                </div>
                <div className="text-purple-400 text-xs mt-2">
                  {walletBalance.toFixed(3)} XRP
                </div>
              </div>
            )}

            {/* Mobile XRP Price */}
            <div className="glass rounded-lg p-4 mt-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-purple-300 text-sm font-medium">XRP/USD</span>
                {!loading && xrpPrice && (
                  <span className={`text-xs font-medium ${
                    xrpPrice.change >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {xrpPrice.change >= 0 ? '↑' : '↓'} {Math.abs(xrpPrice.change).toFixed(2)}%
                  </span>
                )}
              </div>
              {loading ? (
                <div className="text-purple-400 text-lg animate-pulse">Loading...</div>
              ) : xrpPrice ? (
                <div className="text-2xl font-bold text-purple-200">
                  ${xrpPrice.price.toFixed(4)}
                </div>
              ) : (
                <div className="text-purple-400 text-sm">Unable to load</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
