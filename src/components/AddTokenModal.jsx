import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../utils/supabase';
import { Wallet as XrplWallet } from 'xrpl';
import { getClient, submitWithRetry } from '../utils/xrplClient';
import { encodeCurrencyCode } from '../utils/currencyUtils';
import { uploadImageToPinata } from '../utils/pinata';

const LISTING_FEE = 1;
const FEATURED_FEE_OPTIONS = [
  { days: 1, price: 10, label: '1 Day' },
  { days: 3, price: 25, label: '3 Days' },
  { days: 7, price: 50, label: '7 Days' },
  { days: 30, price: 150, label: '30 Days' }
];

const PLATFORM_WALLET = 'rphatRpwXc8wk6PdmR5SDt6kLMqb2M3Ckj';

export default function AddTokenModal({ isOpen, onClose, wallet }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const isAdminWallet = wallet?.address === PLATFORM_WALLET;
  const [formData, setFormData] = useState({
    tokenName: '',
    currencyCode: '',
    issuerAddress: '',
    supply: '',
    description: '',
    category: 'Meme',
    twitterHandle: '',
    websiteUrl: '',
    imageUrl: '',
    hasAmmPool: false,
    ammAssetAmount: '',
    ammXrpAmount: '',
    ammAccountId: '',
    ammLpTokenBalance: '',
    ammTradingFee: '',
    addFeatured: false,
    featuredDuration: 0
  });
  const [fetchingAmmInfo, setFetchingAmmInfo] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setImageFile(null);
      setImagePreview(null);
      setFormData({
        tokenName: '',
        currencyCode: '',
        issuerAddress: '',
        supply: '',
        description: '',
        category: 'Meme',
        twitterHandle: '',
        websiteUrl: '',
        imageUrl: '',
        hasAmmPool: false,
        ammAssetAmount: '',
        ammXrpAmount: '',
        ammAccountId: '',
        ammLpTokenBalance: '',
        ammTradingFee: '',
        addFeatured: false,
        featuredDuration: 0
      });
    }
  }, [isOpen]);

  const getTotalFee = () => {
    if (isAdminWallet) return 0;

    let total = LISTING_FEE;
    if (formData.addFeatured && formData.featuredDuration) {
      const featured = FEATURED_FEE_OPTIONS.find(opt => opt.days === formData.featuredDuration);
      total += featured.price;
    }
    return total;
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be less than 5MB');
        return;
      }
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const validateStep1 = () => {
    if (!formData.tokenName.trim()) {
      toast.error('Token name is required');
      return false;
    }
    if (!formData.currencyCode.trim() || formData.currencyCode.length < 3 || formData.currencyCode.length > 10) {
      toast.error('Currency code must be 3-10 characters');
      return false;
    }
    if (!formData.issuerAddress.trim() || !formData.issuerAddress.startsWith('r')) {
      toast.error('Valid issuer address is required');
      return false;
    }
    if (!formData.supply || parseFloat(formData.supply) <= 0) {
      toast.error('Valid supply amount is required');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (formData.hasAmmPool) {
      if (!formData.ammAssetAmount || parseFloat(formData.ammAssetAmount) <= 0) {
        toast.error('AMM asset amount is required when pool is enabled');
        return false;
      }
      if (!formData.ammXrpAmount || parseFloat(formData.ammXrpAmount) <= 0) {
        toast.error('AMM XRP amount is required when pool is enabled');
        return false;
      }
      if (!formData.ammAccountId) {
        toast.error('AMM account ID is required. Please fetch AMM info.');
        return false;
      }
    }
    return true;
  };

  const fetchAmmInfo = async () => {
    if (!formData.currencyCode || !formData.issuerAddress) {
      toast.error('Please enter currency code and issuer address first');
      return;
    }

    setFetchingAmmInfo(true);
    try {
      const client = await getClient();

      const currencyHex = formData.currencyCode.length > 3
        ? Buffer.from(formData.currencyCode, 'utf8').toString('hex').toUpperCase().padEnd(40, '0')
        : formData.currencyCode.toUpperCase();

      const ammInfo = await client.request({
        command: 'amm_info',
        asset: { currency: 'XRP' },
        asset2: { currency: currencyHex, issuer: formData.issuerAddress },
        ledger_index: 'validated'
      });

      await client.disconnect();

      if (ammInfo?.result?.amm) {
        const amm = ammInfo.result.amm;
        const xrpAmount = parseFloat(amm.amount) / 1000000;
        const tokenAmount = parseFloat(amm.amount2.value);
        const lpTokenBalance = parseFloat(amm.lp_token.value);
        const tradingFee = amm.trading_fee || 0;

        setFormData({
          ...formData,
          hasAmmPool: true,
          ammAssetAmount: tokenAmount.toString(),
          ammXrpAmount: xrpAmount.toString(),
          ammAccountId: amm.account,
          ammLpTokenBalance: lpTokenBalance.toString(),
          ammTradingFee: tradingFee.toString()
        });

        toast.success('AMM pool found and data loaded!');
      } else {
        toast.error('No AMM pool found for this token pair');
      }
    } catch (error) {
      console.error('Error fetching AMM info:', error);
      if (error.data?.error === 'actNotFound') {
        toast.error('No AMM pool exists for this token');
      } else {
        toast.error('Failed to fetch AMM info. Please check the token details.');
      }
    } finally {
      setFetchingAmmInfo(false);
    }
  };

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    setStep(step + 1);
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleSubmit = async () => {
    if (!wallet) {
      toast.error('Please connect a wallet first');
      return;
    }

    const totalFee = getTotalFee();

    setLoading(true);
    try {
      let imageUrl = formData.imageUrl;

      if (imageFile) {
        setUploadingImage(true);
        try {
          imageUrl = await uploadImageToPinata(imageFile);
          toast.success('Image uploaded successfully!');
        } catch (error) {
          console.error('Image upload error:', error);
          toast.error('Failed to upload image. Continuing without image.');
        } finally {
          setUploadingImage(false);
        }
      }

      let txHash = null;

      if (!isAdminWallet && totalFee > 0) {
        const xrplWallet = XrplWallet.fromSeed(wallet.seed);
        const client = await getClient();

        const payment = {
          TransactionType: 'Payment',
          Account: xrplWallet.address,
          Amount: String(totalFee * 1000000),
          Destination: PLATFORM_WALLET,
          Memos: [{
            Memo: {
              MemoData: Buffer.from(`Token Listing: ${formData.tokenName}`).toString('hex').toUpperCase(),
              MemoType: Buffer.from('token-listing').toString('hex').toUpperCase()
            }
          }]
        };

        const result = await submitWithRetry(payment, xrplWallet);

        if (result.result.meta.TransactionResult !== 'tesSUCCESS') {
          throw new Error('Payment transaction failed');
        }

        txHash = result.result.hash;
      }

      const currencyHex = encodeCurrencyCode(formData.currencyCode);

      const { data: tokenData, error: tokenError } = await supabase
        .from('meme_tokens')
        .insert({
          token_name: formData.tokenName,
          currency_code: formData.currencyCode.toUpperCase(),
          currency_hex: currencyHex,
          issuer_address: formData.issuerAddress,
          receiver_address: wallet.address,
          supply: parseFloat(formData.supply),
          description: formData.description || null,
          category: formData.category,
          twitter_handle: formData.twitterHandle || null,
          website_url: formData.websiteUrl || null,
          image_url: imageUrl || null,
          amm_pool_created: formData.hasAmmPool,
          amm_asset_amount: formData.hasAmmPool ? parseFloat(formData.ammAssetAmount) : null,
          amm_xrp_amount: formData.hasAmmPool ? parseFloat(formData.ammXrpAmount) : null,
          amm_account_id: formData.hasAmmPool ? formData.ammAccountId : null,
          amm_lp_token_balance: formData.hasAmmPool ? parseFloat(formData.ammLpTokenBalance) : null,
          amm_trading_fee: formData.hasAmmPool ? parseInt(formData.ammTradingFee) : null,
          status: 'listed',
          tx_hash: txHash
        })
        .select()
        .single();

      if (tokenError) throw tokenError;

      if (formData.addFeatured && formData.featuredDuration) {
        const featuredOption = FEATURED_FEE_OPTIONS.find(opt => opt.days === formData.featuredDuration);
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + featuredOption.days);

        await supabase
          .from('featured_spot_payments')
          .insert({
            token_id: tokenData.id,
            wallet_address: wallet.address,
            spot_number: null,
            duration_days: featuredOption.days,
            amount_xrp: featuredOption.price,
            status: 'active',
            tx_hash: txHash,
            expires_at: expiresAt.toISOString()
          });

        await supabase
          .from('meme_tokens')
          .update({ is_featured: true })
          .eq('id', tokenData.id);
      }

      if (isAdminWallet) {
        toast.success('Token added successfully! (Admin - No Fee)');
      } else {
        toast.success(`Token added successfully! Fee: ${totalFee} XRP`);
      }
      onClose();
      window.location.reload();
    } catch (error) {
      console.error('Error adding token:', error);
      toast.error(error.message || 'Failed to add token');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-purple-500/30">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Add Token to Platform</h2>
          <button
            onClick={onClose}
            className="text-purple-300 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-6 flex items-center gap-2">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                step >= s ? 'bg-purple-600 text-white' : 'bg-purple-900/30 text-purple-500'
              }`}>
                {s}
              </div>
              {s < 4 && <div className={`flex-1 h-1 mx-2 ${step > s ? 'bg-purple-600' : 'bg-purple-900/30'}`} />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <h3 className="text-blue-300 font-semibold mb-2 flex items-center gap-2">
                <span>ℹ️</span>
                Token Listing Process
              </h3>
              <ul className="text-blue-200 text-sm space-y-1">
                <li>• Submit token information and metadata</li>
                <li>• Pay listing fee to add your token to the platform</li>
                <li>• Optional: Purchase featured spot for increased visibility</li>
                <li>• Token appears immediately after payment confirmation</li>
              </ul>
            </div>

            <h3 className="text-white font-semibold">Basic Information</h3>

            <div>
              <label className="block text-purple-300 text-sm mb-2">Token Name *</label>
              <input
                type="text"
                value={formData.tokenName}
                onChange={(e) => setFormData({ ...formData, tokenName: e.target.value })}
                placeholder="My Awesome Token"
                className="w-full px-4 py-3 bg-purple-900/20 border border-purple-500/30 rounded-lg text-white placeholder-purple-500"
              />
            </div>

            <div>
              <label className="block text-purple-300 text-sm mb-2">Currency Code * (3-10 chars)</label>
              <input
                type="text"
                value={formData.currencyCode}
                onChange={(e) => setFormData({ ...formData, currencyCode: e.target.value.toUpperCase() })}
                placeholder="TOKEN"
                maxLength={10}
                className="w-full px-4 py-3 bg-purple-900/20 border border-purple-500/30 rounded-lg text-white placeholder-purple-500"
              />
              {formData.currencyCode && formData.currencyCode.length >= 3 && (
                <div className="mt-2 p-2 bg-purple-900/30 border border-purple-500/20 rounded text-xs">
                  <p className="text-purple-300">
                    {formData.currencyCode.length === 3
                      ? `Standard code: ${formData.currencyCode.toUpperCase()}`
                      : `Hex encoded: ${encodeCurrencyCode(formData.currencyCode)}`
                    }
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-purple-300 text-sm mb-2">Issuer Address *</label>
              <input
                type="text"
                value={formData.issuerAddress}
                onChange={(e) => setFormData({ ...formData, issuerAddress: e.target.value })}
                placeholder="rXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                className="w-full px-4 py-3 bg-purple-900/20 border border-purple-500/30 rounded-lg text-white placeholder-purple-500 font-mono text-sm"
              />
            </div>

            <div>
              <label className="block text-purple-300 text-sm mb-2">Total Supply *</label>
              <input
                type="number"
                value={formData.supply}
                onChange={(e) => setFormData({ ...formData, supply: e.target.value })}
                placeholder="1000000"
                className="w-full px-4 py-3 bg-purple-900/20 border border-purple-500/30 rounded-lg text-white placeholder-purple-500"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h3 className="text-white font-semibold">Additional Details</h3>

            <div>
              <label className="block text-purple-300 text-sm mb-2">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe your token..."
                rows={3}
                className="w-full px-4 py-3 bg-purple-900/20 border border-purple-500/30 rounded-lg text-white placeholder-purple-500"
              />
            </div>

            <div>
              <label className="block text-purple-300 text-sm mb-2">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-4 py-3 bg-purple-900/20 border border-purple-500/30 rounded-lg text-white"
              >
                <option value="Meme">Meme</option>
                <option value="DeFi">DeFi</option>
                <option value="Gaming">Gaming</option>
                <option value="NFT">NFT</option>
                <option value="Utility">Utility</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-purple-300 text-sm mb-2">Twitter Handle</label>
              <input
                type="text"
                value={formData.twitterHandle}
                onChange={(e) => setFormData({ ...formData, twitterHandle: e.target.value })}
                placeholder="@mytoken"
                className="w-full px-4 py-3 bg-purple-900/20 border border-purple-500/30 rounded-lg text-white placeholder-purple-500"
              />
            </div>

            <div>
              <label className="block text-purple-300 text-sm mb-2">Website URL</label>
              <input
                type="url"
                value={formData.websiteUrl}
                onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                placeholder="https://mytoken.com"
                className="w-full px-4 py-3 bg-purple-900/20 border border-purple-500/30 rounded-lg text-white placeholder-purple-500"
              />
            </div>

            <div>
              <label className="block text-purple-300 text-sm mb-2">Token Image</label>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <label className="flex-1 cursor-pointer">
                    <div className="w-full px-4 py-3 bg-purple-900/20 border border-purple-500/30 rounded-lg text-white hover:border-purple-500/50 transition-colors flex items-center justify-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>{imageFile ? imageFile.name : 'Upload Image (Max 5MB)'}</span>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                  </label>
                </div>

                {imagePreview && (
                  <div className="relative w-32 h-32 mx-auto">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full h-full object-cover rounded-lg border-2 border-purple-500/30"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setImageFile(null);
                        setImagePreview(null);
                      }}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white text-sm"
                    >
                      ×
                    </button>
                  </div>
                )}

                <div className="text-center text-purple-400 text-xs">OR</div>

                <input
                  type="url"
                  value={formData.imageUrl}
                  onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                  placeholder="https://example.com/token-image.png"
                  disabled={!!imageFile}
                  className="w-full px-4 py-3 bg-purple-900/20 border border-purple-500/30 rounded-lg text-white placeholder-purple-500 disabled:opacity-50"
                />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h3 className="text-white font-semibold">AMM Pool Information</h3>

            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <h4 className="text-blue-300 font-semibold mb-2 flex items-center gap-2">
                <span>ℹ️</span>
                Receiver Wallet Configuration
              </h4>
              <p className="text-blue-200 text-sm mb-2">
                Your connected wallet address will be set as the receiver for this token listing:
              </p>
              <p className="text-blue-100 text-xs font-mono bg-blue-900/30 p-2 rounded break-all">
                {wallet?.address || 'No wallet connected'}
              </p>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
              <p className="text-yellow-200 text-sm">
                If your token already has an AMM pool on XRPL, provide the pool details below. Otherwise, leave this section disabled.
              </p>
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.hasAmmPool}
                onChange={(e) => setFormData({ ...formData, hasAmmPool: e.target.checked })}
                className="w-5 h-5"
              />
              <span className="text-purple-200">This token has an existing AMM pool</span>
            </label>

            {formData.hasAmmPool && (
              <>
                <button
                  type="button"
                  onClick={fetchAmmInfo}
                  disabled={fetchingAmmInfo}
                  className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800/50 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  {fetchingAmmInfo ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Fetching AMM Info...
                    </>
                  ) : (
                    <>
                      <span>🔍</span>
                      Fetch AMM Pool Data from XRPL
                    </>
                  )}
                </button>

                {formData.ammAccountId && (
                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                    <h4 className="text-green-300 font-semibold mb-2 flex items-center gap-2">
                      <span>✅</span>
                      AMM Pool Verified
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-green-200">AMM Account:</span>
                        <span className="text-white font-mono text-xs">{formData.ammAccountId.slice(0, 10)}...{formData.ammAccountId.slice(-8)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-200">Token Amount:</span>
                        <span className="text-white">{parseFloat(formData.ammAssetAmount).toLocaleString()} {formData.currencyCode}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-200">XRP Amount:</span>
                        <span className="text-white">{parseFloat(formData.ammXrpAmount).toLocaleString()} XRP</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-200">LP Token Balance:</span>
                        <span className="text-white">{parseFloat(formData.ammLpTokenBalance).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-200">Trading Fee:</span>
                        <span className="text-white">{formData.ammTradingFee} basis points</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-200">Current Price:</span>
                        <span className="text-white">{(parseFloat(formData.ammXrpAmount) / parseFloat(formData.ammAssetAmount)).toFixed(8)} XRP</span>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-purple-300 text-sm mb-2">AMM Token Amount *</label>
                  <input
                    type="number"
                    value={formData.ammAssetAmount}
                    onChange={(e) => setFormData({ ...formData, ammAssetAmount: e.target.value })}
                    placeholder="900000"
                    readOnly={!!formData.ammAccountId}
                    className="w-full px-4 py-3 bg-purple-900/20 border border-purple-500/30 rounded-lg text-white placeholder-purple-500 read-only:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-purple-300 text-sm mb-2">AMM XRP Amount *</label>
                  <input
                    type="number"
                    value={formData.ammXrpAmount}
                    onChange={(e) => setFormData({ ...formData, ammXrpAmount: e.target.value })}
                    placeholder="100"
                    readOnly={!!formData.ammAccountId}
                    className="w-full px-4 py-3 bg-purple-900/20 border border-purple-500/30 rounded-lg text-white placeholder-purple-500 read-only:opacity-50"
                  />
                </div>
              </>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h3 className="text-white font-semibold">Featured Listing (Optional)</h3>

            {isAdminWallet && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                <h4 className="text-green-300 font-semibold mb-2 flex items-center gap-2">
                  <span>👑</span>
                  Admin Wallet Detected
                </h4>
                <p className="text-green-200 text-sm">
                  You are using the platform admin wallet. All listing fees are waived for admin submissions.
                </p>
              </div>
            )}

            <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-lg p-4">
              <h4 className="text-purple-200 font-semibold mb-2">Get Featured Spotlight</h4>
              <p className="text-purple-300 text-sm mb-3">
                Boost your token visibility with a featured spot on the main page. Featured tokens appear at the top with special highlighting.
              </p>
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.addFeatured}
                onChange={(e) => setFormData({ ...formData, addFeatured: e.target.checked, featuredDuration: e.target.checked ? 1 : 0 })}
                className="w-5 h-5"
              />
              <span className="text-purple-200 font-semibold">Add Featured Spot</span>
            </label>

            {formData.addFeatured && (
              <div className="grid grid-cols-2 gap-3">
                {FEATURED_FEE_OPTIONS.map((option) => (
                  <button
                    key={option.days}
                    onClick={() => setFormData({ ...formData, featuredDuration: option.days })}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      formData.featuredDuration === option.days
                        ? 'border-purple-500 bg-purple-500/20'
                        : 'border-purple-500/30 bg-purple-900/20 hover:border-purple-500/50'
                    }`}
                  >
                    <div className="text-white font-bold text-lg">{option.label}</div>
                    <div className="text-purple-300 text-sm mt-1">{option.price} XRP</div>
                  </button>
                ))}
              </div>
            )}

            <div className={`rounded-lg p-4 border ${isAdminWallet ? 'bg-green-500/10 border-green-500/30' : 'bg-gray-800/50 border-purple-500/20'}`}>
              <div className="flex items-center justify-between text-lg font-bold">
                <span className={isAdminWallet ? "text-green-200" : "text-purple-200"}>Total Fee:</span>
                <span className="text-white">
                  {isAdminWallet ? (
                    <span className="flex items-center gap-2">
                      <span className="line-through text-gray-500">{LISTING_FEE + (formData.addFeatured && formData.featuredDuration ? FEATURED_FEE_OPTIONS.find(opt => opt.days === formData.featuredDuration)?.price || 0 : 0)} XRP</span>
                      <span className="text-green-400">FREE</span>
                    </span>
                  ) : (
                    `${getTotalFee()} XRP`
                  )}
                </span>
              </div>
              {!isAdminWallet && (
                <div className="mt-3 pt-3 border-t border-purple-500/20 space-y-1 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-purple-300">Listing Fee</span>
                    <span className="text-purple-200">{LISTING_FEE} XRP</span>
                  </div>
                  {formData.addFeatured && formData.featuredDuration > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-purple-300">Featured ({FEATURED_FEE_OPTIONS.find(opt => opt.days === formData.featuredDuration)?.label})</span>
                      <span className="text-purple-200">{FEATURED_FEE_OPTIONS.find(opt => opt.days === formData.featuredDuration)?.price} XRP</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-3 mt-6">
          {step > 1 && (
            <button
              onClick={handleBack}
              className="px-6 py-3 bg-purple-900/30 text-purple-300 rounded-lg hover:bg-purple-900/50 transition-all"
            >
              Back
            </button>
          )}
          {step < 4 ? (
            <button
              onClick={handleNext}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-500 text-white rounded-lg hover:from-purple-500 hover:to-purple-400 transition-all font-semibold"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading || uploadingImage || !wallet}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-green-500 text-white rounded-lg hover:from-green-500 hover:to-green-400 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploadingImage ? 'Uploading Image...' : loading ? 'Processing...' : isAdminWallet ? 'Submit (Admin - No Fee)' : `Submit & Pay ${getTotalFee()} XRP`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
