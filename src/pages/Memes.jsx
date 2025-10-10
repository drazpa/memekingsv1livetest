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
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('list');
  const [sortBy, setSortBy] = useState('newest');
  const [favorites, setFavorites] = useState([]);
  const [connectedWallet, setConnectedWallet] = useState(null);
  const [poolsData, setPoolsData] = useState({});
  const [lpBalances, setLpBalances] = useState({});
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordAction, setPasswordAction] = useState('add');
  const [password, setPassword] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [addMode, setAddMode] = useState('manual');
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
    loadTokens();
    loadConnectedWallet();
    loadUserWallets();

    const unsubscribe = onTokenUpdate(() => {
      loadTokens();
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (tokens.length > 0) {
      fetchAllPoolsData();
    }
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

  const fetchAllPoolsData = async () => {
    try {
      const client = new xrpl.Client('wss://xrplcluster.com');
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
      setNewToken({ name: '', issuer: '', supply: '1000000', xrpLocked: '1', image: null, tfTransferable: false, requireDestTag: false, description: '', twitterHandle: '', websiteUrl: '' });
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
      { title: 'Issuing Coins', description: 'Minting tokens to receiver wallet' }
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

      setNewToken({ name: '', issuer: '', supply: '1000000', xrpLocked: '1', image: null, tfTransferable: false, requireDestTag: false, description: '', twitterHandle: '', websiteUrl: '' });
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
      { title: 'Issuing Coins', description: 'Minting tokens to receiver wallet' }
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

      const issuerWallet = xrpl.Wallet.fromSeed(ISSUER_SEED);
      const receiverWallet = xrpl.Wallet.fromSeed(RECEIVER_SEED);

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

      setNewToken({ name: '', issuer: '', supply: '1000000', xrpLocked: '1', image: null, tfTransferable: false, requireDestTag: false });
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
      `#XRPL #Crypto`;

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
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.created_at) - new Date(a.created_at);
        case 'oldest':
          return new Date(a.created_at) - new Date(b.created_at);
        case 'name-asc':
          return a.token_name.localeCompare(b.token_name);
        case 'name-desc':
          return b.token_name.localeCompare(a.token_name);
        case 'supply-high':
          return b.supply - a.supply;
        case 'supply-low':
          return a.supply - b.supply;
        case 'price-high':
          return calculatePrice(b) - calculatePrice(a);
        case 'price-low':
          return calculatePrice(a) - calculatePrice(b);
        default:
          return 0;
      }
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
            <TokenIcon token={token} size="lg" />
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
                <p className="text-purple-400 text-sm">Meme Coin</p>
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
              <div className="flex items-center gap-2">
                <span className="text-green-400 text-sm font-bold">{getLivePrice(token).toFixed(8)} XRP</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                  parseFloat(calculate24hChange(token)) >= 0
                    ? 'text-green-300 bg-green-500/10'
                    : 'text-red-300 bg-red-500/10'
                }`}>
                  {parseFloat(calculate24hChange(token)) >= 0 ? '+' : ''}{calculate24hChange(token)}%
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-purple-400 text-xs">Market Cap (Live)</span>
              <span className="text-purple-200 text-sm font-bold">{calculateMarketCap(token).toFixed(2)} XRP</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-purple-400 text-xs">Liquidity (XRP)</span>
              <span className="text-purple-200 text-sm font-bold">{poolsData[token.id]?.xrpAmount ? poolsData[token.id].xrpAmount.toFixed(2) : token.amm_xrp_amount} XRP</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-purple-400 text-xs">Volume 24h</span>
              <span className="text-purple-200 text-sm font-bold">
                {token.amm_pool_created ? `${((poolsData[token.id]?.xrpAmount || token.amm_xrp_amount || 0) * 0.15).toFixed(2)} XRP` : '-'}
              </span>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-purple-500/20">
              <span className="text-purple-400 text-xs">Your LP</span>
              {lpBalances[token.id] ? (
                <div className="text-right">
                  <div className="text-green-400 text-sm font-bold">{lpBalances[token.id].balance.toFixed(4)}</div>
                  <div className="text-green-500 text-xs">{lpBalances[token.id].share.toFixed(2)}%</div>
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
          <TokenIcon token={token} size="sm" />
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
        <div className="flex items-center gap-2">
          <div>
            <div className="text-purple-200 font-bold">{getLivePrice(token).toFixed(8)}</div>
            <div className="text-purple-400 text-xs">XRP</div>
          </div>
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
      <td className="px-4 py-3 text-purple-300">
        {token.amm_pool_created ? `${((poolsData[token.id]?.xrpAmount || token.amm_xrp_amount || 0) * 0.15).toFixed(2)} XRP` : '-'}
      </td>
      <td className="px-4 py-3">
        {lpBalances[token.id] ? (
          <div>
            <div className="text-green-200 font-medium">{lpBalances[token.id].balance.toFixed(4)}</div>
            <div className="text-green-400 text-xs">{lpBalances[token.id].share.toFixed(2)}%</div>
          </div>
        ) : (
          <span className="text-purple-500">-</span>
        )}
      </td>
      <td className="px-4 py-3 text-purple-200">{calculateMarketCap(token).toFixed(2)} XRP</td>
      <td className="px-4 py-3 text-purple-200 font-bold">{poolsData[token.id]?.xrpAmount ? `${poolsData[token.id].xrpAmount.toFixed(2)} XRP` : `${token.amm_xrp_amount || 0} XRP`}</td>
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
              placeholder="🔍 Search coins..."
              className="input flex-1 text-purple-200"
            />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="input text-purple-200 w-full md:w-auto"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
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
                  <th className="text-left px-4 py-3 text-purple-300 font-medium">Token</th>
                  <th className="text-left px-4 py-3 text-purple-300 font-medium">Category</th>
                  <th className="text-left px-4 py-3 text-purple-300 font-medium">Days</th>
                  <th className="text-left px-4 py-3 text-purple-300 font-medium">Live Price</th>
                  <th className="text-left px-4 py-3 text-purple-300 font-medium">Volume 24h</th>
                  <th className="text-left px-4 py-3 text-purple-300 font-medium">Your LP</th>
                  <th className="text-left px-4 py-3 text-purple-300 font-medium">Market Cap</th>
                  <th className="text-left px-4 py-3 text-purple-300 font-medium">Liquidity (XRP)</th>
                  <th className="text-left px-4 py-3 text-purple-300 font-medium">Status</th>
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
          <h3 className="text-xl font-bold text-purple-200 mb-2">No Coins Found</h3>
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
                  setNewToken({ name: '', issuer: '', supply: '1000000', xrpLocked: '1', image: null });
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
                <h4 className="text-purple-200 font-medium mb-2">Wallet Configuration</h4>
                <div className="space-y-2 text-sm text-purple-300">
                  <p><span className="font-medium">Issuer:</span> {ISSUER_ADDRESS}</p>
                  <p><span className="font-medium">Receiver:</span> {RECEIVER_ADDRESS}</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={createCustomToken}
                disabled={isCreating || uploadingImage}
                className="btn-primary text-white px-6 py-2 rounded-lg font-medium flex-1 disabled:opacity-50"
              >
                {uploadingImage ? (
                  <span>⬆️ Uploading Image...</span>
                ) : isCreating ? (
                  <span>🔄 Creating...</span>
                ) : (
                  <span>🚀 Create Token</span>
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
