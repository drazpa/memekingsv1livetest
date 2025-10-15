import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../utils/supabase';
import { Wallet as XrplWallet } from 'xrpl';
import { getClient, submitWithRetry } from '../utils/xrplClient';
import { encodeCurrencyCode } from '../utils/currencyUtils';

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
    addFeatured: false,
    featuredDuration: 0
  });

  useEffect(() => {
    if (isOpen) {
      setStep(1);
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
        addFeatured: false,
        featuredDuration: 0
      });
    }
  }, [isOpen]);

  const getTotalFee = () => {
    let total = LISTING_FEE;
    if (formData.addFeatured && formData.featuredDuration) {
      const featured = FEATURED_FEE_OPTIONS.find(opt => opt.days === formData.featuredDuration);
      total += featured.price;
    }
    return total;
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
    }
    return true;
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
          image_url: formData.imageUrl || null,
          amm_pool_created: formData.hasAmmPool,
          amm_asset_amount: formData.hasAmmPool ? parseFloat(formData.ammAssetAmount) : null,
          amm_xrp_amount: formData.hasAmmPool ? parseFloat(formData.ammXrpAmount) : null,
          status: 'listed',
          tx_hash: result.result.hash
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
            tx_hash: result.result.hash,
            expires_at: expiresAt.toISOString()
          });

        await supabase
          .from('meme_tokens')
          .update({ is_featured: true })
          .eq('id', tokenData.id);
      }

      toast.success(`Token added successfully! Fee: ${totalFee} XRP`);
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
              <label className="block text-purple-300 text-sm mb-2">Image URL</label>
              <input
                type="url"
                value={formData.imageUrl}
                onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                placeholder="https://example.com/token-image.png"
                className="w-full px-4 py-3 bg-purple-900/20 border border-purple-500/30 rounded-lg text-white placeholder-purple-500"
              />
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
                <div>
                  <label className="block text-purple-300 text-sm mb-2">AMM Token Amount *</label>
                  <input
                    type="number"
                    value={formData.ammAssetAmount}
                    onChange={(e) => setFormData({ ...formData, ammAssetAmount: e.target.value })}
                    placeholder="900000"
                    className="w-full px-4 py-3 bg-purple-900/20 border border-purple-500/30 rounded-lg text-white placeholder-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-purple-300 text-sm mb-2">AMM XRP Amount *</label>
                  <input
                    type="number"
                    value={formData.ammXrpAmount}
                    onChange={(e) => setFormData({ ...formData, ammXrpAmount: e.target.value })}
                    placeholder="100"
                    className="w-full px-4 py-3 bg-purple-900/20 border border-purple-500/30 rounded-lg text-white placeholder-purple-500"
                  />
                </div>
              </>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h3 className="text-white font-semibold">Featured Listing (Optional)</h3>

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

            <div className="bg-gray-800/50 rounded-lg p-4 border border-purple-500/20">
              <div className="flex items-center justify-between text-lg font-bold">
                <span className="text-purple-200">Total Fee:</span>
                <span className="text-white">{getTotalFee()} XRP</span>
              </div>
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
              disabled={loading || !wallet}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-green-500 text-white rounded-lg hover:from-green-500 hover:to-green-400 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : `Submit & Pay ${getTotalFee()} XRP`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
