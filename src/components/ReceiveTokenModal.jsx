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
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl shadow-2xl max-w-md w-full border border-slate-700">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">Receive Coins</h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white text-2xl"
            >
              ×
            </button>
          </div>

          <div className="mb-6 text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <TokenIcon token={token} size="lg" />
              <div>
                <h3 className="text-xl font-bold text-white">{token.token_name}</h3>
                <p className="text-sm text-slate-400">{token.currency_code}</p>
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
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Your Wallet Address
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={wallet.address}
                readOnly
                className="flex-1 px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white font-mono text-sm"
              />
              <button
                onClick={copyToClipboard}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  copied
                    ? 'bg-green-500 text-white'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
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
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-lg transition-all"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
