import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import toast from 'react-hot-toast';
import * as xrpl from 'xrpl';
import { Buffer } from 'buffer';
import { uploadImageToPinata } from '../utils/pinata';
import TokenIcon from '../components/TokenIcon';
import TokenDetailModal from '../components/TokenDetailModal';
import TokenCreationProgressModal from '../components/TokenCreationProgressModal';
import { getXRPBalance, checkWalletFunded } from '../utils/xrplBalance';
import { logActivity, ACTION_TYPES } from '../utils/activityLogger';
import { onTokenUpdate } from '../utils/tokenEvents';
import { promoteToFeatured } from '../utils/featuredTokens';
import { CategoryBadge, calculateDaysOnMarket } from '../utils/categoryUtils';

const ISSUER_SEED = 'sEd7bAfzqZWKxaatJpoWzTvENyaTg1Y';
const ISSUER_ADDRESS = 'rKxBBMmY969Ph1y63ddVfYyN7xmxwDfVq6';
const RECEIVER_SEED = 'sEd7W72aANTbLTG98XDhU1yfotPJdhu';
const RECEIVER_ADDRESS = 'rphatRpwXcPAo7CVm46dC78JAQ6kLMqb2M';

export default function Memes() {
  const [tokens, setTokens] = useState([]);
  const [filter, setFilter] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState(() => {
    return window.innerWidth < 768 ? 'grid' : 'list';
  });
  const [sortBy, setSortBy] = useState('newest');
  const [sortOrder, setSortOrder] = useState('desc');
  const [favorites, setFavorites] = useState([]);
  const [connectedWallet, setConnectedWallet] = useState(null);
  const [poolsData, setPoolsData] = useState({});
  const [lpBalances, setLpBalances] = useState({});
  const [xrpUsdPrice, setXrpUsdPrice] = useState(0);
  const [volumeHistory, setVolumeHistory] = useState({});
  const [priceHistory, setPriceHistory] = useState({});
  const [lpHistory, setLpHistory] = useState({});
  const [marketCapHistory, setMarketCapHistory] = useState({});
  const [liquidityHistory, setLiquidityHistory] = useState({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [addMode, setAddMode] = useState('manual');
  const [walletConfigMode, setWalletConfigMode] = useState('admin');
  const [userWallets, setUserWallets] = useState([]);
  const [selectedIssuerWallet, setSelectedIssuerWallet] = useState(null);
  const [selectedReceiverWallet, setSelectedReceiverWallet] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newToken, setNewToken] = useState({
    name: '',
    issuer: '',
    supply: '1000000',
    xrpLocked: '1',
    image: null,
    imageUrl: '',
    tfTransferable: false,
    requireDestTag: false,
    description: '',
    twitterHandle: '',
    websiteUrl: ''
  });
  const [imagePreview, setImagePreview] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedToken, setSelectedToken] = useState(null);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressSteps, setProgressSteps] = useState([]);
  const [currentProgressStep, setCurrentProgressStep] = useState(0);
  const [canCloseProgress, setCanCloseProgress] = useState(false);

  useEffect(() => {
    const initialize = async () => {
      await loadTokens();
      await loadCachedPoolData();
      loadConnectedWallet();
      loadUserWallets();
    };
    initialize();

    const unsubscribe = onTokenUpdate(() => {
      loadTokens();
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (tokens.length > 0 && Object.keys(poolsData).length === 0) {
      fetchAllPoolsData();
    }
  }, [tokens]);

  useEffect(() => {
    const refreshInterval = setInterval(() => {
      if (tokens.length > 0) {
        fetchAllPoolsData(false);
      }
    }, 300000);

    return () => clearInterval(refreshInterval);
  }, [tokens]);

  useEffect(() => {
    if (connectedWallet && Object.keys(poolsData).length > 0) {
      fetchLPBalances();
    }
  }, [connectedWallet, poolsData]);

  useEffect(() => {
    if (connectedWallet) {
      loadFavorites();
    }
  }, [connectedWallet]);

  useEffect(() => {
    const fetchXrpPrice = async () => {
      try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd');
        const data = await response.json();
        setXrpUsdPrice(data.ripple.usd);
      } catch (error) {
        console.error('Error fetching XRP price:', error);
      }
    };

    fetchXrpPrice();
    const interval = setInterval(fetchXrpPrice, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (tokens.length > 0 && Object.keys(poolsData).length > 0) {
      const newVolumeHistory = {};
      const newPriceHistory = {};
      const newLpHistory = {};
      const newMarketCapHistory = {};
      const newLiquidityHistory = {};

      tokens.forEach(token => {
        if (token.amm_pool_created && poolsData[token.id]) {
          const volume = parseFloat(calculateVolume(token));
          const price = parseFloat(calculatePrice(token));
          const lp = parseFloat(lpBalances[token.id]) || 0;
          const marketCap = parseFloat(calculateMarketCap(token));
          const liquidity = token.amm_xrp_amount || 0;

          if (!volumeHistory[token.id]) newVolumeHistory[token.id] = volume;
          if (!priceHistory[token.id]) newPriceHistory[token.id] = price;
          if (!lpHistory[token.id]) newLpHistory[token.id] = lp;
          if (!marketCapHistory[token.id]) newMarketCapHistory[token.id] = marketCap;
          if (!liquidityHistory[token.id]) newLiquidityHistory[token.id] = liquidity;
        }
      });

      if (Object.keys(newVolumeHistory).length > 0) {
        setVolumeHistory(prev => ({ ...prev, ...newVolumeHistory }));
        setPriceHistory(prev => ({ ...prev, ...newPriceHistory }));
        setLpHistory(prev => ({ ...prev, ...newLpHistory }));
        setMarketCapHistory(prev => ({ ...prev, ...newMarketCapHistory }));
        setLiquidityHistory(prev => ({ ...prev, ...newLiquidityHistory }));
      }

      const interval = setInterval(() => {
        const updatedVolumeHistory = {};
        const updatedPriceHistory = {};
        const updatedLpHistory = {};
        const updatedMarketCapHistory = {};
        const updatedLiquidityHistory = {};

        tokens.forEach(token => {
          if (token.amm_pool_created && poolsData[token.id]) {
            updatedVolumeHistory[token.id] = parseFloat(calculateVolume(token));
            updatedPriceHistory[token.id] = parseFloat(calculatePrice(token));
            updatedLpHistory[token.id] = parseFloat(lpBalances[token.id]) || 0;
            updatedMarketCapHistory[token.id] = parseFloat(calculateMarketCap(token));
            updatedLiquidityHistory[token.id] = token.amm_xrp_amount || 0;
          }
        });

        setVolumeHistory(updatedVolumeHistory);
        setPriceHistory(updatedPriceHistory);
        setLpHistory(updatedLpHistory);
        setMarketCapHistory(updatedMarketCapHistory);
        setLiquidityHistory(updatedLiquidityHistory);
      }, 60000);

      return () => clearInterval(interval);
    }
  }, [tokens, poolsData, lpBalances]);

  const loadConnectedWallet = () => {
    const stored = localStorage.getItem('connectedWallet');
    if (stored) {
      setConnectedWallet(JSON.parse(stored));
    }
  };

  const loadUserWallets = async () => {
    try {
      const { data, error } = await supabase
        .from('wallets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUserWallets(data || []);

      if (data && data.length >= 2) {
        setSelectedIssuerWallet(data[0]);
        setSelectedReceiverWallet(data[1]);
      } else if (data && data.length >= 1) {
        setSelectedIssuerWallet(data[0]);
      }
    } catch (error) {
      console.error('Error loading wallets:', error);
    }
  };

  const loadFavorites = async () => {
    if (!connectedWallet) return;
    try {
      const { data, error } = await supabase
        .from('token_favorites')
        .select('token_id')
        .eq('user_address', connectedWallet.address);

      if (error) throw error;
      setFavorites(data?.map(f => f.token_id) || []);
    } catch (error) {
      console.error('Error loading favorites:', error);
    }
  };

  const toggleFavorite = async (tokenId, e) => {
    if (e) e.stopPropagation();
    if (!connectedWallet) {
      toast.error('Connect wallet to favorite tokens');
      return;
    }

    try {
      const isFavorited = favorites.includes(tokenId);

      if (isFavorited) {
        const { error } = await supabase
          .from('token_favorites')
          .delete()
          .eq('user_address', connectedWallet.address)
          .eq('token_id', tokenId);

        if (error) throw error;
        setFavorites(favorites.filter(id => id !== tokenId));
        toast.success('Removed from favorites');
      } else {
        const { error } = await supabase
          .from('token_favorites')
          .insert({
            user_address: connectedWallet.address,
            token_id: tokenId
          });

        if (error) throw error;
        setFavorites([...favorites, tokenId]);
        toast.success('Added to favorites');
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast.error('Failed to update favorite');
    }
  };

  const loadTokens = async () => {
    try {
      const { data, error } = await supabase
        .from('meme_tokens')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTokens(data || []);
    } catch (error) {
      console.error('Error loading tokens:', error);
    }
  };

  const loadCachedPoolData = async () => {
    try {
      const { data: cachedPools, error } = await supabase
        .from('pool_data_cache')
        .select('*');

      if (!error && cachedPools && cachedPools.length > 0) {
        const poolData = {};
        cachedPools.forEach(cache => {
          poolData[cache.token_id] = {
            xrpAmount: parseFloat(cache.xrp_amount),
            tokenAmount: parseFloat(cache.token_amount),
            lpTokens: parseFloat(cache.lp_tokens),
            price: parseFloat(cache.price),
            accountId: cache.account_id,
            volume24h: parseFloat(cache.volume_24h || 0),
            priceChange24h: parseFloat(cache.price_change_24h || 0)
          };
        });
        setPoolsData(poolData);
        console.log(`⚡ Memes: Loaded ${cachedPools.length} pools from cache instantly`);
      }
    } catch (error) {
      console.error('Error loading cached pool data:', error);
    }
  };

  const fetch24hVolumes = async (tokenIds) => {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('trade_history')
        .select('token_id, xrp_amount')
        .in('token_id', tokenIds)
        .gte('created_at', twentyFourHoursAgo);

      if (error) throw error;

      const volumeByToken = {};
      tokenIds.forEach(id => volumeByToken[id] = 0);

      if (data && data.length > 0) {
        data.forEach(trade => {
          const volume = parseFloat(trade.xrp_amount || 0);
          volumeByToken[trade.token_id] = (volumeByToken[trade.token_id] || 0) + volume;
        });
      }

      return volumeByToken;
    } catch (error) {
      console.error('Error fetching 24h volumes:', error);
      return {};
    }
  };

  const fetchAllPoolsData = async (forceRefresh = false) => {
    try {
      const cacheAge = 300;
      const { data: cachedPools, error: cacheError } = await supabase
        .from('pool_data_cache')
        .select('*')
        .gte('last_updated', new Date(Date.now() - cacheAge * 1000).toISOString());

      if (!forceRefresh && cachedPools && cachedPools.length > 0 && !cacheError) {
        console.log(`✅ Using cached pool data (${cachedPools.length} pools)`);

        const poolData = {};
        cachedPools.forEach(cache => {
          poolData[cache.token_id] = {
            xrpAmount: parseFloat(cache.xrp_amount),
            tokenAmount: parseFloat(cache.token_amount),
            lpTokens: parseFloat(cache.lp_tokens),
            price: parseFloat(cache.price),
            accountId: cache.account_id,
            volume24h: parseFloat(cache.volume_24h || 0),
            priceChange24h: parseFloat(cache.price_change_24h || 0)
          };
        });

        setPoolsData(poolData);
        return;
      }

      console.log('🔄 Fetching fresh pool data from XRPL...');
      const { requestWithRetry } = await import('../utils/xrplClient');

      const poolTokens = tokens.filter(t => t.amm_pool_created);
      const volumeData = await fetch24hVolumes(poolTokens.map(t => t.id));

      const poolData = {};
      for (const token of tokens) {
        if (!token.amm_pool_created) continue;

        try {
          const currencyHex = token.currency_code.length > 3
            ? Buffer.from(token.currency_code, 'utf8').toString('hex').toUpperCase().padEnd(40, '0')
            : token.currency_code;

          const ammInfoResponse = await requestWithRetry({
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

            const volume24h = volumeData[token.id] || 0;

            poolData[token.id] = {
              xrpAmount,
              tokenAmount,
              lpTokens,
              price: xrpAmount / tokenAmount,
              accountId: amm.account,
              volume24h
            };
          }
        } catch (error) {
          console.error(`Error fetching pool data for ${token.token_name}:`, error.message);
        }
      }

      const cacheRecords = Object.entries(poolData).map(([tokenId, data]) => ({
        token_id: tokenId,
        xrp_amount: data.xrpAmount,
        token_amount: data.tokenAmount,
        lp_tokens: data.lpTokens,
        price: data.price,
        account_id: data.accountId,
        volume_24h: data.volume24h || 0,
        price_change_24h: 0,
        last_updated: new Date().toISOString()
      }));

      if (cacheRecords.length > 0) {
        for (const record of cacheRecords) {
          await supabase
            .from('pool_data_cache')
            .upsert(record, { onConflict: 'token_id' });
        }
        console.log(`💾 Cached ${cacheRecords.length} pools`);
      }

      setPoolsData(poolData);
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

      const lpBal = {};
      response.result.lines.forEach(line => {
        const poolData = Object.entries(poolsData).find(
          ([_, data]) => data.accountId === line.account
        );

        if (poolData) {
          const [tokenId, data] = poolData;
          const balance = parseFloat(line.balance);
          const share = (balance / data.lpTokens) * 100;
          lpBal[tokenId] = { balance, share };
        }
      });

      setLpBalances(lpBal);
      await client.disconnect();
    } catch (error) {
      console.error('Error fetching LP balances:', error);
    }
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be less than 5MB');
        return;
      }
      if (!file.type.startsWith('image/')) {
        toast.error('File must be an image');
        return;
      }
      setNewToken({ ...newToken, image: file });
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const addToken = async () => {
    if (!newToken.name || !newToken.issuer) {
      toast.error('Token name and issuer are required');
      return;
    }

    try {
      let imageUrl = null;

      if (newToken.image) {
        setUploadingImage(true);
        toast.loading('Uploading image...');
        try {
          imageUrl = await uploadImageToPinata(newToken.image);
          toast.dismiss();
          toast.success('Image uploaded successfully!');
        } catch (error) {
          toast.dismiss();
          toast.error('Failed to upload image');
          setUploadingImage(false);
          return;
        }
        setUploadingImage(false);
      }

      const { error } = await supabase
        .from('meme_tokens')
        .insert([{
          token_name: newToken.name,
          currency_code: newToken.name,
          issuer_address: newToken.issuer,
          receiver_address: 'Manual Entry',
          supply: parseFloat(newToken.supply),
          amm_xrp_amount: parseFloat(newToken.xrpLocked),
          amm_pool_created: true,
          status: 'manual',
          amm_asset_amount: parseFloat(newToken.supply) * 0.9,
          initial_xrp_amount: parseFloat(newToken.xrpLocked),
          initial_asset_amount: parseFloat(newToken.supply) * 0.9,
          image_url: imageUrl,
          description: newToken.description || null,
          twitter_handle: newToken.twitterHandle || null,
          website_url: newToken.websiteUrl || null
        }]);

      if (error) throw error;

      toast.success(`Token ${newToken.name} added successfully!`);
      setShowAddModal(false);
      setNewToken({ name: '', issuer: '', supply: '1000000', xrpLocked: '1', image: null, imageUrl: '', tfTransferable: false, requireDestTag: false, description: '', twitterHandle: '', websiteUrl: '' });
      setImagePreview(null);
      loadTokens();
    } catch (error) {
      console.error('Error adding token:', error);
      toast.error('Failed to add token');
    }
  };

  const createUserToken = async () => {
    if (!newToken.name) {
      toast.error('Token name is required');
      return;
    }

    if (!selectedIssuerWallet || !selectedReceiverWallet) {
      toast.error('Please select both issuer and receiver wallets');
      return;
    }

    if (selectedIssuerWallet.id === selectedReceiverWallet.id) {
      toast.error('Issuer and receiver must be different wallets');
      return;
    }

    setIsCreating(true);
    setShowAddModal(false);
    setShowProgressModal(true);
    setCanCloseProgress(false);

    const steps = [
      { title: 'Connecting to XRPL', description: 'Establishing connection to XRP Ledger' },
      { title: 'Validating Wallets', description: 'Checking issuer and receiver wallet balances' },
      { title: 'Creating Trust Line', description: 'Setting up trust line for the new token' },
      { title: 'Issuing Tokens', description: 'Minting tokens to receiver wallet' }
    ];

    if (newToken.image) {
      steps.push({ title: 'Uploading Image', description: 'Uploading token image to IPFS' });
    }

    steps.push({ title: 'Saving to Database', description: 'Storing token information' });

    if (parseFloat(newToken.xrpLocked) > 0) {
      steps.push({ title: 'Creating AMM Pool', description: 'Setting up automated market maker pool' });
    }

    steps.push({ title: 'Complete', description: 'Token creation finished successfully' });

    setProgressSteps(steps);
    setCurrentProgressStep(0);

    try {
      setCurrentProgressStep(0);
      const client = new xrpl.Client('wss://xrplcluster.com');
      await client.connect();

      const issuerWallet = xrpl.Wallet.fromSeed(selectedIssuerWallet.encrypted_seed);
      const receiverWallet = xrpl.Wallet.fromSeed(selectedReceiverWallet.encrypted_seed);

      setCurrentProgressStep(1);

      try {
        await client.request({
          command: 'account_info',
          account: issuerWallet.address
        });
      } catch (e) {
        if (e.data?.error === 'actNotFound') {
          const errorStep = [...steps];
          errorStep[1] = {
            ...errorStep[1],
            description: `Error: Issuer wallet not funded. Address: ${issuerWallet.address}`,
            error: true
          };
          setProgressSteps(errorStep);
          setCanCloseProgress(true);
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
          const errorStep = [...steps];
          errorStep[1] = {
            ...errorStep[1],
            description: `Error: Receiver wallet not funded. Address: ${receiverWallet.address}`,
            error: true
          };
          setProgressSteps(errorStep);
          setCanCloseProgress(true);
          await client.disconnect();
          setIsCreating(false);
          return;
        }
      }

      setCurrentProgressStep(2);

      if (!newToken.tfTransferable) {
        const accountSetTx = {
          TransactionType: 'AccountSet',
          Account: issuerWallet.address,
          SetFlag: 8
        };

        const accountSetPrepared = await client.autofill(accountSetTx);
        const accountSetSigned = issuerWallet.sign(accountSetPrepared);
        const accountSetResult = await client.submitAndWait(accountSetSigned.tx_blob);

        if (accountSetResult.result.meta.TransactionResult !== 'tesSUCCESS') {
          throw new Error('Failed to disable rippling on issuer: ' + accountSetResult.result.meta.TransactionResult);
        }
      }

      const currencyCode = newToken.name.length <= 3
        ? newToken.name.toUpperCase()
        : Buffer.from(newToken.name, 'utf8').toString('hex').toUpperCase().padEnd(40, '0');

      const trustSetTx = {
        TransactionType: 'TrustSet',
        Account: receiverWallet.address,
        LimitAmount: {
          currency: currencyCode,
          issuer: issuerWallet.address,
          value: newToken.supply.toString()
        }
      };

      if (!newToken.tfTransferable) {
        trustSetTx.Flags = xrpl.TrustSetFlags.tfSetNoRipple;
      }

      const trustPrepared = await client.autofill(trustSetTx);
      const trustSigned = receiverWallet.sign(trustPrepared);
      const trustResult = await client.submitAndWait(trustSigned.tx_blob);

      if (trustResult.result.meta.TransactionResult !== 'tesSUCCESS') {
        throw new Error('Trust line creation failed: ' + trustResult.result.meta.TransactionResult);
      }

      const updatedSteps = [...steps];
      updatedSteps[2] = { ...updatedSteps[2], txHash: trustResult.result.hash };
      setProgressSteps(updatedSteps);

      setCurrentProgressStep(3);
      const paymentTx = {
        TransactionType: 'Payment',
        Account: issuerWallet.address,
        Destination: receiverWallet.address,
        Amount: {
          currency: currencyCode,
          value: newToken.supply.toString(),
          issuer: issuerWallet.address
        }
      };

      if (newToken.requireDestTag) {
        paymentTx.DestinationTag = 1;
      }

      const paymentPrepared = await client.autofill(paymentTx);
      const paymentSigned = issuerWallet.sign(paymentPrepared);
      const paymentResult = await client.submitAndWait(paymentSigned.tx_blob);

      if (paymentResult.result.meta.TransactionResult !== 'tesSUCCESS') {
        throw new Error('Token issuance failed: ' + paymentResult.result.meta.TransactionResult);
      }

      updatedSteps[3] = { ...updatedSteps[3], txHash: paymentResult.result.hash };
      setProgressSteps(updatedSteps);

      let imageUrl = '';
      const currentStep = newToken.image ? 4 : 4;

      if (newToken.image) {
        setCurrentProgressStep(currentStep);
        const uploadedUrl = await uploadImageToPinata(newToken.image);
        imageUrl = uploadedUrl;
      }

      setCurrentProgressStep(currentStep + (newToken.image ? 1 : 0));

      const { data, error } = await supabase.from('meme_tokens').insert([{
        token_name: newToken.name,
        issuer_address: issuerWallet.address,
        currency_code: currencyCode,
        supply: newToken.supply,
        total_supply: newToken.supply,
        description: newToken.description || '',
        twitter_handle: newToken.twitterHandle || '',
        website_url: newToken.websiteUrl || '',
        image_url: imageUrl,
        xrp_locked: parseFloat(newToken.xrpLocked) || 0,
        amm_pool_created: false,
        require_dest_tag: newToken.requireDestTag || false
      }]).select();

      if (error) throw error;

      const tokenId = data[0].id;

      if (parseFloat(newToken.xrpLocked) > 0) {
        setCurrentProgressStep(currentStep + 1 + (newToken.image ? 1 : 0));

        const ammSupply = parseFloat(newToken.supply) * 0.9;
        const ammCreateTx = {
          TransactionType: 'AMMCreate',
          Account: receiverWallet.address,
          Amount: {
            currency: currencyCode,
            issuer: issuerWallet.address,
            value: ammSupply.toString()
          },
          Amount2: xrpl.xrpToDrops(newToken.xrpLocked),
          TradingFee: 1000
        };

        const ammPrepared = await client.autofill(ammCreateTx);
        const ammSigned = receiverWallet.sign(ammPrepared);
        const ammResult = await client.submitAndWait(ammSigned.tx_blob);

        if (ammResult.result.meta.TransactionResult === 'tesSUCCESS') {
          const ammInfoRequest = {
            command: 'amm_info',
            asset: {
              currency: currencyCode,
              issuer: issuerWallet.address
            },
            asset2: {
              currency: 'XRP'
            }
          };

          const ammInfo = await client.request(ammInfoRequest);
          const ammData = ammInfo.result.amm;

          const ammAssetAmount = parseFloat(ammData.amount.value);
          const ammXrpAmount = parseFloat(xrpl.dropsToXrp(ammData.amount2));

          await supabase.from('meme_tokens').update({
            amm_pool_created: true,
            amm_asset_amount: ammAssetAmount,
            amm_xrp_amount: ammXrpAmount,
            initial_asset_amount: ammAssetAmount,
            initial_xrp_amount: ammXrpAmount
          }).eq('id', tokenId);

          updatedSteps[currentStep + 1 + (newToken.image ? 1 : 0)] = {
            ...updatedSteps[currentStep + 1 + (newToken.image ? 1 : 0)],
            txHash: ammResult.result.hash
          };
          setProgressSteps(updatedSteps);
        } else {
          throw new Error('AMM creation failed: ' + ammResult.result.meta.TransactionResult);
        }
      }

      setCurrentProgressStep(steps.length - 1);
      toast.success(`Token ${newToken.name} created successfully!`);

      await promoteToFeatured(tokenId);

      await logActivity({
        userAddress: issuerWallet.address,
        actionType: ACTION_TYPES.TOKEN_CREATED,
        description: `Created custom token ${newToken.name} with user wallets`,
        metadata: { tokenName: newToken.name, issuer: issuerWallet.address, receiver: receiverWallet.address }
      });

      setNewToken({ name: '', issuer: '', supply: '1000000', xrpLocked: '1', image: null, imageUrl: '', tfTransferable: false, requireDestTag: false, description: '', twitterHandle: '', websiteUrl: '' });
      setImagePreview(null);
      setShowCreateModal(false);
      loadTokens();

      await client.disconnect();
      setCanCloseProgress(true);

      setTimeout(() => {
        setShowProgressModal(false);
        setProgressSteps([]);
        setCurrentProgressStep(0);
        setCanCloseProgress(false);
      }, 3000);
    } catch (error) {
      console.error('Error creating token:', error);
      toast.error('Error: ' + error.message);

      const errorSteps = [...steps];
      if (currentProgressStep < errorSteps.length) {
        errorSteps[currentProgressStep] = {
          ...errorSteps[currentProgressStep],
          description: `Error: ${error.message}`,
          error: true
        };
        setProgressSteps(errorSteps);
      }

      setCanCloseProgress(true);
    } finally {
      setIsCreating(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);

    setNewToken({ ...newToken, image: file });
  };

  const createCustomToken = async () => {
    if (!newToken.name) {
      toast.error('Token name is required');
      return;
    }

    setIsCreating(true);
    setShowAddModal(false);
    setShowProgressModal(true);
    setCanCloseProgress(false);

    const steps = [
      { title: 'Connecting to XRPL', description: 'Establishing connection to XRP Ledger testnet' },
      { title: 'Validating Wallets', description: 'Checking issuer and receiver wallet balances' },
      { title: 'Creating Trust Line', description: 'Setting up trust line for the new token' },
      { title: 'Issuing Tokens', description: 'Minting tokens to receiver wallet' }
    ];

    if (newToken.image) {
      steps.push({ title: 'Uploading Image', description: 'Uploading token image to IPFS' });
    }

    steps.push({ title: 'Saving to Database', description: 'Storing token information' });

    if (parseFloat(newToken.xrpLocked) > 0) {
      steps.push({ title: 'Creating AMM Pool', description: 'Setting up automated market maker pool' });
    }

    steps.push({ title: 'Complete', description: 'Token creation finished successfully' });

    setProgressSteps(steps);
    setCurrentProgressStep(0);

    try {
      setCurrentProgressStep(0);
      const feeHash = await payCreationFee();
      const updatedSteps0 = [...steps];
      updatedSteps0[0] = { ...updatedSteps0[0], txHash: feeHash };
      setProgressSteps(updatedSteps0);

      setCurrentProgressStep(1);
      const client = new xrpl.Client('wss://xrplcluster.com');
      await client.connect();

      let issuerWallet, receiverWallet;
      if (walletConfigMode === 'admin') {
        issuerWallet = xrpl.Wallet.fromSeed(ISSUER_SEED);
        receiverWallet = xrpl.Wallet.fromSeed(RECEIVER_SEED);
      } else {
        if (!selectedIssuerWallet || !selectedReceiverWallet) {
          throw new Error('Please select both issuer and receiver wallets');
        }
        issuerWallet = xrpl.Wallet.fromSeed(selectedIssuerWallet.encrypted_seed);
        receiverWallet = xrpl.Wallet.fromSeed(selectedReceiverWallet.encrypted_seed);
      }

      setCurrentProgressStep(2);

      try {
        await client.request({
          command: 'account_info',
          account: issuerWallet.address
        });
      } catch (e) {
        if (e.data?.error === 'actNotFound') {
          const errorStep = [...steps];
          errorStep[2] = {
            ...errorStep[2],
            description: `Error: Issuer wallet not funded. Address: ${issuerWallet.address}`,
            error: true
          };
          setProgressSteps(errorStep);
          setCanCloseProgress(true);
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
          const errorStep = [...steps];
          errorStep[2] = {
            ...errorStep[2],
            description: `Error: Receiver wallet not funded. Address: ${receiverWallet.address}`,
            error: true
          };
          setProgressSteps(errorStep);
          setCanCloseProgress(true);
          await client.disconnect();
          setIsCreating(false);
          return;
        }
      }

      setCurrentProgressStep(3);

      if (!newToken.tfTransferable) {
        const accountSetTx = {
          TransactionType: 'AccountSet',
          Account: issuerWallet.address,
          SetFlag: 8
        };

        const accountSetPrepared = await client.autofill(accountSetTx);
        const accountSetSigned = issuerWallet.sign(accountSetPrepared);
        const accountSetResult = await client.submitAndWait(accountSetSigned.tx_blob);

        if (accountSetResult.result.meta.TransactionResult !== 'tesSUCCESS') {
          throw new Error('Failed to disable rippling on issuer: ' + accountSetResult.result.meta.TransactionResult);
        }
      }

      const currencyCode = newToken.name.length <= 3
        ? newToken.name.toUpperCase()
        : Buffer.from(newToken.name, 'utf8').toString('hex').toUpperCase().padEnd(40, '0');

      const trustSetTx = {
        TransactionType: 'TrustSet',
        Account: receiverWallet.address,
        LimitAmount: {
          currency: currencyCode,
          issuer: issuerWallet.address,
          value: newToken.supply.toString()
        }
      };

      if (!newToken.tfTransferable) {
        trustSetTx.Flags = xrpl.TrustSetFlags.tfSetNoRipple;
      }

      const trustPrepared = await client.autofill(trustSetTx);
      const trustSigned = receiverWallet.sign(trustPrepared);
      const trustResult = await client.submitAndWait(trustSigned.tx_blob);

      if (trustResult.result.meta.TransactionResult !== 'tesSUCCESS') {
        throw new Error('Trust line creation failed: ' + trustResult.result.meta.TransactionResult);
      }

      const updatedSteps = [...steps];
      updatedSteps[3] = { ...updatedSteps[2], txHash: trustResult.result.hash };
      setProgressSteps(updatedSteps);

      setCurrentProgressStep(4);
      const paymentTx = {
        TransactionType: 'Payment',
        Account: issuerWallet.address,
        Destination: receiverWallet.address,
        Amount: {
          currency: currencyCode,
          value: newToken.supply.toString(),
          issuer: issuerWallet.address
        }
      };

      if (newToken.requireDestTag) {
        paymentTx.DestinationTag = 1;
      }

      const paymentPrepared = await client.autofill(paymentTx);
      const paymentSigned = issuerWallet.sign(paymentPrepared);
      const paymentResult = await client.submitAndWait(paymentSigned.tx_blob);

      if (paymentResult.result.meta.TransactionResult !== 'tesSUCCESS') {
        throw new Error('Token issuance failed: ' + paymentResult.result.meta.TransactionResult);
      }

      const updatedSteps2 = [...updatedSteps];
      updatedSteps2[3] = { ...updatedSteps2[3], txHash: paymentResult.result.hash };
      setProgressSteps(updatedSteps2);

      let currentStep = 4;
      let imageUrl = null;
      if (newToken.image) {
        setCurrentProgressStep(currentStep);
        try {
          imageUrl = await uploadImageToPinata(newToken.image);
        } catch (error) {
          console.error('Image upload failed:', error);
        }
        currentStep++;
      }

      setCurrentProgressStep(currentStep);
      const { data: insertedToken, error: insertError } = await supabase
        .from('meme_tokens')
        .insert([{
          token_name: newToken.name,
          currency_code: newToken.name,
          issuer_address: issuerWallet.address,
          receiver_address: receiverWallet.address,
          supply: parseFloat(newToken.supply),
          tx_hash: paymentResult.result.hash,
          status: 'issued',
          amm_pool_created: false,
          image_url: imageUrl,
          description: newToken.description || null,
          twitter_handle: newToken.twitterHandle || null,
          website_url: newToken.websiteUrl || null
        }])
        .select()
        .single();

      if (insertError) throw insertError;
      currentStep++;

      if (parseFloat(newToken.xrpLocked) > 0) {
        setCurrentProgressStep(currentStep);
        try {
          const ammAssetAmount = parseFloat(newToken.supply) * 0.9;

          const ammCreateTx = {
            TransactionType: 'AMMCreate',
            Account: receiverWallet.address,
            Amount: {
              currency: currencyCode,
              value: ammAssetAmount.toString(),
              issuer: issuerWallet.address
            },
            Amount2: xrpl.xrpToDrops(newToken.xrpLocked),
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
                amm_asset_amount: ammAssetAmount,
                amm_xrp_amount: parseFloat(newToken.xrpLocked),
                initial_asset_amount: ammAssetAmount,
                initial_xrp_amount: parseFloat(newToken.xrpLocked),
                status: 'amm_created'
              })
              .eq('id', insertedToken.id);

            const updatedSteps3 = [...updatedSteps2];
            updatedSteps3[currentStep] = { ...updatedSteps3[currentStep], txHash: ammResult.result.hash };
            setProgressSteps(updatedSteps3);
          }
        } catch (ammError) {
          console.error('AMM creation error:', ammError);
        }
        currentStep++;
      }

      await client.disconnect();
      setCurrentProgressStep(currentStep);
      setCanCloseProgress(true);

      await promoteToFeatured(insertedToken.id);

      await logActivity({
        userAddress: ISSUER_ADDRESS,
        actionType: ACTION_TYPES.TOKEN_CREATED,
        description: `Created token ${newToken.name} with supply of ${newToken.supply}`,
        details: {
          tokenName: newToken.name,
          supply: newToken.supply,
          xrpLocked: newToken.xrpLocked,
          hasAMM: parseFloat(newToken.xrpLocked) > 0
        },
        txHash: paymentResult?.result?.hash,
        tokenId: insertedToken?.id
      });

      setNewToken({ name: '', issuer: '', supply: '1000000', xrpLocked: '1', image: null, imageUrl: '', tfTransferable: false, requireDestTag: false, description: '', twitterHandle: '', websiteUrl: '' });
      setImagePreview(null);
      setAddMode('manual');
      setShowCreateModal(false);
      await loadTokens();

      setTimeout(() => {
        setShowProgressModal(false);
        setProgressSteps([]);
        setCurrentProgressStep(0);
        setCanCloseProgress(false);
      }, 3000);
    } catch (error) {
      console.error('Error creating token:', error);
      const errorStep = [...steps];
      const currentErrorStep = currentProgressStep < steps.length ? currentProgressStep : steps.length - 1;
      errorStep[currentErrorStep] = {
        ...errorStep[currentErrorStep],
        description: `Error: ${error.message || 'Unknown error occurred'}`,
        error: true
      };
      setProgressSteps(errorStep);
      setCanCloseProgress(true);
      setIsCreating(false);
    }
  };

  const handleSubmit = () => {
    if (addMode === 'manual') {
      addToken();
    } else {
      createCustomToken();
    }
  };

  const handlePasswordSubmit = () => {
    if (password !== 'divercity') {
      toast.error('Incorrect password!');
      return;
    }

    setShowPasswordModal(false);
    setPassword('');
    if (passwordAction === 'create') {
      setShowCreateModal(true);
    } else {
      setShowAddModal(true);
    }
  };

  const requestAddToken = () => {
    setPasswordAction('add');
    setShowPasswordModal(true);
  };

  const requestCreateToken = () => {
    setPasswordAction('create');
    setShowPasswordModal(true);
  };

  const calculateMarketCap = (token) => {
    const price = getLivePrice(token);
    const supply = parseFloat(token.total_supply) || parseFloat(token.supply) || 0;
    return price * supply;
  };

  const calculatePrice = (token) => {
    if (!token.amm_pool_created || !token.amm_xrp_amount || !token.amm_asset_amount) return 0;
    return token.amm_xrp_amount / token.amm_asset_amount;
  };

  const getLivePrice = (token) => {
    const poolData = poolsData[token.id];
    if (poolData && poolData.price) {
      return poolData.price;
    }
    return calculatePrice(token);
  };

  const calculate24hChange = (token) => {
    const poolData = poolsData[token.id];
    if (!poolData || !poolData.price) {
      return '0.00';
    }

    const initialXrp = parseFloat(token.initial_xrp_amount) || parseFloat(token.amm_xrp_amount);
    const initialAsset = parseFloat(token.initial_asset_amount) || parseFloat(token.amm_asset_amount);

    if (!initialXrp || !initialAsset || initialAsset === 0) {
      return '0.00';
    }

    const currentPrice = poolData.price;
    const startingPrice = initialXrp / initialAsset;

    if (!startingPrice || startingPrice === 0) {
      return '0.00';
    }

    const change = ((currentPrice - startingPrice) / startingPrice) * 100;
    return change.toFixed(2);
  };

  const calculateVolume = (token) => {
    const poolData = poolsData[token.id];
    if (poolData) {
      return (poolData.xrpAmount * 0.15).toFixed(2);
    }
    return token.amm_pool_created ? ((token.amm_xrp_amount || 0) * 0.15).toFixed(2) : '0';
  };

  const calculatePercentChange = (current, previous) => {
    if (!current || !previous || previous === 0) return '0.00';
    const change = ((current - previous) / previous) * 100;
    return change.toFixed(2);
  };

  const calculateVolumeChange = (token) => {
    const currentVolume = parseFloat(calculateVolume(token));
    return calculatePercentChange(currentVolume, volumeHistory[token.id]);
  };

  const calculatePriceChange = (token) => {
    const currentPrice = parseFloat(calculatePrice(token));
    return calculatePercentChange(currentPrice, priceHistory[token.id]);
  };

  const calculateLpChange = (token) => {
    const currentLp = parseFloat(lpBalances[token.id]) || 0;
    return calculatePercentChange(currentLp, lpHistory[token.id]);
  };

  const calculateMarketCapChange = (token) => {
    const currentMarketCap = parseFloat(calculateMarketCap(token));
    return calculatePercentChange(currentMarketCap, marketCapHistory[token.id]);
  };

  const calculateLiquidityChange = (token) => {
    const currentLiquidity = token.amm_xrp_amount || 0;
    return calculatePercentChange(currentLiquidity, liquidityHistory[token.id]);
  };

  const handleColumnSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
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
      `MORE #MEME COINS @ MEMEKINGS.ONLINE\n\n` +
      `#XRPL #Crypto #XRP`;

    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    window.open(tweetUrl, '_blank', 'width=550,height=420');
  };

  const filteredAndSortedTokens = tokens
    .filter(token => {
      const matchesSearch = token.token_name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filter === 'all' ||
        (filter === 'active' && token.amm_pool_created) ||
        (filter === 'pending' && !token.amm_pool_created) ||
        (filter === 'favorites' && favorites.includes(token.id));
      const matchesCategory = filterCategory === 'all' || token.category === filterCategory;
      return matchesSearch && matchesFilter && matchesCategory;
    })
    .sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'newest':
          comparison = new Date(b.created_at) - new Date(a.created_at);
          break;
        case 'oldest':
          comparison = new Date(a.created_at) - new Date(b.created_at);
          break;
        case 'name':
          comparison = a.token_name.localeCompare(b.token_name);
          break;
        case 'name-asc':
          comparison = a.token_name.localeCompare(b.token_name);
          break;
        case 'name-desc':
          comparison = b.token_name.localeCompare(a.token_name);
          break;
        case 'category':
          comparison = (a.category || '').localeCompare(b.category || '');
          break;
        case 'days':
          comparison = calculateDaysOnMarket(b.created_at) - calculateDaysOnMarket(a.created_at);
          break;
        case 'supply-high':
          comparison = b.supply - a.supply;
          break;
        case 'supply-low':
          comparison = a.supply - b.supply;
          break;
        case 'price':
          comparison = calculatePrice(b) - calculatePrice(a);
          break;
        case 'price-high':
          comparison = calculatePrice(b) - calculatePrice(a);
          break;
        case 'price-low':
          comparison = calculatePrice(a) - calculatePrice(b);
          break;
        case 'volume':
          comparison = parseFloat(calculateVolume(b)) - parseFloat(calculateVolume(a));
          break;
        case 'lp':
          comparison = (lpBalances[b.id]?.balance || 0) - (lpBalances[a.id]?.balance || 0);
          break;
        case 'marketcap':
          comparison = calculateMarketCap(b) - calculateMarketCap(a);
          break;
        case 'liquidity':
          comparison = (poolsData[b.id]?.xrpAmount || b.amm_xrp_amount || 0) - (poolsData[a.id]?.xrpAmount || a.amm_xrp_amount || 0);
          break;
        case 'status':
          comparison = (b.amm_pool_created ? 1 : 0) - (a.amm_pool_created ? 1 : 0);
          break;
        default:
          comparison = 0;
      }

      return sortOrder === 'asc' ? -comparison : comparison;
    });

  const TokenCard = ({ token }) => {
    const isFavorited = favorites.includes(token.id);

    return (
      <div
        className="glass rounded-lg p-6 space-y-4 hover:scale-105 transition-transform cursor-pointer relative"
        onClick={() => {
          setSelectedToken(token);
          setShowTokenModal(true);
        }}
      >
        <button
          onClick={(e) => toggleFavorite(token.id, e)}
          className="absolute top-4 right-4 text-2xl hover:scale-110 transition-transform z-10"
          title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
        >
          {isFavorited ? '⭐' : '☆'}
        </button>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TokenIcon token={token} size="3xl" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-2xl font-bold text-purple-200">{token.token_name}</h3>
                <button
                  onClick={(e) => toggleFavorite(token.id, e)}
                  className="text-xl hover:scale-110 transition-transform"
                >
                  {favorites.includes(token.id) ? '⭐' : '☆'}
                </button>
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <p className="text-purple-400 text-sm">Meme Token</p>
                {token.category && <CategoryBadge category={token.category} size="xs" />}
                <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 text-xs rounded-full font-medium">
                  📅 {calculateDaysOnMarket(token.created_at)}d
                </span>
              </div>
            </div>
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${
            token.amm_pool_created
              ? 'bg-green-500/20 text-green-400'
              : 'bg-yellow-500/20 text-yellow-400'
          }`}>
            {token.amm_pool_created ? '🟢 Live' : '🟡 Pending'}
          </div>
        </div>

      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-purple-400 text-xs">Total Supply</span>
          <span className="text-purple-200 text-sm font-bold">{token.supply.toLocaleString()}</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-purple-400 text-xs">Currency Code</span>
          <span className="text-purple-200 font-mono text-xs">{token.currency_code}</span>
        </div>

        {token.amm_pool_created && (
          <>
            <div className="flex justify-between items-center">
              <span className="text-purple-400 text-xs">Live Price</span>
              <div className="text-right">
                <div className="flex items-center gap-2 justify-end">
                  <span className="text-green-400 text-sm font-bold">{getLivePrice(token).toFixed(8)} XRP</span>
                  {priceHistory[token.id] && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                      parseFloat(calculatePriceChange(token)) >= 0
                        ? 'text-green-300 bg-green-500/10'
                        : 'text-red-300 bg-red-500/10'
                    }`}>
                      {parseFloat(calculatePriceChange(token)) >= 0 ? '+' : ''}{calculatePriceChange(token)}%
                    </span>
                  )}
                </div>
                <div className="text-green-400 text-xs">
                  ${(getLivePrice(token) * xrpUsdPrice).toFixed(6)}
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-purple-400 text-xs">Market Cap (Live)</span>
              <div className="text-right">
                <div className="flex items-center gap-2 justify-end">
                  <span className="text-purple-200 text-sm font-bold">{calculateMarketCap(token).toFixed(2)} XRP</span>
                  {marketCapHistory[token.id] && (
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                      parseFloat(calculateMarketCapChange(token)) >= 0
                        ? 'text-green-300 bg-green-500/10'
                        : 'text-red-300 bg-red-500/10'
                    }`}>
                      {parseFloat(calculateMarketCapChange(token)) >= 0 ? '+' : ''}{calculateMarketCapChange(token)}%
                    </span>
                  )}
                </div>
                <div className="text-green-400 text-xs">
                  ${(calculateMarketCap(token) * xrpUsdPrice).toFixed(2)}
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-purple-400 text-xs">Liquidity (XRP)</span>
              <div className="text-right">
                <div className="flex items-center gap-2 justify-end">
                  <span className="text-purple-200 text-sm font-bold">
                    {poolsData[token.id]?.xrpAmount ? poolsData[token.id].xrpAmount.toFixed(2) : (token.amm_xrp_amount || 0).toFixed(2)} XRP
                  </span>
                  {liquidityHistory[token.id] && (
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                      parseFloat(calculateLiquidityChange(token)) >= 0
                        ? 'text-green-300 bg-green-500/10'
                        : 'text-red-300 bg-red-500/10'
                    }`}>
                      {parseFloat(calculateLiquidityChange(token)) >= 0 ? '+' : ''}{calculateLiquidityChange(token)}%
                    </span>
                  )}
                </div>
                <div className="text-green-400 text-xs">
                  ${((poolsData[token.id]?.xrpAmount || token.amm_xrp_amount || 0) * xrpUsdPrice).toFixed(2)}
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-purple-400 text-xs">Volume 24h</span>
              <div className="text-right">
                <div className="flex items-center gap-2 justify-end">
                  <span className="text-purple-200 text-sm font-bold">
                    {token.amm_pool_created ? `${calculateVolume(token)} XRP` : '-'}
                  </span>
                  {token.amm_pool_created && volumeHistory[token.id] && (
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                      parseFloat(calculateVolumeChange(token)) >= 0
                        ? 'text-green-300 bg-green-500/10'
                        : 'text-red-300 bg-red-500/10'
                    }`}>
                      {parseFloat(calculateVolumeChange(token)) >= 0 ? '+' : ''}{calculateVolumeChange(token)}%
                    </span>
                  )}
                </div>
                {token.amm_pool_created && (
                  <div className="text-green-400 text-xs">
                    ${(parseFloat(calculateVolume(token)) * xrpUsdPrice).toFixed(2)}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-purple-500/20">
              <span className="text-purple-400 text-xs">Your LP</span>
              {lpBalances[token.id] ? (
                <div className="text-right">
                  <div className="flex items-center gap-2 justify-end">
                    <div>
                      <div className="text-green-400 text-sm font-bold">{lpBalances[token.id].balance.toFixed(4)}</div>
                      <div className="text-green-500 text-xs">{lpBalances[token.id].share.toFixed(2)}%</div>
                    </div>
                    {lpHistory[token.id] && lpHistory[token.id] > 0 && (
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                        parseFloat(calculateLpChange(token)) >= 0
                          ? 'text-green-300 bg-green-500/10'
                          : 'text-red-300 bg-red-500/10'
                      }`}>
                        {parseFloat(calculateLpChange(token)) >= 0 ? '+' : ''}{calculateLpChange(token)}%
                      </span>
                    )}
                  </div>
                  <div className="text-green-400 text-xs">
                    ${(lpBalances[token.id].balance * getLivePrice(token) * 2 * xrpUsdPrice).toFixed(2)}
                  </div>
                </div>
              ) : (
                <span className="text-purple-500 text-sm font-bold">-</span>
              )}
            </div>
          </>
        )}

        <div className="pt-2 border-t border-purple-500/20">
          <div className="text-purple-400 text-xs mb-1">Issuer Address</div>
          <div className="text-purple-300 text-xs font-mono bg-black/30 p-2 rounded break-all">
            {token.issuer_address}
          </div>
        </div>

        <div className="flex justify-between items-center pt-2 border-t border-purple-500/20">
          <span className="text-purple-500 text-xs">Created</span>
          <span className="text-purple-400 text-xs">
            {new Date(token.created_at).toLocaleString()}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <a
          href={`https://xmagnetic.org/dex/${token.currency_code}+${token.issuer_address}_XRP+XRP?network=mainnet`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary text-white text-xs px-2 py-2 rounded-lg text-center"
          onClick={(e) => { e.stopPropagation(); }}
          title="Trade on xMagnetic DEX"
        >
          💱 Trade
        </a>
        <button
          className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-bold text-xs px-2 py-2 rounded-lg shadow-lg shadow-purple-500/50 hover:shadow-purple-500/70"
          onClick={(e) => { e.stopPropagation(); tweetToken(token); }}
          title="Post on X"
        >
          𝕏 Post
        </button>
        <a
          href={`https://xmagnetic.org/amm/${token.currency_code}+${token.issuer_address}_XRP+XRP?network=mainnet`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn text-purple-300 text-xs px-2 py-2 rounded-lg text-center"
          onClick={(e) => { e.stopPropagation(); }}
          title="AMM Pool"
        >
          🔗 AMM Pool
        </a>
        <a
          href={`https://xrpl.services/?issuer=${token.issuer_address}&currency=${token.currency_code.length > 3 ? Buffer.from(token.currency_code, 'utf8').toString('hex').toUpperCase().padEnd(40, '0') : token.currency_code}&limit=${token.supply}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn text-purple-300 text-xs px-2 py-2 rounded-lg text-center"
          onClick={(e) => { e.stopPropagation(); }}
          title="Set up Trustline"
        >
          ✅ Trustline
        </a>
      </div>
    </div>
    );
  };

  const TokenRow = ({ token }) => (
    <tr
      className="border-t border-purple-500/20 hover:bg-purple-900/20 cursor-pointer"
      onClick={() => {
        setSelectedToken(token);
        setShowTokenModal(true);
      }}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <TokenIcon token={token} size="3xl" />
          <div className="flex items-center gap-2">
            <div>
              <div className="font-bold text-purple-200">{token.token_name}</div>
              <div className="text-purple-400 text-xs">{token.currency_code}</div>
            </div>
            <button
              onClick={(e) => toggleFavorite(token.id, e)}
              className="text-lg hover:scale-110 transition-transform"
            >
              {favorites.includes(token.id) ? '⭐' : '☆'}
            </button>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        {token.category ? <CategoryBadge category={token.category} size="xs" /> : <span className="text-purple-400 text-xs">-</span>}
      </td>
      <td className="px-4 py-3">
        <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 text-xs rounded-full font-medium inline-block">
          📅 {calculateDaysOnMarket(token.created_at)}d
        </span>
      </td>
      <td className="px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <div>
              <div className="text-purple-200 font-bold">{getLivePrice(token).toFixed(8)}</div>
              <div className="text-purple-400 text-xs">XRP</div>
            </div>
            {token.amm_pool_created && priceHistory[token.id] && (
              <span className={`text-xs font-medium px-1.5 py-0.5 rounded whitespace-nowrap ${
                parseFloat(calculatePriceChange(token)) >= 0
                  ? 'text-green-300 bg-green-500/10'
                  : 'text-red-300 bg-red-500/10'
              }`}>
                {parseFloat(calculatePriceChange(token)) >= 0 ? '+' : ''}{calculatePriceChange(token)}%
              </span>
            )}
          </div>
          <div className="text-green-400 text-xs">
            ${(getLivePrice(token) * xrpUsdPrice).toFixed(6)}
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-purple-300">
              {token.amm_pool_created ? `${calculateVolume(token)} XRP` : '-'}
            </span>
            {token.amm_pool_created && volumeHistory[token.id] && (
              <span className={`text-xs font-medium px-1.5 py-0.5 rounded whitespace-nowrap ${
                parseFloat(calculateVolumeChange(token)) >= 0
                  ? 'text-green-300 bg-green-500/10'
                  : 'text-red-300 bg-red-500/10'
              }`}>
                {parseFloat(calculateVolumeChange(token)) >= 0 ? '+' : ''}{calculateVolumeChange(token)}%
              </span>
            )}
          </div>
          {token.amm_pool_created && (
            <div className="text-green-400 text-xs">
              ${(parseFloat(calculateVolume(token)) * xrpUsdPrice).toFixed(2)}
            </div>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        {lpBalances[token.id] ? (
          <div>
            <div className="flex items-center gap-2">
              <div>
                <div className="text-green-200 font-medium">{lpBalances[token.id].balance.toFixed(4)}</div>
                <div className="text-green-400 text-xs">{lpBalances[token.id].share.toFixed(2)}%</div>
              </div>
              {lpHistory[token.id] && lpHistory[token.id] > 0 && (
                <span className={`text-xs font-medium px-1.5 py-0.5 rounded whitespace-nowrap ${
                  parseFloat(calculateLpChange(token)) >= 0
                    ? 'text-green-300 bg-green-500/10'
                    : 'text-red-300 bg-red-500/10'
                }`}>
                  {parseFloat(calculateLpChange(token)) >= 0 ? '+' : ''}{calculateLpChange(token)}%
                </span>
              )}
            </div>
            <div className="text-green-400 text-xs">
              ${(lpBalances[token.id].balance * getLivePrice(token) * 2 * xrpUsdPrice).toFixed(2)}
            </div>
          </div>
        ) : (
          <span className="text-purple-500">-</span>
        )}
      </td>
      <td className="px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-purple-200">{calculateMarketCap(token).toFixed(2)} XRP</span>
            {marketCapHistory[token.id] && (
              <span className={`text-xs font-medium px-1.5 py-0.5 rounded whitespace-nowrap ${
                parseFloat(calculateMarketCapChange(token)) >= 0
                  ? 'text-green-300 bg-green-500/10'
                  : 'text-red-300 bg-red-500/10'
              }`}>
                {parseFloat(calculateMarketCapChange(token)) >= 0 ? '+' : ''}{calculateMarketCapChange(token)}%
              </span>
            )}
          </div>
          <div className="text-green-400 text-xs">
            ${(calculateMarketCap(token) * xrpUsdPrice).toFixed(2)}
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-purple-200 font-bold">
              {poolsData[token.id]?.xrpAmount ? `${poolsData[token.id].xrpAmount.toFixed(2)} XRP` : `${(token.amm_xrp_amount || 0).toFixed(2)} XRP`}
            </span>
            {liquidityHistory[token.id] && (
              <span className={`text-xs font-medium px-1.5 py-0.5 rounded whitespace-nowrap ${
                parseFloat(calculateLiquidityChange(token)) >= 0
                  ? 'text-green-300 bg-green-500/10'
                  : 'text-red-300 bg-red-500/10'
              }`}>
                {parseFloat(calculateLiquidityChange(token)) >= 0 ? '+' : ''}{calculateLiquidityChange(token)}%
              </span>
            )}
          </div>
          <div className="text-green-400 text-xs">
            ${((poolsData[token.id]?.xrpAmount || token.amm_xrp_amount || 0) * xrpUsdPrice).toFixed(2)}
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
          token.amm_pool_created
            ? 'bg-green-500/20 text-green-400'
            : 'bg-yellow-500/20 text-yellow-400'
        }`}>
          {token.amm_pool_created ? '🟢' : '🟡'}
        </span>
      </td>
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex gap-1">
          <a
            href={`https://xmagnetic.org/dex/${token.currency_code}+${token.issuer_address}_XRP+XRP?network=mainnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary text-white text-xs px-2 py-1 rounded"
            title="Trade"
          >
            💱
          </a>
          <button
            className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-bold text-xs px-2 py-1 rounded shadow-md shadow-purple-500/50 hover:shadow-purple-500/70"
            onClick={(e) => { e.stopPropagation(); tweetToken(token); }}
            title="Post on X"
          >
            𝕏
          </button>
          <a
            href={`https://xmagnetic.org/amm/${token.currency_code}+${token.issuer_address}_XRP+XRP?network=mainnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn text-purple-300 text-xs px-2 py-1 rounded"
            title="AMM"
          >
            🔗
          </a>
          <a
            href={`https://xrpl.services/?issuer=${token.issuer_address}&currency=${token.currency_code.length > 3 ? Buffer.from(token.currency_code, 'utf8').toString('hex').toUpperCase().padEnd(40, '0') : token.currency_code}&limit=${token.supply}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn text-purple-300 text-xs px-2 py-1 rounded"
            title="Trustline"
            onClick={(e) => e.stopPropagation()}
          >
            ✅
          </a>
        </div>
      </td>
    </tr>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-purple-200">Memes</h2>
          <p className="text-purple-400 mt-1">All minted tokens from the factory</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={requestAddToken}
            className="btn text-purple-300 px-6 py-3 rounded-lg font-medium"
          >
            + Add Token
          </button>
          <button
            onClick={requestCreateToken}
            className="btn-primary text-white px-6 py-3 rounded-lg font-medium"
          >
            🚀 Create Token
          </button>
        </div>
      </div>

      <div className="glass rounded-lg p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="🔍 Search tokens..."
              className="input flex-1 text-purple-200"
            />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="input text-purple-200 w-full md:w-auto"
            >
              <option value="all">All Categories</option>
              <option value="Meme">😂 Meme</option>
              <option value="Gaming">🎮 Gaming</option>
              <option value="DeFi">💰 DeFi</option>
              <option value="Utility">🔧 Utility</option>
              <option value="Community">👥 Community</option>
              <option value="NFT">🎨 NFT</option>
              <option value="AI">🤖 AI</option>
              <option value="Other">📦 Other</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="input text-purple-200 w-full md:w-auto"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="marketcap">Market Cap</option>
              <option value="supply-high">Supply (High-Low)</option>
              <option value="supply-low">Supply (Low-High)</option>
              <option value="price-high">Price (High-Low)</option>
              <option value="price-low">Price (Low-High)</option>
            </select>
          </div>

          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg transition-all ${
                  filter === 'all' ? 'bg-purple-600 text-white' : 'glass text-purple-300'
                }`}
              >
                All ({tokens.length})
              </button>
              <button
                onClick={() => setFilter('active')}
                className={`px-4 py-2 rounded-lg transition-all ${
                  filter === 'active' ? 'bg-purple-600 text-white' : 'glass text-purple-300'
                }`}
              >
                🟢 Active ({tokens.filter(t => t.amm_pool_created).length})
              </button>
              <button
                onClick={() => setFilter('pending')}
                className={`px-4 py-2 rounded-lg transition-all ${
                  filter === 'pending' ? 'bg-purple-600 text-white' : 'glass text-purple-300'
                }`}
              >
                🟡 Pending ({tokens.filter(t => !t.amm_pool_created).length})
              </button>
              <button
                onClick={() => setFilter('favorites')}
                className={`px-4 py-2 rounded-lg transition-all ${
                  filter === 'favorites' ? 'bg-purple-600 text-white' : 'glass text-purple-300'
                }`}
                disabled={!connectedWallet}
                title={!connectedWallet ? 'Connect wallet to view favorites' : ''}
              >
                ⭐ Favorites ({favorites.length})
              </button>
              <button
                disabled
                className="px-4 py-2 rounded-lg transition-all font-medium text-purple-500/50 cursor-not-allowed relative group"
              >
                👤 User
                <span className="ml-2 text-xs bg-purple-900/50 px-2 py-0.5 rounded">Coming Soon</span>
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-4 py-2 rounded-lg transition-all ${
                  viewMode === 'grid' ? 'bg-purple-600 text-white' : 'glass text-purple-300'
                }`}
              >
                ▦ Grid
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-4 py-2 rounded-lg transition-all ${
                  viewMode === 'list' ? 'bg-purple-600 text-white' : 'glass text-purple-300'
                }`}
              >
                ☰ List
              </button>
            </div>
          </div>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAndSortedTokens.map((token) => (
            <TokenCard key={token.id} token={token} />
          ))}
        </div>
      ) : (
        <div className="glass rounded-lg p-4">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-purple-900/30">
                <tr>
                  <th
                    className="text-left px-4 py-3 text-purple-300 font-medium cursor-pointer hover:text-purple-200 select-none"
                    onDoubleClick={() => handleColumnSort('name')}
                    title="Double-click to sort"
                  >
                    Token {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    className="text-left px-4 py-3 text-purple-300 font-medium cursor-pointer hover:text-purple-200 select-none"
                    onDoubleClick={() => handleColumnSort('category')}
                    title="Double-click to sort"
                  >
                    Category {sortBy === 'category' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    className="text-left px-4 py-3 text-purple-300 font-medium cursor-pointer hover:text-purple-200 select-none"
                    onDoubleClick={() => handleColumnSort('days')}
                    title="Double-click to sort"
                  >
                    Days {sortBy === 'days' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    className="text-left px-4 py-3 text-purple-300 font-medium cursor-pointer hover:text-purple-200 select-none"
                    onDoubleClick={() => handleColumnSort('price')}
                    title="Double-click to sort"
                  >
                    Live Price {sortBy === 'price' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    className="text-left px-4 py-3 text-purple-300 font-medium cursor-pointer hover:text-purple-200 select-none"
                    onDoubleClick={() => handleColumnSort('volume')}
                    title="Double-click to sort"
                  >
                    Volume 24h {sortBy === 'volume' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    className="text-left px-4 py-3 text-purple-300 font-medium cursor-pointer hover:text-purple-200 select-none"
                    onDoubleClick={() => handleColumnSort('lp')}
                    title="Double-click to sort"
                  >
                    Your LP {sortBy === 'lp' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    className="text-left px-4 py-3 text-purple-300 font-medium cursor-pointer hover:text-purple-200 select-none"
                    onDoubleClick={() => handleColumnSort('marketcap')}
                    title="Double-click to sort"
                  >
                    Market Cap {sortBy === 'marketcap' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    className="text-left px-4 py-3 text-purple-300 font-medium cursor-pointer hover:text-purple-200 select-none"
                    onDoubleClick={() => handleColumnSort('liquidity')}
                    title="Double-click to sort"
                  >
                    Liquidity (XRP) {sortBy === 'liquidity' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    className="text-left px-4 py-3 text-purple-300 font-medium cursor-pointer hover:text-purple-200 select-none"
                    onDoubleClick={() => handleColumnSort('status')}
                    title="Double-click to sort"
                  >
                    Status {sortBy === 'status' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="text-left px-4 py-3 text-purple-300 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedTokens.map((token) => (
                  <TokenRow key={token.id} token={token} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {filteredAndSortedTokens.length === 0 && (
        <div className="glass rounded-lg p-12 text-center">
          <div className="text-6xl mb-4">🚀</div>
          <h3 className="text-xl font-bold text-purple-200 mb-2">No Tokens Found</h3>
          <p className="text-purple-400">
            {searchTerm ? 'Try a different search term' : 'Create your first token from the dashboard'}
          </p>
        </div>
      )}

      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="glass rounded-lg p-8 max-w-md w-full">
            <h3 className="text-2xl font-bold text-purple-200 mb-4">Admin Access Required</h3>
            <p className="text-purple-300 mb-6">
              Enter password to {passwordAction === 'create' ? 'create tokens' : 'add tokens'}
            </p>

            <div className="mb-6">
              <label className="block text-purple-300 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                className="input w-full text-purple-200"
                placeholder="Enter password"
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handlePasswordSubmit}
                className="btn-primary text-white px-6 py-2 rounded-lg font-medium flex-1"
              >
                Confirm
              </button>
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setPassword('');
                }}
                className="btn text-purple-300 px-6 py-2 rounded-lg font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="glass rounded-lg p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold text-purple-200 mb-6">Add Token</h3>

            <div className="space-y-4">
              <input
                type="text"
                placeholder="Token Name"
                value={newToken.name}
                onChange={(e) => setNewToken({ ...newToken, name: e.target.value })}
                className="w-full px-4 py-2 bg-purple-900/20 border border-purple-500/30 rounded-lg text-purple-200 placeholder-purple-400"
              />
              <input
                type="text"
                placeholder="Issuer Address"
                value={newToken.issuer}
                onChange={(e) => setNewToken({ ...newToken, issuer: e.target.value })}
                className="w-full px-4 py-2 bg-purple-900/20 border border-purple-500/30 rounded-lg text-purple-200 placeholder-purple-400"
              />
              <input
                type="number"
                placeholder="Supply"
                value={newToken.supply}
                onChange={(e) => setNewToken({ ...newToken, supply: e.target.value })}
                className="w-full px-4 py-2 bg-purple-900/20 border border-purple-500/30 rounded-lg text-purple-200 placeholder-purple-400"
              />
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={addToken}
                disabled={isCreating || uploadingImage}
                className="btn-primary text-white px-6 py-2 rounded-lg font-medium flex-1 disabled:opacity-50"
              >
                {isCreating ? '🔄 Adding...' : '+ Add Token'}
              </button>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewToken({ name: '', issuer: '', supply: '1000000', xrpLocked: '1', image: null, imageUrl: '', tfTransferable: false, requireDestTag: false, description: '', twitterHandle: '', websiteUrl: '' });
                  setImagePreview(null);
                  setAddMode('manual');
                }}
                disabled={isCreating}
                className="btn text-purple-300 px-6 py-2 rounded-lg font-medium disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="glass rounded-lg p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold text-purple-200 mb-6">Create Token</h3>

            <div className="space-y-4">
              <input
                type="text"
                placeholder="Token Name"
                value={newToken.name}
                onChange={(e) => setNewToken({ ...newToken, name: e.target.value })}
                className="w-full px-4 py-2 bg-purple-900/20 border border-purple-500/30 rounded-lg text-purple-200 placeholder-purple-400"
              />
              <input
                type="number"
                placeholder="Supply (default: 1,000,000)"
                value={newToken.supply}
                onChange={(e) => setNewToken({ ...newToken, supply: e.target.value })}
                className="w-full px-4 py-2 bg-purple-900/20 border border-purple-500/30 rounded-lg text-purple-200 placeholder-purple-400"
              />
              <input
                type="number"
                placeholder="XRP to Lock in Pool (default: 1)"
                value={newToken.xrpLocked}
                onChange={(e) => setNewToken({ ...newToken, xrpLocked: e.target.value })}
                className="w-full px-4 py-2 bg-purple-900/20 border border-purple-500/30 rounded-lg text-purple-200 placeholder-purple-400"
              />
              <textarea
                placeholder="Description (optional)"
                value={newToken.description}
                onChange={(e) => setNewToken({ ...newToken, description: e.target.value })}
                className="w-full px-4 py-2 bg-purple-900/20 border border-purple-500/30 rounded-lg text-purple-200 placeholder-purple-400 min-h-[80px]"
              />
              <input
                type="text"
                placeholder="Twitter Handle (optional, e.g., @mytoken)"
                value={newToken.twitterHandle}
                onChange={(e) => setNewToken({ ...newToken, twitterHandle: e.target.value })}
                className="w-full px-4 py-2 bg-purple-900/20 border border-purple-500/30 rounded-lg text-purple-200 placeholder-purple-400"
              />
              <input
                type="url"
                placeholder="Website URL (optional)"
                value={newToken.websiteUrl}
                onChange={(e) => setNewToken({ ...newToken, websiteUrl: e.target.value })}
                className="w-full px-4 py-2 bg-purple-900/20 border border-purple-500/30 rounded-lg text-purple-200 placeholder-purple-400"
              />
              <div>
                <label className="block text-purple-300 mb-2 text-sm">Token Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="w-full px-4 py-2 bg-purple-900/20 border border-purple-500/30 rounded-lg text-purple-200 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700"
                />
                {imagePreview && (
                  <div className="mt-3">
                    <img src={imagePreview} alt="Preview" className="w-24 h-24 rounded-lg object-cover" />
                  </div>
                )}
              </div>

              <div className="glass rounded-lg p-4">
                <h4 className="text-purple-200 font-medium mb-3">Token Settings</h4>
                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newToken.tfTransferable}
                      onChange={(e) => setNewToken({ ...newToken, tfTransferable: e.target.checked })}
                      className="w-4 h-4 rounded border-purple-500/30"
                    />
                    <span className="text-purple-300 text-sm">Transferable</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newToken.requireDestTag}
                      onChange={(e) => setNewToken({ ...newToken, requireDestTag: e.target.checked })}
                      className="w-4 h-4 rounded border-purple-500/30"
                    />
                    <span className="text-purple-300 text-sm">Require Destination Tag</span>
                  </label>
                </div>
              </div>

              <div className="glass rounded-lg p-4">
                <h4 className="text-purple-200 font-medium mb-3">Wallet Configuration</h4>
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => setWalletConfigMode('admin')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      walletConfigMode === 'admin'
                        ? 'bg-purple-600 text-white'
                        : 'bg-purple-900/20 text-purple-300 hover:bg-purple-900/40'
                    }`}
                  >
                    Admin Token
                  </button>
                  <button
                    onClick={() => setWalletConfigMode('custom')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      walletConfigMode === 'custom'
                        ? 'bg-purple-600 text-white'
                        : 'bg-purple-900/20 text-purple-300 hover:bg-purple-900/40'
                    }`}
                  >
                    Custom Wallet
                  </button>
                </div>

                {walletConfigMode === 'admin' ? (
                  <div className="space-y-2 text-sm text-purple-300">
                    <p><span className="font-medium">Issuer:</span> {ISSUER_ADDRESS}</p>
                    <p><span className="font-medium">Receiver:</span> {RECEIVER_ADDRESS}</p>
                    <p className="text-xs text-purple-400 mt-2">Using MEMEKINGS managed wallets for token creation</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-purple-300 mb-2 text-sm">Issuer Wallet</label>
                      <select
                        value={selectedIssuerWallet?.id || ''}
                        onChange={(e) => {
                          if (e.target.value === 'connected') {
                            setSelectedIssuerWallet({ id: 'connected', address: connectedWallet.address, encrypted_seed: connectedWallet.seed });
                          } else {
                            const wallet = userWallets.find(w => w.id === e.target.value);
                            setSelectedIssuerWallet(wallet || null);
                          }
                        }}
                        className="w-full px-3 py-2 bg-purple-900/20 border border-purple-500/30 rounded-lg text-purple-200 text-sm"
                      >
                        <option value="">Select issuer wallet...</option>
                        {connectedWallet && (
                          <option value="connected">{connectedWallet.address} (Connected)</option>
                        )}
                        {userWallets.map((wallet) => (
                          <option key={wallet.id} value={wallet.id}>
                            {wallet.name} - {wallet.address.substring(0, 10)}...
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-purple-300 mb-2 text-sm">Receiver Wallet</label>
                      <select
                        value={selectedReceiverWallet?.id || ''}
                        onChange={(e) => {
                          if (e.target.value === 'connected') {
                            setSelectedReceiverWallet({ id: 'connected', address: connectedWallet.address, encrypted_seed: connectedWallet.seed });
                          } else if (e.target.value === 'default') {
                            setSelectedReceiverWallet({ id: 'default', address: RECEIVER_ADDRESS, encrypted_seed: 'sEd7W72aANTbLTG98XDhU1yfotPJdhu' });
                          } else {
                            const wallet = userWallets.find(w => w.id === e.target.value);
                            setSelectedReceiverWallet(wallet || null);
                          }
                        }}
                        className="w-full px-3 py-2 bg-purple-900/20 border border-purple-500/30 rounded-lg text-purple-200 text-sm"
                      >
                        <option value="">Select receiver wallet...</option>
                        {connectedWallet && (
                          <option value="connected">{connectedWallet.address} (Connected)</option>
                        )}
                        <option value="default">{RECEIVER_ADDRESS} (Platform Default)</option>
                        {userWallets.map((wallet) => (
                          <option key={wallet.id} value={wallet.id}>
                            {wallet.name} - {wallet.address.substring(0, 10)}...
                          </option>
                        ))}
                      </select>
                    </div>
                    <p className="text-xs text-purple-400">Token will be issued from your selected wallets</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={createCustomToken}
                disabled={isCreating || uploadingImage || (walletConfigMode === 'custom' && (!selectedIssuerWallet || !selectedReceiverWallet))}
                className="btn-primary text-white px-6 py-2 rounded-lg font-medium flex-1 disabled:opacity-50"
              >
                {uploadingImage ? (
                  <span>⬆️ Uploading Image...</span>
                ) : isCreating ? (
                  <span>🔄 Creating...</span>
                ) : (
                  <span>🚀 Create Token (5 XRP)</span>
                )}
              </button>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewToken({
                    name: '',
                    issuer: '',
                    supply: '1000000',
                    xrpLocked: '1',
                    image: null,
                    imageUrl: '',
                    tfTransferable: false,
                    requireDestTag: false,
                    description: '',
                    twitterHandle: '',
                    websiteUrl: ''
                  });
                  setImagePreview(null);
                }}
                disabled={isCreating || uploadingImage}
                className="btn text-purple-300 px-6 py-2 rounded-lg font-medium disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showTokenModal && selectedToken && (
        <TokenDetailModal
          token={selectedToken}
          onClose={() => {
            setShowTokenModal(false);
            setSelectedToken(null);
          }}
        />
      )}

      <TokenCreationProgressModal
        isOpen={showProgressModal}
        steps={progressSteps}
        currentStep={currentProgressStep}
        canClose={canCloseProgress}
        onClose={() => {
          setShowProgressModal(false);
          setProgressSteps([]);
          setCurrentProgressStep(0);
        }}
      />
    </div>
  );
}
