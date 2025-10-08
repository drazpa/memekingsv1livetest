import React, { useState } from 'react';
import { Client } from 'xrpl';
import toast from 'react-hot-toast';

export function CreateToken({ wallet, network }) {
  const [loading, setLoading] = useState(false);
  const [tokenData, setTokenData] = useState({
    currency: '',
    value: '',
    flags: {
      rippling: false,
      requireAuth: true,
      freezeEnabled: true,
      transferFeeEnabled: false
    },
    transferFee: 0
  });

  const createToken = async () => {
    if (!wallet) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (!tokenData.currency || !tokenData.value) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      const client = new Client(
        network === 'mainnet' 
          ? "wss://xrplcluster.com" 
          : "wss://s.altnet.rippletest.net:51233"
      );
      await client.connect();

      // Calculate flags
      let flags = 0;
      if (tokenData.flags.rippling) flags |= 0x00000001;
      if (tokenData.flags.requireAuth) flags |= 0x00000002;
      if (tokenData.flags.freezeEnabled) flags |= 0x00000004;
      if (tokenData.flags.transferFeeEnabled) flags |= 0x00000008;

      // Create trustline to self with limit
      const tx = {
        TransactionType: "TrustSet",
        Account: wallet.address,
        LimitAmount: {
          currency: tokenData.currency,
          issuer: wallet.address,
          value: tokenData.value
        },
        Flags: flags,
        TransferRate: tokenData.flags.transferFeeEnabled 
          ? Math.floor(1000 + (tokenData.transferFee * 10)) 
          : 0
      };

      const prepared = await client.autofill(tx);
      const signed = wallet.sign(prepared);
      const result = await client.submitAndWait(signed.tx_blob);

      if (result.result.meta.TransactionResult === "tesSUCCESS") {
        toast.success('Token created successfully!');
        setTokenData({
          currency: '',
          value: '',
          flags: {
            rippling: false,
            requireAuth: true,
            freezeEnabled: true,
            transferFeeEnabled: false
          },
          transferFee: 0
        });
      } else {
        throw new Error(result.result.meta.TransactionResult);
      }

      await client.disconnect();
    } catch (error) {
      toast.error('Error creating token: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">Create Token</h2>
      
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">Currency Code</label>
          <input
            type="text"
            value={tokenData.currency}
            onChange={(e) => setTokenData({ ...tokenData, currency: e.target.value.toUpperCase() })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            placeholder="e.g., USD"
            maxLength={3}
          />
          <p className="mt-1 text-sm text-gray-500">
            3-character code for your token (e.g., USD, EUR, GBP)
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Total Supply</label>
          <input
            type="text"
            value={tokenData.value}
            onChange={(e) => setTokenData({ ...tokenData, value: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            placeholder="e.g., 1000000"
          />
          <p className="mt-1 text-sm text-gray-500">
            Maximum number of tokens that can be issued
          </p>
        </div>

        <div>
          <h3 className="text-lg font-medium mb-3">Token Settings</h3>
          <div className="space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="rippling"
                checked={tokenData.flags.rippling}
                onChange={(e) => setTokenData({
                  ...tokenData,
                  flags: { ...tokenData.flags, rippling: e.target.checked }
                })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="rippling" className="ml-2 block text-sm text-gray-900">
                Enable Rippling
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="requireAuth"
                checked={tokenData.flags.requireAuth}
                onChange={(e) => setTokenData({
                  ...tokenData,
                  flags: { ...tokenData.flags, requireAuth: e.target.checked }
                })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="requireAuth" className="ml-2 block text-sm text-gray-900">
                Require Authorization
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="freezeEnabled"
                checked={tokenData.flags.freezeEnabled}
                onChange={(e) => setTokenData({
                  ...tokenData,
                  flags: { ...tokenData.flags, freezeEnabled: e.target.checked }
                })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="freezeEnabled" className="ml-2 block text-sm text-gray-900">
                Enable Freeze
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="transferFeeEnabled"
                checked={tokenData.flags.transferFeeEnabled}
                onChange={(e) => setTokenData({
                  ...tokenData,
                  flags: { ...tokenData.flags, transferFeeEnabled: e.target.checked }
                })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="transferFeeEnabled" className="ml-2 block text-sm text-gray-900">
                Enable Transfer Fee
              </label>
            </div>

            {tokenData.flags.transferFeeEnabled && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Transfer Fee (%)</label>
                <input
                  type="number"
                  value={tokenData.transferFee}
                  onChange={(e) => setTokenData({ ...tokenData, transferFee: parseFloat(e.target.value) })}
                  min="0"
                  max="100"
                  step="0.1"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            )}
          </div>
        </div>

        <button
          onClick={createToken}
          disabled={loading || !tokenData.currency || !tokenData.value}
          className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Creating Token...' : 'Create Token'}
        </button>
      </div>
    </div>
  );
}