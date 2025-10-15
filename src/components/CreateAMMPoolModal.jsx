import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../utils/supabase';
import { Wallet as XrplWallet } from 'xrpl';
import { getClient, submitWithRetry } from '../utils/xrplClient';
import { encodeCurrencyCode } from '../utils/currencyUtils';

const AMM_CREATION_FEE = 0.10;

export default function CreateAMMPoolModal({ isOpen, onClose, wallet }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [tokens, setTokens] = useState([]);
  const [formData, setFormData] = useState({
    selectedToken: null,
    tokenAmount: '',
    xrpAmount: '',
    tradingFee: 0
  });
  const [progressStep, setProgressStep] = useState('');
  const [showProgress, setShowProgress] = useState(false);
  const [progressSteps, setProgressSteps] = useState([]);

  useEffect(() => {
    if (isOpen) {
      loadAvailableTokens();
      setStep(1);
      setFormData({
        selectedToken: null,
        tokenAmount: '',
        xrpAmount: '',
        tradingFee: 0
      });
    }
  }, [isOpen]);

  const loadAvailableTokens = async () => {
    try {
      const { data, error } = await supabase
        .from('meme_tokens')
        .select('*')
        .eq('amm_pool_created', false)
        .neq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTokens(data || []);
    } catch (error) {
      console.error('Error loading tokens:', error);
      toast.error('Failed to load available tokens');
    }
  };

  const validateStep1 = () => {
    if (!formData.selectedToken) {
      toast.error('Please select a token');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!formData.tokenAmount || parseFloat(formData.tokenAmount) <= 0) {
      toast.error('Token amount must be greater than 0');
      return false;
    }
    if (!formData.xrpAmount || parseFloat(formData.xrpAmount) <= 0) {
      toast.error('XRP amount must be greater than 0');
      return false;
    }
    if (parseFloat(formData.xrpAmount) < 10) {
      toast.error('XRP amount must be at least 10 XRP');
      return false;
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

    setLoading(true);
    setShowProgress(true);
    const steps = [];

    try {
      setProgressStep('Initializing wallet...');
      steps.push({ text: 'Initialize wallet', status: 'in_progress' });
      setProgressSteps([...steps]);

      const xrplWallet = XrplWallet.fromSeed(wallet.seed);
      const client = await getClient();

      const token = formData.selectedToken;
      const currencyHex = token.currency_hex || encodeCurrencyCode(token.currency_code);

      steps[0].status = 'completed';
      setProgressSteps([...steps]);

      const ISSUER_ADDRESS = 'rKxBBMmY969Ph1y63ddVfYyN7xmxwDfVq6';
      const isAdminOrReceiver = wallet.address === ISSUER_ADDRESS ||
                               (token.receiver_address && wallet.address === token.receiver_address);

      if (token.receiver_address && token.receiver_address !== wallet.address && !isAdminOrReceiver) {
        setProgressStep(`Paying ${AMM_CREATION_FEE} XRP creation fee...`);
        steps.push({ text: `Pay ${AMM_CREATION_FEE} XRP creation fee`, status: 'in_progress' });
        setProgressSteps([...steps]);

        const feePayment = {
          TransactionType: 'Payment',
          Account: xrplWallet.address,
          Amount: String(AMM_CREATION_FEE * 1000000),
          Destination: token.receiver_address,
          Memos: [{
            Memo: {
              MemoData: Buffer.from(`AMM Pool Creation Fee: ${token.currency_code}`).toString('hex').toUpperCase(),
              MemoType: Buffer.from('amm-creation-fee').toString('hex').toUpperCase()
            }
          }]
        };

        const feeResult = await submitWithRetry(feePayment, xrplWallet);

        if (feeResult.result.meta.TransactionResult !== 'tesSUCCESS') {
          throw new Error('Fee payment failed');
        }

        steps[steps.length - 1].status = 'completed';
        setProgressSteps([...steps]);
        toast.success(`${AMM_CREATION_FEE} XRP fee paid to token receiver`);
      } else if (isAdminOrReceiver) {
        steps.push({ text: 'Skip fee (admin/receiver wallet)', status: 'completed' });
        setProgressSteps([...steps]);
      }

      setProgressStep('Creating AMM pool on XRPL...');
      steps.push({ text: 'Create AMM pool on XRPL', status: 'in_progress' });
      setProgressSteps([...steps]);

      const amount = {
        currency: currencyHex,
        issuer: token.issuer_address,
        value: formData.tokenAmount
      };

      const amount2 = formData.xrpAmount;

      const ammCreate = {
        TransactionType: 'AMMCreate',
        Account: xrplWallet.address,
        Amount: amount,
        Amount2: String(parseFloat(amount2) * 1000000),
        TradingFee: formData.tradingFee
      };

      const prepared = await client.autofill(ammCreate);
      const signed = xrplWallet.sign(prepared);
      const result = await client.submitAndWait(signed.tx_blob);

      if (result.result.meta.TransactionResult !== 'tesSUCCESS') {
        throw new Error(`Transaction failed: ${result.result.meta.TransactionResult}`);
      }

      steps[steps.length - 1].status = 'completed';
      setProgressSteps([...steps]);

      setProgressStep('Updating database...');
      steps.push({ text: 'Update token status in database', status: 'in_progress' });
      setProgressSteps([...steps]);

      await supabase
        .from('meme_tokens')
        .update({
          amm_pool_created: true,
          amm_asset_amount: parseFloat(formData.tokenAmount),
          amm_xrp_amount: parseFloat(formData.xrpAmount),
          amm_tx_hash: result.result.hash,
          status: 'active'
        })
        .eq('id', token.id);

      steps[steps.length - 1].status = 'completed';
      setProgressSteps([...steps]);

      setProgressStep('Adding to pool tracking...');
      steps.push({ text: 'Add to pool tracking', status: 'in_progress' });
      setProgressSteps([...steps]);

      await supabase
        .from('user_pools')
        .insert({
          user_address: wallet.address,
          token_id: token.id,
          token_amount: parseFloat(formData.tokenAmount),
          xrp_amount: parseFloat(formData.xrpAmount),
          created_at: new Date().toISOString()
        });

      steps[steps.length - 1].status = 'completed';
      setProgressSteps([...steps]);

      setProgressStep('Complete!');
      toast.success('AMM Pool created successfully!');

      setTimeout(() => {
        onClose();
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error('Error creating AMM pool:', error);

      const steps = progressSteps.map((s, i) =>
        i === progressSteps.length - 1 && s.status === 'in_progress'
          ? { ...s, status: 'error' }
          : s
      );
      setProgressSteps(steps);

      let errorMessage = 'Failed to create AMM pool';
      if (error.message?.includes('tecNO_AUTH')) {
        errorMessage = 'Insufficient authorization. Make sure you have a trustline for this token.';
      } else if (error.message?.includes('tecUNFUNDED')) {
        errorMessage = 'Insufficient funds. You need more XRP in your wallet.';
      } else if (error.message?.includes('tecINSUF_RESERVE_LINE')) {
        errorMessage = 'Insufficient reserve. You need to maintain the minimum XRP reserve.';
      } else if (error.message?.includes('tecAMM_EXISTS')) {
        errorMessage = 'AMM pool already exists for this token pair.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      setProgressStep(`Error: ${errorMessage}`);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const initialPrice = formData.tokenAmount && formData.xrpAmount
    ? (parseFloat(formData.xrpAmount) / parseFloat(formData.tokenAmount)).toFixed(8)
    : '0';

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-purple-500/30">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Create AMM LP Pool</h2>
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
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                step >= s ? 'bg-purple-600 text-white' : 'bg-purple-900/30 text-purple-500'
              }`}>
                {s}
              </div>
              {s < 3 && <div className={`flex-1 h-1 mx-2 ${step > s ? 'bg-purple-600' : 'bg-purple-900/30'}`} />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <h3 className="text-blue-300 font-semibold mb-2 flex items-center gap-2">
                <span>ℹ️</span>
                AMM Pool Creation
              </h3>
              <ul className="text-blue-200 text-sm space-y-1">
                <li>• Select a token that doesn't have an AMM pool yet</li>
                <li>• Provide initial liquidity (Token + XRP)</li>
                <li>• The pool will be created on the XRPL blockchain</li>
                <li>• You'll receive LP tokens representing your share</li>
                <li>• Fee: {AMM_CREATION_FEE} XRP (FREE for admin issuer and token receiver wallets)</li>
              </ul>
            </div>

            <h3 className="text-white font-semibold">Select Token</h3>

            {tokens.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-purple-300">No tokens available for pool creation</p>
                <p className="text-purple-500 text-sm mt-2">All tokens already have AMM pools</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {tokens.map((token) => (
                  <button
                    key={token.id}
                    onClick={() => setFormData({ ...formData, selectedToken: token })}
                    className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                      formData.selectedToken?.id === token.id
                        ? 'border-purple-500 bg-purple-500/20'
                        : 'border-purple-500/30 bg-purple-900/20 hover:border-purple-500/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500/20 to-purple-600/20 flex items-center justify-center">
                        <span className="text-lg font-bold text-purple-400">
                          {token.token_name?.charAt(0) || '?'}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-white">{token.token_name}</div>
                        <div className="text-sm text-purple-400">{token.currency_code}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-purple-300">Supply</div>
                        <div className="text-white font-medium">{parseFloat(token.supply).toLocaleString()}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h3 className="text-white font-semibold">Set Initial Liquidity</h3>

            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
              <p className="text-yellow-200 text-sm">
                The amounts you provide will determine the initial price. Make sure you have enough of both assets in your wallet.
              </p>
            </div>

            <div>
              <label className="block text-purple-300 text-sm mb-2">
                {formData.selectedToken?.currency_code} Amount *
              </label>
              <input
                type="number"
                value={formData.tokenAmount}
                onChange={(e) => setFormData({ ...formData, tokenAmount: e.target.value })}
                placeholder="100000"
                step="any"
                className="w-full px-4 py-3 bg-purple-900/20 border border-purple-500/30 rounded-lg text-white placeholder-purple-500"
              />
            </div>

            <div>
              <label className="block text-purple-300 text-sm mb-2">XRP Amount * (min 10 XRP)</label>
              <input
                type="number"
                value={formData.xrpAmount}
                onChange={(e) => setFormData({ ...formData, xrpAmount: e.target.value })}
                placeholder="1000"
                step="any"
                min="10"
                className="w-full px-4 py-3 bg-purple-900/20 border border-purple-500/30 rounded-lg text-white placeholder-purple-500"
              />
            </div>

            <div>
              <label className="block text-purple-300 text-sm mb-2">Trading Fee (basis points, 0-1000)</label>
              <input
                type="number"
                value={formData.tradingFee}
                onChange={(e) => setFormData({ ...formData, tradingFee: Math.min(1000, Math.max(0, parseInt(e.target.value) || 0)) })}
                placeholder="0"
                min="0"
                max="1000"
                className="w-full px-4 py-3 bg-purple-900/20 border border-purple-500/30 rounded-lg text-white placeholder-purple-500"
              />
              <p className="text-purple-500 text-xs mt-1">
                {formData.tradingFee / 100}% fee per trade. Default is 0 (no fee).
              </p>
            </div>

            {formData.tokenAmount && formData.xrpAmount && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                <p className="text-green-300 text-sm">
                  Initial Price: 1 {formData.selectedToken?.currency_code} = {initialPrice} XRP
                </p>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h3 className="text-white font-semibold">Review & Confirm</h3>

            <div className="space-y-3">
              <div className="glass rounded-lg p-4">
                <div className="text-purple-400 text-sm mb-1">Token</div>
                <div className="text-white font-semibold">
                  {formData.selectedToken?.token_name} ({formData.selectedToken?.currency_code})
                </div>
              </div>

              <div className="glass rounded-lg p-4">
                <div className="text-purple-400 text-sm mb-1">Initial Liquidity</div>
                <div className="text-white">
                  <div>{parseFloat(formData.tokenAmount).toLocaleString()} {formData.selectedToken?.currency_code}</div>
                  <div>{parseFloat(formData.xrpAmount).toLocaleString()} XRP</div>
                </div>
              </div>

              <div className="glass rounded-lg p-4">
                <div className="text-purple-400 text-sm mb-1">Initial Price</div>
                <div className="text-white">
                  1 {formData.selectedToken?.currency_code} = {initialPrice} XRP
                </div>
              </div>

              <div className="glass rounded-lg p-4">
                <div className="text-purple-400 text-sm mb-1">Trading Fee</div>
                <div className="text-white">{formData.tradingFee / 100}%</div>
              </div>

              {formData.selectedToken?.receiver_address && formData.selectedToken.receiver_address !== wallet?.address && (
                <div className="glass rounded-lg p-4 bg-blue-500/10 border-blue-500/30">
                  <div className="text-blue-400 text-sm mb-1">AMM Creation Fee</div>
                  <div className="text-white font-semibold">{AMM_CREATION_FEE} XRP</div>
                  <div className="text-blue-300 text-xs mt-1">
                    Paid to token receiver: {formData.selectedToken.receiver_address.slice(0, 8)}...{formData.selectedToken.receiver_address.slice(-6)}
                  </div>
                </div>
              )}

              {(!formData.selectedToken?.receiver_address || formData.selectedToken.receiver_address === wallet?.address || wallet?.address === 'rKxBBMmY969Ph1y63ddVfYyN7xmxwDfVq6') && (
                <div className="glass rounded-lg p-4 bg-green-500/10 border-green-500/30">
                  <div className="text-green-400 text-sm mb-1">AMM Creation Fee</div>
                  <div className="text-green-200 font-semibold">FREE</div>
                  <div className="text-green-300 text-xs mt-1">
                    No fee for admin issuer and token receiver wallets
                  </div>
                </div>
              )}
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
              <p className="text-yellow-200 text-sm">
                ⚠️ Make sure you have a trustline for this token and sufficient balance before proceeding.
              </p>
            </div>
          </div>
        )}

        <div className="mt-6 flex gap-3">
          {step > 1 && (
            <button
              onClick={handleBack}
              disabled={loading}
              className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              Back
            </button>
          )}

          {step < 3 ? (
            <button
              onClick={handleNext}
              disabled={loading || (step === 1 && !formData.selectedToken)}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white rounded-lg font-medium transition-all disabled:opacity-50"
            >
              {loading ? 'Creating Pool...' : 'Create AMM Pool'}
            </button>
          )}
        </div>

        {showProgress && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60]">
            <div className="glass rounded-xl p-6 max-w-md w-full mx-4 border border-purple-500/30">
              <h3 className="text-xl font-bold text-white mb-4">Creating AMM Pool</h3>

              <div className="space-y-3">
                {progressSteps.map((step, index) => (
                  <div key={index} className="flex items-center gap-3">
                    {step.status === 'completed' && (
                      <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                    {step.status === 'in_progress' && (
                      <div className="w-6 h-6 rounded-full border-2 border-purple-500 border-t-transparent animate-spin flex-shrink-0" />
                    )}
                    {step.status === 'error' && (
                      <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                    )}
                    <span className={`text-sm ${
                      step.status === 'completed' ? 'text-green-300' :
                      step.status === 'in_progress' ? 'text-purple-300 font-semibold' :
                      step.status === 'error' ? 'text-red-300' :
                      'text-gray-400'
                    }`}>
                      {step.text}
                    </span>
                  </div>
                ))}
              </div>

              {progressStep && (
                <div className="mt-4 pt-4 border-t border-purple-500/20">
                  <p className="text-purple-300 text-sm">{progressStep}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
