import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../utils/supabase';
import * as xrpl from 'xrpl';
import toast from 'react-hot-toast';
import { createChart } from 'lightweight-charts';

const FUND_ADDRESS = 'rphatRpwXcPAo7CVm46dC78JAQ6kLMqb2M';
const FUND_SEED = 'sEd7W72aANTbLTG98XDhU1yfotPJdhu';

export default function XRPRewards() {
  const [connectedWallet, setConnectedWallet] = useState(null);
  const [rewards, setRewards] = useState([]);
  const [stats, setStats] = useState({
    totalEarned: 0,
    totalClaimed: 0,
    pending: 0,
    lifetimeEarnings: 0
  });
  const [earningStats, setEarningStats] = useState({
    tokensCreated: 0,
    botsCreated: 0,
    tradesExecuted: 0,
    rewardsByType: {}
  });
  const [globalStats, setGlobalStats] = useState({
    totalXRPPaid: 0,
    totalXRPClaimed: 0,
    totalUSDPaid: 0,
    totalUSDClaimed: 0
  });
  const [xrpPrice, setXrpPrice] = useState(2.50);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimProgress, setClaimProgress] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    loadConnectedWallet();

    const handleWalletChange = () => loadConnectedWallet();
    window.addEventListener('walletConnected', handleWalletChange);
    window.addEventListener('walletDisconnected', handleWalletChange);

    return () => {
      window.removeEventListener('walletConnected', handleWalletChange);
      window.removeEventListener('walletDisconnected', handleWalletChange);
    };
  }, []);

  useEffect(() => {
    fetchXRPPrice();
    loadGlobalStats();
  }, []);

  useEffect(() => {
    if (connectedWallet) {
      loadRewards();
    }
  }, [connectedWallet]);

  useEffect(() => {
    if (chartData.length > 0) {
      renderChart();
    }
  }, [chartData]);

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
    } else {
      setConnectedWallet(null);
    }
  };

  const fetchXRPPrice = async () => {
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd');
      const data = await response.json();
      if (data.ripple?.usd) {
        setXrpPrice(data.ripple.usd);
      }
    } catch (error) {
      console.error('Failed to fetch XRP price:', error);
    }
  };

  const loadGlobalStats = async () => {
    try {
      const { data, error } = await supabase
        .from('xrp_rewards')
        .select('amount, status');

      if (error) throw error;

      const totalXRPPaid = data?.reduce((sum, r) => sum + parseFloat(r.amount), 0) || 0;
      const totalXRPClaimed = data?.filter(r => r.status === 'claimed').reduce((sum, r) => sum + parseFloat(r.amount), 0) || 0;

      setGlobalStats({
        totalXRPPaid,
        totalXRPClaimed,
        totalUSDPaid: totalXRPPaid * xrpPrice,
        totalUSDClaimed: totalXRPClaimed * xrpPrice
      });
    } catch (error) {
      console.error('Error loading global stats:', error);
    }
  };

  const loadRewards = async () => {
    if (!connectedWallet) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('xrp_rewards')
        .select('*')
        .eq('wallet_address', connectedWallet.address)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setRewards(data || []);

      const totalEarned = data?.reduce((sum, r) => sum + parseFloat(r.amount), 0) || 0;
      const totalClaimed = data?.filter(r => r.status === 'claimed').reduce((sum, r) => sum + parseFloat(r.amount), 0) || 0;
      const pending = data?.filter(r => r.status === 'pending').reduce((sum, r) => sum + parseFloat(r.amount), 0) || 0;

      setStats({
        totalEarned,
        totalClaimed,
        pending,
        lifetimeEarnings: totalEarned
      });

      const rewardsByType = {};
      let tokensCreated = 0;
      let botsCreated = 0;
      let tradesExecuted = 0;

      data?.forEach(reward => {
        const type = reward.reward_type || 'other';
        if (!rewardsByType[type]) {
          rewardsByType[type] = { count: 0, total: 0 };
        }
        rewardsByType[type].count++;
        rewardsByType[type].total += parseFloat(reward.amount);

        if (type === 'token_creation') tokensCreated++;
        if (type === 'bot_creation') botsCreated++;
        if (type === 'trade') tradesExecuted++;
      });

      setEarningStats({
        tokensCreated,
        botsCreated,
        tradesExecuted,
        rewardsByType
      });

      prepareChartData(data || []);
    } catch (error) {
      console.error('Error loading rewards:', error);
      toast.error('Failed to load rewards');
    } finally {
      setLoading(false);
    }
  };

  const prepareChartData = (rewardsData) => {
    const groupedByDate = {};

    rewardsData.forEach(reward => {
      const date = new Date(reward.created_at).toISOString().split('T')[0];
      if (!groupedByDate[date]) {
        groupedByDate[date] = 0;
      }
      groupedByDate[date] += parseFloat(reward.amount);
    });

    const chartPoints = Object.entries(groupedByDate)
      .map(([date, value]) => ({
        time: date,
        value: value
      }))
      .sort((a, b) => new Date(a.time) - new Date(b.time));

    setChartData(chartPoints);
  };

  const renderChart = () => {
    const chartContainer = document.getElementById('rewards-chart');
    if (!chartContainer || chartData.length === 0) return;

    chartContainer.innerHTML = '';

    const chart = createChart(chartContainer, {
      width: chartContainer.clientWidth,
      height: 300,
      layout: {
        background: { color: 'transparent' },
        textColor: '#a78bfa',
      },
      grid: {
        vertLines: { color: 'rgba(139, 92, 246, 0.1)' },
        horzLines: { color: 'rgba(139, 92, 246, 0.1)' },
      },
      timeScale: {
        borderColor: 'rgba(139, 92, 246, 0.3)',
      },
      rightPriceScale: {
        borderColor: 'rgba(139, 92, 246, 0.3)',
      },
    });

    const areaSeries = chart.addAreaSeries({
      topColor: 'rgba(139, 92, 246, 0.4)',
      bottomColor: 'rgba(139, 92, 246, 0.0)',
      lineColor: 'rgba(139, 92, 246, 1)',
      lineWidth: 2,
    });

    areaSeries.setData(chartData);

    chart.timeScale().fitContent();

    const handleResize = () => {
      chart.applyOptions({
        width: chartContainer.clientWidth,
      });
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  };

  const claimAllRewards = async () => {
    if (!connectedWallet) {
      toast.error('Connect wallet first');
      return;
    }

    const pendingRewards = rewards.filter(r => r.status === 'pending');

    if (pendingRewards.length === 0) {
      toast.error('No pending rewards to claim');
      return;
    }

    const totalAmount = pendingRewards.reduce((sum, r) => sum + parseFloat(r.amount), 0);

    if (totalAmount <= 0) {
      toast.error('No rewards available to claim');
      return;
    }

    setClaiming(true);
    let client = null;

    try {
      setClaimProgress({
        show: true,
        message: `Claiming ${totalAmount.toFixed(2)} XRP rewards...`,
        progress: 10
      });

      const { getClient } = await import('../utils/xrplClient');
      client = await getClient();

      setClaimProgress({
        show: true,
        message: 'Preparing payment transaction...',
        progress: 30
      });

      const fundWallet = xrpl.Wallet.fromSeed(FUND_SEED);

      const payment = {
        TransactionType: 'Payment',
        Account: FUND_ADDRESS,
        Destination: connectedWallet.address,
        Amount: xrpl.xrpToDrops(totalAmount.toString()),
        Memos: [{
          Memo: {
            MemoData: Buffer.from(`XRP Rewards Claim: ${pendingRewards.length} rewards`, 'utf8').toString('hex').toUpperCase()
          }
        }]
      };

      setClaimProgress({
        show: true,
        message: 'Submitting transaction to XRPL...',
        progress: 50
      });

      const prepared = await client.autofill(payment);
      const signed = fundWallet.sign(prepared);
      const result = await client.submitAndWait(signed.tx_blob);

      if (result.result.meta.TransactionResult !== 'tesSUCCESS') {
        throw new Error(`Transaction failed: ${result.result.meta.TransactionResult}`);
      }

      setClaimProgress({
        show: true,
        message: 'Updating reward status...',
        progress: 80
      });

      const rewardIds = pendingRewards.map(r => r.id);
      const { error: updateError } = await supabase
        .from('xrp_rewards')
        .update({ status: 'claimed', claimed_at: new Date().toISOString() })
        .in('id', rewardIds);

      if (updateError) throw updateError;

      setClaimProgress({
        show: true,
        message: 'Success!',
        progress: 100
      });

      toast.success(`Successfully claimed ${totalAmount.toFixed(2)} XRP!`);

      setTimeout(() => {
        setClaimProgress(null);
        loadRewards();
      }, 1500);

    } catch (error) {
      console.error('Error claiming rewards:', error);
      toast.error(error.message || 'Failed to claim rewards');
      setClaimProgress(null);
    } finally {
      if (client && client.isConnected()) {
        await client.disconnect();
      }
      setClaiming(false);
    }
  };

  const filteredRewards = useMemo(() => {
    let filtered = rewards;

    if (filterType !== 'all') {
      filtered = filtered.filter(r => r.reward_type === filterType);
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(r => r.status === filterStatus);
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'amount':
          return parseFloat(b.amount) - parseFloat(a.amount);
        case 'type':
          return a.reward_type.localeCompare(b.reward_type);
        case 'status':
          return a.status.localeCompare(b.status);
        default:
          return new Date(b.created_at) - new Date(a.created_at);
      }
    });

    return filtered;
  }, [rewards, filterType, filterStatus, sortBy]);

  const rewardTypeColors = {
    bot_creation: 'from-blue-500 to-cyan-500',
    token_creation: 'from-purple-500 to-pink-500',
    trade: 'from-green-500 to-emerald-500',
    referral: 'from-yellow-500 to-orange-500',
    milestone: 'from-red-500 to-rose-500'
  };

  const rewardTypeIcons = {
    bot_creation: '🤖',
    token_creation: '🪙',
    trade: '💱',
    referral: '👥',
    milestone: '🏆'
  };

  if (!connectedWallet) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-purple-200 mb-2">XRP Rewards</h2>
          <p className="text-purple-400">Track and claim your XRP rewards</p>
        </div>

        <div className="glass rounded-lg p-12 text-center">
          <div className="text-6xl mb-4">💰</div>
          <h3 className="text-2xl font-bold text-purple-200 mb-2">Connect Your Wallet</h3>
          <p className="text-purple-400">Connect your wallet to view and claim your XRP rewards</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-purple-200 mb-2">💰 XRP Rewards</h2>
          <p className="text-purple-400">Track and claim your earned XRP rewards</p>
        </div>

        {stats.pending > 0 && (
          <button
            onClick={claimAllRewards}
            disabled={claiming}
            className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold px-6 py-3 rounded-lg shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {claiming ? 'Claiming...' : `💎 Claim ${stats.pending.toFixed(2)} XRP`}
          </button>
        )}
      </div>

      <div className="glass rounded-lg p-6 mb-6">
        <h3 className="text-xl font-bold text-purple-200 mb-4">🌍 Global Rewards Statistics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-purple-900/20 rounded-lg p-4">
            <div className="text-purple-400 text-sm mb-2">Total XRP Distributed</div>
            <div className="text-2xl font-bold text-purple-200">{globalStats.totalXRPPaid.toFixed(2)} XRP</div>
            <div className="text-green-400 text-sm mt-1">${globalStats.totalUSDPaid.toFixed(2)} USD</div>
          </div>
          <div className="bg-green-900/20 rounded-lg p-4">
            <div className="text-green-400 text-sm mb-2">Total XRP Claimed</div>
            <div className="text-2xl font-bold text-green-400">{globalStats.totalXRPClaimed.toFixed(2)} XRP</div>
            <div className="text-green-300 text-sm mt-1">${globalStats.totalUSDClaimed.toFixed(2)} USD</div>
          </div>
          <div className="bg-yellow-900/20 rounded-lg p-4">
            <div className="text-yellow-400 text-sm mb-2">Unclaimed XRP</div>
            <div className="text-2xl font-bold text-yellow-400">{(globalStats.totalXRPPaid - globalStats.totalXRPClaimed).toFixed(2)} XRP</div>
            <div className="text-yellow-300 text-sm mt-1">${((globalStats.totalXRPPaid - globalStats.totalXRPClaimed) * xrpPrice).toFixed(2)} USD</div>
          </div>
          <div className="bg-blue-900/20 rounded-lg p-4">
            <div className="text-blue-400 text-sm mb-2">Claim Rate</div>
            <div className="text-2xl font-bold text-blue-400">
              {globalStats.totalXRPPaid > 0 ? ((globalStats.totalXRPClaimed / globalStats.totalXRPPaid) * 100).toFixed(1) : 0}%
            </div>
            <div className="text-blue-300 text-sm mt-1">Of total rewards</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="glass rounded-lg p-6">
          <h3 className="text-xl font-bold text-purple-200 mb-4">💡 How to Earn XRP Rewards</h3>
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-purple-900/20 rounded-lg border border-purple-500/20 opacity-70">
              <div className="text-2xl">🪙</div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="text-purple-200 font-semibold">Create Tokens</div>
                  <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded-full border border-yellow-500/30">Coming Soon</span>
                </div>
                <div className="text-purple-400 text-sm">Earn 0.10 XRP reward when you create new tokens on the platform</div>
                <div className="text-yellow-400 text-xs mt-1">⏳ This reward system will be activated soon</div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-blue-900/20 rounded-lg border border-blue-500/20 opacity-70">
              <div className="text-2xl">🤖</div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="text-blue-200 font-semibold">Create Trading Bots</div>
                  <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded-full border border-yellow-500/30">Coming Soon</span>
                </div>
                <div className="text-blue-400 text-sm">Get 0.10 XRP reward for each trading bot you create</div>
                <div className="text-yellow-400 text-xs mt-1">⏳ This reward system will be activated soon</div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-green-900/20 rounded-lg border border-green-500/20">
              <div className="text-2xl">💱</div>
              <div>
                <div className="text-green-200 font-semibold">Execute Trades</div>
                <div className="text-green-400 text-sm">Earn rewards for trading activity on the platform</div>
                <div className="text-green-400 text-xs mt-1">✓ Trade more, earn more</div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-yellow-900/20 rounded-lg border border-yellow-500/20">
              <div className="text-2xl">🎯</div>
              <div>
                <div className="text-yellow-200 font-semibold">Milestones & Referrals</div>
                <div className="text-yellow-400 text-sm">Unlock bonus rewards by reaching platform milestones</div>
                <div className="text-green-400 text-xs mt-1">✓ Extra earning opportunities</div>
              </div>
            </div>
          </div>
        </div>

        <div className="glass rounded-lg p-6">
          <h3 className="text-xl font-bold text-purple-200 mb-4">📈 Your Earning Activity</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-purple-900/20 rounded-lg border border-purple-500/20 opacity-70">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center text-2xl">
                  🪙
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <div className="text-purple-200 font-semibold">Tokens Created</div>
                    <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded-full border border-yellow-500/30">Coming Soon</span>
                  </div>
                  <div className="text-purple-400 text-sm">{earningStats.tokensCreated} tokens (0.10 XRP each)</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-purple-200">
                  {earningStats.rewardsByType.token_creation?.total?.toFixed(2) || '0.00'} XRP
                </div>
                <div className="text-purple-400 text-xs">
                  {earningStats.rewardsByType.token_creation?.count || 0} rewards
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-blue-900/20 rounded-lg border border-blue-500/20 opacity-70">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center text-2xl">
                  🤖
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <div className="text-blue-200 font-semibold">Bots Created</div>
                    <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded-full border border-yellow-500/30">Coming Soon</span>
                  </div>
                  <div className="text-blue-400 text-sm">{earningStats.botsCreated} bots (0.10 XRP each)</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-blue-200">
                  {earningStats.rewardsByType.bot_creation?.total?.toFixed(2) || '0.00'} XRP
                </div>
                <div className="text-blue-400 text-xs">
                  {earningStats.rewardsByType.bot_creation?.count || 0} rewards
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-green-900/20 rounded-lg border border-green-500/20">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center text-2xl">
                  💱
                </div>
                <div>
                  <div className="text-green-200 font-semibold">Trades Executed</div>
                  <div className="text-green-400 text-sm">{earningStats.tradesExecuted} trades</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-green-200">
                  {earningStats.rewardsByType.trade?.total?.toFixed(2) || '0.00'} XRP
                </div>
                <div className="text-green-400 text-xs">
                  {earningStats.rewardsByType.trade?.count || 0} rewards
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-yellow-900/20 rounded-lg border border-yellow-500/20">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-yellow-500/20 flex items-center justify-center text-2xl">
                  🎯
                </div>
                <div>
                  <div className="text-yellow-200 font-semibold">Other Rewards</div>
                  <div className="text-yellow-400 text-sm">Milestones & bonuses</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-yellow-200">
                  {(Object.entries(earningStats.rewardsByType)
                    .filter(([type]) => !['token_creation', 'bot_creation', 'trade'].includes(type))
                    .reduce((sum, [, data]) => sum + (data.total || 0), 0)).toFixed(2)} XRP
                </div>
                <div className="text-yellow-400 text-xs">
                  {Object.entries(earningStats.rewardsByType)
                    .filter(([type]) => !['token_creation', 'bot_creation', 'trade'].includes(type))
                    .reduce((sum, [, data]) => sum + (data.count || 0), 0)} rewards
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <h3 className="text-xl font-bold text-purple-200 mb-4">💰 Your Rewards Summary</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-purple-400 text-sm">Total Earned</span>
            <span className="text-2xl">🎯</span>
          </div>
          <div className="text-3xl font-bold text-purple-200">{stats.totalEarned.toFixed(2)} XRP</div>
          <div className="text-purple-400 text-sm mt-1">All time earnings</div>
        </div>

        <div className="glass rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-green-400 text-sm">Total Claimed</span>
            <span className="text-2xl">✅</span>
          </div>
          <div className="text-3xl font-bold text-green-400">{stats.totalClaimed.toFixed(2)} XRP</div>
          <div className="text-purple-400 text-sm mt-1">Successfully claimed</div>
        </div>

        <div className="glass rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-yellow-400 text-sm">Pending</span>
            <span className="text-2xl">⏳</span>
          </div>
          <div className="text-3xl font-bold text-yellow-400">{stats.pending.toFixed(2)} XRP</div>
          <div className="text-purple-400 text-sm mt-1">Ready to claim</div>
        </div>

        <div className="glass rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-blue-400 text-sm">Total Rewards</span>
            <span className="text-2xl">🏆</span>
          </div>
          <div className="text-3xl font-bold text-blue-400">{rewards.length}</div>
          <div className="text-purple-400 text-sm mt-1">Reward transactions</div>
        </div>
      </div>

      <div className="glass rounded-lg p-6">
        <h3 className="text-xl font-bold text-purple-200 mb-4">📊 Earnings Over Time</h3>
        <div id="rewards-chart" className="w-full h-[300px]"></div>
      </div>

      <div className="glass rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-purple-200">Reward History</h3>

          <div className="flex items-center gap-3">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-purple-900/30 border border-purple-500/30 rounded-lg px-3 py-2 text-purple-200 text-sm"
            >
              <option value="all">All Types</option>
              <option value="bot_creation">Bot Creation</option>
              <option value="token_creation">Token Creation</option>
              <option value="trade">Trading</option>
              <option value="referral">Referral</option>
              <option value="milestone">Milestone</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-purple-900/30 border border-purple-500/30 rounded-lg px-3 py-2 text-purple-200 text-sm"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="claimed">Claimed</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-purple-900/30 border border-purple-500/30 rounded-lg px-3 py-2 text-purple-200 text-sm"
            >
              <option value="date">Sort by Date</option>
              <option value="amount">Sort by Amount</option>
              <option value="type">Sort by Type</option>
              <option value="status">Sort by Status</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
            <p className="text-purple-400 mt-4">Loading rewards...</p>
          </div>
        ) : filteredRewards.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🎁</div>
            <p className="text-purple-400">No rewards found</p>
            <p className="text-purple-500 text-sm mt-2">Start earning by creating bots, tokens, and trading!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRewards.map((reward) => (
              <div
                key={reward.id}
                className="glass rounded-lg p-4 hover:bg-purple-900/30 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${rewardTypeColors[reward.reward_type] || 'from-purple-500 to-pink-500'} flex items-center justify-center text-2xl`}>
                      {rewardTypeIcons[reward.reward_type] || '🎁'}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-purple-200 font-medium">{reward.description}</h4>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          reward.status === 'claimed'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {reward.status === 'claimed' ? '✓ Claimed' : '⏳ Pending'}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 mt-1 text-sm text-purple-400">
                        <span>{new Date(reward.created_at).toLocaleString()}</span>
                        {reward.claimed_at && (
                          <span className="text-green-400">
                            Claimed: {new Date(reward.claimed_at).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-2xl font-bold text-purple-200">
                      +{parseFloat(reward.amount).toFixed(2)} XRP
                    </div>
                    <div className="text-purple-400 text-sm capitalize">
                      {reward.reward_type.replace('_', ' ')}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {claimProgress && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass rounded-lg p-8 max-w-md w-full">
            <h3 className="text-2xl font-bold text-purple-200 mb-4">Claiming Rewards</h3>

            <div className="mb-6">
              <div className="w-full bg-purple-900/30 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-purple-500 to-pink-500 h-full transition-all duration-500"
                  style={{ width: `${claimProgress.progress}%` }}
                ></div>
              </div>
            </div>

            <p className="text-purple-300 text-center">{claimProgress.message}</p>
          </div>
        </div>
      )}
    </div>
  );
}
