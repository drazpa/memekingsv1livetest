import { useState } from 'react';
import * as xrpl from 'xrpl';
import toast from 'react-hot-toast';
import TokenIcon from './TokenIcon';
import { logActivity, ACTION_TYPES } from '../utils/activityLogger';

const SEND_FEE = 0.01;

export default function SendTokenModal({ token, balance, wallet, onClose, onSuccess }) {
  const [recipientAddress, setRecipientAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!recipientAddress || !amount) {
      toast.error('Please fill in all fields');
      return;
    }

    if (parseFloat(amount) <= 0) {
      toast.error('Amount must be greater than 0');
      return;
    }

    if (parseFloat(amount) > parseFloat(balance)) {
      toast.error('Insufficient balance');
      return;
    }

    if (!xrpl.isValidClassicAddress(recipientAddress)) {
      toast.error('Invalid recipient address');
      return;
    }

    setSending(true);
    try {
      const client = new xrpl.Client('wss://s.altnet.rippletest.net:51233');
      await client.connect();

      const walletObj = xrpl.Wallet.fromSeed(wallet.seed);

      const payment = {
        TransactionType: 'Payment',
        Account: wallet.address,
        Destination: recipientAddress,
        Amount: {
          currency: token.currency_code,
          value: amount,
          issuer: token.issuer_address
        }
      };

      const prepared = await client.autofill(payment);
      const signed = walletObj.sign(prepared);
      const result = await client.submitAndWait(signed.tx_blob);

      if (result.result.meta.TransactionResult === 'tesSUCCESS') {
        await logActivity({
          userAddress: wallet.address,
          actionType: ACTION_TYPES.TOKEN_SENT,
          description: `Sent ${amount} ${token.token_name} to ${recipientAddress.slice(0, 8)}...`,
          details: {
            amount,
            token_name: token.token_name,
            from: wallet.address,
            to: recipientAddress
          },
          txHash: result.result.hash,
          tokenId: token.id
        });

        toast.success(`Sent ${amount} ${token.token_name} successfully! Fee: ${SEND_FEE} XRP`);
        await client.disconnect();
        onSuccess();
        onClose();
      } else {
        throw new Error('Transaction failed: ' + result.result.meta.TransactionResult);
      }
    } catch (error) {
      console.error('Send error:', error);
      toast.error('Failed to send tokens: ' + error.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="glass rounded-lg max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-purple-200">Send {token.token_name}</h3>
          <button
            onClick={onClose}
            className="text-purple-400 hover:text-purple-300 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="flex items-center gap-4 mb-6 p-4 glass rounded-lg">
          <TokenIcon token={token} size="lg" />
          <div>
            <div className="text-purple-200 font-bold">{token.token_name}</div>
            <div className="text-purple-400 text-sm">Available: {parseFloat(balance).toFixed(4)}</div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-purple-300 mb-2">Recipient Address</label>
            <input
              type="text"
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              placeholder="rXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
              className="input w-full text-purple-200 font-mono text-sm"
            />
            <div className="text-purple-400 text-xs mt-1">
              Enter the XRPL address to send to
            </div>
          </div>

          <div>
            <label className="block text-purple-300 mb-2">Amount</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              step="0.0001"
              className="input w-full text-purple-200 text-lg"
            />
            <div className="flex justify-between text-xs mt-1">
              <span className="text-purple-400">Min: 0.0001</span>
              <button
                onClick={() => setAmount(balance)}
                className="text-purple-400 hover:text-purple-300"
              >
                Max: {parseFloat(balance).toFixed(4)}
              </button>
            </div>
          </div>

          <div className="glass rounded-lg p-4 bg-blue-500/10 border border-blue-500/30">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-blue-300">Network Fee</span>
              <span className="text-blue-200 font-bold">{SEND_FEE} XRP</span>
            </div>
            <div className="text-blue-400 text-xs">
              Platform fee for processing the transaction
            </div>
          </div>

          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <div className="text-yellow-200 font-medium mb-1">⚠️ Important</div>
            <p className="text-yellow-300 text-xs">
              Double-check the recipient address. Transactions cannot be reversed once confirmed.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSend}
              disabled={sending || !recipientAddress || !amount}
              className="flex-1 btn-primary text-white py-3 rounded-lg font-medium disabled:opacity-50"
            >
              {sending ? '⏳ Sending...' : `📤 Send ${amount || '0'} ${token.token_name}`}
            </button>
            <button
              onClick={onClose}
              disabled={sending}
              className="btn text-purple-300 px-6 py-3 rounded-lg font-medium disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
