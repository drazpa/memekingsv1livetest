import React, { useState, useEffect } from 'react';
import { Client, xrpToDrops, dropsToXrp } from 'xrpl';
import toast from 'react-hot-toast';
import { getCurrencyInfo } from '../utils/currencyUtils';

// Add known issuers and AMM accounts
const KNOWN_ISSUERS = {
  'MINT': 'rwCsCz93A1svS6Yv8hFqUeKLdTLhBpvqGD', // MINT token issuer
  'RLUSD': 'rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV', // RLUSD issuer
  'USD': 'rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq', // Gatehub USD issuer
  'EUR': 'rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq', // Gatehub EUR issuer
};

// Add known AMM accounts
const AMM_ACCOUNTS = {
  'MINT/XRP': 'rJVUeRqDFNsrcSY7zMX8vBERZp7P971cqw' // MINT/XRP AMM account
};

// Common tokens for easy selection
const COMMON_TOKENS = [
  { currency: 'XRP', name: 'XRP' },
  { currency: 'MINT', name: 'MINT Token', issuer: KNOWN_ISSUERS.MINT },
  { currency: 'USD', name: 'USD', issuer: KNOWN_ISSUERS.USD },
  { currency: 'EUR', name: 'EUR', issuer: KNOWN_ISSUERS.EUR },
];

