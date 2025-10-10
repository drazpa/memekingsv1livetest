import React, { useState, useEffect } from 'react';
import { Client, Wallet as XrplWallet } from 'xrpl';
import { supabase } from '../utils/supabase';
import toast from 'react-hot-toast';

export default function TipModal({
  isOpen,
  onClose,
  recipient,
  connectedWallet,
  nickname,
  currentStream
}) {
  const [walletAssets, setWalletAssets] = useState([]);
  const [selectedToken, setSelectedToken] = useState(null);
  const [amount, setAmount] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [xrpBalance, setXrpBalance] = useState('0');

  useEffect(() => {
    if (isOpen && connectedWallet) {
      loadWalletAssets();
    }
  }, [isOpen, connectedWallet]);

  const loadWalletAssets = async () => {
    if (!connectedWallet?.address) return;

    try {
      const client = new Client(
        connectedWallet.network === 'mainnet'
          ? 'wss://xrplcluster.com'
          : 'wss://s.altnet.rippletest.net:51233'
      );

      await client.connect();

      const accountInfo = await client.request({
        command: 'account_info',
        account: connectedWallet.address,
        ledger_index: 'validated'
      });

      const balance = parseFloat(accountInfo.result.account_data.Balance) / 1000000;
      const reserve = 10;
      const available = Math.max(0, balance - reserve);
      setXrpBalance(available.toFixed(6));

      const response = await client.request({
        command: 'account_lines',
        account: connectedWallet.address,
        ledger_index: 'validated'
      });

      const assets = response.result.lines || [];
      setWalletAssets(assets);

      await client.disconnect();
    } catch (error) {
      console.error('Error loading wallet assets:', error);
      toast.error('Failed to load wallet assets');
    }
  };

  const sendTip = async () => {
    if (!selectedToken || !amount || parseFloat(amount) <= 0) {
      toast.error('Please select a token and enter a valid amount');
      return;
    }

    if (parseFloat(amount) > parseFloat(selectedToken.balance)) {
      toast.error('Insufficient balance');
      return;
    }

    setIsSending(true);

    try {
      const client = new Client(
        connectedWallet.network === 'mainnet'
          ? 'wss://xrplcluster.com'
          : 'wss://s.altnet.rippletest.net:51233'
      );

      await client.connect();
      const wallet = XrplWallet.fromSeed(connectedWallet.seed);

      let payment;
      if (selectedToken.currency === 'XRP') {
        payment = {
          TransactionType: 'Payment',
          Account: wallet.address,
          Destination: recipient.wallet_address,
          Amount: String(Math.floor(parseFloat(amount) * 1000000))
        };
      } else {
        payment = {
          TransactionType: 'Payment',
          Account: wallet.address,
          Destination: recipient.wallet_address,
          Amount: {
            currency: selectedToken.currency,
            issuer: selectedToken.issuer,
            value: amount
          }
        };
      }

      const prepared = await client.autofill(payment);
      const signed = wallet.sign(prepared);
      const result = await client.submitAndWait(signed.tx_blob);

      if (result.result.meta.TransactionResult === 'tesSUCCESS') {
        toast.success(`Sent ${amount} ${selectedToken.currency} to ${recipient.nickname}!`);

        if (currentStream) {
          await supabase
            .from('stream_tips')
            .insert([{
              stream_id: currentStream.id,
              from_wallet: connectedWallet.address,
              from_nickname: nickname,
              to_wallet: recipient.wallet_address,
              currency: selectedToken.currency,
              amount: parseFloat(amount),
              tx_hash: result.result.hash
            }]);

          const { data: streamData } = await supabase
            .from('live_streams')
            .select('total_tips')
            .eq('id', currentStream.id)
            .single();

          const currentTotal = parseFloat(streamData?.total_tips || 0);
          const newTotal = currentTotal + parseFloat(amount);

          await supabase
            .from('live_streams')
            .update({ total_tips: newTotal })
            .eq('id', currentStream.id);
        }

        onClose();
        setAmount('');
        setSelectedToken(null);
      } else {
        toast.error('Transaction failed: ' + result.result.meta.TransactionResult);
      }

      await client.disconnect();
    } catch (error) {
      console.error('Error sending tip:', error);
      toast.error('Failed to send tip: ' + error.message);
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  const tokenOptions = [
    { currency: 'XRP', balance: xrpBalance, issuer: 'XRP' },
    ...walletAssets.map(a => ({
      currency: a.currency,
      balance: a.balance,
      issuer: a.account
    }))
  ];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-purple-900 to-slate-900 rounded-lg p-8 max-w-lg w-full border border-purple-500/30 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-purple-200">Send Tip</h3>
          <button
            onClick={onClose}
            className="text-purple-400 hover:text-purple-200 transition-colors text-2xl"
          >
            ×
          </button>
        </div>

        <div className="text-center mb-6 p-4 bg-purple-800/30 rounded-lg border border-purple-500/20">
          <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-2xl mx-auto mb-3">
            {recipient.nickname.charAt(0).toUpperCase()}
          </div>
          <div className="text-purple-200 font-bold text-lg">{recipient.nickname}</div>
          <div className="text-purple-400 text-xs mt-1 break-all">{recipient.wallet_address}</div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-purple-200 font-medium mb-2">Select Token</label>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
              {tokenOptions.map((token, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedToken(token)}
                  disabled={parseFloat(token.balance) <= 0}
                  className={`w-full p-4 rounded-lg border-2 transition-all ${
                    selectedToken?.currency === token.currency && selectedToken?.issuer === token.issuer
                      ? 'border-purple-500 bg-purple-800/50'
                      : 'border-purple-500/20 bg-purple-800/20 hover:border-purple-500/40'
                  } ${parseFloat(token.balance) <= 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-left">
                      <div className="text-purple-200 font-bold flex items-center gap-2">
                        {token.currency === 'XRP' && <span className="text-xl">💎</span>}
                        {token.currency}
                      </div>
                      {token.currency !== 'XRP' && (
                        <div className="text-purple-400 text-xs mt-1 truncate max-w-xs">
                          Issuer: {token.issuer.slice(0, 12)}...
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-green-400 font-bold">{parseFloat(token.balance).toFixed(4)}</div>
                      <div className="text-purple-400 text-xs">Available</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {selectedToken && (
            <div>
              <label className="block text-purple-200 font-medium mb-2">Amount</label>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  max={selectedToken.balance}
                  className="w-full bg-purple-800/30 text-purple-100 px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 border border-purple-500/30 pr-20"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-300 font-medium">
                  {selectedToken.currency}
                </div>
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="text-purple-400 text-sm">
                  Available: {parseFloat(selectedToken.balance).toFixed(4)} {selectedToken.currency}
                </div>
                <button
                  onClick={() => setAmount(selectedToken.balance)}
                  className="text-purple-300 hover:text-purple-200 text-sm font-medium transition-colors"
                >
                  Max
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 bg-slate-700/50 hover:bg-slate-700/70 text-white py-3 rounded-lg font-medium transition-all"
            >
              Cancel
            </button>
            <button
              onClick={sendTip}
              disabled={!selectedToken || !amount || parseFloat(amount) <= 0 || isSending}
              className="flex-1 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white py-3 rounded-lg font-bold transition-all"
            >
              {isSending ? 'Sending...' : `Send ${amount || '0'} ${selectedToken?.currency || ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
