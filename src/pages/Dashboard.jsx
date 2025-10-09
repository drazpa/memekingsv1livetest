import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import toast from 'react-hot-toast';
import * as xrpl from 'xrpl';
import { Buffer } from 'buffer';
import { uploadImageToPinata } from '../utils/pinata';
import TokenDetailModal from '../components/TokenDetailModal';
import TokenIcon from '../components/TokenIcon';
import { logActivity, ACTION_TYPES } from '../utils/activityLogger';
import { getRandomWord } from '../utils/dictionary';
import { emitTokenUpdate } from '../utils/tokenEvents';

const ISSUER_SEED = 'sEd7bAfzqZWKxaatJpoWzTvENyaTg1Y';
const ISSUER_ADDRESS = 'rKxBBMmY969Ph1y63ddVfYyN7xmxwDfVq6';
const RECEIVER_SEED = 'sEd7W72aANTbLTG98XDhU1yfotPJdhu';
const RECEIVER_ADDRESS = 'rphatRpwXcPAo7CVm46dC78JAQ6kLMqb2M';

export default function Dashboard() {
  const [tokens, setTokens] = useState([]);
  const [poolsData, setPoolsData] = useState({});
  const [lpBalances, setLpBalances] = useState({});
  const [connectedWallet, setConnectedWallet] = useState(null);
  const [analytics, setAnalytics] = useState({
    totalTokens: 0,
    totalValue: 0,
    topPerformer: null,
    recentActivity: []
  });
  const [xrpUsdPrice, setXrpUsdPrice] = useState(0);
  const [livePoolStats, setLivePoolStats] = useState({
    totalXrpLocked: 0,
    totalMarketCap: 0
  });
  const [trustlineStats, setTrustlineStats] = useState({
    totalTrustlines: 0,
    totalHolders: 0,
    trustlines24hAgo: 0,
    holders24hAgo: 0
  });
  const [tokens24h, setTokens24h] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [showCreateTokenModal, setShowCreateTokenModal] = useState(false);
  const [createPassword, setCreatePassword] = useState('');
  const [createdToken, setCreatedToken] = useState(null);
  const [showCreatedTokenOptions, setShowCreatedTokenOptions] = useState(false);
  const [showAddTokenPasswordModal, setShowAddTokenPasswordModal] = useState(false);
  const [addTokenPassword, setAddTokenPassword] = useState('');
  const [manualTokenData, setManualTokenData] = useState({
    name: '',
    issuer: '',
    supply: '1000000',
    xrpLocked: '1',
    description: '',
    twitterHandle: '',
    websiteUrl: ''
  });
  const [manualImageFile, setManualImageFile] = useState(null);
  const [manualImagePreview, setManualImagePreview] = useState(null);
  const [uploadingManualImage, setUploadingManualImage] = useState(false);
  const [viewMode, setViewMode] = useState('list');
  const [topViewMode, setTopViewMode] = useState('grid');
  const [selectedToken, setSelectedToken] = useState(null);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [activities, setActivities] = useState([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminAction, setAdminAction] = useState(null);
  const [editingToken, setEditingToken] = useState(null);
  const [editImageFile, setEditImageFile] = useState(null);
  const [editImagePreview, setEditImagePreview] = useState(null);
  const [uploadingEditImage, setUploadingEditImage] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressSteps, setProgressSteps] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [creationComplete, setCreationComplete] = useState(false);
  const [createdTokenData, setCreatedTokenData] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const [tokenFilterTab, setTokenFilterTab] = useState('all');
  const [mainTokenTab, setMainTokenTab] = useState('all');
  const TOKENS_PER_PAGE = 100;

  useEffect(() => {
    loadTokens();
    loadConnectedWallet();
    fetchXrpUsdPrice();
    const interval = setInterval(() => {
      loadTokens();
      fetchXrpUsdPrice();
    }, 60000);

    const handleWalletChange = () => {
      loadConnectedWallet();
    };
    window.addEventListener('walletConnected', handleWalletChange);
    window.addEventListener('walletDisconnected', handleWalletChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('walletConnected', handleWalletChange);
      window.removeEventListener('walletDisconnected', handleWalletChange);
    };
  }, []);

  useEffect(() => {
    if (tokens.length > 0) {
      fetchAllPoolsData();
      fetchTrustlineStats();
      calculate24hTokens();
    }
  }, [tokens.length]);

  useEffect(() => {
    if (Object.keys(poolsData).length > 0) {
      calculateLivePoolStats();
    }
  }, [Object.keys(poolsData).length]);

  useEffect(() => {
    if (connectedWallet && Object.keys(poolsData).length > 0) {
      fetchLPBalances();
    }
  }, [connectedWallet?.address, Object.keys(poolsData).length]);

  const loadConnectedWallet = () => {
    const stored = localStorage.getItem('connectedWallet');
    if (stored) {
      setConnectedWallet(JSON.parse(stored));
    } else {
      setConnectedWallet(null);
    }
  };

  const fetchXrpUsdPrice = async () => {
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd');
      const data = await response.json();
      setXrpUsdPrice(data.ripple?.usd || 0);
    } catch (error) {
      console.error('Error fetching XRP/USD price:', error);
    }
  };

  const calculateLivePoolStats = () => {
    let totalXrp = 0;
    let totalMarketCap = 0;

    tokens.forEach(token => {
      const poolData = poolsData[token.id];
      if (poolData) {
        totalXrp += poolData.xrpAmount;
        const price = poolData.price;
        const supply = token.supply || 0;
        totalMarketCap += (price * supply);
      }
    });

    setLivePoolStats({
      totalXrpLocked: totalXrp,
      totalMarketCap: totalMarketCap
    });
  };

  const calculate24hTokens = () => {
    const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
    const recentTokens = tokens.filter(token =>
      new Date(token.created_at).getTime() > twentyFourHoursAgo
    );
    setTokens24h(recentTokens.length);
  };

  const fetchTrustlineStats = async () => {
    const client = new xrpl.Client('wss://xrplcluster.com');

    try {
      await client.connect();
      let totalTrustlines = 0;
      const uniqueHolders = new Set();
      const holders24hAgoSet = new Set();

      const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
      const recentTokens = tokens.filter(token =>
        new Date(token.created_at).getTime() > twentyFourHoursAgo
      );
      let trustlines24hAgo = 0;

      for (const token of tokens) {
        if (!token.amm_pool_created) continue;

        const isRecentToken = recentTokens.some(t => t.id === token.id);

        try {
          const currencyHex = token.currency_code.length > 3
            ? Buffer.from(token.currency_code, 'utf8').toString('hex').toUpperCase().padEnd(40, '0')
            : token.currency_code;

          const response = await client.request({
            command: 'account_lines',
            account: token.issuer_address,
            ledger_index: 'validated'
          });

          if (response.result.lines) {
            const tokenLines = response.result.lines.filter(line => {
              if (token.currency_code.length > 3) {
                return line.currency === currencyHex;
              }
              return line.currency === token.currency_code;
            });

            totalTrustlines += tokenLines.length;
            if (!isRecentToken) {
              trustlines24hAgo += tokenLines.length;
            }

            tokenLines.forEach(line => {
              if (parseFloat(line.balance) > 0) {
                uniqueHolders.add(line.account);
                if (!isRecentToken) {
                  holders24hAgoSet.add(line.account);
                }
              }
            });
          }
        } catch (error) {
          console.error(`Error fetching trustlines for ${token.token_name}:`, error.message);
        }
      }

      setTrustlineStats({
        totalTrustlines,
        totalHolders: uniqueHolders.size,
        trustlines24hAgo,
        holders24hAgo: holders24hAgoSet.size
      });

      await client.disconnect();
    } catch (error) {
      console.error('Error fetching trustline stats:', error);
    }
  };

  const loadTokens = async () => {
    const client = new xrpl.Client('wss://xrplcluster.com');

    try {
      const { data, error } = await supabase
        .from('meme_tokens')
        .select('*')
        .order('created_at', { ascending: false});

      if (error) throw error;

      const tokensData = data || [];

      await client.connect();

      for (const token of tokensData.filter(t => t.amm_pool_created)) {
        try {
          const currencyHex = token.currency_code.length > 3
            ? Buffer.from(token.currency_code, 'utf8').toString('hex').toUpperCase().padEnd(40, '0')
            : token.currency_code;

          const ammInfoResponse = await client.request({
            command: 'amm_info',
            asset: { currency: 'XRP' },
            asset2: {
              currency: currencyHex,
              issuer: token.issuer_address
            },
            ledger_index: 'validated'
          });

          if (ammInfoResponse.result.amm) {
            const amm = ammInfoResponse.result.amm;
            token.amm_xrp_amount = parseFloat(amm.amount) / 1000000;
            token.amm_asset_amount = parseFloat(amm.amount2.value);
          }
        } catch (error) {
          console.error(`Failed to fetch live data for ${token.token_name}:`, error.message);
        }
      }

      await client.disconnect();

      setTokens(tokensData);

      const stats = {
        totalTokens: tokensData.length,
        totalValue: tokensData.reduce((sum, t) => sum + (t.amm_xrp_amount || 0), 0),
        topPerformer: tokensData[0] || null,
        recentActivity: tokensData.slice(0, 5)
      };
      setAnalytics(stats);
    } catch (error) {
      console.error('Error loading tokens:', error);
    }
  };

  const fetchAllPoolsData = async () => {
    const client = new xrpl.Client('wss://xrplcluster.com');

    try {
      await client.connect();
      const poolData = {};

      for (const token of tokens) {
        if (!token.amm_pool_created) continue;

        try {
          const currencyHex = token.currency_code.length > 3
            ? Buffer.from(token.currency_code, 'utf8').toString('hex').toUpperCase().padEnd(40, '0')
            : token.currency_code;

          const ammInfoResponse = await client.request({
            command: 'amm_info',
            asset: { currency: 'XRP' },
            asset2: {
              currency: currencyHex,
              issuer: token.issuer_address
            },
            ledger_index: 'validated'
          });

          if (ammInfoResponse.result.amm) {
            const amm = ammInfoResponse.result.amm;
            const xrpAmount = parseFloat(amm.amount) / 1000000;
            const tokenAmount = parseFloat(amm.amount2.value);
            const lpTokens = parseFloat(amm.lp_token?.value || 0);

            poolData[token.id] = {
              xrpAmount,
              tokenAmount,
              lpTokens,
              price: xrpAmount / tokenAmount,
              accountId: amm.account
            };
          }
        } catch (error) {
          console.error(`Error fetching pool data for ${token.token_name}:`, error.message);
        }
      }

      setPoolsData(poolData);
      await client.disconnect();
    } catch (error) {
      console.error('Error fetching pools data:', error);
    }
  };

  const fetchLPBalances = async () => {
    if (!connectedWallet) return;

    const client = new xrpl.Client('wss://xrplcluster.com');

    try {
      await client.connect();

      const response = await client.request({
        command: 'account_lines',
        account: connectedWallet.address,
        ledger_index: 'validated'
      });

      const balances = {};
      if (response.result.lines) {
        response.result.lines.forEach(line => {
          const matchingToken = tokens.find(t => {
            const poolData = poolsData[t.id];
            return poolData && line.account === poolData.accountId;
          });

          if (matchingToken) {
            balances[matchingToken.id] = line.balance;
          }
        });
      }

      setLpBalances(balances);
      await client.disconnect();
    } catch (error) {
      console.error('Error fetching LP balances:', error);
    }
  };

  const initiateAddToken = () => {
    setShowAddTokenPasswordModal(true);
    setAddTokenPassword('');
  };

  const verifyAddTokenPassword = () => {
    if (addTokenPassword !== 'divercity') {
      toast.error('Incorrect password!');
      return;
    }
    setShowAddTokenPasswordModal(false);
    setShowManualAdd(true);
    setAddTokenPassword('');
  };

  const handleManualImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setManualImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setManualImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const addManualToken = async () => {
    if (!manualTokenData.name || !manualTokenData.issuer) {
      toast.error('Token name and issuer are required');
      return;
    }

    try {
      setUploadingManualImage(true);
      let imageUrl = null;

      if (manualImageFile) {
        imageUrl = await uploadImageToPinata(manualImageFile);
      }

      const insertData = {
        token_name: manualTokenData.name,
        currency_code: manualTokenData.name,
        issuer_address: manualTokenData.issuer,
        receiver_address: 'Manual Entry',
        supply: parseFloat(manualTokenData.supply),
        amm_xrp_amount: parseFloat(manualTokenData.xrpLocked),
        amm_pool_created: true,
        status: 'manual',
        amm_asset_amount: parseFloat(manualTokenData.supply) * 0.9,
        description: manualTokenData.description || null,
        twitter_handle: manualTokenData.twitterHandle || null,
        website_url: manualTokenData.websiteUrl || null
      };

      if (imageUrl) {
        insertData.image_url = imageUrl;
      }

      const { error } = await supabase
        .from('meme_tokens')
        .insert([insertData]);

      if (error) throw error;

      toast.success(`Token ${manualTokenData.name} added successfully!`);
      setShowManualAdd(false);
      setManualTokenData({ name: '', issuer: '', supply: '1000000', xrpLocked: '1', description: '', twitterHandle: '', websiteUrl: '' });
      setManualImageFile(null);
      setManualImagePreview(null);
      loadTokens();
    } catch (error) {
      console.error('Error adding token:', error);
      toast.error('Failed to add token');
    } finally {
      setUploadingManualImage(false);
    }
  };

  const initiateTokenCreation = () => {
    setShowCreateTokenModal(true);
    setCreatePassword('');
  };

  const createTokenAndAMM = async () => {
    if (createPassword !== 'divercity') {
      toast.error('Incorrect password!');
      return;
    }

    setIsCreating(true);
    setShowCreateTokenModal(false);
    setShowProgressModal(true);
    setCreationComplete(false);
    setCurrentStep(0);

    const steps = [
      { title: 'Generating Token Name', status: 'pending' },
      { title: 'Connecting to XRPL', status: 'pending' },
      { title: 'Validating Wallets', status: 'pending' },
      { title: 'Creating Trust Line', status: 'pending' },
      { title: 'Issuing Tokens', status: 'pending' },
      { title: 'Saving to Database', status: 'pending' },
      { title: 'Creating AMM Pool', status: 'pending' },
      { title: 'Complete', status: 'pending' }
    ];
    setProgressSteps(steps);

    const updateStep = (stepIndex, status, data = {}) => {
      setProgressSteps(prev => prev.map((step, idx) =>
        idx === stepIndex ? { ...step, status, ...data } : step
      ));
      setCurrentStep(stepIndex);
    };

    try {
      updateStep(0, 'active');
      const tokenName = getRandomWord();
      updateStep(0, 'complete', { data: `Token name: ${tokenName}` });

      updateStep(1, 'active');
      const client = new xrpl.Client('wss://s.altnet.rippletest.net:51233');
      await client.connect();
      updateStep(1, 'complete');

      updateStep(2, 'active');
      const issuerWallet = xrpl.Wallet.fromSeed(ISSUER_SEED);
      const receiverWallet = xrpl.Wallet.fromSeed(RECEIVER_SEED);

      try {
        await client.request({
          command: 'account_info',
          account: issuerWallet.address
        });
      } catch (e) {
        if (e.data?.error === 'actNotFound') {
          updateStep(2, 'error', { error: 'Issuer wallet not funded' });
          toast.error('Issuer wallet needs XRP. Please fund: ' + issuerWallet.address);
          await client.disconnect();
          setIsCreating(false);
          return;
        }
      }

      try {
        await client.request({
          command: 'account_info',
          account: receiverWallet.address
        });
      } catch (e) {
        if (e.data?.error === 'actNotFound') {
          updateStep(2, 'error', { error: 'Receiver wallet not funded' });
          toast.error('Receiver wallet needs XRP. Please fund: ' + receiverWallet.address);
          await client.disconnect();
          setIsCreating(false);
          return;
        }
      }
      updateStep(2, 'complete');

      updateStep(3, 'active');
      const trustSetTx = {
        TransactionType: 'TrustSet',
        Account: receiverWallet.address,
        LimitAmount: {
          currency: tokenName,
          issuer: issuerWallet.address,
          value: '1000000'
        }
      };

      const trustPrepared = await client.autofill(trustSetTx);
      const trustSigned = receiverWallet.sign(trustPrepared);
      const trustResult = await client.submitAndWait(trustSigned.tx_blob);

      if (trustResult.result.meta.TransactionResult !== 'tesSUCCESS') {
        updateStep(3, 'error', { error: trustResult.result.meta.TransactionResult });
        throw new Error('Trust line creation failed: ' + trustResult.result.meta.TransactionResult);
      }
      updateStep(3, 'complete', { txHash: trustResult.result.hash });

      updateStep(4, 'active');
      const paymentTx = {
        TransactionType: 'Payment',
        Account: issuerWallet.address,
        Destination: receiverWallet.address,
        Amount: {
          currency: tokenName,
          value: '1000000',
          issuer: issuerWallet.address
        }
      };

      const paymentPrepared = await client.autofill(paymentTx);
      const paymentSigned = issuerWallet.sign(paymentPrepared);
      const paymentResult = await client.submitAndWait(paymentSigned.tx_blob);

      if (paymentResult.result.meta.TransactionResult !== 'tesSUCCESS') {
        updateStep(4, 'error', { error: paymentResult.result.meta.TransactionResult });
        throw new Error('Token issuance failed: ' + paymentResult.result.meta.TransactionResult);
      }
      updateStep(4, 'complete', { txHash: paymentResult.result.hash });

      updateStep(5, 'active');
      const { data: insertedToken, error: insertError } = await supabase
        .from('meme_tokens')
        .insert([{
          token_name: tokenName,
          currency_code: tokenName,
          issuer_address: issuerWallet.address,
          receiver_address: receiverWallet.address,
          supply: 1000000,
          tx_hash: paymentResult.result.hash,
          status: 'issued',
          amm_pool_created: false
        }])
        .select()
        .single();

      if (insertError) {
        updateStep(5, 'error', { error: insertError.message });
        throw insertError;
      }

      await logActivity({
        userAddress: issuerWallet.address,
        actionType: ACTION_TYPES.TOKEN_CREATED,
        description: `Created random meme token "${tokenName}" with 1M supply`,
        details: {
          token_name: tokenName,
          supply: 1000000,
          issuer: issuerWallet.address
        },
        txHash: paymentResult.result.hash,
        tokenId: insertedToken.id
      });
      updateStep(5, 'complete');

      updateStep(6, 'active');
      try {
        const ammCreateTx = {
          TransactionType: 'AMMCreate',
          Account: receiverWallet.address,
          Amount: {
            currency: tokenName,
            value: '900000',
            issuer: issuerWallet.address
          },
          Amount2: xrpl.xrpToDrops('1'),
          TradingFee: 500
        };

        const ammPrepared = await client.autofill(ammCreateTx);
        const ammSigned = receiverWallet.sign(ammPrepared);
        const ammResult = await client.submitAndWait(ammSigned.tx_blob);

        if (ammResult.result.meta.TransactionResult === 'tesSUCCESS') {
          await supabase
            .from('meme_tokens')
            .update({
              amm_pool_created: true,
              amm_tx_hash: ammResult.result.hash,
              amm_asset_amount: 900000,
              amm_xrp_amount: 1,
              status: 'amm_created'
            })
            .eq('id', insertedToken.id);

          await logActivity({
            userAddress: receiverWallet.address,
            actionType: ACTION_TYPES.AMM_CREATED,
            description: `Created AMM pool for ${tokenName} with 900K tokens and 1 XRP`,
            details: {
              token_name: tokenName,
              token_amount: 900000,
              xrp_amount: 1
            },
            txHash: ammResult.result.hash,
            tokenId: insertedToken.id
          });

          updateStep(6, 'complete', { txHash: ammResult.result.hash });
        } else {
          updateStep(6, 'error', { error: ammResult.result.meta.TransactionResult });
        }
      } catch (ammError) {
        console.error('AMM creation error:', ammError);
        updateStep(6, 'error', { error: ammError.message });
      }

      await client.disconnect();

      updateStep(7, 'complete');
      setCreationComplete(true);
      setCreatedTokenData({
        name: tokenName,
        supply: 1000000,
        issuer: issuerWallet.address,
        receiver: receiverWallet.address,
        token: insertedToken
      });

      loadTokens();
    } catch (error) {
      console.error('Error creating token:', error);
      toast.error(`Failed to create token: ${error.message}`);
      setShowProgressModal(false);
    } finally {
      setIsCreating(false);
      setCreatePassword('');
    }
  };

  const calculateMarketCap = (token) => {
    if (!token.amm_pool_created || !token.amm_xrp_amount || !token.amm_asset_amount) return 0;
    const priceInXRP = token.amm_xrp_amount / token.amm_asset_amount;
    return (token.supply * priceInXRP).toFixed(4);
  };

  const calculatePrice = (token) => {
    const poolData = poolsData[token.id];
    if (poolData) {
      return poolData.price.toFixed(8);
    }
    if (!token.amm_pool_created || !token.amm_xrp_amount || !token.amm_asset_amount) return 0;
    return (token.amm_xrp_amount / token.amm_asset_amount).toFixed(8);
  };

  const calculateVolume = (token) => {
    const poolData = poolsData[token.id];
    if (poolData) {
      return (poolData.xrpAmount * 0.15).toFixed(2);
    }
    return token.amm_pool_created ? ((token.amm_xrp_amount || 0) * 0.15).toFixed(2) : '-';
  };

  const calculate24hChange = (token) => {
    const poolData = poolsData[token.id];
    if (!poolData || !poolData.price || !token.amm_xrp_amount || !token.amm_asset_amount) {
      return '0.00';
    }

    const currentPrice = poolData.price;
    const startingPrice = token.amm_xrp_amount / token.amm_asset_amount;

    if (!startingPrice || startingPrice === 0) {
      return '0.00';
    }

    const change = ((currentPrice - startingPrice) / startingPrice) * 100;
    return change.toFixed(2);
  };

  const tweetToken = (token) => {
    const price = calculatePrice(token);
    const marketCap = calculateMarketCap(token);

    const currencyHex = Buffer.from(token.currency_code, 'utf8').toString('hex').toUpperCase().padEnd(40, '0');

    const trustLineLink = `https://xrpl.services/?issuer=${token.issuer_address}&currency=${currencyHex}&limit=${token.supply}`;

    const magneticLink = `https://xmagnetic.org/dex/${token.currency_code}+${token.issuer_address}_XRP+XRP?network=mainnet`;

    const tweetText = `🚀 ${token.token_name} Token Info\n\n` +
      `💰 Supply: ${token.supply.toLocaleString()}\n` +
      `📊 Price: ${price} XRP\n` +
      `💎 Market Cap: ${marketCap} XRP\n` +
      `🔒 XRP Locked: ${token.amm_xrp_amount || 0} XRP\n` +
      `✅ Status: ${token.amm_pool_created ? 'AMM Pool Active' : 'Pending'}\n\n` +
      `🔗 Trust Line:\n${trustLineLink}\n\n` +
      `💱 Trade on Magnetic:\n${magneticLink}\n\n` +
      `#XRPL #Crypto #MemeToken`;

    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    window.open(tweetUrl, '_blank', 'width=550,height=420');
  };

  const requestAdminAction = (action, token = null) => {
    setAdminAction({ type: action, token });
    setShowAdminModal(true);
    setAdminPassword('');
  };

  const executeAdminAction = async () => {
    if (adminPassword !== 'divercity') {
      toast.error('Incorrect admin password!');
      return;
    }

    try {
      if (adminAction.type === 'delete') {
        const { error } = await supabase
          .from('meme_tokens')
          .delete()
          .eq('id', adminAction.token.id);

        if (error) throw error;
        toast.success(`Token ${adminAction.token.token_name} deleted!`);
      } else if (adminAction.type === 'edit') {
        console.log('Opening edit modal for token:', adminAction.token.token_name, 'Image URL:', adminAction.token.image_url);
        setEditingToken(adminAction.token);
        setEditImageFile(null);
        setEditImagePreview(null);
        setShowAdminModal(false);
        return;
      }

      setShowAdminModal(false);
      setAdminPassword('');
      setAdminAction(null);
      loadTokens();
    } catch (error) {
      console.error('Admin action error:', error);
      toast.error('Failed to execute action');
    }
  };

  const handleEditImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      console.log('Edit image file selected:', file.name, file.type, file.size);
      setEditImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        console.log('Edit image preview generated, length:', reader.result.length);
        setEditImagePreview(reader.result);
      };
      reader.onerror = (error) => {
        console.error('FileReader error:', error);
        toast.error('Failed to read image file');
      };
      reader.readAsDataURL(file);
    } else {
      console.log('No file selected');
      setEditImageFile(null);
      setEditImagePreview(null);
    }
  };

  const saveTokenEdit = async () => {
    if (adminPassword !== 'divercity') {
      toast.error('Incorrect admin password!');
      return;
    }

    try {
      setUploadingEditImage(true);
      let imageUrl = editingToken.image_url;

      if (editImageFile) {
        toast.loading('Uploading image to IPFS...');
        imageUrl = await uploadImageToPinata(editImageFile);
        toast.dismiss();
        toast.success('Image uploaded successfully!');
        console.log('New image URL:', imageUrl);
      }

      const updateData = {
        token_name: editingToken.token_name,
        supply: parseFloat(editingToken.supply),
        amm_xrp_amount: parseFloat(editingToken.amm_xrp_amount),
        amm_asset_amount: parseFloat(editingToken.amm_asset_amount),
        image_url: imageUrl,
        is_featured: editingToken.is_featured || false,
        featured_order: editingToken.is_featured ? (editingToken.featured_order || null) : null
      };

      console.log('Updating token with data:', updateData);

      const { data, error } = await supabase
        .from('meme_tokens')
        .update(updateData)
        .eq('id', editingToken.id)
        .select();

      if (error) throw error;

      const updatedToken = data[0];
      console.log('Updated token from database:', updatedToken);

      const tokenId = editingToken.id;

      setEditingToken(null);
      setAdminPassword('');
      setEditImageFile(null);
      setEditImagePreview(null);

      toast.success(`Token updated successfully! Refreshing...`);

      await loadTokens();

      emitTokenUpdate(tokenId);
    } catch (error) {
      console.error('Update error:', error);
      toast.error('Failed to update token: ' + error.message);
    } finally {
      setUploadingEditImage(false);
    }
  };

  const filteredTokens = tokens
    .filter(t => {
      const matchesSearch = t.token_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          t.issuer_address.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = filterStatus === 'all' ||
                          (filterStatus === 'active' && t.amm_pool_created) ||
                          (filterStatus === 'pending' && !t.amm_pool_created);
      const matchesTab = tokenFilterTab === 'all' ||
                        (tokenFilterTab === 'memeking' && t.issuer_address === ISSUER_ADDRESS) ||
                        (tokenFilterTab === 'user' && t.issuer_address !== ISSUER_ADDRESS);
      return matchesSearch && matchesFilter && matchesTab;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.created_at) - new Date(a.created_at);
        case 'oldest':
          return new Date(a.created_at) - new Date(b.created_at);
        case 'marketcap':
          return parseFloat(calculateMarketCap(b)) - parseFloat(calculateMarketCap(a));
        case 'supply':
          return b.supply - a.supply;
        default:
          return 0;
      }
    });

  const totalPages = Math.ceil(filteredTokens.length / TOKENS_PER_PAGE);
  const paginatedTokens = filteredTokens.slice(
    (currentPage - 1) * TOKENS_PER_PAGE,
    currentPage * TOKENS_PER_PAGE
  );

  const memeKingTokens = tokens.filter(t => t.issuer_address === ISSUER_ADDRESS);
  const userTokens = tokens.filter(t => t.issuer_address !== ISSUER_ADDRESS);

  const topTokens = [...tokens]
    .filter(t => t.is_featured && t.amm_pool_created)
    .sort((a, b) => (a.featured_order || 999) - (b.featured_order || 999))
    .slice(0, 3);

  if (topTokens.length < 3) {
    const nonFeaturedTokens = [...tokens]
      .filter(t => !t.is_featured && t.amm_pool_created)
      .sort((a, b) => parseFloat(calculateMarketCap(b)) - parseFloat(calculateMarketCap(a)))
      .slice(0, 3 - topTokens.length);
    topTokens.push(...nonFeaturedTokens);
  }

  const TokenCard = ({ token, featured = false }) => (
    <div
      className={`glass rounded-lg p-6 space-y-4 hover:scale-105 transition-transform cursor-pointer ${
        featured ? 'border-2 border-purple-500/50' : ''
      }`}
      onClick={() => setSelectedToken(token)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TokenIcon token={token} size={featured ? 'lg' : 'md'} />
          <div>
            <h3 className={`${featured ? 'text-2xl' : 'text-xl'} font-bold text-purple-200`}>{token.token_name}</h3>
            <p className="text-purple-400 text-sm">{token.currency_code}</p>
          </div>
        </div>
        {token.amm_pool_created && (
          <div className={`px-3 py-1 rounded-full text-xs font-bold ${
            parseFloat(calculate24hChange(token)) >= 0
              ? 'bg-green-500/20 text-green-400'
              : 'bg-red-500/20 text-red-400'
          }`}>
            {parseFloat(calculate24hChange(token)) >= 0 ? '+' : ''}{calculate24hChange(token)}%
          </div>
        )}
        {!token.amm_pool_created && (
          <div className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400">
            ○ Pending
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-purple-400 text-xs">Live Price</span>
          <span className="text-purple-200 text-sm font-bold">{calculatePrice(token)} XRP</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-purple-400 text-xs">Volume 24h</span>
          <span className="text-purple-200 text-sm font-bold">
            {token.amm_pool_created ? `${calculateVolume(token)} XRP` : '-'}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-purple-400 text-xs">Your LP</span>
          <span className="text-green-400 text-sm font-bold">
            {lpBalances[token.id] ? parseFloat(lpBalances[token.id]).toFixed(4) : '-'}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-purple-400 text-xs">Market Cap (Live)</span>
          <span className="text-purple-200 text-sm font-bold font-mono">{calculateMarketCap(token)} XRP</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-purple-400 text-xs">XRP Locked (Live)</span>
          <span className="text-purple-200 text-sm font-bold font-mono">{token.amm_xrp_amount ? token.amm_xrp_amount.toFixed(2) : '0.00'} XRP</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-purple-400 text-xs">Total Supply</span>
          <span className="text-purple-200 text-sm font-bold">{token.supply.toLocaleString()}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-3 border-t border-purple-500/20">
        <a
          href={`https://xrpl.services/?issuer=${token.issuer_address}&currency=${token.currency_code}&limit=1000000000`}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold text-xs px-3 py-2 rounded text-center shadow-lg"
          onClick={(e) => { e.stopPropagation(); }}
        >
          🔗 Trust
        </a>
        <button
          className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-bold text-xs px-3 py-2 rounded text-center shadow-lg"
          onClick={(e) => {
            e.stopPropagation();
            localStorage.setItem('selectedTradeToken', JSON.stringify(token));
            window.dispatchEvent(new CustomEvent('navigateToTrade', { detail: token }));
          }}
        >
          💱 Swap
        </button>
        <button
          className="col-span-2 bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white font-bold text-xs px-3 py-2 rounded shadow-lg"
          onClick={(e) => { e.stopPropagation(); tweetToken(token); }}
        >
          𝕏 Post on X
        </button>
      </div>
    </div>
  );

  const TokenRow = ({ token }) => (
    <tr
      className="border-t border-purple-500/20 hover:bg-purple-900/20 cursor-pointer"
      onClick={() => setSelectedToken(token)}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <TokenIcon token={token} size="sm" />
          <div>
            <div className="font-bold text-purple-200">{token.token_name}</div>
            <div className="text-purple-400 text-xs">{token.currency_code}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-purple-300 text-xs">{token.supply.toLocaleString()}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-purple-200 font-mono text-xs">{calculatePrice(token)}</span>
          {token.amm_pool_created && (
            <span className={`text-xs font-medium px-1.5 py-0.5 rounded whitespace-nowrap ${
              parseFloat(calculate24hChange(token)) >= 0
                ? 'text-green-300 bg-green-500/10'
                : 'text-red-300 bg-red-500/10'
            }`}>
              {parseFloat(calculate24hChange(token)) >= 0 ? '+' : ''}{calculate24hChange(token)}%
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-purple-200 text-xs">
        {token.amm_pool_created ? `${calculateVolume(token)} XRP` : '-'}
      </td>
      <td className="px-4 py-3 text-green-400 text-xs font-bold">
        {lpBalances[token.id] ? parseFloat(lpBalances[token.id]).toFixed(4) : '-'}
      </td>
      <td className="px-4 py-3 text-purple-200 text-xs font-mono">{calculateMarketCap(token)} XRP</td>
      <td className="px-4 py-3 text-purple-300 text-xs font-mono">{token.amm_xrp_amount ? token.amm_xrp_amount.toFixed(2) : '0.00'} XRP</td>
      <td className="px-4 py-3">
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
          token.amm_pool_created
            ? 'bg-green-500/20 text-green-400'
            : 'bg-yellow-500/20 text-yellow-400'
        }`}>
          {token.amm_pool_created ? '✓' : '○'}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-1 flex-wrap">
          <a
            href={`https://xrpl.services/?issuer=${token.issuer_address}&currency=${token.currency_code}&limit=1000000000`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold text-xs px-2 py-1 rounded shadow-md"
            onClick={(e) => { e.stopPropagation(); }}
            title="Setup Trustline"
          >
            🔗 Trust
          </a>
          <button
            className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-bold text-xs px-2 py-1 rounded shadow-md"
            onClick={(e) => {
              e.stopPropagation();
              localStorage.setItem('selectedTradeToken', JSON.stringify(token));
              window.dispatchEvent(new CustomEvent('navigateToTrade', { detail: token }));
            }}
            title="Trade on AMM"
          >
            💱 Swap
          </button>
          <button
            className="bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white font-bold text-xs px-2 py-1 rounded shadow-md"
            onClick={(e) => { e.stopPropagation(); tweetToken(token); }}
            title="Post on X"
          >
            𝕏 Post
          </button>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-1">
          <button
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-1 rounded"
            onClick={(e) => { e.stopPropagation(); requestAdminAction('edit', token); }}
            title="Edit Token"
          >
            ✏️
          </button>
          <button
            className="bg-red-600 hover:bg-red-700 text-white text-xs px-2 py-1 rounded"
            onClick={(e) => { e.stopPropagation(); requestAdminAction('delete', token); }}
            title="Delete Token"
          >
            🗑️
          </button>
        </div>
      </td>
    </tr>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-purple-200">Dashboard</h2>
          <p className="text-purple-400 mt-1">Meme token factory control center</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={async () => {
              if (!connectedWallet) {
                toast.error('Please connect a wallet first');
                return;
              }
              setShowActivityModal(true);
              setLoadingActivities(true);
              try {
                const { data, error } = await supabase
                  .from('activity_logs')
                  .select('*')
                  .eq('user_address', connectedWallet.address)
                  .order('created_at', { ascending: false })
                  .limit(50);
                if (error) throw error;
                setActivities(data || []);
              } catch (error) {
                console.error('Error loading activities:', error);
                toast.error('Failed to load activities');
              } finally {
                setLoadingActivities(false);
              }
            }}
            className="btn text-purple-300 px-4 py-3 rounded-lg font-medium flex items-center gap-2"
          >
            <span>📜</span> Activity
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="glass rounded-lg p-6">
          <div className="text-purple-400 text-sm mb-2">Total Tokens</div>
          <div className="text-3xl font-bold text-green-400">{analytics.totalTokens}</div>
          {tokens24h > 0 && (
            <div className="text-green-300 text-sm mt-1">
              +{tokens24h} ({tokens24h > 0 ? '+' : ''}{((tokens24h / analytics.totalTokens) * 100).toFixed(1)}%)
            </div>
          )}
          <div className="text-purple-500 text-xs mt-1">Last 24h</div>
        </div>

        <div className="glass rounded-lg p-6">
          <div className="text-purple-400 text-sm mb-2">Total XRP Locked (Live)</div>
          <div className="text-3xl font-bold text-green-400">{livePoolStats.totalXrpLocked.toFixed(2)}</div>
          <div className="text-green-300 text-sm mt-1">
            ${(livePoolStats.totalXrpLocked * xrpUsdPrice).toFixed(2)} USD
          </div>
          <div className="text-purple-500 text-xs mt-1">In AMM pools from XRPL</div>
        </div>

        <div className="glass rounded-lg p-6">
          <div className="text-purple-400 text-sm mb-2">Total Market Cap (Live)</div>
          <div className="text-3xl font-bold text-green-400">
            {livePoolStats.totalMarketCap.toFixed(2)}
          </div>
          <div className="text-green-300 text-sm mt-1">
            ${(livePoolStats.totalMarketCap * xrpUsdPrice).toFixed(2)} USD
          </div>
          <div className="text-purple-500 text-xs mt-1">XRP value from XRPL</div>
        </div>

        <div className="glass rounded-lg p-6">
          <div className="text-purple-400 text-sm mb-2">Total Holders (Live)</div>
          <div className="text-3xl font-bold text-green-400">
            {trustlineStats.totalTrustlines.toLocaleString()}
          </div>
          {trustlineStats.holders24hAgo > 0 && (
            <div className={`text-sm mt-1 ${
              trustlineStats.totalHolders > trustlineStats.holders24hAgo
                ? 'text-green-300'
                : trustlineStats.totalHolders < trustlineStats.holders24hAgo
                ? 'text-red-300'
                : 'text-purple-400'
            }`}>
              {trustlineStats.totalHolders > trustlineStats.holders24hAgo ? '+' : ''}
              {(((trustlineStats.totalHolders - trustlineStats.holders24hAgo) / trustlineStats.holders24hAgo) * 100).toFixed(1)}% holders
            </div>
          )}
          <div className="text-purple-500 text-xs mt-1">Last 24h</div>
        </div>
      </div>

      {topTokens.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-2xl font-bold text-purple-200">🔥 Top 3 Featured Tokens</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setTopViewMode('grid')}
                className={`px-4 py-2 rounded-lg transition-all text-sm ${
                  topViewMode === 'grid' ? 'bg-purple-600 text-white' : 'glass text-purple-300'
                }`}
              >
                ▦ Grid
              </button>
              <button
                onClick={() => setTopViewMode('list')}
                className={`px-4 py-2 rounded-lg transition-all text-sm ${
                  topViewMode === 'list' ? 'bg-purple-600 text-white' : 'glass text-purple-300'
                }`}
              >
                ☰ List
              </button>
            </div>
          </div>

          {topViewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {topTokens.map((token) => (
                <TokenCard key={token.id} token={token} featured={true} />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto glass rounded-lg p-4">
              <table className="w-full">
                <thead className="bg-purple-900/30">
                  <tr>
                    <th className="text-left px-4 py-3 text-purple-300 font-medium">Token</th>
                    <th className="text-left px-4 py-3 text-purple-300 font-medium">Supply</th>
                    <th className="text-left px-4 py-3 text-purple-300 font-medium">Live Price</th>
                    <th className="text-left px-4 py-3 text-purple-300 font-medium">Volume 24h</th>
                    <th className="text-left px-4 py-3 text-purple-300 font-medium">Your LP</th>
                    <th className="text-left px-4 py-3 text-purple-300 font-medium">Market Cap (Live)</th>
                    <th className="text-left px-4 py-3 text-purple-300 font-medium">XRP Locked (Live)</th>
                    <th className="text-left px-4 py-3 text-purple-300 font-medium">Status</th>
                    <th className="text-left px-4 py-3 text-purple-300 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {topTokens.map((token) => (
                    <TokenRow key={token.id} token={token} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => setMainTokenTab('all')}
          className={`px-6 py-3 rounded-lg transition-all font-medium text-lg ${
            mainTokenTab === 'all' ? 'bg-purple-600 text-white shadow-lg' : 'glass text-purple-300 hover:bg-purple-900/30'
          }`}
        >
          All Tokens
        </button>
        <button
          onClick={() => setMainTokenTab('user')}
          className={`px-6 py-3 rounded-lg transition-all font-medium text-lg ${
            mainTokenTab === 'user' ? 'bg-purple-600 text-white shadow-lg' : 'glass text-purple-300 hover:bg-purple-900/30'
          }`}
        >
          User Tokens
        </button>
      </div>

      {mainTokenTab === 'all' && (
        <div className="glass rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-purple-200">All Tokens</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-lg transition-all ${
                viewMode === 'list' ? 'bg-purple-600 text-white' : 'glass text-purple-300'
              }`}
            >
              ☰ List
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-4 py-2 rounded-lg transition-all ${
                viewMode === 'grid' ? 'bg-purple-600 text-white' : 'glass text-purple-300'
              }`}
            >
              ▦ Grid
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
          <input
            type="text"
            placeholder="🔍 Search tokens..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input text-purple-200 md:col-span-2"
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="input text-purple-200"
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="pending">Pending Only</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="input text-purple-200"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="marketcap">Market Cap</option>
            <option value="supply">Supply</option>
          </select>
        </div>

        <div className="flex items-center justify-between mb-3">
          <div className="text-purple-400 text-sm">
            Showing {((currentPage - 1) * TOKENS_PER_PAGE) + 1}-{Math.min(currentPage * TOKENS_PER_PAGE, filteredTokens.length)} of {filteredTokens.length} tokens
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 btn text-purple-300 rounded disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-purple-300 text-sm">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 btn text-purple-300 rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>

        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginatedTokens.map((token) => (
              <TokenCard key={token.id} token={token} />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-purple-900/30">
                <tr>
                  <th className="text-left px-4 py-3 text-purple-300 font-medium">Token</th>
                  <th className="text-left px-4 py-3 text-purple-300 font-medium">Supply</th>
                  <th className="text-left px-4 py-3 text-purple-300 font-medium">Live Price</th>
                  <th className="text-left px-4 py-3 text-purple-300 font-medium">Volume 24h</th>
                  <th className="text-left px-4 py-3 text-purple-300 font-medium">Your LP</th>
                  <th className="text-left px-4 py-3 text-purple-300 font-medium">Market Cap (Live)</th>
                  <th className="text-left px-4 py-3 text-purple-300 font-medium">XRP Locked (Live)</th>
                  <th className="text-left px-4 py-3 text-purple-300 font-medium">Status</th>
                  <th className="text-left px-4 py-3 text-purple-300 font-medium">Actions</th>
                  <th className="text-left px-4 py-3 text-purple-300 font-medium">Admin</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTokens.map((token) => (
                  <TokenRow key={token.id} token={token} />
                ))}
              </tbody>
            </table>
          </div>
        )}
        </div>
      )}

      {mainTokenTab === 'memeking_disabled' && (
        <div className="glass rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-purple-200">MemeKing Tokens</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('list')}
                className={`px-4 py-2 rounded-lg transition-all ${
                  viewMode === 'list' ? 'bg-purple-600 text-white' : 'glass text-purple-300'
                }`}
              >
                ☰ List
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`px-4 py-2 rounded-lg transition-all ${
                  viewMode === 'grid' ? 'bg-purple-600 text-white' : 'glass text-purple-300'
                }`}
              >
                ▦ Grid
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
            <input
              type="text"
              placeholder="🔍 Search tokens..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input text-purple-200 md:col-span-2"
            />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="input text-purple-200"
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="pending">Pending Only</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="input text-purple-200"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="marketcap">Market Cap</option>
              <option value="supply">Supply</option>
            </select>
          </div>

          <div className="flex items-center justify-between mb-3">
            <div className="text-purple-400 text-sm">
              Showing {memeKingTokens.filter(t => {
                const matchesSearch = t.token_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                    t.issuer_address.toLowerCase().includes(searchQuery.toLowerCase());
                const matchesFilter = filterStatus === 'all' ||
                                    (filterStatus === 'active' && t.amm_pool_created) ||
                                    (filterStatus === 'pending' && !t.amm_pool_created);
                return matchesSearch && matchesFilter;
              }).length} of {memeKingTokens.length} MemeKing tokens
            </div>
          </div>

          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {memeKingTokens.filter(t => {
                const matchesSearch = t.token_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                    t.issuer_address.toLowerCase().includes(searchQuery.toLowerCase());
                const matchesFilter = filterStatus === 'all' ||
                                    (filterStatus === 'active' && t.amm_pool_created) ||
                                    (filterStatus === 'pending' && !t.amm_pool_created);
                return matchesSearch && matchesFilter;
              }).sort((a, b) => {
                switch (sortBy) {
                  case 'oldest': return new Date(a.created_at) - new Date(b.created_at);
                  case 'marketcap': return (poolsData[b.id]?.marketCap || 0) - (poolsData[a.id]?.marketCap || 0);
                  case 'supply': return b.supply - a.supply;
                  default: return new Date(b.created_at) - new Date(a.created_at);
                }
              }).map(token => renderTokenCard(token))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-purple-500/20">
                    <th className="text-left py-3 px-4 text-purple-300">Token</th>
                    <th className="text-left py-3 px-4 text-purple-300">Supply</th>
                    <th className="text-left py-3 px-4 text-purple-300">XRP Locked (Live)</th>
                    <th className="text-left py-3 px-4 text-purple-300">Price</th>
                    <th className="text-left py-3 px-4 text-purple-300">Market Cap (Live)</th>
                    <th className="text-left py-3 px-4 text-purple-300">Status</th>
                    <th className="text-left py-3 px-4 text-purple-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {memeKingTokens.filter(t => {
                    const matchesSearch = t.token_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                        t.issuer_address.toLowerCase().includes(searchQuery.toLowerCase());
                    const matchesFilter = filterStatus === 'all' ||
                                        (filterStatus === 'active' && t.amm_pool_created) ||
                                        (filterStatus === 'pending' && !t.amm_pool_created);
                    return matchesSearch && matchesFilter;
                  }).sort((a, b) => {
                    switch (sortBy) {
                      case 'oldest': return new Date(a.created_at) - new Date(b.created_at);
                      case 'marketcap': return (poolsData[b.id]?.marketCap || 0) - (poolsData[a.id]?.marketCap || 0);
                      case 'supply': return b.supply - a.supply;
                      default: return new Date(b.created_at) - new Date(a.created_at);
                    }
                  }).map((token) => (
                    <TokenRow key={token.id} token={token} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {mainTokenTab === 'user' && (
        <div className="glass rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-purple-200">User Created Tokens</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('list')}
                className={`px-4 py-2 rounded-lg transition-all ${
                  viewMode === 'list' ? 'bg-purple-600 text-white' : 'glass text-purple-300'
                }`}
              >
                ☰ List
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`px-4 py-2 rounded-lg transition-all ${
                  viewMode === 'grid' ? 'bg-purple-600 text-white' : 'glass text-purple-300'
                }`}
              >
                ▦ Grid
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
            <input
              type="text"
              placeholder="🔍 Search tokens..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input text-purple-200 md:col-span-2"
            />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="input text-purple-200"
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="pending">Pending Only</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="input text-purple-200"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="marketcap">Market Cap</option>
              <option value="supply">Supply</option>
            </select>
          </div>

          <div className="flex items-center justify-between mb-3">
            <div className="text-purple-400 text-sm">
              Showing {userTokens.filter(t => {
                const matchesSearch = t.token_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                    t.issuer_address.toLowerCase().includes(searchQuery.toLowerCase());
                const matchesFilter = filterStatus === 'all' ||
                                    (filterStatus === 'active' && t.amm_pool_created) ||
                                    (filterStatus === 'pending' && !t.amm_pool_created);
                return matchesSearch && matchesFilter;
              }).length} of {userTokens.length} user tokens
            </div>
          </div>

          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {userTokens.filter(t => {
                const matchesSearch = t.token_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                    t.issuer_address.toLowerCase().includes(searchQuery.toLowerCase());
                const matchesFilter = filterStatus === 'all' ||
                                    (filterStatus === 'active' && t.amm_pool_created) ||
                                    (filterStatus === 'pending' && !t.amm_pool_created);
                return matchesSearch && matchesFilter;
              }).sort((a, b) => {
                switch (sortBy) {
                  case 'newest':
                    return new Date(b.created_at) - new Date(a.created_at);
                  case 'oldest':
                    return new Date(a.created_at) - new Date(b.created_at);
                  case 'marketcap':
                    return parseFloat(calculateMarketCap(b)) - parseFloat(calculateMarketCap(a));
                  case 'supply':
                    return b.supply - a.supply;
                  default:
                    return 0;
                }
              }).map((token) => (
                <TokenCard key={token.id} token={token} />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-purple-900/30">
                  <tr>
                    <th className="text-left px-4 py-3 text-purple-300 font-medium">Token</th>
                    <th className="text-left px-4 py-3 text-purple-300 font-medium">Supply</th>
                    <th className="text-left px-4 py-3 text-purple-300 font-medium">Starting Price</th>
                    <th className="text-left px-4 py-3 text-purple-300 font-medium">Live Price</th>
                    <th className="text-left px-4 py-3 text-purple-300 font-medium">Volume 24h</th>
                    <th className="text-left px-4 py-3 text-purple-300 font-medium">Your LP</th>
                    <th className="text-left px-4 py-3 text-purple-300 font-medium">Starting Cap</th>
                    <th className="text-left px-4 py-3 text-purple-300 font-medium">Starting XRP</th>
                    <th className="text-left px-4 py-3 text-purple-300 font-medium">Status</th>
                    <th className="text-left px-4 py-3 text-purple-300 font-medium">Actions</th>
                    <th className="text-left px-4 py-3 text-purple-300 font-medium">Admin</th>
                  </tr>
                </thead>
                <tbody>
                  {userTokens.filter(t => {
                    const matchesSearch = t.token_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                        t.issuer_address.toLowerCase().includes(searchQuery.toLowerCase());
                    const matchesFilter = filterStatus === 'all' ||
                                        (filterStatus === 'active' && t.amm_pool_created) ||
                                        (filterStatus === 'pending' && !t.amm_pool_created);
                    return matchesSearch && matchesFilter;
                  }).sort((a, b) => {
                    switch (sortBy) {
                      case 'newest':
                        return new Date(b.created_at) - new Date(a.created_at);
                      case 'oldest':
                        return new Date(a.created_at) - new Date(b.created_at);
                      case 'marketcap':
                        return parseFloat(calculateMarketCap(b)) - parseFloat(calculateMarketCap(a));
                      case 'supply':
                        return b.supply - a.supply;
                      default:
                        return 0;
                    }
                  }).map((token) => (
                    <TokenRow key={token.id} token={token} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showAddTokenPasswordModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="glass rounded-lg p-8 max-w-md w-full">
            <h3 className="text-2xl font-bold text-purple-200 mb-4">Password Required</h3>
            <p className="text-purple-300 mb-6">
              Enter password to add a token manually to the dashboard.
            </p>

            <div className="mb-6">
              <label className="block text-purple-300 mb-2">Password</label>
              <input
                type="password"
                value={addTokenPassword}
                onChange={(e) => setAddTokenPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && verifyAddTokenPassword()}
                className="input w-full text-purple-200"
                placeholder="Enter password"
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={verifyAddTokenPassword}
                className="btn-primary text-white px-6 py-2 rounded-lg font-medium flex-1"
              >
                Continue
              </button>
              <button
                onClick={() => {
                  setShowAddTokenPasswordModal(false);
                  setAddTokenPassword('');
                }}
                className="btn text-purple-300 px-6 py-2 rounded-lg font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showManualAdd && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="glass rounded-lg p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold text-purple-200 mb-6">Add Token Manually</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-purple-300 mb-2">Token Name *</label>
                <input
                  type="text"
                  value={manualTokenData.name}
                  onChange={(e) => setManualTokenData({ ...manualTokenData, name: e.target.value })}
                  className="input w-full text-purple-200"
                  placeholder="KOOL"
                />
              </div>

              <div>
                <label className="block text-purple-300 mb-2">Issuer Address *</label>
                <input
                  type="text"
                  value={manualTokenData.issuer}
                  onChange={(e) => setManualTokenData({ ...manualTokenData, issuer: e.target.value })}
                  className="input w-full text-purple-200 font-mono"
                  placeholder="rXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                />
              </div>

              <div>
                <label className="block text-purple-300 mb-2">Total Supply</label>
                <input
                  type="number"
                  value={manualTokenData.supply}
                  onChange={(e) => setManualTokenData({ ...manualTokenData, supply: e.target.value })}
                  className="input w-full text-purple-200"
                  placeholder="1000000"
                />
              </div>

              <div>
                <label className="block text-purple-300 mb-2">XRP Locked (for market cap calc)</label>
                <input
                  type="number"
                  step="0.01"
                  value={manualTokenData.xrpLocked}
                  onChange={(e) => setManualTokenData({ ...manualTokenData, xrpLocked: e.target.value })}
                  className="input w-full text-purple-200"
                  placeholder="1"
                />
              </div>

              <div>
                <label className="block text-purple-300 mb-2">Token Image (Optional)</label>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleManualImageChange}
                      className="input w-full text-purple-200"
                    />
                    <p className="text-purple-400 text-xs mt-1">Upload an image for the token icon</p>
                  </div>
                  {manualImagePreview && (
                    <div className="w-20 h-20 rounded-lg border-2 border-purple-500/30 overflow-hidden">
                      <img
                        src={manualImagePreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={addManualToken}
                disabled={uploadingManualImage}
                className="btn-primary text-white px-6 py-2 rounded-lg font-medium flex-1 disabled:opacity-50"
              >
                {uploadingManualImage ? 'Uploading...' : 'Add Token'}
              </button>
              <button
                onClick={() => {
                  setShowManualAdd(false);
                  setManualTokenData({ name: '', issuer: '', supply: '1000000', xrpLocked: '1' });
                  setManualImageFile(null);
                  setManualImagePreview(null);
                }}
                className="btn text-purple-300 px-6 py-2 rounded-lg font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedToken && (
        <TokenDetailModal token={selectedToken} onClose={() => setSelectedToken(null)} />
      )}

      {showAdminModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="glass rounded-lg p-8 max-w-md w-full">
            <h3 className="text-2xl font-bold text-purple-200 mb-4">Admin Access Required</h3>
            <p className="text-purple-300 mb-6">
              {adminAction?.type === 'delete'
                ? `Delete token "${adminAction?.token?.token_name}"?`
                : `Edit token "${adminAction?.token?.token_name}"?`}
            </p>

            <div className="mb-6">
              <label className="block text-purple-300 mb-2">Admin Password</label>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && executeAdminAction()}
                className="input w-full text-purple-200"
                placeholder="Enter admin password"
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={executeAdminAction}
                className="btn-primary text-white px-6 py-2 rounded-lg font-medium flex-1"
              >
                Confirm
              </button>
              <button
                onClick={() => {
                  setShowAdminModal(false);
                  setAdminPassword('');
                  setAdminAction(null);
                }}
                className="btn text-purple-300 px-6 py-2 rounded-lg font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateTokenModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="glass rounded-lg p-8 max-w-md w-full">
            <h3 className="text-2xl font-bold text-purple-200 mb-4">Create Random Meme Token</h3>
            <p className="text-purple-300 mb-6">
              This will generate a random meme token with a 3-5 letter name, issue 1M tokens, and create an AMM pool with 1 XRP.
            </p>

            <div className="mb-6">
              <label className="block text-purple-300 mb-2">Password Required</label>
              <input
                type="password"
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && createTokenAndAMM()}
                className="input w-full text-purple-200"
                placeholder="Enter password to create token"
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={createTokenAndAMM}
                className="btn-primary text-white px-6 py-2 rounded-lg font-medium flex-1"
              >
                Create Token
              </button>
              <button
                onClick={() => {
                  setShowCreateTokenModal(false);
                  setCreatePassword('');
                }}
                className="btn text-purple-300 px-6 py-2 rounded-lg font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreatedTokenOptions && createdToken && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="glass rounded-lg p-8 max-w-md w-full">
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">🎉</div>
              <h3 className="text-2xl font-bold text-purple-200 mb-2">Token Created Successfully!</h3>
              <p className="text-purple-300 text-lg font-bold">{createdToken.token_name}</p>
              <p className="text-purple-400 text-sm mt-2">Your meme token is now live on the XRPL!</p>
            </div>

            <div className="space-y-3 mb-6">
              <a
                href={`https://testnet.xrpl.org/transactions/${createdToken.tx_hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary text-white w-full px-6 py-3 rounded-lg font-medium text-center block"
              >
                View on XRPL Explorer
              </a>

              <a
                href={`https://firstledger.net/token/${createdToken.issuer_address}/${Buffer.from(createdToken.currency_code, 'utf8').toString('hex').toUpperCase().padEnd(40, '0')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn text-purple-300 w-full px-6 py-3 rounded-lg font-medium text-center block"
              >
                View on FirstLedger
              </a>

              <a
                href={`https://xmagnetic.org/dex/${createdToken.currency_code}+${createdToken.issuer_address}_XRP+XRP?network=testnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn text-purple-300 w-full px-6 py-3 rounded-lg font-medium text-center block"
              >
                Trade on Magnetic DEX
              </a>

              <button
                onClick={() => {
                  setSelectedToken(createdToken);
                  setShowCreatedTokenOptions(false);
                  setCreatedToken(null);
                }}
                className="btn text-purple-300 w-full px-6 py-3 rounded-lg font-medium"
              >
                View Token Details
              </button>
            </div>

            <button
              onClick={() => {
                setShowCreatedTokenOptions(false);
                setCreatedToken(null);
              }}
              className="btn text-purple-400 w-full px-6 py-2 rounded-lg font-medium"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {editingToken && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="glass rounded-lg p-8 max-w-2xl w-full">
            <h3 className="text-2xl font-bold text-purple-200 mb-6">Edit Token</h3>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-purple-300 mb-2">Token Name</label>
                <input
                  type="text"
                  value={editingToken.token_name}
                  onChange={(e) => setEditingToken({ ...editingToken, token_name: e.target.value })}
                  className="input w-full text-purple-200"
                />
              </div>

              <div>
                <label className="block text-purple-300 mb-2">Total Supply</label>
                <input
                  type="number"
                  value={editingToken.supply}
                  onChange={(e) => setEditingToken({ ...editingToken, supply: e.target.value })}
                  className="input w-full text-purple-200"
                />
              </div>

              <div>
                <label className="block text-purple-300 mb-2">XRP Locked</label>
                <input
                  type="number"
                  step="0.01"
                  value={editingToken.amm_xrp_amount || 0}
                  onChange={(e) => setEditingToken({ ...editingToken, amm_xrp_amount: e.target.value })}
                  className="input w-full text-purple-200"
                />
              </div>

              <div>
                <label className="block text-purple-300 mb-2">Asset Amount in Pool</label>
                <input
                  type="number"
                  value={editingToken.amm_asset_amount || 0}
                  onChange={(e) => setEditingToken({ ...editingToken, amm_asset_amount: e.target.value })}
                  className="input w-full text-purple-200"
                />
              </div>

              <div>
                <label className="block text-purple-300 mb-2">Featured Token</label>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={editingToken.is_featured || false}
                    onChange={(e) => setEditingToken({ ...editingToken, is_featured: e.target.checked })}
                    className="w-5 h-5 rounded border-purple-500 bg-purple-900/50 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-purple-300">Mark as featured token (top 3)</span>
                </div>
                {editingToken.is_featured && (
                  <div className="mt-2">
                    <label className="block text-purple-300 text-sm mb-1">Featured Order (1-3)</label>
                    <input
                      type="number"
                      min="1"
                      max="3"
                      value={editingToken.featured_order || 1}
                      onChange={(e) => setEditingToken({ ...editingToken, featured_order: parseInt(e.target.value) })}
                      className="input w-32 text-purple-200"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-purple-300 mb-2">Token Icon</label>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <input
                      key={editingToken.id}
                      type="file"
                      accept="image/*"
                      onChange={handleEditImageChange}
                      className="input w-full text-purple-200"
                    />
                    <p className="text-purple-400 text-xs mt-1">Upload new image or leave blank to keep current</p>
                  </div>
                  <div className="w-20 h-20 rounded-lg border-2 border-purple-500/30 overflow-hidden bg-gradient-to-br from-purple-900 to-purple-800 flex items-center justify-center">
                    {editImagePreview ? (
                      <img
                        src={editImagePreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                        onLoad={() => console.log('Preview image loaded')}
                        onError={() => console.error('Preview image failed to load')}
                      />
                    ) : editingToken.image_url ? (
                      <img
                        src={editingToken.image_url}
                        alt="Current"
                        className="w-full h-full object-cover"
                        onLoad={() => console.log('Current token image loaded:', editingToken.image_url)}
                        onError={(e) => {
                          console.error('Current token image failed to load:', editingToken.image_url);
                          e.target.style.display = 'none';
                          const parent = e.target.parentElement;
                          if (parent && !parent.querySelector('span')) {
                            const span = document.createElement('span');
                            span.className = 'text-2xl text-purple-300';
                            span.textContent = editingToken.token_name[0];
                            parent.appendChild(span);
                          }
                        }}
                      />
                    ) : (
                      <span className="text-2xl text-purple-300">{editingToken.token_name[0]}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t border-purple-500/20 pt-4">
                <label className="block text-purple-300 mb-2">Confirm Admin Password</label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && saveTokenEdit()}
                  className="input w-full text-purple-200"
                  placeholder="Enter admin password to save"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={saveTokenEdit}
                className="btn-primary text-white px-6 py-2 rounded-lg font-medium flex-1"
              >
                Save Changes
              </button>
              <button
                onClick={() => {
                  setEditingToken(null);
                  setAdminPassword('');
                }}
                className="btn text-purple-300 px-6 py-2 rounded-lg font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showProgressModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="glass rounded-lg max-w-2xl w-full p-8">
            <h3 className="text-2xl font-bold text-purple-200 mb-6">
              {creationComplete ? '✅ Token Created Successfully!' : '🚀 Creating Random Meme Token'}
            </h3>

            <div className="space-y-4 mb-6">
              {progressSteps.map((step, index) => (
                <div key={index} className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">
                    {step.status === 'complete' ? (
                      <div className="text-green-400 text-2xl">✓</div>
                    ) : step.status === 'active' ? (
                      <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                    ) : step.status === 'error' ? (
                      <div className="text-red-400 text-2xl">✗</div>
                    ) : (
                      <div className="w-6 h-6 border-2 border-purple-900 rounded-full"></div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className={`font-medium ${
                      step.status === 'complete' ? 'text-green-400' :
                      step.status === 'active' ? 'text-purple-200' :
                      step.status === 'error' ? 'text-red-400' :
                      'text-purple-500'
                    }`}>
                      {step.title}
                    </div>
                    {step.data && (
                      <div className="text-sm text-purple-400 mt-1">{step.data}</div>
                    )}
                    {step.txHash && (
                      <a
                        href={`https://testnet.xrpl.org/transactions/${step.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-400 hover:text-blue-300 mt-1 inline-block"
                      >
                        View Transaction →
                      </a>
                    )}
                    {step.error && (
                      <div className="text-sm text-red-400 mt-1">Error: {step.error}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {creationComplete && createdTokenData && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-6 mb-6">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-green-400 mb-1">Token Name</div>
                    <div className="text-green-200 font-bold text-lg">{createdTokenData.name}</div>
                  </div>
                  <div>
                    <div className="text-green-400 mb-1">Supply</div>
                    <div className="text-green-200 font-mono">{createdTokenData.supply.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-green-400 mb-1">Issuer</div>
                    <div className="text-green-200 font-mono text-xs">{createdTokenData.issuer.substring(0, 20)}...</div>
                  </div>
                  <div>
                    <div className="text-green-400 mb-1">Status</div>
                    <div className="text-green-200">✓ AMM Pool Created</div>
                  </div>
                </div>
              </div>
            )}

            {creationComplete && (
              <button
                onClick={() => {
                  setShowProgressModal(false);
                  setProgressSteps([]);
                  setCreatedTokenData(null);
                }}
                className="btn-primary text-white px-6 py-3 rounded-lg font-medium w-full"
              >
                Close
              </button>
            )}

            {!creationComplete && (
              <div className="text-center text-purple-400 text-sm">
                Please wait while we create your token...
              </div>
            )}
          </div>
        </div>
      )}

      {showActivityModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="glass rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-purple-500/20">
              <h3 className="text-2xl font-bold text-purple-200">My App Activity</h3>
              <button
                onClick={() => setShowActivityModal(false)}
                className="text-purple-400 hover:text-purple-200 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {loadingActivities ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-4 animate-pulse">⏳</div>
                  <div className="text-purple-200">Loading activities...</div>
                </div>
              ) : activities.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📭</div>
                  <h4 className="text-xl font-bold text-purple-200 mb-2">No Activity Yet</h4>
                  <p className="text-purple-400">Your app activity will appear here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activities.map((activity) => (
                    <div key={activity.id} className="glass rounded-lg p-4 border-l-4 border-green-500">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="text-purple-200 font-medium mb-1">
                            {activity.action_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </div>
                          <div className="text-purple-400 text-sm mb-2">{activity.description}</div>
                          {activity.details && Object.keys(activity.details).length > 0 && (
                            <div className="flex flex-wrap gap-3 text-xs">
                              {activity.details.amount && (
                                <span className="text-purple-300">Amount: {activity.details.amount}</span>
                              )}
                              {activity.details.xrpCost && (
                                <span className="text-purple-300">XRP: {activity.details.xrpCost}</span>
                              )}
                              {activity.details.tradeType && (
                                <span className={`px-2 py-1 rounded ${activity.details.tradeType === 'BUY' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                  {activity.details.tradeType}
                                </span>
                              )}
                            </div>
                          )}
                          <div className="flex items-center gap-3 mt-3 text-xs text-purple-500">
                            <span>{new Date(activity.created_at).toLocaleString()}</span>
                            {activity.tx_hash && (
                              <a
                                href={`https://testnet.xrpl.org/transactions/${activity.tx_hash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-purple-400 hover:text-purple-300"
                              >
                                View TX
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
