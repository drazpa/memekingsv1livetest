import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import toast from 'react-hot-toast';
import TokenIcon from '../components/TokenIcon';
import * as xrpl from 'xrpl';
import { Buffer } from 'buffer';
import { logActivity, ACTION_TYPES } from '../utils/activityLogger';
import { XRPScanLink } from '../components/XRPScanLink';
import { onTokenUpdate } from '../utils/tokenEvents';

const APY_RATE = 0.10;
const SECONDS_PER_YEAR = 31536000;
const CLAIM_FEE = 0.01;
const FUND_ADDRESS = 'rphatRpwXcPAo7CVm46dC78JAQ6kLMqb2M';
const FUND_SEED = 'sEd7W72aANTbLTG98XDhU1yfotPJdhu';

export default function Vault() {
  const [tokens, setTokens] = useState([]);
  const [connectedWallet, setConnectedWallet] = useState(null);
  const [earnings, setEarnings] = useState({});
  const [tokenBalances, setTokenBalances] = useState({});
  const [claiming, setClaiming] = useState({});
  const [starting, setStarting] = useState({});
  const [stopping, setStopping] = useState({});
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState([]);
  const [claimProgress, setClaimProgress] = useState(null);
  const [stats, setStats] = useState({
    totalBalance: 0,
    totalEarned: 0,
    activeTokens: 0
  });

  useEffect(() => {
    loadTokens();
    loadConnectedWallet();
    loadFavorites();

    const unsubscribe = onTokenUpdate(() => {
      loadTokens();
    });

    const handleWalletChange = () => loadConnectedWallet();
    window.addEventListener('walletConnected', handleWalletChange);
    window.addEventListener('walletDisconnected', handleWalletChange);
    return () => {
      unsubscribe();
      window.removeEventListener('walletConnected', handleWalletChange);
      window.removeEventListener('walletDisconnected', handleWalletChange);
    };
  }, []);

  useEffect(() => {
    if (connectedWallet && tokens.length > 0) {
      loadTokenBalances();
    }
  }, [connectedWallet, tokens]);

  useEffect(() => {
    if (connectedWallet && Object.keys(tokenBalances).length > 0) {
      loadEarnings();
      const interval = setInterval(() => {
        setEarnings(prev => ({ ...prev }));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [connectedWallet, tokenBalances]);

  const loadFavorites = async () => {
    if (!connectedWallet) return;
    try {
      const { data } = await supabase
        .from('token_favorites')
        .select('token_id')
        .eq('wallet_address', connectedWallet?.address);
      setFavorites(data?.map(f => f.token_id) || []);
    } catch (error) {
      console.error('Error loading favorites:', error);
    }
  };

  const toggleFavorite = async (tokenId) => {
    if (!connectedWallet) return;

    try {
      if (favorites.includes(tokenId)) {
        await supabase
          .from('token_favorites')
          .delete()
          .eq('wallet_address', connectedWallet.address)
          .eq('token_id', tokenId);
        setFavorites(prev => prev.filter(id => id !== tokenId));
        toast.success('Removed from favorites');
      } else {
        await supabase
          .from('token_favorites')
          .insert([{
            wallet_address: connectedWallet.address,
            token_id: tokenId
          }]);
        setFavorites(prev => [...prev, tokenId]);
        toast.success('Added to favorites');
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast.error('Failed to update favorite');
    }
  };

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

  const loadTokens = async () => {
    const { data } = await supabase
      .from('meme_tokens')
      .select('*')
      .order('created_at', { ascending: false });
    setTokens(data || []);
  };

  const loadTokenBalances = async () => {
    if (!connectedWallet || tokens.length === 0) return;

    setLoading(true);
    const client = new xrpl.Client('wss://xrplcluster.com');

    try {
      await client.connect();

      const accountLinesResponse = await client.request({
        command: 'account_lines',
        account: connectedWallet.address,
        ledger_index: 'validated'
      });

      const balances = {};
      let totalBalance = 0;

      accountLinesResponse.result.lines.forEach(line => {
        const token = tokens.find(t => {
          if (t.issuer_address !== line.account) return false;

          const currencyHex = t.currency_code.length > 3
            ? Buffer.from(t.currency_code, 'utf8').toString('hex').toUpperCase().padEnd(40, '0')
            : t.currency_code;

          return line.currency === currencyHex || line.currency === t.currency_code;
        });

        if (token) {
          const balance = parseFloat(line.balance);
          balances[token.id] = balance;
          totalBalance += balance;
        }
      });

      setTokenBalances(balances);
      setStats(prev => ({ ...prev, totalBalance }));

      await client.disconnect();
    } catch (error) {
      console.error('Error loading balances:', error);
      toast.error('Failed to load token balances');
    } finally {
      setLoading(false);
    }
  };

  const loadEarnings = async () => {
    if (!connectedWallet || Object.keys(tokenBalances).length === 0) return;

    try {
      const { data, error } = await supabase
        .from('token_earnings')
        .select('*')
        .eq('wallet_address', connectedWallet.address);

      if (error) throw error;

      const earningsMap = {};
      let totalEarned = 0;
      let activeCount = 0;

      data?.forEach(earning => {
        earningsMap[earning.token_id] = earning;
        totalEarned += parseFloat(earning.total_earned || 0);
        if (earning.is_earning) activeCount++;
      });

      setEarnings(earningsMap);
      setStats(prev => ({
        ...prev,
        totalEarned,
        activeTokens: activeCount
      }));
    } catch (error) {
      console.error('Error loading earnings:', error);
    }
  };

  const calculatePendingEarnings = (tokenId) => {
    const earning = earnings[tokenId];
    if (!earning || !earning.is_earning) return 0;

    const balance = parseFloat(earning.balance_snapshot || 0);
    const startTime = new Date(earning.earning_started_at).getTime();
    const now = Date.now();
    const elapsed = (now - startTime) / 1000;
    const rate = APY_RATE / SECONDS_PER_YEAR;
    const pending = balance * rate * elapsed;

    return pending;
  };

  const startEarning = async (token) => {
    if (!connectedWallet) {
      toast.error('Connect wallet first');
      return;
    }

    const balance = tokenBalances[token.id];
    if (!balance || balance <= 0) {
      toast.error('You need tokens in your wallet to start earning');
      return;
    }

    try {
      setStarting(prev => ({ ...prev, [token.id]: true }));

      const { data, error } = await supabase
        .from('token_earnings')
        .upsert({
          wallet_address: connectedWallet.address,
          token_id: token.id,
          balance_snapshot: balance,
          is_earning: true,
          earning_started_at: new Date().toISOString(),
          pending_amount: 0,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'wallet_address,token_id'
        })
        .select()
        .single();

      if (error) throw error;

      setEarnings(prev => ({ ...prev, [token.id]: data }));
      setStats(prev => ({ ...prev, activeTokens: prev.activeTokens + 1 }));
      toast.success(`Started earning on ${token.token_name}`);

      await logActivity({
        actionType: ACTION_TYPES.START_EARNING,
        userAddress: connectedWallet.address,
        description: `Started earning on ${token.token_name}`,
        tokenId: token.id,
        details: { amount: balance }
      });
    } catch (error) {
      console.error('Error starting earnings:', error);
      toast.error('Failed to start earning');
    } finally {
      setStarting(prev => ({ ...prev, [token.id]: false }));
    }
  };

  const stopEarning = async (token) => {
    try {
      setStopping(prev => ({ ...prev, [token.id]: true }));

      const pending = calculatePendingEarnings(token.id);
      const newTotalEarned = parseFloat(earnings[token.id]?.total_earned || 0) + pending;

      const { error } = await supabase
        .from('token_earnings')
        .update({
          is_earning: false,
          pending_amount: pending,
          total_earned: newTotalEarned,
          updated_at: new Date().toISOString()
        })
        .eq('wallet_address', connectedWallet.address)
        .eq('token_id', token.id);

      if (error) throw error;

      setEarnings(prev => ({
        ...prev,
        [token.id]: {
          ...prev[token.id],
          is_earning: false,
          pending_amount: pending,
          total_earned: newTotalEarned
        }
      }));

      setStats(prev => ({
        ...prev,
        activeTokens: Math.max(0, prev.activeTokens - 1),
        totalEarned: prev.totalEarned + pending
      }));

      toast.success('Stopped earning. You can now claim your earnings.');

      await logActivity({
        actionType: ACTION_TYPES.STOP_EARNING,
        userAddress: connectedWallet.address,
        description: `Stopped earning on ${token.token_name}`,
        tokenId: token.id,
        details: { amount: pending }
      });
    } catch (error) {
      console.error('Error stopping earnings:', error);
      toast.error('Failed to stop earning');
    } finally {
      setStopping(prev => ({ ...prev, [token.id]: false }));
    }
  };

  const claimEarnings = async (token) => {
    if (!connectedWallet) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (connectedWallet.address === FUND_ADDRESS) {
      toast.error('Cannot claim earnings to the receiver wallet. Please connect a different wallet.');
      return;
    }

    const earning = earnings[token.id];
    if (!earning) {
      toast.error('No earnings data found');
      return;
    }

    const pending = earning.is_earning
      ? calculatePendingEarnings(token.id)
      : parseFloat(earning.pending_amount || 0);

    if (pending < 0.0001) {
      toast.error('Minimum claim amount is 0.0001');
      return;
    }

    try {
      setClaiming(prev => ({ ...prev, [token.id]: true }));

      setClaimProgress({
        step: 1,
        message: 'Connecting to XRPL...',
        token: token.token_name,
        amount: pending
      });

      const client = new xrpl.Client('wss://xrplcluster.com');
      await client.connect();

      const fundWallet = xrpl.Wallet.fromSeed(FUND_SEED);

      setClaimProgress(prev => ({ ...prev, step: 2, message: 'Checking trustlines...' }));

      const accountInfo = await client.request({
        command: 'account_lines',
        account: FUND_ADDRESS,
        ledger_index: 'validated'
      });

      const currencyHex = token.currency_code.length > 3
        ? Buffer.from(token.currency_code, 'utf8').toString('hex').toUpperCase().padEnd(40, '0')
        : token.currency_code;

      const hasTrustline = accountInfo.result.lines.some(line =>
        line.account === token.issuer_address &&
        (line.currency === currencyHex || line.currency === token.currency_code)
      );

      if (!hasTrustline) {
        setClaimProgress(prev => ({ ...prev, step: 3, message: 'Setting up trustline...' }));

        const trustSet = {
          TransactionType: 'TrustSet',
          Account: FUND_ADDRESS,
          LimitAmount: {
            currency: currencyHex,
            issuer: token.issuer_address,
            value: '1000000000'
          }
        };

        const preparedTrust = await client.autofill(trustSet);
        const signedTrust = fundWallet.sign(preparedTrust);
        const trustResult = await client.submitAndWait(signedTrust.tx_blob);

        if (trustResult.result.meta.TransactionResult !== 'tesSUCCESS') {
          throw new Error('Failed to set up trustline');
        }
      }

      const destAccountInfo = await client.request({
        command: 'account_lines',
        account: connectedWallet.address,
        ledger_index: 'validated'
      });

      const destHasTrustline = destAccountInfo.result.lines.some(line =>
        line.account === token.issuer_address &&
        (line.currency === currencyHex || line.currency === token.currency_code)
      );

      if (!destHasTrustline) {
        setClaimProgress(null);
        toast.error(`Your wallet needs a trustline for ${token.currency_code}. Please set up trustline first.`);
        setClaiming(prev => ({ ...prev, [token.id]: false }));
        await client.disconnect();
        return;
      }

      setClaimProgress(prev => ({ ...prev, step: 4, message: 'Processing claim fee...' }));

      const feePayment = {
        TransactionType: 'Payment',
        Account: connectedWallet.address,
        Destination: FUND_ADDRESS,
        Amount: String(CLAIM_FEE * 1000000)
      };

      const wallet = xrpl.Wallet.fromSeed(connectedWallet.seed);
      const preparedFee = await client.autofill(feePayment);
      const signedFee = wallet.sign(preparedFee);
      const feeResult = await client.submitAndWait(signedFee.tx_blob);

      if (feeResult.result.meta.TransactionResult !== 'tesSUCCESS') {
        throw new Error('Failed to process claim fee');
      }

      setClaimProgress(prev => ({ ...prev, step: 5, message: 'Sending earnings...' }));

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
          .update({
            balance_snapshot: tokenBalances[token.id] || 0,
            last_claim_at: new Date().toISOString(),
            total_earned: newTotalEarned,
            pending_amount: 0,
            is_earning: true,
            earning_started_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('wallet_address', connectedWallet.address)
          .eq('token_id', token.id);

        await logActivity({
          actionType: ACTION_TYPES.CLAIM_EARNINGS,
          userAddress: connectedWallet.address,
          description: `Claimed ${pending.toFixed(4)} ${token.token_name}`,
          tokenId: token.id,
          details: { amount: pending },
          txHash: result.result.hash
        });

        setClaimProgress({
          step: 6,
          message: 'Claim successful!',
          token: token.token_name,
          amount: pending,
          txHash: result.result.hash,
          complete: true
        });

        await loadEarnings();
        await loadTokenBalances();
      } else {
        throw new Error(`Transaction failed: ${result.result.meta.TransactionResult}`);
      }

      await client.disconnect();
    } catch (error) {
      console.error('Claim error:', error);
      setClaimProgress(null);

      if (error.message?.includes('tecNO_DST_INSUF_XRP')) {
        toast.error('Destination wallet needs at least 10 XRP reserve');
      } else if (error.message?.includes('tecPATH_DRY')) {
        toast.error('Insufficient balance in receiver wallet');
      } else if (error.message?.includes('tecNO_LINE')) {
        toast.error('Trustline issue detected. Please ensure both wallets have trustlines.');
      } else {
        toast.error(`Failed to claim earnings: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setClaiming(prev => ({ ...prev, [token.id]: false }));
    }
  };

  const TokenCard = ({ token, isListView = false }) => {
    const balance = tokenBalances[token.id] || 0;
    const earning = earnings[token.id];
    const pending = calculatePendingEarnings(token.id);
    const totalEarned = parseFloat(earning?.total_earned || 0) + pending;
    const isFavorite = favorites.includes(token.id);

    const dailyRate = (balance * APY_RATE) / 365;
    const monthlyEst = (balance * APY_RATE) / 12;
    const yearlyEst = balance * APY_RATE;
    const lastClaim = earning?.last_claim_at ? new Date(earning.last_claim_at) : null;

    if (isListView) {
      return (
        <div className="glass rounded-lg p-4 flex items-center gap-4">
          <button
            onClick={() => toggleFavorite(token.id)}
            className={`text-2xl ${isFavorite ? 'text-yellow-400' : 'text-gray-500 hover:text-yellow-400'}`}
          >
            {isFavorite ? '⭐' : '☆'}
          </button>

          <TokenIcon token={token} size="md" />

          <div className="flex-1 grid grid-cols-9 gap-3 items-center">
            <div>
              <div className="text-lg font-bold text-purple-200">{token.token_name}</div>
              <div className="text-purple-400 text-sm">{token.currency_code}</div>
            </div>

            <div className="text-right">
              <div className="text-purple-400 text-xs">Balance</div>
              <div className="text-purple-200 font-bold">{balance.toFixed(2)}</div>
            </div>

            <div className="text-right">
              <div className="text-purple-400 text-xs">Total Earned</div>
              <div className="text-green-400 font-bold">{totalEarned.toFixed(6)}</div>
            </div>

            <div className="text-right">
              <div className="text-purple-400 text-xs">Pending</div>
              <div className="text-yellow-400 font-bold">{pending.toFixed(6)}</div>
            </div>

            <div className="text-right">
              <div className="text-purple-400 text-xs">Daily Est.</div>
              <div className="text-blue-300 font-bold">{dailyRate.toFixed(6)}</div>
            </div>

            <div className="text-right">
              <div className="text-purple-400 text-xs">Monthly Est.</div>
              <div className="text-cyan-400 font-bold">{monthlyEst.toFixed(6)}</div>
            </div>

            <div className="text-right">
              <div className="text-purple-400 text-xs">Yearly Est.</div>
              <div className="text-emerald-400 font-bold">{yearlyEst.toFixed(4)}</div>
            </div>

            <div className="text-right">
              <div className="text-purple-400 text-xs">Last Claim</div>
              <div className="text-purple-300 font-medium text-xs">
                {lastClaim ? (
                  <>
                    <div>{lastClaim.toLocaleDateString()}</div>
                    <div className="text-purple-500">{lastClaim.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </>
                ) : (
                  <span className="text-gray-500">Never</span>
                )}
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              {!earning?.is_earning ? (
                <button
                  onClick={() => startEarning(token)}
                  disabled={starting[token.id]}
                  className="btn-primary px-4 py-2 rounded-lg text-sm"
                >
                  {starting[token.id] ? '...' : 'Start'}
                </button>
              ) : (
                <>
                  <button
                    onClick={() => stopEarning(token)}
                    disabled={stopping[token.id]}
                    className="btn px-4 py-2 rounded-lg text-sm"
                  >
                    {stopping[token.id] ? '...' : 'Stop'}
                  </button>
                  <button
                    onClick={() => claimEarnings(token)}
                    disabled={claiming[token.id] || earning.is_earning}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm"
                  >
                    {claiming[token.id] ? '...' : 'Claim'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="glass rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <TokenIcon token={token} size="lg" />
            <div>
              <h3 className="text-xl font-bold text-purple-200">{token.token_name}</h3>
              <p className="text-purple-400 text-sm">{token.currency_code}</p>
            </div>
          </div>

          <button
            onClick={() => toggleFavorite(token.id)}
            className={`text-3xl ${isFavorite ? 'text-yellow-400' : 'text-gray-500 hover:text-yellow-400'}`}
          >
            {isFavorite ? '⭐' : '☆'}
          </button>
        </div>

        <div className="space-y-4">
          <div className="glass rounded-lg p-4 bg-purple-500/10">
            <div className="text-purple-400 text-sm mb-1">Your Balance</div>
            <div className="text-3xl font-bold text-purple-200">{balance.toFixed(2)}</div>
            <div className="text-purple-400 text-xs mt-1">{token.currency_code}</div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="glass rounded-lg p-3 bg-purple-500/5">
              <div className="text-purple-400 text-xs mb-1">Total Earned</div>
              <div className="text-lg font-bold text-green-400">
                {totalEarned.toFixed(6)}
              </div>
            </div>
            <div className="glass rounded-lg p-3 bg-purple-500/5">
              <div className="text-purple-400 text-xs mb-1">Pending</div>
              <div className="text-lg font-bold text-yellow-400">
                {pending.toFixed(6)}
              </div>
            </div>
          </div>

          {earning?.is_earning && (
            <div className="glass rounded-lg p-3 bg-green-500/10 border border-green-500/30">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <div className="text-green-400 text-sm font-medium">Earning Active</div>
              </div>
              <div className="text-green-300 text-xs">
                Started: {new Date(earning.start_earning_at).toLocaleString()}
              </div>
            </div>
          )}

          <div className="glass rounded-lg p-3 bg-blue-500/5">
            <div className="flex items-center justify-between mb-2">
              <div className="text-blue-400 text-xs font-medium">📈 Earnings Projection</div>
              <div className="text-blue-300 text-xs">10% APY</div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="text-blue-400 text-xs">Daily</div>
                <div className="text-blue-200 font-bold text-sm">
                  +{dailyRate.toFixed(4)}
                </div>
              </div>
              <div>
                <div className="text-blue-400 text-xs">Monthly</div>
                <div className="text-blue-200 font-bold text-sm">
                  +{(dailyRate * 30).toFixed(4)}
                </div>
              </div>
              <div>
                <div className="text-blue-400 text-xs">Yearly</div>
                <div className="text-blue-200 font-bold text-sm">
                  +{yearlyEst.toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            {!earning?.is_earning ? (
              <>
                <button
                  onClick={() => startEarning(token)}
                  disabled={starting[token.id] || balance <= 0}
                  className="flex-1 btn-primary text-white px-6 py-3 rounded-lg font-medium"
                >
                  {starting[token.id] ? 'Starting...' : 'Start Earning'}
                </button>
                {earning?.pending_amount > 0 && (
                  <button
                    onClick={() => claimEarnings(token)}
                    disabled={claiming[token.id] || parseFloat(earning.pending_amount) < 0.0001}
                    className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium"
                  >
                    {claiming[token.id] ? 'Claiming...' : `Claim ${parseFloat(earning.pending_amount).toFixed(4)}`}
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  onClick={() => claimEarnings(token)}
                  disabled={claiming[token.id] || calculatePendingEarnings(token.id) < 0.0001}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium"
                >
                  {claiming[token.id] ? 'Claiming...' : 'Claim Earnings'}
                </button>
                <button
                  onClick={() => stopEarning(token)}
                  disabled={stopping[token.id]}
                  className="flex-1 btn text-purple-300 px-6 py-3 rounded-lg font-medium"
                >
                  {stopping[token.id] ? 'Stopping...' : 'Stop Earning'}
                </button>
              </>
            )}
          </div>

          {earning?.last_claim_at && (
            <div className="text-purple-400 text-xs text-center">
              Last claimed: {new Date(earning.last_claim_at).toLocaleString()}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!connectedWallet) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-purple-200 mb-2">Passive Earnings Vault</h2>
          <p className="text-purple-400">Earn 10% APY on your token holdings automatically</p>
        </div>

        <div className="glass rounded-lg p-12 text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h3 className="text-2xl font-bold text-purple-200 mb-2">Connect Your Wallet</h3>
          <p className="text-purple-400">Connect your wallet to start earning passive income on your tokens</p>
        </div>
      </div>
    );
  }

  const tokensWithBalance = tokens.filter(t => parseFloat(tokenBalances[t.id] || 0) > 0);

  const filteredTokens = tokensWithBalance.filter(token => {
    const matchesSearch = token.token_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         token.currency_code.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const sortedTokens = [...filteredTokens].sort((a, b) => {
    const aFav = favorites.includes(a.id);
    const bFav = favorites.includes(b.id);
    if (aFav && !bFav) return -1;
    if (!aFav && bFav) return 1;
    return 0;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-purple-200 mb-2">Passive Earnings Vault</h2>
          <p className="text-purple-400">Earn 10% APY automatically just by holding tokens in your wallet</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 glass rounded-lg p-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded ${viewMode === 'grid' ? 'bg-purple-600 text-white' : 'text-purple-400'}`}
              title="Grid View"
            >
              ⊞
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded ${viewMode === 'list' ? 'bg-purple-600 text-white' : 'text-purple-400'}`}
              title="List View"
            >
              ☰
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass rounded-lg p-6">
          <div className="text-purple-400 text-sm mb-2">Total Balance</div>
          <div className="text-3xl font-bold text-purple-200">{stats.totalBalance.toFixed(2)}</div>
          <div className="text-purple-400 text-xs mt-1">Tokens in wallet</div>
        </div>

        <div className="glass rounded-lg p-6">
          <div className="text-purple-400 text-sm mb-2">Total Earned</div>
          <div className="text-3xl font-bold text-green-400">{stats.totalEarned.toFixed(6)}</div>
          <div className="text-purple-400 text-xs mt-1">All time earnings</div>
        </div>

        <div className="glass rounded-lg p-6">
          <div className="text-purple-400 text-sm mb-2">Active Tokens</div>
          <div className="text-3xl font-bold text-blue-400">{stats.activeTokens}</div>
          <div className="text-purple-400 text-xs mt-1">Currently earning</div>
        </div>
      </div>

      <div className="glass rounded-lg p-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search tokens..."
          className="input w-full"
        />
      </div>

      {loading ? (
        <div className="glass rounded-lg p-12 text-center">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-purple-300">Loading your tokens...</p>
        </div>
      ) : sortedTokens.length === 0 ? (
        <div className="glass rounded-lg p-12 text-center">
          <div className="text-6xl mb-4">💰</div>
          <h3 className="text-2xl font-bold text-purple-200 mb-2">No Tokens Found</h3>
          <p className="text-purple-400">
            {searchQuery ? 'No tokens match your search.' : 'You need tokens in your wallet to start earning.'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {sortedTokens.map(token => (
            <TokenCard key={token.id} token={token} />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {sortedTokens.map(token => (
            <TokenCard key={token.id} token={token} isListView />
          ))}
        </div>
      )}

      {claimProgress && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="glass rounded-lg p-6 max-w-md w-full space-y-4">
            <h3 className="text-2xl font-bold text-purple-200 text-center">
              {claimProgress.complete ? '✅ Claim Complete!' : '⏳ Claiming Earnings'}
            </h3>

            <div className="space-y-3">
              <div className="glass rounded-lg p-4 bg-purple-500/10">
                <div className="text-purple-400 text-sm">Token</div>
                <div className="text-purple-200 font-bold">{claimProgress.token}</div>
              </div>

              <div className="glass rounded-lg p-4 bg-green-500/10">
                <div className="text-green-400 text-sm">Amount</div>
                <div className="text-green-300 font-bold text-xl">{claimProgress.amount?.toFixed(6)}</div>
              </div>

              {!claimProgress.complete && (
                <div className="glass rounded-lg p-4">
                  <div className="text-purple-200 font-medium mb-2">
                    Step {claimProgress.step} of 5
                  </div>
                  <div className="text-purple-400 text-sm">{claimProgress.message}</div>
                  <div className="mt-3 w-full bg-purple-900/30 rounded-full h-2">
                    <div
                      className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(claimProgress.step / 5) * 100}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {claimProgress.complete && claimProgress.txHash && (
                <div className="glass rounded-lg p-4 bg-blue-500/10">
                  <div className="text-blue-400 text-sm mb-2">Transaction</div>
                  <XRPScanLink type="tx" value={claimProgress.txHash} network="mainnet" />
                </div>
              )}

              {claimProgress.complete && (
                <>
                  <div className="glass rounded-lg p-4 bg-yellow-500/10 border border-yellow-500/30">
                    <div className="text-yellow-200 text-sm">
                      ⚡ Claim fee of {CLAIM_FEE} XRP was sent to the receiver wallet
                    </div>
                  </div>

                  <button
                    onClick={() => setClaimProgress(null)}
                    className="w-full btn-primary text-white px-6 py-3 rounded-lg font-medium"
                  >
                    Close
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
