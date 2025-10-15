import React, { useState, useEffect, useRef } from 'react';
import * as xrpl from 'xrpl';
import { supabase } from '../utils/supabase';
import toast from 'react-hot-toast';

export default function Airdropper() {
  const [connectedWallet, setConnectedWallet] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [tokens, setTokens] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [logs, setLogs] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const processingRef = useRef(false);
  const pausedRef = useRef(false);

  const [newCampaign, setNewCampaign] = useState({
    name: '',
    intervalSeconds: 5,
    tokens: [{ currency_code: '', issuer_address: '', amount: '' }],
    recipientsList: ''
  });

  const [csvFile, setCsvFile] = useState(null);
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
      const [tokensData, recipientsData, logsData] = await Promise.all([
        supabase.from('airdrop_tokens').select('*').eq('campaign_id', campaignId),
        supabase.from('airdrop_recipients').select('*').eq('campaign_id', campaignId).order('created_at', { ascending: false }),
        supabase.from('airdrop_logs').select('*').eq('campaign_id', campaignId).order('created_at', { ascending: false }).limit(100)
      ]);

      setTokens(tokensData.data || []);
      setRecipients(recipientsData.data || []);
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

      const { data: recipientsData } = await supabase
        .from('airdrop_recipients')
        .select('xrp_fee_paid')
        .in('campaign_id', (campaignsData || []).map(c => c.id))
        .eq('status', 'completed');

      setAnalytics({
        totalCampaigns: campaignsData?.length || 0,
        activeCampaigns: campaignsData?.filter(c => c.status === 'running' || c.status === 'paused').length || 0,
        totalSent: recipientsData?.length || 0,
        totalFees: recipientsData?.reduce((sum, r) => sum + parseFloat(r.xrp_fee_paid), 0) || 0
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
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
      tokens: [...newCampaign.tokens, { currency_code: '', issuer_address: '', amount: '' }]
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

  const createCampaign = async () => {
    if (!newCampaign.name.trim()) {
      toast.error('Please enter a campaign name');
      return;
    }

    const validTokens = newCampaign.tokens.filter(t => t.currency_code && t.issuer_address && t.amount);
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
      const { data: campaign, error: campaignError } = await supabase
        .from('airdrop_campaigns')
        .insert({
          wallet_address: connectedWallet.address,
          name: newCampaign.name,
          total_recipients: recipientAddresses.length,
          interval_seconds: Math.max(5, parseInt(newCampaign.intervalSeconds))
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      const tokenInserts = validTokens.map(token => ({
        campaign_id: campaign.id,
        currency_code: token.currency_code,
        issuer_address: token.issuer_address,
        amount: parseFloat(token.amount)
      }));

      await supabase.from('airdrop_tokens').insert(tokenInserts);

      const recipientInserts = recipientAddresses.map(addr => ({
        campaign_id: campaign.id,
        wallet_address: addr.trim()
      }));

      await supabase.from('airdrop_recipients').insert(recipientInserts);

      await supabase.from('airdrop_logs').insert({
        campaign_id: campaign.id,
        log_type: 'info',
        message: `Campaign created with ${validTokens.length} tokens and ${recipientAddresses.length} recipients`
      });

      toast.success('Campaign created successfully!');
      setShowCreateModal(false);
      setNewCampaign({
        name: '',
        intervalSeconds: 5,
        tokens: [{ currency_code: '', issuer_address: '', amount: '' }],
        recipientsList: ''
      });
      loadCampaigns();
    } catch (error) {
      console.error('Error creating campaign:', error);
      toast.error('Failed to create campaign');
    }
  };

  const estimateFees = () => {
    const recipientCount = newCampaign.recipientsList.split('\n').filter(addr => addr.trim()).length;
    return (recipientCount * 0.01).toFixed(2);
  };

  const logMessage = async (campaignId, type, message, details = null) => {
    try {
      await supabase.from('airdrop_logs').insert({
        campaign_id: campaignId,
        log_type: type,
        message,
        details
      });
    } catch (error) {
      console.error('Error logging:', error);
    }
  };

  const startCampaign = async (campaign) => {
    if (processingRef.current) {
      toast.error('Another campaign is already running');
      return;
    }

    processingRef.current = true;
    setIsProcessing(true);
    setSelectedCampaign(campaign);

    try {
      await supabase
        .from('airdrop_campaigns')
        .update({ status: 'running', started_at: new Date().toISOString() })
        .eq('id', campaign.id);

      await logMessage(campaign.id, 'info', 'Campaign started');

      const { data: campaignTokens } = await supabase
        .from('airdrop_tokens')
        .select('*')
        .eq('campaign_id', campaign.id);

      const { data: pendingRecipients } = await supabase
        .from('airdrop_recipients')
        .select('*')
        .eq('campaign_id', campaign.id)
        .eq('status', 'pending')
        .order('created_at');

      const client = new xrpl.Client('wss://xrplcluster.com');
      await client.connect();
      const wallet = xrpl.Wallet.fromSeed(connectedWallet.seed);

      for (let i = 0; i < pendingRecipients.length; i++) {
        if (pausedRef.current) {
          await logMessage(campaign.id, 'warning', 'Campaign paused by user');
          break;
        }

        const recipient = pendingRecipients[i];

        await supabase
          .from('airdrop_recipients')
          .update({ status: 'processing' })
          .eq('id', recipient.id);

        await logMessage(campaign.id, 'info', `Processing recipient ${i + 1}/${pendingRecipients.length}: ${recipient.wallet_address}`);

        try {
          for (const token of campaignTokens) {
            const payment = {
              TransactionType: 'Payment',
              Account: wallet.address,
              Destination: recipient.wallet_address,
              Amount: {
                currency: token.currency_code,
                value: token.amount.toString(),
                issuer: token.issuer_address
              }
            };

            const prepared = await client.autofill(payment);
            const signed = wallet.sign(prepared);
            const result = await client.submitAndWait(signed.tx_blob);

            if (result.result.meta.TransactionResult === 'tesSUCCESS') {
              await supabase
                .from('airdrop_tokens')
                .update({ total_sent: parseFloat(token.total_sent) + parseFloat(token.amount) })
                .eq('id', token.id);

              await logMessage(campaign.id, 'success', `Sent ${token.amount} ${token.currency_code} to ${recipient.wallet_address}`, { tx_hash: result.result.hash });
            } else {
              throw new Error(`Transaction failed: ${result.result.meta.TransactionResult}`);
            }
          }

          await supabase
            .from('airdrop_recipients')
            .update({
              status: 'completed',
              processed_at: new Date().toISOString()
            })
            .eq('id', recipient.id);

          await supabase
            .from('airdrop_campaigns')
            .update({ completed_recipients: campaign.completed_recipients + 1 })
            .eq('id', campaign.id);

        } catch (error) {
          await supabase
            .from('airdrop_recipients')
            .update({
              status: 'failed',
              error_message: error.message,
              processed_at: new Date().toISOString()
            })
            .eq('id', recipient.id);

          await supabase
            .from('airdrop_campaigns')
            .update({ failed_recipients: campaign.failed_recipients + 1 })
            .eq('id', campaign.id);

          await logMessage(campaign.id, 'error', `Failed to process ${recipient.wallet_address}: ${error.message}`);
        }

        if (i < pendingRecipients.length - 1) {
          await new Promise(resolve => setTimeout(resolve, campaign.interval_seconds * 1000));
        }
      }

      await client.disconnect();

      if (!pausedRef.current) {
        await supabase
          .from('airdrop_campaigns')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', campaign.id);

        await logMessage(campaign.id, 'success', 'Campaign completed successfully');
        toast.success('Campaign completed!');
      }

    } catch (error) {
      console.error('Campaign error:', error);
      await logMessage(campaign.id, 'error', `Campaign failed: ${error.message}`);
      await supabase
        .from('airdrop_campaigns')
        .update({ status: 'failed' })
        .eq('id', campaign.id);
      toast.error('Campaign failed');
    } finally {
      processingRef.current = false;
      pausedRef.current = false;
      setIsProcessing(false);
      setIsPaused(false);
      loadCampaigns();
      if (selectedCampaign) {
        loadCampaignDetails(selectedCampaign.id);
      }
    }
  };

  const pauseCampaign = async (campaign) => {
    pausedRef.current = true;
    setIsPaused(true);
    await supabase
      .from('airdrop_campaigns')
      .update({ status: 'paused', paused_at: new Date().toISOString() })
      .eq('id', campaign.id);
    toast.info('Campaign pausing...');
  };

  const resumeCampaign = async (campaign) => {
    pausedRef.current = false;
    setIsPaused(false);
    startCampaign(campaign);
  };

  const exportLogs = () => {
    if (logs.length === 0) {
      toast.error('No logs to export');
      return;
    }

    const csv = [
      ['Timestamp', 'Type', 'Message'],
      ...logs.map(log => [
        new Date(log.created_at).toLocaleString(),
        log.log_type,
        log.message
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `airdrop-logs-${selectedCampaign.name}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Logs exported!');
  };

  const exportRecipients = () => {
    if (recipients.length === 0) {
      toast.error('No recipients to export');
      return;
    }

    const csv = [
      ['Wallet Address', 'Status', 'TX Hash', 'Processed At', 'Error'],
      ...recipients.map(r => [
        r.wallet_address,
        r.status,
        r.tx_hash || '',
        r.processed_at ? new Date(r.processed_at).toLocaleString() : '',
        r.error_message || ''
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `airdrop-recipients-${selectedCampaign.name}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Recipients exported!');
  };

  if (!connectedWallet) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-6">
        <div className="max-w-md mx-auto mt-20 text-center">
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-8">
            <h2 className="text-2xl font-bold mb-4">Connect Your Wallet</h2>
            <p className="text-gray-300">Please connect a wallet to use the Airdropper</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-pink-400 text-transparent bg-clip-text">
            Multi-Token Airdropper
          </h1>
          <p className="text-gray-300">Batch send multiple tokens to multiple recipients with intelligent processing</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4">
            <div className="text-sm text-gray-400 mb-1">Total Campaigns</div>
            <div className="text-2xl font-bold">{analytics.totalCampaigns}</div>
          </div>
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4">
            <div className="text-sm text-gray-400 mb-1">Active Campaigns</div>
            <div className="text-2xl font-bold text-green-400">{analytics.activeCampaigns}</div>
          </div>
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4">
            <div className="text-sm text-gray-400 mb-1">Total Sent</div>
            <div className="text-2xl font-bold">{analytics.totalSent}</div>
          </div>
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4">
            <div className="text-sm text-gray-400 mb-1">Total Fees Paid</div>
            <div className="text-2xl font-bold">{analytics.totalFees.toFixed(2)} XRP</div>
          </div>
        </div>

        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Campaigns</h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg font-medium hover:shadow-lg hover:shadow-purple-500/50 transition-all"
          >
            Create Campaign
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            {campaigns.length === 0 ? (
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-8 text-center">
                <p className="text-gray-400">No campaigns yet</p>
              </div>
            ) : (
              campaigns.map(campaign => (
                <div
                  key={campaign.id}
                  onClick={() => setSelectedCampaign(campaign)}
                  className={`bg-white/10 backdrop-blur-md border rounded-xl p-4 cursor-pointer transition-all ${
                    selectedCampaign?.id === campaign.id ? 'border-purple-500 shadow-lg shadow-purple-500/50' : 'border-white/20 hover:border-purple-400'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold truncate">{campaign.name}</h3>
                    <span className={`px-2 py-1 rounded text-xs ${
                      campaign.status === 'running' ? 'bg-green-500/20 text-green-300' :
                      campaign.status === 'paused' ? 'bg-yellow-500/20 text-yellow-300' :
                      campaign.status === 'completed' ? 'bg-blue-500/20 text-blue-300' :
                      campaign.status === 'failed' ? 'bg-red-500/20 text-red-300' :
                      'bg-gray-500/20 text-gray-300'
                    }`}>
                      {campaign.status}
                    </span>
                  </div>
                  <div className="text-sm text-gray-400 space-y-1">
                    <div>Recipients: {campaign.completed_recipients}/{campaign.total_recipients}</div>
                    <div>Failed: {campaign.failed_recipients}</div>
                    <div>Interval: {campaign.interval_seconds}s</div>
                  </div>
                  {campaign.status === 'pending' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); startCampaign(campaign); }}
                      className="mt-3 w-full px-4 py-2 bg-green-500 rounded-lg text-sm font-medium hover:bg-green-600 transition-all"
                      disabled={isProcessing}
                    >
                      Start Campaign
                    </button>
                  )}
                  {campaign.status === 'running' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); pauseCampaign(campaign); }}
                      className="mt-3 w-full px-4 py-2 bg-yellow-500 rounded-lg text-sm font-medium hover:bg-yellow-600 transition-all"
                    >
                      Pause Campaign
                    </button>
                  )}
                  {campaign.status === 'paused' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); resumeCampaign(campaign); }}
                      className="mt-3 w-full px-4 py-2 bg-green-500 rounded-lg text-sm font-medium hover:bg-green-600 transition-all"
                      disabled={isProcessing}
                    >
                      Resume Campaign
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="lg:col-span-2 space-y-6">
            {selectedCampaign ? (
              <>
                <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold">Tokens</h3>
                  </div>
                  {tokens.length === 0 ? (
                    <p className="text-gray-400 text-center py-4">No tokens</p>
                  ) : (
                    <div className="space-y-2">
                      {tokens.map(token => (
                        <div key={token.id} className="bg-white/5 rounded-lg p-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium">{token.currency_code}</div>
                              <div className="text-sm text-gray-400 truncate">{token.issuer_address}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold">{token.amount}</div>
                              <div className="text-xs text-gray-400">Sent: {token.total_sent}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold">Recipients ({recipients.length})</h3>
                    <button
                      onClick={exportRecipients}
                      className="px-3 py-1 bg-white/10 rounded-lg text-sm hover:bg-white/20 transition-all"
                    >
                      Export CSV
                    </button>
                  </div>
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {recipients.map(recipient => (
                      <div key={recipient.id} className="bg-white/5 rounded-lg p-3 flex justify-between items-center">
                        <div className="truncate flex-1">
                          <div className="font-mono text-sm truncate">{recipient.wallet_address}</div>
                          {recipient.error_message && (
                            <div className="text-xs text-red-400 mt-1">{recipient.error_message}</div>
                          )}
                        </div>
                        <span className={`px-2 py-1 rounded text-xs ml-2 ${
                          recipient.status === 'completed' ? 'bg-green-500/20 text-green-300' :
                          recipient.status === 'processing' ? 'bg-blue-500/20 text-blue-300' :
                          recipient.status === 'failed' ? 'bg-red-500/20 text-red-300' :
                          'bg-gray-500/20 text-gray-300'
                        }`}>
                          {recipient.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold">Activity Log</h3>
                    <button
                      onClick={exportLogs}
                      className="px-3 py-1 bg-white/10 rounded-lg text-sm hover:bg-white/20 transition-all"
                    >
                      Export CSV
                    </button>
                  </div>
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {logs.map(log => (
                      <div key={log.id} className="bg-white/5 rounded-lg p-3">
                        <div className="flex items-start gap-2">
                          <span className={`px-2 py-1 rounded text-xs ${
                            log.log_type === 'success' ? 'bg-green-500/20 text-green-300' :
                            log.log_type === 'error' ? 'bg-red-500/20 text-red-300' :
                            log.log_type === 'warning' ? 'bg-yellow-500/20 text-yellow-300' :
                            'bg-blue-500/20 text-blue-300'
                          }`}>
                            {log.log_type}
                          </span>
                          <div className="flex-1">
                            <div className="text-sm">{log.message}</div>
                            <div className="text-xs text-gray-400 mt-1">
                              {new Date(log.created_at).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-12 text-center">
                <p className="text-gray-400 text-lg">Select a campaign to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl border border-white/20 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Create Airdrop Campaign</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Campaign Name</label>
                  <input
                    type="text"
                    value={newCampaign.name}
                    onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:border-purple-500"
                    placeholder="My Token Airdrop"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Interval Between Recipients (seconds, min 5)</label>
                  <input
                    type="number"
                    min="5"
                    value={newCampaign.intervalSeconds}
                    onChange={(e) => setNewCampaign({ ...newCampaign, intervalSeconds: e.target.value })}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium">Tokens to Airdrop</label>
                    <button
                      onClick={addToken}
                      className="px-3 py-1 bg-purple-500 rounded-lg text-sm hover:bg-purple-600"
                    >
                      Add Token
                    </button>
                  </div>
                  <div className="space-y-3">
                    {newCampaign.tokens.map((token, index) => (
                      <div key={index} className="bg-white/5 rounded-lg p-4">
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-sm font-medium">Token {index + 1}</span>
                          {newCampaign.tokens.length > 1 && (
                            <button
                              onClick={() => removeToken(index)}
                              className="text-red-400 hover:text-red-300 text-sm"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={token.currency_code}
                            onChange={(e) => updateToken(index, 'currency_code', e.target.value)}
                            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:border-purple-500 text-sm"
                            placeholder="Currency Code"
                          />
                          <input
                            type="text"
                            value={token.issuer_address}
                            onChange={(e) => updateToken(index, 'issuer_address', e.target.value)}
                            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:border-purple-500 text-sm"
                            placeholder="Issuer Address"
                          />
                          <input
                            type="number"
                            value={token.amount}
                            onChange={(e) => updateToken(index, 'amount', e.target.value)}
                            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:border-purple-500 text-sm"
                            placeholder="Amount per recipient"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Recipients (one per line or import CSV)</label>
                  <div className="flex gap-2 mb-2">
                    <label className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-lg cursor-pointer hover:bg-white/20 transition-all text-center">
                      <input
                        type="file"
                        accept=".csv"
                        onChange={handleCSVUpload}
                        className="hidden"
                      />
                      Import CSV
                    </label>
                  </div>
                  <textarea
                    value={newCampaign.recipientsList}
                    onChange={(e) => setNewCampaign({ ...newCampaign, recipientsList: e.target.value })}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:border-purple-500 h-32"
                    placeholder="rAddress1&#10;rAddress2&#10;rAddress3"
                  />
                  <div className="text-sm text-gray-400 mt-1">
                    {newCampaign.recipientsList.split('\n').filter(addr => addr.trim()).length} recipients
                  </div>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                  <div className="text-sm font-medium mb-2">Fee Estimate</div>
                  <div className="text-2xl font-bold text-blue-400">{estimateFees()} XRP</div>
                  <div className="text-xs text-gray-400 mt-1">0.01 XRP per recipient for transaction fees</div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={createCampaign}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg font-medium hover:shadow-lg hover:shadow-purple-500/50 transition-all"
                  >
                    Create Campaign
                  </button>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="px-6 py-3 bg-white/10 rounded-lg font-medium hover:bg-white/20 transition-all"
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