export function AssetSwap({ wallet, network }) {
  const [fromAsset, setFromAsset] = useState({ currency: 'XRP', value: '', issuer: '' });
  const [toAsset, setToAsset] = useState({ currency: 'MINT', value: '', issuer: KNOWN_ISSUERS.MINT });
  const [loading, setLoading] = useState(false);
  const [ammInfo, setAmmInfo] = useState(null);
  const [estimatedOutput, setEstimatedOutput] = useState(null);
  const [priceImpact, setPriceImpact] = useState(null);
  const [slippage, setSlippage] = useState(0.5);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (fromAsset.value && toAsset.currency) {
      fetchAmmInfo();
    }
  }, [fromAsset.value, toAsset.currency, fromAsset.currency, toAsset.value]);

  const fetchAmmInfo = async () => {
    try {
      setLoading(true);
      setError(null);
      setAmmInfo(null);
      setEstimatedOutput(null);
      setPriceImpact(null);

      const client = new Client(
        network === 'mainnet' 
          ? "wss://xrplcluster.com" 
          : "wss://s.altnet.rippletest.net:51233"
      );
      await client.connect();

      // Get the AMM account for the pair
      const pairKey = `${fromAsset.currency}/${toAsset.currency}`;
      const ammAccount = AMM_ACCOUNTS[pairKey] || AMM_ACCOUNTS[`${toAsset.currency}/${fromAsset.currency}`];

      if (!ammAccount) {
        throw new Error('No AMM available for this pair');
      }

      // Get AMM info
      const ammInfoRequest = {
        command: "account_info",
        account: ammAccount,
        ledger_index: "validated"
      };

      const ammResponse = await client.request(ammInfoRequest);
      
      if (ammResponse.result.account_data) {
        // Get the AMM's current liquidity
        const lpTokenRequest = {
          command: "account_lines",
          account: ammAccount,
          ledger_index: "validated"
        };

        const lpResponse = await client.request(lpTokenRequest);
        
        // Calculate estimated output using AMM formula
        const inputAmount = parseFloat(fromAsset.value);
        const pool1 = parseFloat(lpResponse.result.lines[0].balance);
        const pool2 = parseFloat(lpResponse.result.lines[1].balance);

        // Using constant product formula: x * y = k
        const k = pool1 * pool2;
        const newPool1 = pool1 + inputAmount;
        const newPool2 = k / newPool1;
        const output = pool2 - newPool2;
        
        // Calculate price impact
        const impact = ((pool2 / pool1 - newPool2 / newPool1) / (pool2 / pool1)) * 100;
        
        setEstimatedOutput(output);
        setPriceImpact(impact);
        setAmmInfo({
          account: ammAccount,
          pool1: pool1,
          pool2: pool2,
          trading_fee: 0.003 // 0.3% fee
        });
        
        // Update toAsset value
        setToAsset(prev => ({
          ...prev,
          value: output.toFixed(6)
        }));
      } else {
        throw new Error('AMM account not found');
      }

      await client.disconnect();
    } catch (error) {
      console.error('Error fetching AMM info:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const executeSwap = async () => {
    if (!wallet || !ammInfo || !estimatedOutput) {
      toast.error('Please wait for AMM information');
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

      const minOutput = estimatedOutput * (1 - slippage / 100);
      
      // Create the swap transaction
      const tx = {
        TransactionType: "Payment",
        Account: wallet.address,
        Destination: ammInfo.account,
        Amount: fromAsset.currency === 'XRP'
          ? xrpToDrops(fromAsset.value)
          : {
              currency: fromAsset.currency,
              issuer: KNOWN_ISSUERS[fromAsset.currency],
              value: fromAsset.value
            },
        SendMax: fromAsset.currency === 'XRP'
          ? xrpToDrops((parseFloat(fromAsset.value) * (1 + slippage / 100)).toString())
          : {
              currency: fromAsset.currency,
              issuer: KNOWN_ISSUERS[fromAsset.currency],
              value: (parseFloat(fromAsset.value) * (1 + slippage / 100)).toString()
            }
      };

      const prepared = await client.autofill(tx);
      const signed = wallet.sign(prepared);
      const result = await client.submitAndWait(signed.tx_blob);

      if (result.result.meta.TransactionResult === "tesSUCCESS") {
        toast.success('Swap executed successfully!');
        setFromAsset({ currency: 'XRP', value: '', issuer: '' });
        setToAsset({ currency: 'MINT', value: '', issuer: KNOWN_ISSUERS.MINT });
        setAmmInfo(null);
        setEstimatedOutput(null);
        setPriceImpact(null);
      } else {
        throw new Error(result.result.meta.TransactionResult);
      }

      await client.disconnect();
    } catch (error) {
      toast.error('Error executing swap: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">Asset Swap</h2>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-red-700">{error}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg font-semibold mb-4">Swap Assets</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">From Asset</label>
              <div className="mt-1">
                <div className="grid grid-cols-2 gap-2 mb-2">
                  {COMMON_TOKENS.map(token => (
                    <button
                      key={`from-${token.currency}`}
                      onClick={() => setFromAsset({
                        currency: token.currency,
                        value: fromAsset.value,
                        issuer: token.issuer || ''
                      })}
                      className={`px-3 py-2 rounded-md text-sm ${
                        fromAsset.currency === token.currency
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {token.name}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  value={fromAsset.value}
                  onChange={(e) => setFromAsset({ ...fromAsset, value: e.target.value })}
                  className="w-full rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="flex justify-center">
              <button
                onClick={() => {
                  const temp = fromAsset;
                  setFromAsset(toAsset);
                  setToAsset(temp);
                }}
                className="p-2 rounded-full hover:bg-gray-100"
              >
                <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">To Asset</label>
              <div className="mt-1">
                <div className="grid grid-cols-2 gap-2 mb-2">
                  {COMMON_TOKENS.map(token => (
                    <button
                      key={`to-${token.currency}`}
                      onClick={() => setToAsset({
                        currency: token.currency,
                        value: toAsset.value,
                        issuer: token.issuer || ''
                      })}
                      className={`px-3 py-2 rounded-md text-sm ${
                        toAsset.currency === token.currency
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {token.name}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  value={toAsset.value}
                  className="w-full rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  placeholder="0.00"
                  readOnly
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Slippage Tolerance</label>
              <select
                value={slippage}
                onChange={(e) => setSlippage(parseFloat(e.target.value))}
                className="mt-1 block w-full rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="0.1">0.1%</option>
                <option value="0.5">0.5%</option>
                <option value="1.0">1.0%</option>
                <option value="3.0">3.0%</option>
              </select>
            </div>

            {ammInfo && (
              <div className="p-4 bg-gray-50 rounded-md space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Rate:</span>
                  <span className="font-medium">
                    1 {fromAsset.currency} = {(estimatedOutput / parseFloat(fromAsset.value)).toFixed(6)} {toAsset.currency}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Price Impact:</span>
                  <span className={`font-medium ${
                    priceImpact > 5 ? 'text-red-500' : 'text-gray-900'
                  }`}>
                    {priceImpact.toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Trading Fee:</span>
                  <span className="font-medium">0.3%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Minimum Received:</span>
                  <span className="font-medium">
                    {(estimatedOutput * (1 - slippage / 100)).toFixed(6)} {toAsset.currency}
                  </span>
                </div>
              </div>
            )}
            
            <button
              onClick={executeSwap}
              disabled={loading || !estimatedOutput || !fromAsset.value}
              className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? 'Swapping...' : 'Swap Assets'}
            </button>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4">Pool Information</h3>
          {ammInfo ? (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-md">
                <h4 className="font-medium mb-2">Liquidity Pools</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">{fromAsset.currency} Pool:</span>
                    <span className="font-medium">{ammInfo.pool1.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">{toAsset.currency} Pool:</span>
                    <span className="font-medium">{ammInfo.pool2.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-blue-50 rounded-md">
                <h4 className="font-medium mb-2 text-blue-900">Trading Info</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-blue-700">AMM Address:</span>
                    <span className="font-medium text-blue-900">{ammInfo.account.substring(0, 8)}...</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">Trading Fee:</span>
                    <span className="font-medium text-blue-900">0.3%</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
                  <span className="ml-2">Loading pool information...</span>
                </div>
              ) : error ? (
                <p>Unable to load pool information</p>
              ) : (
                <p>Enter an amount to see pool information</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}