import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import TokenIcon from './TokenIcon';

export default function ReceiveTokenModal({ token, wallet, onClose }) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(wallet.address);
    setCopied(true);
    toast.success('Address copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="glass rounded-xl shadow-2xl max-w-md w-full border border-purple-500/30">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-purple-200">Receive Tokens</h2>
            <button
              onClick={onClose}
              className="text-purple-400 hover:text-purple-200 text-2xl"
            >
              ×
            </button>
          </div>

          <div className="mb-6 text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <TokenIcon token={token} size="lg" />
              <div>
                <h3 className="text-xl font-bold text-purple-200">{token.token_name}</h3>
                <p className="text-sm text-purple-400">{token.currency_code}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg mb-4 flex justify-center">
            <QRCodeSVG
              value={wallet.address}
              size={200}
              level="H"
              includeMargin={true}
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-purple-300 mb-2">
              Your Wallet Address
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={wallet.address}
                readOnly
                className="flex-1 px-4 py-2 bg-purple-900/30 border border-purple-500/30 rounded-lg text-purple-200 font-mono text-sm"
              />
              <button
                onClick={copyToClipboard}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  copied
                    ? 'bg-green-500 text-white'
                    : 'bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white'
                }`}
              >
                {copied ? '✓ Copied' : '📋 Copy'}
              </button>
            </div>
          </div>

          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-4">
            <p className="text-yellow-200 text-sm">
              <strong>Important:</strong> Make sure the sender has set up a trustline for this token before sending. Share your wallet address with them.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-bold py-3 rounded-lg transition-all"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
