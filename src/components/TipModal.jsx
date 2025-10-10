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
  const [showDropdown, setShowDropdown] = useState(false);

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
      setXrpBalance(available.toFixed(4));

      const response = await client.request({
        command: 'account_lines',
        account: connectedWallet.address,
        ledger_index: 'validated'
      });

      const assets = response.result.lines || [];
      setWalletAssets(assets);

      const xrpToken = { currency: 'XRP', balance: available, issuer: 'XRP' };
      setSelectedToken(xrpToken);

      await client.disconnect();
    } catch (error) {
      console.error('Error loading wallet assets:', error);
      toast.error('Failed to load wallet assets');
    }
  };

  const sendTip = async () => {
    if (!selectedToken || !amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
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
          Amount: String(Math.floor(parseFloat(amount) * 1000000)),
          Fee: '12'
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
          },
          Fee: '12'
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
              to_nickname: recipient.nickname,
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

  if (!isOpen || !recipient) return null;

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
      <div className="bg-gradient-to-br from-purple-900 to-slate-900 rounded-2xl p-8 max-w-md w-full border border-purple-500/30 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-white">Send Tip</h3>
          <button
            onClick={onClose}
            className="text-purple-400 hover:text-purple-200 transition-colors text-3xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="text-center mb-8 p-6 bg-purple-800/30 rounded-xl border border-purple-500/20">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-3xl mx-auto mb-4">
            {recipient.nickname.charAt(0).toUpperCase()}
          </div>
          <div className="text-white font-bold text-xl mb-2">{recipient.nickname}</div>
          <div className="text-purple-400 text-xs break-all font-mono">{recipient.wallet_address}</div>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-white font-bold mb-3">Select Token</label>
            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="w-full bg-purple-800/50 text-white px-4 py-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 border border-purple-500/30 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="text-2xl">💎</div>
                  <div className="text-left">
                    <div className="font-bold">{selectedToken?.currency || 'Select Token'}</div>
                    <div className="text-purple-300 text-sm">{selectedToken ? `${parseFloat(selectedToken.balance).toFixed(4)} Available` : ''}</div>
                  </div>
                </div>
                <svg className="w-5 h-5 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showDropdown && (
                <div className="absolute z-10 w-full mt-2 bg-slate-800 rounded-xl border border-purple-500/30 shadow-2xl max-h-64 overflow-y-auto">
                  {tokenOptions.map((token, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setSelectedToken(token);
                        setShowDropdown(false);
                      }}
                      disabled={parseFloat(token.balance) <= 0}
                      className={`w-full p-4 flex items-center justify-between hover:bg-purple-800/50 transition-all border-b border-purple-500/10 last:border-b-0 ${
                        parseFloat(token.balance) <= 0 ? 'opacity-50 cursor-not-allowed' : ''
                      } ${selectedToken?.currency === token.currency ? 'bg-purple-800/50' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">{token.currency === 'XRP' ? '💎' : '🪙'}</div>
                        <div className="text-left">
                          <div className="text-white font-bold">{token.currency}</div>
                          {token.currency !== 'XRP' && (
                            <div className="text-purple-400 text-xs truncate max-w-[200px]">
                              {token.issuer.slice(0, 12)}...
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-green-400 font-bold">{parseFloat(token.balance).toFixed(4)}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-white font-bold mb-3">Amount</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              step="0.01"
              min="0"
              max={selectedToken?.balance}
              className="w-full bg-purple-800/50 text-white text-2xl px-4 py-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 border border-purple-500/30 text-center font-bold"
            />
            {selectedToken && (
              <div className="text-purple-400 text-sm mt-2 text-center">
                Available: {parseFloat(selectedToken.balance).toFixed(4)} {selectedToken.currency}
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-8">
            <button
              onClick={onClose}
              className="flex-1 bg-slate-700/50 hover:bg-slate-700/70 text-white py-4 rounded-xl font-bold transition-all"
            >
              Cancel
            </button>
            <button
              onClick={sendTip}
              disabled={!selectedToken || !amount || parseFloat(amount) <= 0 || isSending}
              className="flex-1 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold transition-all"
            >
              {isSending ? 'Sending...' : `Send ${amount || '0'}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
