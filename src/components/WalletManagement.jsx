import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import toast from 'react-hot-toast';
import * as xrpl from 'xrpl';
import { TrustlineDropdown } from './TrustlineDropdown';
import { PinProtection } from './PinProtection';

export default function WalletManagement() {
  const [wallets, setWallets] = useState([]);
  const [connectedWallet, setConnectedWallet] = useState(null);
  const [viewMode, setViewMode] = useState('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterFavorites, setFilterFavorites] = useState(false);
  const [showSeedFor, setShowSeedFor] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showImportSeedModal, setShowImportSeedModal] = useState(false);
  const [editingWallet, setEditingWallet] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [generatedWallet, setGeneratedWallet] = useState(null);
  const [selectedNetwork, setSelectedNetwork] = useState('mainnet');
  const [importingSeed, setImportingSeed] = useState(false);
  const [importedWalletData, setImportedWalletData] = useState(null);
  const [importSeedInput, setImportSeedInput] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [pendingSeedView, setPendingSeedView] = useState(null);
  const [tokenBalances, setTokenBalances] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    seed: '',
    purpose: 'trading',
    notes: ''
  });

  useEffect(() => {
    loadWallets();
    loadConnectedWallet();
  }, [filterFavorites]);

  const toggleFavorite = (wallet) => {
    try {
      const stored = localStorage.getItem('wallets');
      const allWallets = stored ? JSON.parse(stored) : [];
      const updated = allWallets.map(w =>
        w.id === wallet.id ? { ...w, is_favorite: !w.is_favorite } : w
      );
      localStorage.setItem('wallets', JSON.stringify(updated));
      toast.success(wallet.is_favorite ? 'Removed from favorites' : 'Added to favorites');
      loadWallets();
    } catch (error) {
      console.error('Error updating favorite:', error);
      toast.error('Failed to update favorite');
    }
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  const filteredWallets = wallets.filter(wallet => {
    const matchesSearch = wallet.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          wallet.address.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const loadConnectedWallet = () => {
    const stored = localStorage.getItem('connectedWallet');
    if (stored) {
      setConnectedWallet(JSON.parse(stored));
    }
  };

  const connectWallet = (wallet) => {
    const walletData = {
      ...wallet,
      seed: wallet.encrypted_seed || wallet.seed
    };
    setConnectedWallet(walletData);
    localStorage.setItem('connectedWallet', JSON.stringify(walletData));
    toast.success(`Connected to ${wallet.name}`);
    window.dispatchEvent(new Event('walletConnected'));
  };

  const disconnectWallet = () => {
    setConnectedWallet(null);
    localStorage.removeItem('connectedWallet');
    toast.success('Wallet disconnected');
    window.dispatchEvent(new Event('walletDisconnected'));
  };

  const loadWallets = async () => {
    try {
      const stored = localStorage.getItem('wallets');
      let allWallets = stored ? JSON.parse(stored) : [];

      if (filterFavorites) {
        allWallets = allWallets.filter(w => w.is_favorite);
      }

      allWallets.sort((a, b) => {
        if (a.is_favorite !== b.is_favorite) {
          return b.is_favorite ? 1 : -1;
        }
        return new Date(b.created_at) - new Date(a.created_at);
      });

      setWallets(allWallets);
      updateWalletBalances(allWallets);
    } catch (error) {
      console.error('Error loading wallets:', error);
      toast.error('Failed to load wallets');
    }
  };

  const updateWalletBalances = async (walletList) => {
    try {
      const { requestWithRetry } = await import('../utils/xrplClient');
      const stored = localStorage.getItem('wallets');
      const allWallets = stored ? JSON.parse(stored) : [];

      for (const wallet of walletList) {
        try {
          const accountInfo = await requestWithRetry({
            command: 'account_info',
            account: wallet.address,
            ledger_index: 'validated'
          });

          const balance = parseFloat(accountInfo.result.account_data.Balance) / 1000000;

          if (balance !== wallet.balance_xrp) {
            wallet.balance_xrp = balance;
            const walletIndex = allWallets.findIndex(w => w.id === wallet.id);
            if (walletIndex !== -1) {
              allWallets[walletIndex].balance_xrp = balance;
            }
          }
        } catch (error) {
          if (error.data?.error === 'actNotFound') {
            if (wallet.balance_xrp !== 0) {
              wallet.balance_xrp = 0;
              const walletIndex = allWallets.findIndex(w => w.id === wallet.id);
              if (walletIndex !== -1) {
                allWallets[walletIndex].balance_xrp = 0;
              }
            }
          }
        }
      }

      localStorage.setItem('wallets', JSON.stringify(allWallets));
      setWallets([...walletList]);
    } catch (error) {
      console.error('Error updating wallet balances:', error);
    }
  };

  const saveWallet = async () => {
    if (!formData.name || !formData.address) {
      toast.error('Name and address are required');
      return;
    }

    try {
      const stored = localStorage.getItem('wallets');
      const allWallets = stored ? JSON.parse(stored) : [];

      if (editingWallet) {
        const walletIndex = allWallets.findIndex(w => w.id === editingWallet.id);
        if (walletIndex !== -1) {
          allWallets[walletIndex] = {
            ...allWallets[walletIndex],
            name: formData.name,
            encrypted_seed: formData.seed || editingWallet.encrypted_seed,
            purpose: formData.purpose,
            notes: formData.notes,
            updated_at: new Date().toISOString()
          };
        }
        toast.success('Wallet updated successfully');
      } else {
        const newWallet = {
          id: Date.now().toString(),
          name: formData.name,
          address: formData.address,
          encrypted_seed: formData.seed,
          purpose: formData.purpose,
          notes: formData.notes,
          network: formData.address.startsWith('r') ? 'mainnet' : 'testnet',
          is_favorite: false,
          balance_xrp: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        allWallets.push(newWallet);
        toast.success('Wallet added successfully');
      }

      localStorage.setItem('wallets', JSON.stringify(allWallets));
      setShowAddModal(false);
      setEditingWallet(null);
      setFormData({ name: '', address: '', seed: '', purpose: 'trading', notes: '' });
      loadWallets();
    } catch (error) {
      console.error('Error saving wallet:', error);
      toast.error('Failed to save wallet');
    }
  };

  const deleteWallet = async (id) => {
    if (!confirm('Are you sure you want to delete this wallet?')) return;

    try {
      const stored = localStorage.getItem('wallets');
      const allWallets = stored ? JSON.parse(stored) : [];
      const filtered = allWallets.filter(w => w.id !== id);
      localStorage.setItem('wallets', JSON.stringify(filtered));
      toast.success('Wallet deleted successfully');
      loadWallets();
    } catch (error) {
      console.error('Error deleting wallet:', error);
      toast.error('Failed to delete wallet');
    }
  };

  const openEditModal = (wallet) => {
    setEditingWallet(wallet);
    setFormData({
      name: wallet.name,
      address: wallet.address,
      seed: '',
      purpose: wallet.purpose,
      notes: wallet.notes || ''
    });
    setShowAddModal(true);
  };

  const generateNewWallet = async () => {
    setGenerating(true);
    setGeneratedWallet(null);

    try {
      const { getClient } = await import('../utils/xrplClient');
      const client = await getClient();
      toast.success('Connected to XRPL');

      const newWallet = xrpl.Wallet.generate();

      if (selectedNetwork === 'testnet') {
        toast.loading('Funding wallet with test XRP...');
        const fundResult = await client.fundWallet(newWallet);
        toast.dismiss();
        toast.success('Wallet funded with test XRP!');
      }

      setGeneratedWallet({
        address: newWallet.address,
        seed: newWallet.seed,
        publicKey: newWallet.publicKey,
        privateKey: newWallet.privateKey,
        network: selectedNetwork
      });

      toast.success('Wallet generated successfully!');
    } catch (error) {
      console.error('Error generating wallet:', error);
      toast.error('Failed to generate wallet: ' + error.message);
    } finally {
      setGenerating(false);
    }
  };

  const saveGeneratedWallet = async (walletName) => {
    if (!generatedWallet || !walletName) {
      toast.error('Please provide a wallet name');
      return;
    }

    try {
      const stored = localStorage.getItem('wallets');
      const allWallets = stored ? JSON.parse(stored) : [];

      const newWallet = {
        id: Date.now().toString(),
        name: walletName,
        address: generatedWallet.address,
        encrypted_seed: generatedWallet.seed,
        purpose: 'trading',
        notes: `Generated on ${generatedWallet.network}`,
        network: generatedWallet.network,
        is_favorite: false,
        balance_xrp: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      allWallets.push(newWallet);
      localStorage.setItem('wallets', JSON.stringify(allWallets));

      toast.success('Wallet saved successfully!');
      setShowGenerateModal(false);
      setGeneratedWallet(null);
      loadWallets();
    } catch (error) {
      console.error('Error saving wallet:', error);
      toast.error('Failed to save wallet');
    }
  };

  const importWalletFromSeed = async () => {
    if (!importSeedInput.trim()) {
      toast.error('Please enter a seed phrase');
      return;
    }

    setImportingSeed(true);
    setImportedWalletData(null);

    try {
      console.log('Starting wallet import...');

      let wallet;
      try {
        wallet = xrpl.Wallet.fromSeed(importSeedInput.trim());
        console.log('Wallet created from seed:', wallet.address);
      } catch (seedError) {
        console.error('Invalid seed:', seedError);
        throw new Error('Invalid seed phrase format');
      }

      let balance = 0;
      let network = 'mainnet';

      try {
        console.log('Fetching account info from XRPL...');
        const { requestWithRetry } = await import('../utils/xrplClient');

        const accountInfo = await Promise.race([
          requestWithRetry({
            command: 'account_info',
            account: wallet.address,
            ledger_index: 'validated'
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout fetching account info')), 15000)
          )
        ]);

        balance = parseFloat(accountInfo.result.account_data.Balance) / 1000000;
        console.log('Account balance:', balance);
      } catch (error) {
        console.log('Account fetch error:', error.message);
        if (error.data?.error === 'actNotFound') {
          console.log('Account not found on ledger, setting balance to 0');
          balance = 0;
        } else if (error.message === 'Timeout fetching account info') {
          console.error('Timeout - proceeding with 0 balance');
          balance = 0;
        } else {
          console.error('Error fetching account info:', error);
          balance = 0;
        }
      }

      const walletData = {
        address: wallet.address,
        seed: wallet.seed,
        publicKey: wallet.publicKey,
        balance: balance,
        network: network
      };

      console.log('Setting wallet data:', walletData);
      setImportedWalletData(walletData);
      toast.success('Wallet imported successfully!');
    } catch (error) {
      console.error('Import failed:', error);
      toast.error(error.message || 'Failed to import wallet');
      setImportedWalletData(null);
    } finally {
      console.log('Import process complete, clearing loading state');
      setImportingSeed(false);
    }
  };

  const saveImportedWallet = async (walletName) => {
    if (!importedWalletData || !walletName) {
      toast.error('Please provide a wallet name');
      return;
    }

    try {
      const existingWallet = wallets.find(w => w.address === importedWalletData.address);
      if (existingWallet) {
        toast.error('This wallet address already exists!');
        return;
      }

      const stored = localStorage.getItem('wallets');
      const allWallets = stored ? JSON.parse(stored) : [];

      const newWallet = {
        id: Date.now().toString(),
        name: walletName,
        address: importedWalletData.address,
        encrypted_seed: importedWalletData.seed,
        purpose: 'trading',
        notes: `Imported from seed`,
        network: importedWalletData.network || 'mainnet',
        balance_xrp: importedWalletData.balance,
        is_favorite: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      allWallets.push(newWallet);
      localStorage.setItem('wallets', JSON.stringify(allWallets));

      toast.success('Wallet saved successfully!');
      setShowImportSeedModal(false);
      setImportedWalletData(null);
      setImportSeedInput('');
      loadWallets();
    } catch (error) {
      console.error('Error saving imported wallet:', error);
      toast.error('Failed to save wallet');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-purple-200">Wallet Management</h2>
          <p className="text-purple-400 mt-1">Manage your XRPL wallets</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-4 py-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-purple-600 text-white' : 'glass text-purple-300'}`}
            >
              ▦ Grid
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-purple-600 text-white' : 'glass text-purple-300'}`}
            >
              ☰ List
            </button>
          </div>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="btn-primary text-white px-6 py-2 rounded-lg font-medium"
          >
            🎲 Generate Wallet
          </button>
          <button
            onClick={() => {
              setImportSeedInput('');
              setImportedWalletData(null);
              setShowImportSeedModal(true);
            }}
            className="btn text-purple-300 px-6 py-2 rounded-lg font-medium"
          >
            📥 Import from Seed
          </button>
          <button
            onClick={() => {
              setEditingWallet(null);
              setFormData({ name: '', address: '', seed: '', purpose: 'trading', notes: '' });
              setShowAddModal(true);
            }}
            className="btn text-purple-300 px-6 py-2 rounded-lg font-medium"
          >
            + Add Existing
          </button>
          {connectedWallet && (
            <TrustlineDropdown
              wallet={connectedWallet}
              network={connectedWallet.network || 'testnet'}
              tokenBalances={tokenBalances}
              onTrustlineUpdate={() => {
                toast.success('Trustlines updated');
              }}
            />
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <div className="flex-1 relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="🔍 Search wallets by name or address..."
            className="input w-full text-purple-200 pl-4"
          />
        </div>
        <button
          onClick={() => setFilterFavorites(!filterFavorites)}
          className={`px-6 py-2 rounded-lg font-medium transition-all ${
            filterFavorites
              ? 'bg-yellow-500 text-white'
              : 'glass text-purple-300 hover:text-yellow-400'
          }`}
        >
          {filterFavorites ? '⭐ Favorites Only' : '☆ Show All'}
        </button>
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredWallets.map((wallet) => (
            <div key={wallet.id} className="glass rounded-lg p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-xl font-bold text-purple-200">{wallet.name}</h3>
                    <button
                      onClick={() => toggleFavorite(wallet)}
                      className="text-xl hover:scale-110 transition-transform"
                    >
                      {wallet.is_favorite ? '⭐' : '☆'}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-purple-500/20 text-purple-300">
                      {wallet.purpose}
                    </span>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                      wallet.network === 'mainnet'
                        ? 'bg-green-500/20 text-green-300'
                        : 'bg-blue-500/20 text-blue-300'
                    }`}>
                      {wallet.network === 'mainnet' ? '🌐 Mainnet' : '🧪 Testnet'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openEditModal(wallet)}
                    className="text-purple-400 hover:text-purple-300"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => deleteWallet(wallet.id)}
                    className="text-red-400 hover:text-red-300"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div>
                  <div className="text-purple-400 text-xs mb-1 flex items-center justify-between">
                    <span>Address</span>
                    <button
                      onClick={() => copyToClipboard(wallet.address, 'Address')}
                      className="text-purple-400 hover:text-purple-300"
                    >
                      📋
                    </button>
                  </div>
                  <div className="text-purple-200 text-sm font-mono bg-black/30 p-2 rounded break-all">
                    {wallet.address}
                  </div>
                </div>

                {wallet.encrypted_seed && (
                  <div>
                    <div className="text-purple-400 text-xs mb-1 flex items-center justify-between">
                      <span>Seed</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const isVisible = showSeedFor === wallet.id;
                            if (isVisible) {
                              setShowSeedFor(null);
                            } else {
                              const hasPinSet = localStorage.getItem(`wallet_pin_${wallet.address}`);
                              if (hasPinSet) {
                                setPendingSeedView(wallet);
                                setShowPinModal(true);
                              } else {
                                setPendingSeedView(wallet);
                                setShowPinModal(true);
                              }
                            }
                          }}
                          className="text-purple-400 hover:text-purple-300"
                        >
                          {showSeedFor === wallet.id ? '🙈' : '👁️'}
                        </button>
                        {showSeedFor === wallet.id && (
                          <button
                            onClick={() => copyToClipboard(wallet.encrypted_seed, 'Seed')}
                            className="text-purple-400 hover:text-purple-300"
                          >
                            📋
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="text-purple-200 text-sm font-mono bg-black/30 p-2 rounded break-all">
                      {showSeedFor === wallet.id ? wallet.encrypted_seed : '••••••••••••••••'}
                    </div>
                  </div>
                )}

                <div>
                  <div className="text-purple-400 text-xs mb-1">Balance</div>
                  <div className="text-purple-200 text-lg font-bold">
                    {wallet.balance_xrp || 0} XRP
                  </div>
                </div>

                {wallet.notes && (
                  <div>
                    <div className="text-purple-400 text-xs mb-1">Notes</div>
                    <div className="text-purple-300 text-sm">{wallet.notes}</div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-purple-500/20">
                <div className="text-purple-500 text-xs">
                  Added: {new Date(wallet.created_at).toLocaleDateString()}
                </div>
                {connectedWallet?.id === wallet.id ? (
                  <button
                    onClick={disconnectWallet}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium text-sm"
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    onClick={() => connectWallet(wallet)}
                    className="btn-primary text-white px-4 py-2 rounded-lg font-medium text-sm"
                  >
                    Connect
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-purple-900/50">
              <tr>
                <th className="text-left px-6 py-4 text-purple-300 font-medium">Fav</th>
                <th className="text-left px-6 py-4 text-purple-300 font-medium">Name</th>
                <th className="text-left px-6 py-4 text-purple-300 font-medium">Network</th>
                <th className="text-left px-6 py-4 text-purple-300 font-medium">Address</th>
                <th className="text-left px-6 py-4 text-purple-300 font-medium">Seed</th>
                <th className="text-left px-6 py-4 text-purple-300 font-medium">Purpose</th>
                <th className="text-left px-6 py-4 text-purple-300 font-medium">Balance</th>
                <th className="text-left px-6 py-4 text-purple-300 font-medium">Connection</th>
                <th className="text-left px-6 py-4 text-purple-300 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredWallets.map((wallet) => (
                <tr key={wallet.id} className="border-t border-purple-500/20 hover:bg-purple-900/20">
                  <td className="px-6 py-4">
                    <button
                      onClick={() => toggleFavorite(wallet)}
                      className="text-xl hover:scale-110 transition-transform"
                    >
                      {wallet.is_favorite ? '⭐' : '☆'}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-purple-200 font-medium">{wallet.name}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      wallet.network === 'mainnet'
                        ? 'bg-green-500/20 text-green-300'
                        : 'bg-blue-500/20 text-blue-300'
                    }`}>
                      {wallet.network === 'mainnet' ? '🌐' : '🧪'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="text-purple-300 font-mono text-sm">{wallet.address.slice(0, 15)}...</span>
                      <button
                        onClick={() => copyToClipboard(wallet.address, 'Address')}
                        className="text-purple-400 hover:text-purple-300"
                      >
                        📋
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {wallet.encrypted_seed && (
                      <div className="flex items-center gap-2">
                        <span className="text-purple-300 font-mono text-sm">
                          {showSeedFor === wallet.id ? wallet.encrypted_seed.slice(0, 15) + '...' : '••••••••'}
                        </span>
                        <button
                          onClick={() => {
                            const isVisible = showSeedFor === wallet.id;
                            if (isVisible) {
                              setShowSeedFor(null);
                            } else {
                              setPendingSeedView(wallet);
                              setShowPinModal(true);
                            }
                          }}
                          className="text-purple-400 hover:text-purple-300"
                        >
                          {showSeedFor === wallet.id ? '🙈' : '👁️'}
                        </button>
                        {showSeedFor === wallet.id && (
                          <button
                            onClick={() => copyToClipboard(wallet.encrypted_seed, 'Seed')}
                            className="text-purple-400 hover:text-purple-300"
                          >
                            📋
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-500/20 text-purple-300">
                      {wallet.purpose}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-purple-200 font-bold">{wallet.balance_xrp || 0} XRP</td>
                  <td className="px-6 py-4">
                    {connectedWallet?.id === wallet.id ? (
                      <button
                        onClick={disconnectWallet}
                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
                      >
                        Disconnect
                      </button>
                    ) : (
                      <button
                        onClick={() => connectWallet(wallet)}
                        className="btn-primary text-white px-3 py-1 rounded text-sm"
                      >
                        Connect
                      </button>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditModal(wallet)}
                        className="text-purple-400 hover:text-purple-300"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => deleteWallet(wallet.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="glass rounded-lg p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold text-purple-200 mb-6">
              {editingWallet ? 'Edit Wallet' : 'Add New Wallet'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-purple-300 mb-2">Wallet Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input w-full text-purple-200"
                  placeholder="My Trading Wallet"
                />
              </div>

              <div>
                <label className="block text-purple-300 mb-2">Wallet Address *</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="input w-full text-purple-200 font-mono"
                  placeholder="rXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                  disabled={editingWallet}
                />
              </div>

              <div>
                <label className="block text-purple-300 mb-2">
                  Seed {editingWallet ? '(leave empty to keep current)' : '(optional)'}
                </label>
                <input
                  type="password"
                  value={formData.seed}
                  onChange={(e) => setFormData({ ...formData, seed: e.target.value })}
                  className="input w-full text-purple-200 font-mono"
                  placeholder="sXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                />
              </div>

              <div>
                <label className="block text-purple-300 mb-2">Purpose</label>
                <select
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  className="input w-full text-purple-200"
                >
                  <option value="trading">Trading</option>
                  <option value="issuer">Token Issuer</option>
                  <option value="receiver">Token Receiver</option>
                  <option value="hodl">HODL</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-purple-300 mb-2">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="input w-full text-purple-200 h-24"
                  placeholder="Additional notes about this wallet..."
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={saveWallet}
                className="btn-primary text-white px-6 py-2 rounded-lg font-medium flex-1"
              >
                {editingWallet ? 'Update' : 'Add'} Wallet
              </button>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingWallet(null);
                  setFormData({ name: '', address: '', seed: '', purpose: 'trading', notes: '' });
                }}
                className="btn text-purple-300 px-6 py-2 rounded-lg font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {wallets.length === 0 && (
        <div className="glass rounded-lg p-12 text-center">
          <div className="text-6xl mb-4">💼</div>
          <h3 className="text-xl font-bold text-purple-200 mb-2">No Wallets Yet</h3>
          <p className="text-purple-400">Generate or add your first wallet to get started</p>
        </div>
      )}

      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="glass rounded-lg p-8 max-w-2xl w-full">
            <h3 className="text-2xl font-bold text-purple-200 mb-6">
              Generate New XRPL Wallet
            </h3>

            {!generatedWallet ? (
              <div className="space-y-6">
                <div>
                  <label className="block text-purple-300 mb-3 font-medium">Select Network</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setSelectedNetwork('testnet')}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        selectedNetwork === 'testnet'
                          ? 'border-purple-500 bg-purple-500/20'
                          : 'border-purple-500/30 bg-purple-900/20 hover:border-purple-500/50'
                      }`}
                    >
                      <div className="text-xl mb-2">🧪</div>
                      <div className="font-bold text-purple-200">Testnet</div>
                      <div className="text-sm text-purple-400 mt-1">Free test XRP included</div>
                    </button>
                    <button
                      onClick={() => setSelectedNetwork('mainnet')}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        selectedNetwork === 'mainnet'
                          ? 'border-purple-500 bg-purple-500/20'
                          : 'border-purple-500/30 bg-purple-900/20 hover:border-purple-500/50'
                      }`}
                    >
                      <div className="text-xl mb-2">🌐</div>
                      <div className="font-bold text-purple-200">Mainnet</div>
                      <div className="text-sm text-purple-400 mt-1">Production network</div>
                    </button>
                  </div>
                </div>

                {selectedNetwork === 'testnet' ? (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                    <div className="flex gap-3">
                      <div className="text-yellow-400 text-xl">⚠️</div>
                      <div className="flex-1">
                        <div className="font-medium text-yellow-300 mb-1">Important</div>
                        <div className="text-yellow-200/80 text-sm">
                          Testnet wallets receive free test XRP automatically. This is for testing only.
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                    <div className="flex gap-3">
                      <div className="text-yellow-400 text-xl">⚠️</div>
                      <div className="flex-1">
                        <div className="font-medium text-yellow-300 mb-2">XRP Requirements for Mainnet</div>
                        <div className="text-yellow-200/80 text-sm space-y-2">
                          <div><strong>Wallet Activation:</strong> 2 XRP minimum required to activate your wallet</div>
                          <div><strong>Token Trading:</strong> 0.01 XRP per buy or sell transaction</div>
                          <div><strong>Trading Bots:</strong> 5 XRP per bot (unlimited bots supported)</div>
                          <div className="pt-2 border-t border-yellow-500/30 mt-2">
                            <strong>Recommendation:</strong> Send at least 10-20 XRP to your wallet for comfortable trading and platform usage.
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={generateNewWallet}
                    disabled={generating}
                    className="btn-primary text-white px-6 py-3 rounded-lg font-medium flex-1 disabled:opacity-50"
                  >
                    {generating ? '🔄 Generating...' : '🎲 Generate Wallet'}
                  </button>
                  <button
                    onClick={() => {
                      setShowGenerateModal(false);
                      setGeneratedWallet(null);
                    }}
                    className="btn text-purple-300 px-6 py-3 rounded-lg font-medium"
                    disabled={generating}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                  <div className="flex gap-3">
                    <div className="text-green-400 text-xl">✓</div>
                    <div className="flex-1">
                      <div className="font-medium text-green-300 mb-1">Wallet Generated Successfully!</div>
                      <div className="text-green-200/80 text-sm">
                        Your new {generatedWallet.network} wallet has been created. Save your seed phrase securely!
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-purple-400 text-sm mb-2">Wallet Address</label>
                    <div className="input text-purple-200 font-mono text-sm break-all">
                      {generatedWallet.address}
                    </div>
                  </div>

                  <div>
                    <label className="block text-purple-400 text-sm mb-2">Seed Phrase (Secret Key)</label>
                    <div className="input text-red-400 font-mono text-sm break-all bg-red-500/10 border-red-500/30">
                      {generatedWallet.seed}
                    </div>
                    <div className="text-red-400 text-xs mt-2">⚠️ Keep this secret! Anyone with this can access your wallet.</div>
                  </div>

                  <div>
                    <label className="block text-purple-400 text-sm mb-2">Public Key</label>
                    <div className="input text-purple-300 font-mono text-xs break-all">
                      {generatedWallet.publicKey}
                    </div>
                  </div>

                  <div>
                    <label className="block text-purple-400 text-sm mb-2">Network</label>
                    <div className="input text-purple-200 uppercase">
                      {generatedWallet.network}
                    </div>
                  </div>

                  <div>
                    <label className="block text-purple-300 mb-2">Wallet Name *</label>
                    <input
                      type="text"
                      id="walletName"
                      className="input w-full text-purple-200"
                      placeholder="My Trading Wallet"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      const walletName = document.getElementById('walletName').value;
                      saveGeneratedWallet(walletName);
                    }}
                    className="btn-primary text-white px-6 py-3 rounded-lg font-medium flex-1"
                  >
                    💾 Save Wallet
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Are you sure? Make sure you\'ve saved your seed phrase!')) {
                        setShowGenerateModal(false);
                        setGeneratedWallet(null);
                      }
                    }}
                    className="btn text-purple-300 px-6 py-3 rounded-lg font-medium"
                  >
                    Close
                  </button>
                </div>

                <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                  <div className="text-purple-300 text-sm">
                    <div className="font-medium mb-2">📋 Next Steps:</div>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Copy and securely store your seed phrase</li>
                      <li>Save this wallet to your list</li>
                      {generatedWallet.network === 'mainnet' && (
                        <>
                          <li>Send at least 2 XRP to activate the wallet (10-20 XRP recommended)</li>
                          <li>Budget 0.01 XRP per token trade and 5 XRP per trading bot</li>
                        </>
                      )}
                      <li>Start using your new wallet!</li>
                    </ol>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showImportSeedModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowImportSeedModal(false)}>
          <div className="glass rounded-lg max-w-2xl w-full p-8" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-2xl font-bold text-purple-200 mb-6">Import Wallet from Seed</h3>

            {!importedWalletData ? (
              <div className="space-y-6">
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                  <div className="flex gap-3">
                    <div className="text-yellow-400 text-xl">⚠️</div>
                    <div className="flex-1 text-yellow-200 text-sm">
                      <div className="font-medium mb-1">Security Warning</div>
                      <div>Never share your seed phrase with anyone. Make sure you're in a secure environment.</div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-purple-300 mb-2">Seed Phrase *</label>
                  <textarea
                    value={importSeedInput}
                    onChange={(e) => setImportSeedInput(e.target.value)}
                    className="input w-full text-purple-200 font-mono h-24"
                    placeholder="sXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                    autoFocus
                  />
                  <p className="text-purple-400 text-xs mt-1">Enter your XRPL seed phrase (starts with 's')</p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={importWalletFromSeed}
                    disabled={importingSeed || !importSeedInput.trim()}
                    className="btn-primary text-white px-6 py-3 rounded-lg font-medium flex-1 disabled:opacity-50"
                  >
                    {importingSeed ? '🔄 Importing...' : '📥 Import Wallet'}
                  </button>
                  <button
                    onClick={() => {
                      setShowImportSeedModal(false);
                      setImportSeedInput('');
                    }}
                    disabled={importingSeed}
                    className="btn text-purple-300 px-6 py-3 rounded-lg font-medium disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>

                <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                  <div className="text-purple-300 text-sm">
                    <div className="font-medium mb-2">ℹ️ About Importing</div>
                    <ul className="list-disc list-inside space-y-1">
                      <li>This will import an existing XRPL wallet using its seed phrase</li>
                      <li>The wallet will be checked on the mainnet network</li>
                      <li>Your seed phrase is securely stored locally in your browser</li>
                      <li>You'll get full control over the imported wallet</li>
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                  <div className="flex gap-3">
                    <div className="text-green-400 text-2xl">✓</div>
                    <div className="flex-1">
                      <div className="text-green-400 font-medium mb-1">Wallet Imported Successfully!</div>
                      <div className="text-green-300 text-sm">Please review the details and save this wallet.</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-purple-400 text-sm mb-2">Wallet Address</label>
                    <div className="input text-purple-200 font-mono break-all flex items-center justify-between gap-2">
                      <span>{importedWalletData.address}</span>
                      <button
                        onClick={() => copyToClipboard(importedWalletData.address, 'Address')}
                        className="btn text-purple-300 px-2 py-1 text-xs rounded"
                      >
                        📋
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-purple-400 text-sm mb-2">Public Key</label>
                    <div className="input text-purple-300 font-mono text-xs break-all">
                      {importedWalletData.publicKey}
                    </div>
                  </div>

                  <div>
                    <label className="block text-purple-400 text-sm mb-2">Current Balance</label>
                    <div className="input text-purple-200">
                      {importedWalletData.balance} XRP
                    </div>
                  </div>

                  <div>
                    <label className="block text-purple-300 mb-2">Wallet Name *</label>
                    <input
                      type="text"
                      id="importWalletName"
                      className="input w-full text-purple-200"
                      placeholder="My Imported Wallet"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      const walletName = document.getElementById('importWalletName').value;
                      saveImportedWallet(walletName);
                    }}
                    className="btn-primary text-white px-6 py-3 rounded-lg font-medium flex-1"
                  >
                    💾 Save Wallet
                  </button>
                  <button
                    onClick={() => {
                      setShowImportSeedModal(false);
                      setImportedWalletData(null);
                      setImportSeedInput('');
                    }}
                    className="btn text-purple-300 px-6 py-3 rounded-lg font-medium"
                  >
                    Cancel
                  </button>
                </div>

                <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                  <div className="text-purple-300 text-sm">
                    <div className="font-medium mb-2">📋 Next Steps:</div>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Verify the wallet address and balance</li>
                      <li>Give your wallet a memorable name</li>
                      <li>Save the wallet to your list</li>
                      <li>Start managing your tokens!</li>
                    </ol>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showPinModal && pendingSeedView && (
        <PinProtection
          walletAddress={pendingSeedView.address}
          onSuccess={() => {
            setShowSeedFor(pendingSeedView.id);
            setPendingSeedView(null);
            setShowPinModal(false);
          }}
          onCancel={() => {
            setPendingSeedView(null);
            setShowPinModal(false);
          }}
        />
      )}
    </div>
  );
}
