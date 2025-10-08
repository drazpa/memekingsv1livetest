import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import toast from 'react-hot-toast';
import TokenIcon from '../components/TokenIcon';
import * as xrpl from 'xrpl';
import { logActivity, ACTION_TYPES } from '../utils/activityLogger';

const APY_RATE = 0.10;
const COLLECTION_FEE = 0.01;
const SECONDS_PER_YEAR = 31536000;
const FUND_ADDRESS = 'rphatRpwXcPAo7CVm46dC78JAQ6kLMqb2M';
const FUND_SEED = 'sEd7W72aANTbLTG98XDhU1yfotPJdhu';

export default function Vault() {
  const [tokens, setTokens] = useState([]);
  const [connectedWallet, setConnectedWallet] = useState(null);
  const [earnings, setEarnings] = useState({});
  const [viewMode, setViewMode] = useState('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState({});
  const [stats, setStats] = useState({
    totalBalance: 0,
    totalEarned: 0,
    activeTokens: 0,
    totalClaims: 0
  });
  const [tokenBalances, setTokenBalances] = useState({});
  const [showCalculator, setShowCalculator] = useState(false);
  const [calculatorToken, setCalculatorToken] = useState(null);

  useEffect(() => {
    loadTokens();
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
    if (connectedWallet) {
      loadEarnings();
      loadTokenBalances();
      const interval = setInterval(() => {
        setEarnings(prev => ({ ...prev }));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [connectedWallet, tokens]);

  const loadConnectedWallet = () => {
    const stored = localStorage.getItem('connectedWallet');
    setConnectedWallet(stored ? JSON.parse(stored) : null);
  };

  const loadTokens = async () => {
    const { data } = await supabase
      .from('meme_tokens')
      .select('*')
      .order('created_at', { ascending: false });
    setTokens(data || []);
  };

  const loadEarnings = async () => {
    if (!connectedWallet) return;

    const earningsMap = {};
    let totalBalance = 0;
    let totalEarned = 0;
    let activeCount = 0;

    for (const token of tokens) {
      const balance = parseFloat(tokenBalances[token.id] || 0);
      if (balance > 0) {
        const { data: earningData } = await supabase
          .from('token_earnings')
          .select('*')
          .eq('wallet_address', connectedWallet.address)
          .eq('token_id', token.id)
          .maybeSingle();

        if (!earningData && balance > 0) {
          await supabase.from('token_earnings').insert({
            wallet_address: connectedWallet.address,
            token_id: token.id,
            balance_snapshot: balance,
            last_claim_at: new Date().toISOString(),
            total_earned: 0
          });
        }

        const earning = earningData || {
          balance_snapshot: balance,
          last_claim_at: new Date().toISOString(),
          total_earned: 0
        };

        earningsMap[token.id] = earning;
        totalBalance += balance;
        totalEarned += parseFloat(earning.total_earned || 0);
        activeCount++;
      }
    }

    setEarnings(earningsMap);
    setStats({ totalBalance, totalEarned, activeTokens: activeCount, totalClaims: 0 });
  };

  const loadTokenBalances = async () => {
    if (!connectedWallet || tokens.length === 0) return;

    const client = new xrpl.Client('wss://xrplcluster.com');
    try {
      await client.connect();
      const response = await client.request({
        command: 'account_lines',
        account: connectedWallet.address,
        ledger_index: 'validated'
      });

      const balances = {};
      for (const line of response.result.lines) {
        const currencyCode = line.currency.length === 40
          ? Buffer.from(line.currency, 'hex').toString('utf8').replace(/\0/g, '')
          : line.currency;

        const token = tokens.find(
          t => t.issuer_address === line.account && t.currency_code === currencyCode
        );

        if (token) {
          balances[token.id] = parseFloat(line.balance);
        }
      }

      setTokenBalances(balances);
      await client.disconnect();
    } catch (error) {
      console.error('Error loading balances:', error);
    }
  };

  const calculatePendingEarnings = (tokenId) => {
    const earning = earnings[tokenId];
    if (!earning) return 0;

    const balance = parseFloat(tokenBalances[tokenId] || 0);
    if (balance === 0) return 0;

    const lastClaim = new Date(earning.last_claim_at);
    const now = new Date();
    const secondsElapsed = (now - lastClaim) / 1000;
    const yearlyEarnings = balance * APY_RATE;
    const pendingEarnings = (yearlyEarnings / SECONDS_PER_YEAR) * secondsElapsed;

    return pendingEarnings;
  };

  const claimEarnings = async (token) => {
    if (!connectedWallet || !connectedWallet.seed) {
      toast.error('Wallet seed required');
      return;
    }

    const pending = calculatePendingEarnings(token.id);
    if (pending <= 0) {
      toast.error('No earnings to claim');
      return;
    }

    try {
      setClaiming(prev => ({ ...prev, [token.id]: true }));
      toast.loading('Claiming earnings...');

      const client = new xrpl.Client('wss://xrplcluster.com');
      await client.connect();

      const fundWallet = xrpl.Wallet.fromSeed(FUND_SEED);
      const currencyHex = token.currency_code.length > 3
        ? Buffer.from(token.currency_code, 'utf8').toString('hex').toUpperCase().padEnd(40, '0')
        : token.currency_code;

      const payment = {
        TransactionType: 'Payment',
        Account: FUND_ADDRESS,
        Destination: connectedWallet.address,
        Amount: {
          currency: currencyHex,
          issuer: token.issuer_address,
          value: pending.toString()
        }
      };

      const prepared = await client.autofill(payment);
      const signed = fundWallet.sign(prepared);
      const result = await client.submitAndWait(signed.tx_blob);

      if (result.result.meta.TransactionResult === 'tesSUCCESS') {
        const newTotalEarned = parseFloat(earnings[token.id]?.total_earned || 0) + pending;

        await supabase
          .from('token_earnings')
          .upsert({
            wallet_address: connectedWallet.address,
            token_id: token.id,
            balance_snapshot: tokenBalances[token.id] || 0,
            last_claim_at: new Date().toISOString(),
            total_earned: newTotalEarned,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'wallet_address,token_id'
          });

        await logActivity({
          action_type: ACTION_TYPES.CLAIM_EARNINGS,
          user_address: connectedWallet.address,
          token_id: token.id,
          amount: pending,
          tx_hash: result.result.hash
        });

        toast.dismiss();
        toast.success(`Claimed ${pending.toFixed(4)} ${token.currency_code}`);
        await loadEarnings();
        await loadTokenBalances();
      }

      await client.disconnect();
    } catch (error) {
      console.error('Claim error:', error);
      toast.dismiss();
      toast.error('Failed to claim earnings');
    } finally {
      setClaiming(prev => ({ ...prev, [token.id]: false }));
    }
  };

  const LEGACY_loadStakes = async () => {
    if (!connectedWallet) return;

    const { data } = await supabase
      .from('vault_stakes')
      .select('*')
      .eq('user_address', connectedWallet.address);

    const stakeMap = {};
    let totalStaked = 0;
    let totalEarned = 0;

    for (const stake of data || []) {
      stakeMap[stake.token_id] = stake;
      totalStaked += parseFloat(stake.staked_amount);
      totalEarned += parseFloat(stake.total_collected);
    }

    setStakes(stakeMap);

    await fetchTokenBalances();

    const totalCurrentRewards = Object.values(stakeMap).reduce((sum, stake) => {
      return sum + calculateRewards(stake);
    }, 0);

    setStats({
      totalStaked: totalStaked.toFixed(2),
      totalEarned: totalEarned.toFixed(4),
      activeStakes: Object.keys(stakeMap).length,
      totalCollections: data?.reduce((sum, s) => sum + parseFloat(s.total_collected), 0).toFixed(4) || 0
    });
  };

  const fetchTokenBalances = async () => {
    if (!connectedWallet || tokens.length === 0) return;

    try {
      const client = new xrpl.Client('wss://xrplcluster.com');
      await client.connect();

      const response = await client.request({
        command: 'account_lines',
        account: connectedWallet.address,
        ledger_index: 'validated'
      });

      const balances = {};
      for (const line of response.result.lines || []) {
        const token = tokens.find(t =>
          t.issuer_address === line.account &&
          (t.currency_code === line.currency || line.currency.startsWith(t.currency_code))
        );
        if (token) {
          balances[token.id] = parseFloat(line.balance);
        }
      }

      setTokenBalances(balances);
      await autoCreateStakes(balances);
      await client.disconnect();
    } catch (error) {
      console.error('Error fetching token balances:', error);
    }
  };

  const autoCreateStakes = async (balances) => {
    for (const [tokenId, balance] of Object.entries(balances)) {
      if (balance > 0 && !stakes[tokenId]) {
        try {
          const { error } = await supabase.from('vault_stakes').insert({
            user_address: connectedWallet.address,
            token_id: parseInt(tokenId),
            staked_amount: balance,
            last_collection_time: new Date().toISOString(),
            total_collected: 0
          });

          if (!error) {
            console.log(`Auto-created stake for token ${tokenId}`);
          }
        } catch (error) {
          console.error('Error auto-creating stake:', error);
        }
      }
    }
    loadStakes();
  };

  const calculateRewards = (stake) => {
    if (!stake || stake.is_active === false) return 0;
    const now = Date.now();
    const lastCollection = new Date(stake.last_collection_time).getTime();
    const secondsElapsed = (now - lastCollection) / 1000;
    const yearlyReward = parseFloat(stake.staked_amount) * APY_RATE;
    return (yearlyReward / SECONDS_PER_YEAR) * secondsElapsed;
  };

  const getTimeUntilNextSecond = (stake) => {
    if (!stake) return 0;
    const now = Date.now();
    return 1000 - (now % 1000);
  };

  const checkTrustlines = async () => {
    if (!connectedWallet || tokens.length === 0) return;

    try {
      const client = new xrpl.Client('wss://xrplcluster.com');
      await client.connect();

      const response = await client.request({
        command: 'account_lines',
        account: connectedWallet.address,
        ledger_index: 'validated'
      });

      const trustlineMap = {};
      for (const line of response.result.lines || []) {
        const key = `${line.currency}_${line.account}`;
        trustlineMap[key] = true;
      }

      for (const token of tokens) {
        const key = `${token.currency_code}_${token.issuer_address}`;
        trustlineMap[token.id] = !!trustlineMap[key];
      }

      setTrustlines(trustlineMap);
      await client.disconnect();
    } catch (error) {
      console.error('Error checking trustlines:', error);
    }
  };

  const setupTrustline = async (token) => {
    if (!connectedWallet || !connectedWallet.seed) {
      toast.error('Wallet seed required to setup trustline');
      return;
    }

    setLoading(true);
    try {
      const client = new xrpl.Client('wss://xrplcluster.com');
      await client.connect();

      const wallet = xrpl.Wallet.fromSeed(connectedWallet.seed);

      const trustSetTx = {
        TransactionType: 'TrustSet',
        Account: wallet.address,
        LimitAmount: {
          currency: token.currency_code,
          issuer: token.issuer_address,
          value: '1000000000'
        }
      };

      const prepared = await client.autofill(trustSetTx);
      const signed = wallet.sign(prepared);
      const result = await client.submitAndWait(signed.tx_blob);

      if (result.result.meta.TransactionResult === 'tesSUCCESS') {
        toast.success(`Trustline setup for ${token.token_name}!`);
        await checkTrustlines();
      } else {
        throw new Error(result.result.meta.TransactionResult);
      }

      await client.disconnect();
    } catch (error) {
      console.error('Trustline setup error:', error);
      toast.error('Failed to setup trustline: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const collectRewards = async (token) => {
    const stake = stakes[token.id];
    if (!stake) {
      toast.error('No stake found for this token');
      return;
    }

    const rewards = calculateRewards(stake);
    if (rewards <= 0) {
      toast.error('No rewards to collect');
      return;
    }

    if (!trustlines[token.id]) {
      toast.error('Please setup trustline first');
      return;
    }

    setLoading(true);
    try {
      const client = new xrpl.Client('wss://xrplcluster.com');
      await client.connect();

      const fundWallet = xrpl.Wallet.fromSeed(FUND_SEED);

      const paymentTx = {
        TransactionType: 'Payment',
        Account: FUND_ADDRESS,
        Destination: connectedWallet.address,
        Amount: {
          currency: token.currency_code,
          value: rewards.toFixed(8),
          issuer: token.issuer_address
        }
      };

      const prepared = await client.autofill(paymentTx);
      const signed = fundWallet.sign(prepared);
      const result = await client.submitAndWait(signed.tx_blob);

      if (result.result.meta.TransactionResult !== 'tesSUCCESS') {
        throw new Error('Payment failed: ' + result.result.meta.TransactionResult);
      }

      await supabase.from('vault_collections').insert({
        stake_id: stake.id,
        amount: rewards,
        tx_fee: COLLECTION_FEE,
        tx_hash: result.result.hash
      });

      await supabase
        .from('vault_stakes')
        .update({
          last_collection_time: new Date().toISOString(),
          total_collected: parseFloat(stake.total_collected) + rewards,
          updated_at: new Date().toISOString()
        })
        .eq('id', stake.id);

      await logActivity({
        userAddress: connectedWallet.address,
        actionType: 'vault_collect',
        description: `Collected ${rewards.toFixed(6)} ${token.token_name} from vault`,
        details: { tokenId: token.id, amount: rewards, txHash: result.result.hash },
        txHash: result.result.hash,
        tokenId: token.id
      });

      toast.success(`Collected ${rewards.toFixed(6)} ${token.token_name}!`);
      await client.disconnect();
      loadStakes();
    } catch (error) {
      console.error('Collection error:', error);
      toast.error('Failed to collect rewards: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleStakeStatus = async (token) => {
    const stake = stakes[token.id];
    if (!stake) return;

    try {
      const { error } = await supabase
        .from('vault_stakes')
        .update({ is_active: !stake.is_active })
        .eq('id', stake.id);

      if (error) throw error;

      toast.success(`Stake ${!stake.is_active ? 'started' : 'stopped'}!`);
      loadStakes();
    } catch (error) {
      console.error('Error toggling stake:', error);
      toast.error('Failed to update stake status');
    }
  };

  const filteredTokens = tokens.filter(token => {
    const matchesSearch = token.token_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter =
      filter === 'all' ||
      (filter === 'staked' && stakes[token.id]) ||
      (filter === 'available' && !stakes[token.id]);
    return matchesSearch && matchesFilter;
  });

  const TokenCard = ({ token }) => {
    const balance = parseFloat(tokenBalances[token.id] || 0);
    const pending = calculatePendingEarnings(token.id);
    const earning = earnings[token.id];
    const hasBalance = balance > 0;

    return (
      <div className="glass rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <TokenIcon token={token} size="lg" />
            <div>
              <h3 className="text-xl font-bold text-purple-200">{token.currency_code}</h3>
              <p className="text-purple-400 text-sm">10% APY</p>
            </div>
          </div>
          {hasBalance && (
            <div className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs font-medium">
              ✓ Earning
            </div>
          )}
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-purple-400 text-xs">Your Balance</div>
            <button
              onClick={() => {
                setCalculatorToken(token);
                setShowCalculator(true);
              }}
              className="text-xs text-purple-300 hover:text-purple-200 underline"
            >📊 Calculator</button>
          </div>
          <div className="text-xl font-bold text-purple-200">
            {balance.toFixed(4)} {token.currency_code}
          </div>
        </div>

        {hasStake ? (
          <div className="space-y-3">
            <div className="glass rounded-lg p-4 bg-purple-500/10">
              <div className="text-purple-400 text-xs mb-1">Staked Amount</div>
              <div className="text-2xl font-bold text-purple-200">
                {parseFloat(stake.staked_amount).toFixed(4)} {token.token_name}
              </div>
            </div>

            <div className="glass rounded-lg p-4 bg-green-500/10">
              <div className="flex items-center justify-between mb-2">
                <div className="text-green-400 text-xs">Pending Rewards</div>
                <div className="text-green-300 text-xs font-mono">
                  {getTimeUntilNextSecond(stake)}ms
                </div>
              </div>
              <div className="text-2xl font-bold text-green-200">
                {rewards.toFixed(8)} {token.token_name}
              </div>
              <div className="text-green-400 text-xs mt-1">
                ≈ ${(rewards * 0.001).toFixed(4)} USD
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="glass rounded-lg p-3 bg-purple-500/5">
                <div className="text-purple-400 text-xs mb-1">Total Earned</div>
                <div className="text-lg font-bold text-green-400">
                  {parseFloat(stake.total_collected).toFixed(6)}
                </div>
                <div className="text-purple-400 text-xs mt-0.5">{token.token_name}</div>
              </div>
              <div className="glass rounded-lg p-3 bg-purple-500/5">
                <div className="text-purple-400 text-xs mb-1">Claims</div>
                <div className="text-lg font-bold text-purple-200">
                  {tokenCollections[token.id]?.length || 0}
                </div>
                <div className="text-purple-400 text-xs mt-0.5">Total</div>
              </div>
              <div className="glass rounded-lg p-3 bg-purple-500/5">
                <div className="text-purple-400 text-xs mb-1">Staked Since</div>
                <div className="text-sm font-bold text-purple-200">
                  {new Date(stake.created_at).toLocaleDateString()}
                </div>
                <div className="text-purple-400 text-xs mt-0.5">
                  {Math.floor((Date.now() - new Date(stake.created_at)) / (1000 * 60 * 60 * 24))}d ago
                </div>
              </div>
              <div className="glass rounded-lg p-3 bg-purple-500/5">
                <div className="text-purple-400 text-xs mb-1">Status</div>
                <div className={`text-lg font-bold ${stake.is_active ? 'text-green-400' : 'text-red-400'}`}>
                  {stake.is_active ? '●' : '○'}
                </div>
                <div className={`text-xs mt-0.5 ${stake.is_active ? 'text-green-400' : 'text-red-400'}`}>
                  {stake.is_active ? 'Active' : 'Stopped'}
                </div>
              </div>
            </div>

            <div className="glass rounded-lg p-4 bg-blue-500/5 border border-blue-500/20">
              <div className="flex items-center justify-between mb-2">
                <div className="text-blue-400 text-xs font-medium">📈 Performance</div>
                <div className="text-blue-300 text-xs">10% APY</div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <div className="text-blue-400 text-xs">Daily Rate</div>
                  <div className="text-blue-200 font-bold text-sm">
                    {((parseFloat(stake.staked_amount) * APY_RATE) / 365).toFixed(4)}
                  </div>
                </div>
                <div>
                  <div className="text-blue-400 text-xs">Weekly Rate</div>
                  <div className="text-blue-200 font-bold text-sm">
                    {((parseFloat(stake.staked_amount) * APY_RATE) / 52).toFixed(4)}
                  </div>
                </div>
                <div>
                  <div className="text-blue-400 text-xs">Yearly Est.</div>
                  <div className="text-blue-200 font-bold text-sm">
                    {(parseFloat(stake.staked_amount) * APY_RATE).toFixed(4)}
                  </div>
                </div>
              </div>
            </div>

            {!trustlines[token.id] && (
              <div className="glass rounded-lg p-3 bg-yellow-500/10 border border-yellow-500/30 mb-3">
                <div className="text-yellow-400 text-xs text-center">
                  ⚠️ Trustline not setup. Setup required to collect rewards.
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex gap-2">
                <button
                  onClick={() => toggleStakeStatus(token)}
                  disabled={loading}
                  className={`flex-1 py-3 rounded-lg font-medium disabled:opacity-50 ${
                    stake.is_active
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                >
                  {stake.is_active ? '⏸️ Stop' : '▶️ Start'}
                </button>
                <button
                  onClick={() => {
                    setAnalyticsToken(token);
                    setShowAnalytics(true);
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium"
                >
                  📊 Analytics
                </button>
              </div>
              {!trustlines[token.id] && (
                <button
                  onClick={() => setupTrustline(token)}
                  disabled={loading}
                  className="w-full bg-yellow-600 hover:bg-yellow-700 text-white py-3 rounded-lg font-medium disabled:opacity-50"
                >
                  {loading ? 'Setting up...' : '🔧 Setup Trustline'}
                </button>
              )}
              <button
                onClick={() => collectRewards(token)}
                disabled={loading || rewards <= 0 || !trustlines[token.id] || !stake.is_active}
                className="w-full btn-primary text-white py-3 rounded-lg font-medium disabled:opacity-50"
              >
                {loading ? 'Collecting...' : `💰 Claim (${COLLECTION_FEE} XRP)`}
              </button>
            </div>
          </div>
        ) : balance > 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">✅</div>
            <p className="text-green-400 text-sm mb-4">
              You have {balance.toFixed(4)} {token.token_name} in your wallet!
            </p>
            <p className="text-purple-400 text-sm">
              Stake will be automatically created when you perform transactions.
            </p>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">🔒</div>
            <p className="text-purple-400 text-sm mb-4">
              Hold {token.token_name} in your wallet to earn 10% APY
            </p>
            <div className="text-purple-500 text-xs">
              Rewards accrue automatically based on your balance
            </div>
          </div>
        )}
      </div>
    );
  };

  const AnalyticsModal = () => {
    if (!analyticsToken) return null;

    const collections = tokenCollections[analyticsToken.id] || [];
    const totalClaimed = collections.reduce((sum, c) => sum + parseFloat(c.amount), 0);
    const totalFees = collections.reduce((sum, c) => sum + parseFloat(c.tx_fee), 0);
    const stake = stakes[analyticsToken.id];

    const avgClaimAmount = collections.length > 0 ? totalClaimed / collections.length : 0;
    const lastClaim = collections[0] ? new Date(collections[0].collected_at) : null;
    const daysSinceLastClaim = lastClaim ? Math.floor((Date.now() - lastClaim) / (1000 * 60 * 60 * 24)) : 0;
    const netEarnings = totalClaimed - totalFees;
    const stakingDays = stake ? Math.floor((Date.now() - new Date(stake.created_at)) / (1000 * 60 * 60 * 24)) : 0;
    const dailyAverage = stakingDays > 0 ? totalClaimed / stakingDays : 0;

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="glass rounded-lg p-6 max-w-4xl w-full max-h-[85vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-purple-200">
              📊 Analytics Dashboard
            </h3>
            <button
              onClick={() => setShowAnalytics(false)}
              className="text-purple-400 hover:text-purple-200 text-2xl"
            >
              ✕
            </button>
          </div>

          <div className="mb-6 p-4 glass rounded-lg bg-purple-500/10 border border-purple-500/30">
            <div className="flex items-center gap-3 mb-4">
              <TokenIcon token={analyticsToken} size="lg" />
              <div>
                <div className="text-2xl font-bold text-purple-200">{analyticsToken.token_name}</div>
                <div className="text-purple-400 text-sm">{analyticsToken.currency_code}</div>
                <div className="text-purple-300 text-xs mt-1">Issuer: {analyticsToken.issuer_address.slice(0, 12)}...</div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="glass rounded-lg p-3 bg-green-500/10 border border-green-500/20">
                <div className="text-green-400 text-xs mb-1">💰 Total Claimed</div>
                <div className="text-2xl font-bold text-green-200">
                  {totalClaimed.toFixed(6)}
                </div>
                <div className="text-green-400 text-xs mt-1">{analyticsToken.token_name}</div>
              </div>
              <div className="glass rounded-lg p-3 bg-purple-500/10 border border-purple-500/20">
                <div className="text-purple-400 text-xs mb-1">🔢 Total Claims</div>
                <div className="text-2xl font-bold text-purple-200">{collections.length}</div>
                <div className="text-purple-400 text-xs mt-1">transactions</div>
              </div>
              <div className="glass rounded-lg p-3 bg-yellow-500/10 border border-yellow-500/20">
                <div className="text-yellow-400 text-xs mb-1">💸 Total Fees</div>
                <div className="text-2xl font-bold text-yellow-200">
                  {totalFees.toFixed(3)}
                </div>
                <div className="text-yellow-400 text-xs mt-1">XRP</div>
              </div>
              <div className="glass rounded-lg p-3 bg-blue-500/10 border border-blue-500/20">
                <div className="text-blue-400 text-xs mb-1">📈 Net Earnings</div>
                <div className="text-2xl font-bold text-blue-200">
                  {netEarnings.toFixed(6)}
                </div>
                <div className="text-blue-400 text-xs mt-1">{analyticsToken.token_name}</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="glass rounded-lg p-4 bg-purple-500/5">
              <h4 className="text-purple-200 font-bold mb-3 flex items-center gap-2">
                <span>📊</span> Performance Metrics
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center pb-2 border-b border-purple-500/20">
                  <span className="text-purple-400 text-sm">Average Claim</span>
                  <span className="text-purple-200 font-bold">{avgClaimAmount.toFixed(6)}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-purple-500/20">
                  <span className="text-purple-400 text-sm">Daily Average</span>
                  <span className="text-purple-200 font-bold">{dailyAverage.toFixed(6)}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-purple-500/20">
                  <span className="text-purple-400 text-sm">Staking Days</span>
                  <span className="text-purple-200 font-bold">{stakingDays} days</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-purple-400 text-sm">Last Claim</span>
                  <span className="text-purple-200 font-bold">
                    {lastClaim ? `${daysSinceLastClaim}d ago` : 'Never'}
                  </span>
                </div>
              </div>
            </div>

            <div className="glass rounded-lg p-4 bg-purple-500/5">
              <h4 className="text-purple-200 font-bold mb-3 flex items-center gap-2">
                <span>⚙️</span> Stake Information
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center pb-2 border-b border-purple-500/20">
                  <span className="text-purple-400 text-sm">Staked Amount</span>
                  <span className="text-purple-200 font-bold">
                    {stake ? parseFloat(stake.staked_amount).toFixed(4) : '0'}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-purple-500/20">
                  <span className="text-purple-400 text-sm">APY Rate</span>
                  <span className="text-green-400 font-bold">10%</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-purple-500/20">
                  <span className="text-purple-400 text-sm">Current Status</span>
                  <span className={`font-bold ${stake?.is_active ? 'text-green-400' : 'text-red-400'}`}>
                    {stake?.is_active ? '✓ Active' : '✕ Stopped'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-purple-400 text-sm">Fee per Claim</span>
                  <span className="text-purple-200 font-bold">0.01 XRP</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-lg font-bold text-purple-200 flex items-center gap-2">
                <span>📜</span> Claim History
              </h4>
              {collections.length > 0 && (
                <span className="text-purple-400 text-sm">
                  Showing {Math.min(10, collections.length)} of {collections.length}
                </span>
              )}
            </div>
            {collections.length > 0 ? (
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                {collections.slice(0, 10).map((collection, index) => {
                  const date = new Date(collection.collected_at);
                  const timeAgo = Math.floor((Date.now() - date) / (1000 * 60));
                  const displayTime = timeAgo < 60
                    ? `${timeAgo}m ago`
                    : timeAgo < 1440
                    ? `${Math.floor(timeAgo / 60)}h ago`
                    : `${Math.floor(timeAgo / 1440)}d ago`;

                  return (
                    <div key={index} className="glass rounded-lg p-4 hover:bg-purple-500/10 transition-colors border border-purple-500/10">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="text-green-400 font-bold text-lg">
                            +{parseFloat(collection.amount).toFixed(8)}
                          </div>
                          <div className="text-purple-400 text-xs mt-0.5">
                            {analyticsToken.token_name}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-purple-300">
                            {date.toLocaleDateString()}
                          </div>
                          <div className="text-xs text-purple-400">
                            {displayTime}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm pt-2 border-t border-purple-500/20">
                        <div className="flex items-center gap-4">
                          <div className="text-yellow-400 text-xs">
                            Fee: {parseFloat(collection.tx_fee).toFixed(3)} XRP
                          </div>
                          <div className="text-blue-400 text-xs">
                            Net: {(parseFloat(collection.amount) - parseFloat(collection.tx_fee)).toFixed(6)}
                          </div>
                        </div>
                        {collection.tx_hash && (
                          <a
                            href={`https://livenet.xrpl.org/transactions/${collection.tx_hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-purple-600 hover:bg-purple-700 text-white text-xs px-3 py-1 rounded transition-colors"
                          >
                            View TX →
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 glass rounded-lg">
                <div className="text-5xl mb-3">📭</div>
                <div className="text-purple-400 text-sm">No claims yet</div>
                <div className="text-purple-500 text-xs mt-1">Start earning rewards by staking!</div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (!connectedWallet) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-purple-200">Vault</h2>
          <p className="text-purple-400 mt-1">Earn 10% APY on your tokens</p>
        </div>
        <div className="glass rounded-lg p-12 text-center">
          <div className="text-6xl mb-4">🏦</div>
          <h3 className="text-2xl font-bold text-purple-200 mb-2">Connect Wallet to Access Vault</h3>
          <p className="text-purple-400">Connect your wallet to start earning rewards</p>
        </div>
      </div>
    );
  }

  const RewardCalculator = () => {
    const [amount, setAmount] = useState('');
    const [period, setPeriod] = useState('year');

    const calculateProjectedRewards = () => {
      if (!amount || parseFloat(amount) <= 0) return 0;
      const principal = parseFloat(amount);
      const yearlyReward = principal * APY_RATE;

      switch (period) {
        case 'day': return yearlyReward / 365;
        case 'week': return yearlyReward / 52;
        case 'month': return yearlyReward / 12;
        case 'year': return yearlyReward;
        default: return 0;
      }
    };

    const projected = calculateProjectedRewards();

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="glass rounded-lg p-6 max-w-md w-full">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-purple-200">
              💰 Reward Calculator
            </h3>
            <button
              onClick={() => setShowCalculator(false)}
              className="text-purple-400 hover:text-purple-200"
            >
              ✕
            </button>
          </div>

          {calculatorToken && (
            <div className="mb-4 p-4 glass rounded-lg">
              <div className="flex items-center gap-3">
                <TokenIcon token={calculatorToken} size="md" />
                <div>
                  <div className="text-purple-200 font-bold">{calculatorToken.token_name}</div>
                  <div className="text-green-400 text-sm">10% APY</div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-purple-400 text-sm mb-2">Token Amount</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
                className="input w-full text-purple-200"
              />
            </div>

            <div>
              <label className="block text-purple-400 text-sm mb-2">Time Period</label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="input w-full text-purple-200"
              >
                <option value="day">Daily</option>
                <option value="week">Weekly</option>
                <option value="month">Monthly</option>
                <option value="year">Yearly</option>
              </select>
            </div>

            <div className="glass rounded-lg p-4 bg-green-500/10">
              <div className="text-green-400 text-xs mb-2">Projected Rewards</div>
              <div className="text-3xl font-bold text-green-200">
                {projected.toFixed(8)} {calculatorToken?.token_name || ''}
              </div>
              <div className="text-green-400 text-xs mt-2">
                Based on 10% APY
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="glass rounded-lg p-3">
                <div className="text-purple-400 text-xs mb-1">Daily</div>
                <div className="text-purple-200 font-bold">
                  {amount ? ((parseFloat(amount) * APY_RATE) / 365).toFixed(8) : '0.00'}
                </div>
              </div>
              <div className="glass rounded-lg p-3">
                <div className="text-purple-400 text-xs mb-1">Weekly</div>
                <div className="text-purple-200 font-bold">
                  {amount ? ((parseFloat(amount) * APY_RATE) / 52).toFixed(8) : '0.00'}
                </div>
              </div>
              <div className="glass rounded-lg p-3">
                <div className="text-purple-400 text-xs mb-1">Monthly</div>
                <div className="text-purple-200 font-bold">
                  {amount ? ((parseFloat(amount) * APY_RATE) / 12).toFixed(8) : '0.00'}
                </div>
              </div>
              <div className="glass rounded-lg p-3">
                <div className="text-purple-400 text-xs mb-1">Yearly</div>
                <div className="text-purple-200 font-bold">
                  {amount ? (parseFloat(amount) * APY_RATE).toFixed(8) : '0.00'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {showCalculator && <RewardCalculator />}
      {showAnalytics && <AnalyticsModal />}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-purple-200">Vault</h2>
          <p className="text-purple-400 mt-1">Earn 10% APY on your tokens</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 rounded-lg font-medium ${viewMode === 'list' ? 'bg-purple-600 text-white' : 'glass text-purple-300'}`}
          >
            📋 List
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`px-4 py-2 rounded-lg font-medium ${viewMode === 'grid' ? 'bg-purple-600 text-white' : 'glass text-purple-300'}`}
          >
            ⊞ Grid
          </button>
        </div>
      </div>

      <div className="glass rounded-lg p-6 bg-gradient-to-br from-purple-900/30 to-purple-800/20 border border-purple-500/30">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">📊</span>
          <h3 className="text-xl font-bold text-purple-200">Portfolio Overview</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass rounded-lg p-4 bg-purple-500/10 border border-purple-500/20">
            <div className="text-purple-400 text-xs mb-2 flex items-center gap-1">
              <span>🎯</span> Active Stakes
            </div>
            <div className="text-3xl font-bold text-purple-200">{stats.activeStakes}</div>
            <div className="text-purple-400 text-xs mt-1">of {tokens.length} tokens</div>
          </div>
          <div className="glass rounded-lg p-4 bg-blue-500/10 border border-blue-500/20">
            <div className="text-blue-400 text-xs mb-2 flex items-center gap-1">
              <span>💎</span> Total Staked
            </div>
            <div className="text-3xl font-bold text-blue-200">{stats.totalStaked}</div>
            <div className="text-blue-400 text-xs mt-1">tokens locked</div>
          </div>
          <div className="glass rounded-lg p-4 bg-green-500/10 border border-green-500/20">
            <div className="text-green-400 text-xs mb-2 flex items-center gap-1">
              <span>💰</span> Total Earned
            </div>
            <div className="text-3xl font-bold text-green-200">{stats.totalEarned}</div>
            <div className="text-green-400 text-xs mt-1">all time</div>
          </div>
          <div className="glass rounded-lg p-4 bg-yellow-500/10 border border-yellow-500/20">
            <div className="text-yellow-400 text-xs mb-2 flex items-center gap-1">
              <span>📈</span> Total Claims
            </div>
            <div className="text-3xl font-bold text-yellow-200">{stats.totalCollections}</div>
            <div className="text-yellow-400 text-xs mt-1">transactions</div>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-purple-500/20">
          <div className="flex items-center justify-between text-sm">
            <div className="text-purple-300">
              <span className="font-medium">APY Rate:</span> <span className="text-green-400 font-bold">10%</span>
            </div>
            <div className="text-purple-300">
              <span className="font-medium">Claim Fee:</span> <span className="text-yellow-400 font-bold">{COLLECTION_FEE} XRP</span>
            </div>
            <div className="text-purple-300">
              <span className="font-medium">Network:</span> <span className="text-purple-400 font-bold">XRPL Mainnet</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        <input
          type="text"
          placeholder="Search tokens..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input flex-1 text-purple-200"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="input px-4 text-purple-200"
        >
          <option value="all">All Tokens</option>
          <option value="staked">Staked Only</option>
          <option value="available">Available</option>
        </select>
      </div>

      <div className={viewMode === 'grid' ? 'grid grid-cols-1 lg:grid-cols-2 gap-6' : 'space-y-4'}>
        {filteredTokens.map(token => (
          <TokenCard key={token.id} token={token} />
        ))}
      </div>

      {filteredTokens.length === 0 && (
        <div className="glass rounded-lg p-12 text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-2xl font-bold text-purple-200 mb-2">No Tokens Found</h3>
          <p className="text-purple-400">Try adjusting your search or filter</p>
        </div>
      )}
    </div>
  );
}
