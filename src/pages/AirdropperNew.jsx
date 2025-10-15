import React, { useState, useEffect, useRef } from 'react';
import * as xrpl from 'xrpl';
import { supabase } from '../utils/supabase';
import toast from 'react-hot-toast';
import { XRPScanLink } from '../components/XRPScanLink';
import AirdropAnalytics from '../components/AirdropAnalytics';
import { loadUserTokens, formatTokenOption } from '../utils/tokenSelector';

const DISTRIBUTION_METHODS = [
  { id: 'fixed', name: 'Fixed Amount', icon: '📊' },
  { id: 'wallet_balance_percent', name: 'Wallet Balance %', icon: '💰' },
  { id: 'xrp_balance_percent', name: 'XRP Balance %', icon: '💎' },
  { id: 'token_balance_ratio', name: 'Token Balance 1:1', icon: '🔄' },
  { id: 'random_range', name: 'Random Range', icon: '🎲' }
];

export default function Airdropper() {
  const [connectedWallet, setConnectedWallet] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [tokens, setTokens] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [logs, setLogs] = useState([]);
  const [availableTokens, setAvailableTokens] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const processingRef = useRef(false);
  const pausedRef = useRef(false);

  const [newCampaign, setNewCampaign] = useState({
    name: '',
    intervalSeconds: 5,
    tokens: [{
      currency_code: '',
      issuer_address: '',
      distribution_method: 'fixed',
      amount: '',
      min_amount: '',
      max_amount: '',
      balance_percent: '',
      source_token_currency: '',
      source_token_issuer: ''
    }],
    recipientsList: ''
  });

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [analytics, setAnalytics] = useState({
    totalCampaigns: 0,
    activeCampaigns: 0,
    totalSent: 0,
    totalFees: 0
  });

  useEffect(() => {
    loadConnectedWallet();
  }, []);

  useEffect(() => {
    if (connectedWallet) {
      loadCampaigns();
      loadAnalytics();
      loadAvailableTokens();
    }
  }, [connectedWallet]);

  useEffect(() => {
    if (selectedCampaign) {
      loadCampaignDetails(selectedCampaign.id);
      const interval = setInterval(() => {
        loadCampaignDetails(selectedCampaign.id);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [selectedCampaign]);

  const loadConnectedWallet = async () => {
    const stored = localStorage.getItem('connectedWallet');
    if (stored) {
      const wallet = JSON.parse(stored);
      if (!wallet.seed && wallet.id) {
        try {
          const { data } = await supabase
            .from('wallets')
            .select('*')
            .eq('id', wallet.id)
            .maybeSingle();
          if (data) {
            const updatedWallet = {
              ...data,
              seed: data.encrypted_seed || data.seed
            };
            localStorage.setItem('connectedWallet', JSON.stringify(updatedWallet));
            setConnectedWallet(updatedWallet);
            return;
          }
        } catch (error) {
          console.error('Error refreshing wallet:', error);
        }
      }
      setConnectedWallet(wallet);
    }
  };

  const loadAvailableTokens = async () => {
    const tokens = await loadUserTokens(connectedWallet.address);
    setAvailableTokens(tokens.map(formatTokenOption));
  };

  const loadCampaigns = async () => {
    try {
      const { data, error } = await supabase
        .from('airdrop_campaigns')
        .select('*')
        .eq('wallet_address', connectedWallet.address)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCampaigns(data || []);
    } catch (error) {
      console.error('Error loading campaigns:', error);
    }
  };

  const loadCampaignDetails = async (campaignId) => {
    try {
      const [tokensData, recipientsData, transactionsData, logsData] = await Promise.all([
        supabase.from('airdrop_tokens').select('*').eq('campaign_id', campaignId),
        supabase.from('airdrop_recipients').select('*').eq('campaign_id', campaignId).order('created_at', { ascending: false }),
        supabase.from('airdrop_transactions').select('*').eq('campaign_id', campaignId).order('created_at', { ascending: false }),
        supabase.from('airdrop_logs').select('*').eq('campaign_id', campaignId).order('created_at', { ascending: false}).limit(100)
      ]);

      setTokens(tokensData.data || []);
      setRecipients(recipientsData.data || []);
      setTransactions(transactionsData.data || []);
      setLogs(logsData.data || []);
    } catch (error) {
      console.error('Error loading campaign details:', error);
    }
  };

  const loadAnalytics = async () => {
    try {
      const { data: campaignsData } = await supabase
        .from('airdrop_campaigns')
        .select('*')
        .eq('wallet_address', connectedWallet.address);

      const { data: transactionsData } = await supabase
        .from('airdrop_transactions')
        .select('fee_xrp')
        .in('campaign_id', (campaignsData || []).map(c => c.id))
        .eq('status', 'completed');

      setAnalytics({
        totalCampaigns: campaignsData?.length || 0,
        activeCampaigns: campaignsData?.filter(c => c.status === 'running' || c.status === 'paused').length || 0,
        totalSent: transactionsData?.length || 0,
        totalFees: transactionsData?.reduce((sum, tx) => sum + parseFloat(tx.fee_xrp), 0) || 0
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
  };

  const calculateFeeEstimate = () => {
    const recipientCount = newCampaign.recipientsList.split('\n').filter(addr => addr.trim()).length;
    const tokenCount = newCampaign.tokens.filter(t => t.currency_code && t.issuer_address).length;
    return (recipientCount * tokenCount * 0.01).toFixed(2);
  };

  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const lines = text.split('\n').filter(line => line.trim());
      const addresses = lines.map(line => line.split(',')[0].trim()).filter(addr => addr);
      setNewCampaign({ ...newCampaign, recipientsList: addresses.join('\n') });
      toast.success(`Imported ${addresses.length} addresses`);
    };
    reader.readAsText(file);
  };

  const addToken = () => {
    setNewCampaign({
      ...newCampaign,
      tokens: [...newCampaign.tokens, {
        currency_code: '',
        issuer_address: '',
        distribution_method: 'fixed',
        amount: '',
        min_amount: '',
        max_amount: '',
        balance_percent: '',
        source_token_currency: '',
        source_token_issuer: ''
      }]
    });
  };

  const removeToken = (index) => {
    const newTokens = newCampaign.tokens.filter((_, i) => i !== index);
    setNewCampaign({ ...newCampaign, tokens: newTokens });
  };

  const updateToken = (index, field, value) => {
    const newTokens = [...newCampaign.tokens];
    newTokens[index][field] = value;
    setNewCampaign({ ...newCampaign, tokens: newTokens });
  };

  const selectTokenFromDropdown = (index, selectedToken) => {
    const newTokens = [...newCampaign.tokens];
    newTokens[index].currency_code = selectedToken.currency_code;
    newTokens[index].issuer_address = selectedToken.issuer_address;
    setNewCampaign({ ...newCampaign, tokens: newTokens });
  };

  const createCampaign = async () => {
    if (!newCampaign.name.trim()) {
      toast.error('Please enter a campaign name');
      return;
    }

    const validTokens = newCampaign.tokens.filter(t => {
      if (!t.currency_code || !t.issuer_address) return false;

      switch (t.distribution_method) {
        case 'fixed':
          return t.amount && parseFloat(t.amount) > 0;
        case 'wallet_balance_percent':
        case 'xrp_balance_percent':
          return t.balance_percent && parseFloat(t.balance_percent) > 0;
        case 'token_balance_ratio':
          return t.source_token_currency && t.source_token_issuer;
        case 'random_range':
          return t.min_amount && t.max_amount && parseFloat(t.min_amount) <= parseFloat(t.max_amount);
        default:
          return false;
      }
    });

    if (validTokens.length === 0) {
      toast.error('Please add at least one valid token');
      return;
    }

    const recipientAddresses = newCampaign.recipientsList.split('\n').filter(addr => addr.trim());
    if (recipientAddresses.length === 0) {
      toast.error('Please add at least one recipient');
      return;
    }

    try {
      const totalTransactions = recipientAddresses.length * validTokens.length;

      const { data: campaign, error: campaignError } = await supabase
        .from('airdrop_campaigns')
        .insert({
          wallet_address: connectedWallet.address,
          name: newCampaign.name,
          total_recipients: recipientAddresses.length,
          total_transactions: totalTransactions,
          interval_seconds: Math.max(5, parseInt(newCampaign.intervalSeconds))
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      const tokenInserts = validTokens.map(token => ({
        campaign_id: campaign.id,
        currency_code: token.currency_code,
        issuer_address: token.issuer_address,
        distribution_method: token.distribution_method,
        amount: token.distribution_method === 'fixed' ? parseFloat(token.amount) : null,
        min_amount: token.distribution_method === 'random_range' ? parseFloat(token.min_amount) : null,
        max_amount: token.distribution_method === 'random_range' ? parseFloat(token.max_amount) : null,
        balance_percent: ['wallet_balance_percent', 'xrp_balance_percent'].includes(token.distribution_method)
          ? parseFloat(token.balance_percent) : null,
        source_token_currency: token.distribution_method === 'token_balance_ratio' ? token.source_token_currency : null,
        source_token_issuer: token.distribution_method === 'token_balance_ratio' ? token.source_token_issuer : null
      }));

      const { data: insertedTokens } = await supabase
        .from('airdrop_tokens')
        .insert(tokenInserts)
        .select();

      const recipientInserts = recipientAddresses.map(addr => ({
        campaign_id: campaign.id,
        wallet_address: addr.trim()
      }));

      const { data: insertedRecipients } = await supabase
        .from('airdrop_recipients')
        .insert(recipientInserts)
        .select();

      const transactionInserts = [];
      for (const recipient of insertedRecipients) {
        for (const token of insertedTokens) {
          transactionInserts.push({
            campaign_id: campaign.id,
            recipient_id: recipient.id,
            token_id: token.id,
            amount: 0,
            fee_xrp: 0.01,
            status: 'pending'
          });
        }
      }

      await supabase.from('airdrop_transactions').insert(transactionInserts);

      await supabase.from('airdrop_logs').insert({
        campaign_id: campaign.id,
        log_type: 'info',
        message: `Campaign created with ${validTokens.length} tokens, ${recipientAddresses.length} recipients, ${totalTransactions} transactions`
      });

      toast.success('Campaign created!');
      setShowCreateModal(false);
      setNewCampaign({
        name: '',
        intervalSeconds: 5,
        tokens: [{
          currency_code: '',
          issuer_address: '',
          distribution_method: 'fixed',
          amount: '',
          min_amount: '',
          max_amount: '',
          balance_percent: '',
          source_token_currency: '',
          source_token_issuer: ''
        }],
        recipientsList: ''
      });
      loadCampaigns();
    } catch (error) {
      console.error('Error creating campaign:', error);
      toast.error('Failed to create campaign');
    }
  };

  if (!connectedWallet) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6 flex items-center justify-center">
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 max-w-md text-center">
          <div className="text-6xl mb-4">✈️</div>
          <h2 className="text-2xl font-bold mb-4">Connect Your Wallet</h2>
          <p className="text-slate-400">Please connect a wallet to use the Airdropper</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 text-transparent bg-clip-text">
              Multi-Token Airdropper
            </h1>
            <p className="text-slate-400">Advanced batch token distribution with comprehensive analytics</p>
          </div>
          <button
            onClick={() => setShowInfoModal(true)}
            className="px-4 py-2 bg-blue-500/10 border border-blue-500/30 rounded-xl hover:bg-blue-500/20 transition-all flex items-center gap-2"
          >
            <span>ℹ️</span>
            <span>How It Works</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6">
            <div className="text-sm text-slate-400 mb-2">Total Campaigns</div>
            <div className="text-3xl font-bold text-white mb-1">{analytics.totalCampaigns}</div>
            <div className="text-xs text-slate-500">All time</div>
          </div>
          <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/5 border border-green-500/20 rounded-2xl p-6">
            <div className="text-sm text-green-300 mb-2">Active Now</div>
            <div className="text-3xl font-bold text-white mb-1">{analytics.activeCampaigns}</div>
            <div className="text-xs text-green-400">Running campaigns</div>
          </div>
          <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border border-blue-500/20 rounded-2xl p-6">
            <div className="text-sm text-blue-300 mb-2">Transactions</div>
            <div className="text-3xl font-bold text-white mb-1">{analytics.totalSent}</div>
            <div className="text-xs text-blue-400">Successful sends</div>
          </div>
          <div className="bg-gradient-to-br from-orange-500/10 to-red-500/5 border border-orange-500/20 rounded-2xl p-6">
            <div className="text-sm text-orange-300 mb-2">Total Fees</div>
            <div className="text-3xl font-bold text-white mb-1">{analytics.totalFees.toFixed(2)}</div>
            <div className="text-xs text-orange-400">XRP paid</div>
          </div>
        </div>

        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Campaigns</h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-xl font-medium hover:shadow-lg hover:shadow-purple-500/50 transition-all"
          >
            Create Campaign
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            {campaigns.length === 0 ? (
              <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-12 text-center">
                <div className="text-5xl mb-4">📭</div>
                <p className="text-slate-400">No campaigns yet</p>
                <p className="text-sm text-slate-500 mt-2">Create your first airdrop campaign</p>
              </div>
            ) : (
              campaigns.map(campaign => (
                <div
                  key={campaign.id}
                  onClick={() => setSelectedCampaign(campaign)}
                  className={`backdrop-blur-xl border rounded-2xl p-5 cursor-pointer transition-all ${
                    selectedCampaign?.id === campaign.id
                      ? 'bg-gradient-to-br from-purple-500/20 to-blue-500/10 border-purple-500/50 shadow-lg shadow-purple-500/20'
                      : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600'
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-bold text-lg truncate flex-1">{campaign.name}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      campaign.status === 'running' ? 'bg-green-500/20 text-green-300 border border-green-500/30' :
                      campaign.status === 'paused' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' :
                      campaign.status === 'completed' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                      campaign.status === 'failed' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                      'bg-slate-500/20 text-slate-300 border border-slate-500/30'
                    }`}>
                      {campaign.status}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm text-slate-400">
                    <div className="flex justify-between">
                      <span>Recipients:</span>
                      <span className="text-white font-medium">{campaign.completed_recipients}/{campaign.total_recipients}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Transactions:</span>
                      <span className="text-white font-medium">{campaign.completed_transactions || 0}/{campaign.total_transactions || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Interval:</span>
                      <span className="text-white font-medium">{campaign.interval_seconds}s</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="lg:col-span-2 space-y-6">
            {selectedCampaign ? (
              <>
                <AirdropAnalytics campaign={selectedCampaign} transactions={transactions} recipients={recipients} />

                <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <span>🪙</span>
                    <span>Tokens ({tokens.length})</span>
                  </h3>
                  {tokens.length === 0 ? (
                    <p className="text-slate-400 text-center py-8">No tokens configured</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {tokens.map(token => (
                        <div key={token.id} className="bg-slate-700/30 rounded-xl p-4 border border-slate-600/30">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1">
                              <div className="font-bold text-white">{token.currency_code}</div>
                              <div className="text-xs text-slate-400 truncate">{token.issuer_address}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-purple-300 bg-purple-500/10 px-2 py-1 rounded-lg mb-2">
                            <span>{DISTRIBUTION_METHODS.find(m => m.id === token.distribution_method)?.icon}</span>
                            <span>{DISTRIBUTION_METHODS.find(m => m.id === token.distribution_method)?.name}</span>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-slate-400">Sent: <span className="text-white font-medium">{parseFloat(token.total_sent || 0).toFixed(2)}</span></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      <span>📊</span>
                      <span>Transactions ({transactions.length})</span>
                    </h3>
                  </div>
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {transactions.slice(0, 50).map(tx => {
                      const recipient = recipients.find(r => r.id === tx.recipient_id);
                      const token = tokens.find(t => t.id === tx.token_id);
                      return (
                        <div key={tx.id} className="bg-slate-700/30 rounded-xl p-3 border border-slate-600/30">
                          <div className="flex justify-between items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm text-white font-mono truncate">{recipient?.wallet_address}</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-slate-400">
                                <span className="font-medium text-purple-300">{token?.currency_code}</span>
                                {tx.amount && <span className="text-green-400">{parseFloat(tx.amount).toFixed(6)}</span>}
                                <span className="text-orange-400">{tx.fee_xrp} XRP fee</span>
                              </div>
                              {tx.tx_hash && (
                                <div className="mt-1">
                                  <XRPScanLink type="tx" value={tx.tx_hash} network="mainnet" />
                                </div>
                              )}
                              {tx.error_message && (
                                <div className="text-xs text-red-400 mt-1">{tx.error_message}</div>
                              )}
                            </div>
                            <span className={`px-2 py-1 rounded-lg text-xs whitespace-nowrap font-medium ${
                              tx.status === 'completed' ? 'bg-green-500/20 text-green-300 border border-green-500/30' :
                              tx.status === 'processing' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                              tx.status === 'failed' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                              'bg-slate-500/20 text-slate-300 border border-slate-500/30'
                            }`}>
                              {tx.status}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-20 text-center">
                <div className="text-6xl mb-4">👈</div>
                <p className="text-slate-400 text-lg">Select a campaign to view details</p>
                <p className="text-sm text-slate-500 mt-2">Choose from the list on the left</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-3xl w-full my-8">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Create Airdrop Campaign</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-slate-400 hover:text-white text-2xl"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-2">
                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-300">Campaign Name</label>
                  <input
                    type="text"
                    value={newCampaign.name}
                    onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl focus:outline-none focus:border-purple-500 text-white placeholder-slate-500"
                    placeholder="My Token Airdrop"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-300">Interval Between Recipients (seconds)</label>
                  <input
                    type="number"
                    min="5"
                    value={newCampaign.intervalSeconds}
                    onChange={(e) => setNewCampaign({ ...newCampaign, intervalSeconds: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl focus:outline-none focus:border-purple-500 text-white"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-3">
                    <label className="block text-sm font-medium text-slate-300">Tokens to Airdrop</label>
                    <button
                      onClick={addToken}
                      className="px-4 py-2 bg-purple-500/20 border border-purple-500/30 rounded-xl text-sm hover:bg-purple-500/30 transition-all text-purple-300"
                    >
                      + Add Token
                    </button>
                  </div>
                  <div className="space-y-4">
                    {newCampaign.tokens.map((token, index) => (
                      <div key={index} className="bg-slate-700/30 rounded-xl p-4 space-y-3 border border-slate-600/30">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-white">Token {index + 1}</span>
                          {newCampaign.tokens.length > 1 && (
                            <button
                              onClick={() => removeToken(index)}
                              className="text-red-400 hover:text-red-300 text-sm font-medium"
                            >
                              Remove
                            </button>
                          )}
                        </div>

                        {availableTokens.length > 0 && (
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">Select from your tokens</label>
                            <select
                              onChange={(e) => {
                                const selected = availableTokens.find(t => t.value === e.target.value);
                                if (selected) selectTokenFromDropdown(index, selected);
                              }}
                              className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg focus:outline-none focus:border-purple-500 text-white text-sm"
                            >
                              <option value="">Choose a token...</option>
                              {availableTokens.map(token => (
                                <option key={token.value} value={token.value}>
                                  {token.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={token.currency_code}
                            onChange={(e) => updateToken(index, 'currency_code', e.target.value)}
                            className="px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg focus:outline-none focus:border-purple-500 text-white text-sm placeholder-slate-500"
                            placeholder="Currency Code"
                          />
                          <input
                            type="text"
                            value={token.issuer_address}
                            onChange={(e) => updateToken(index, 'issuer_address', e.target.value)}
                            className="px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg focus:outline-none focus:border-purple-500 text-white text-sm placeholder-slate-500"
                            placeholder="Issuer Address"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Distribution Method</label>
                          <select
                            value={token.distribution_method}
                            onChange={(e) => updateToken(index, 'distribution_method', e.target.value)}
                            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg focus:outline-none focus:border-purple-500 text-white text-sm"
                          >
                            {DISTRIBUTION_METHODS.map(method => (
                              <option key={method.id} value={method.id}>{method.icon} {method.name}</option>
                            ))}
                          </select>
                        </div>

                        {token.distribution_method === 'fixed' && (
                          <input
                            type="number"
                            value={token.amount}
                            onChange={(e) => updateToken(index, 'amount', e.target.value)}
                            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg focus:outline-none focus:border-purple-500 text-white text-sm placeholder-slate-500"
                            placeholder="Amount per recipient"
                            step="0.000001"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-300">Recipients (one per line or import CSV)</label>
                  <label className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl cursor-pointer hover:bg-slate-700 transition-all text-center block mb-2 text-purple-300">
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleCSVUpload}
                      className="hidden"
                    />
                    📁 Import CSV
                  </label>
                  <textarea
                    value={newCampaign.recipientsList}
                    onChange={(e) => setNewCampaign({ ...newCampaign, recipientsList: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl focus:outline-none focus:border-purple-500 h-32 font-mono text-sm text-white placeholder-slate-500"
                    placeholder="rAddress1&#10;rAddress2&#10;rAddress3"
                  />
                  <div className="text-sm text-slate-400 mt-2">
                    {newCampaign.recipientsList.split('\n').filter(addr => addr.trim()).length} recipients
                  </div>
                </div>

                <div className="bg-gradient-to-br from-orange-500/10 to-red-500/5 border border-orange-500/30 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium text-orange-300">Fee Estimate</div>
                    <div className="text-3xl font-bold text-white">{calculateFeeEstimate()} XRP</div>
                  </div>
                  <div className="text-xs text-orange-400">
                    {newCampaign.recipientsList.split('\n').filter(addr => addr.trim()).length} recipients × {newCampaign.tokens.filter(t => t.currency_code && t.issuer_address).length} tokens × 0.01 XRP per transaction
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={createCampaign}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-xl font-medium hover:shadow-lg hover:shadow-purple-500/50 transition-all"
                  >
                    Create Campaign
                  </button>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="px-6 py-3 bg-slate-700/50 rounded-xl font-medium hover:bg-slate-700 transition-all border border-slate-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
