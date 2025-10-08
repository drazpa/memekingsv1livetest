import React, { useState, useEffect } from 'react';
import { Client, xrpToDrops } from 'xrpl';
import toast from 'react-hot-toast';
import { getCurrencyInfo } from '../utils/currencyUtils';
import { XRPScanLink } from './XRPScanLink';
import { Html5QrcodeScanner } from 'html5-qrcode';

export function SendXRP({ loading, sendTransaction, wallet, network, selectedToken }) {
  const [destinationAddress, setDestinationAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [availableBalance, setAvailableBalance] = useState(0);
  const [reserveAmount] = useState(2); // Base reserve is 2 XRP
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressSteps, setProgressSteps] = useState([]);
  const [transactionHash, setTransactionHash] = useState(null);
  const [transactionComplete, setTransactionComplete] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scanner, setScanner] = useState(null);

  useEffect(() => {
    if (showScanner) {
      const qrScanner = new Html5QrcodeScanner(
        "qr-reader",
        { 
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          rememberLastUsedCamera: true,
          showTorchButtonIfSupported: true
        }
      );

      qrScanner.render(handleScan, handleError);
      setScanner(qrScanner);
    }

    return () => {
      if (scanner) {
        scanner.clear();
        setScanner(null);
      }
    };
  }, [showScanner]);

  const handleScan = (decodedText) => {
    try {
      // Check if it's a valid XRPL address
      if (decodedText.startsWith('r') && decodedText.length >= 25 && decodedText.length <= 35) {
        setDestinationAddress(decodedText);
        setShowScanner(false);
        toast.success('Address scanned successfully');
      } else {
        toast.error('Invalid XRPL address format');
      }
    } catch (error) {
      console.error('QR scan error:', error);
      toast.error('Error scanning QR code');
    }
  };

  const handleError = (error) => {
    // Only log critical errors, ignore common scanning errors
    if (!error.message.includes('No MultiFormat Readers') && 
        !error.message.includes('No barcode or QR code detected')) {
      console.error('QR Scanner error:', error);
    }
  };

  // Fetch account info and calculate available balance
  useEffect(() => {
    const fetchAccountInfo = async () => {
      if (!wallet) return;

      try {
        const client = new Client(
          network === 'mainnet' 
            ? "wss://xrplcluster.com" 
            : "wss://s.altnet.rippletest.net:51233"
        );
        await client.connect();

        if (selectedToken && selectedToken.currency !== 'XRP') {
          setAvailableBalance(parseFloat(selectedToken.balance || '0'));
        } else {
          const accountInfo = await client.request({
            command: 'account_info',
            account: wallet.address,
            ledger_index: 'validated'
          });

          const balance = parseInt(accountInfo.result.account_data.Balance) / 1000000;
          const totalReserve = reserveAmount;
          setAvailableBalance(balance - totalReserve);
        }

        await client.disconnect();
      } catch (error) {
        console.error('Error fetching account info:', error);
      }
    };

    fetchAccountInfo();
  }, [wallet, network, reserveAmount, selectedToken]);

  const handleSend = async () => {
    if (!destinationAddress || !amount) {
      toast.error('Please fill in all fields');
      return;
    }

    const sendAmount = parseFloat(amount);
    if (isNaN(sendAmount) || sendAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (selectedToken && selectedToken.currency !== 'XRP') {
      if (sendAmount > parseFloat(selectedToken.balance || '0')) {
        toast.error(`Insufficient ${selectedToken.currency} balance`);
        return;
      }
    } else {
      const totalNeeded = sendAmount + 0.000012;
      if (totalNeeded > availableBalance) {
        toast.error(`Insufficient balance. Available: ${availableBalance.toFixed(6)} XRP (excluding ${reserveAmount} XRP reserve)`);
        return;
      }
    }

    try {
      setTransactionComplete(false);
      setShowProgressModal(true);
      setProgressSteps([
        { message: 'Connecting to XRPL...', status: 'pending' }
      ]);

      const client = new Client(
        network === 'mainnet' 
          ? "wss://xrplcluster.com" 
          : "wss://s.altnet.rippletest.net:51233"
      );
      await client.connect();

      setProgressSteps(prev => [
        { message: 'Connected to XRPL', status: 'complete' },
        { message: 'Preparing transaction...', status: 'pending' }
      ]);

      const tx = {
        TransactionType: "Payment",
        Account: wallet.address,
        Destination: destinationAddress,
        Amount: selectedToken && selectedToken.currency !== 'XRP'
          ? {
              currency: selectedToken.currency,
              issuer: selectedToken.issuer,
              value: amount.toString()
            }
          : xrpToDrops(amount)
      };

      const prepared = await client.autofill(tx);
      const signed = wallet.sign(prepared);

      setProgressSteps(prev => [
        ...prev.slice(0, -1),
        { message: 'Transaction prepared', status: 'complete' },
        { message: 'Submitting transaction...', status: 'pending' }
      ]);

      const result = await client.submitAndWait(signed.tx_blob);

      if (result.result.meta.TransactionResult === "tesSUCCESS") {
        // Log the transaction
        const activityLog = JSON.parse(localStorage.getItem('xrpl_activity') || '[]');
        const newActivity = {
          id: Date.now(),
          type: 'PAYMENT_SENT',
          timestamp: new Date().toISOString(),
          message: `Sent ${amount} ${selectedToken ? selectedToken.currency : 'XRP'} to ${destinationAddress}`,
          hash: result.result.hash,
          amount: amount,
          currency: selectedToken ? selectedToken.currency : 'XRP',
          destination: destinationAddress
        };
        
        localStorage.setItem('xrpl_activity', JSON.stringify([newActivity, ...activityLog]));
        
        setTransactionHash(result.result.hash);
        setTransactionComplete(true);
        setProgressSteps(prev => [
          ...prev.slice(0, -1),
          { message: 'Transaction complete', status: 'complete' },
          { 
            message: (
              <div className="flex flex-col gap-2">
                <span>Transaction successful!</span>
                <XRPScanLink 
                  type="tx" 
                  value={result.result.hash} 
                  network={network}
                  className="text-green-400 hover:text-green-300" 
                />
              </div>
            ), 
            status: 'complete' 
          }
        ]);

        toast.success('Transaction completed successfully!');
        setDestinationAddress('');
        setAmount('');
      } else {
        throw new Error(result.result.meta.TransactionResult);
      }

      await client.disconnect();
    } catch (error) {
      setProgressSteps(prev => [
        ...prev,
        { message: 'Error: ' + error.message, status: 'error' }
      ]);
      toast.error('Error sending transaction: ' + error.message);
    }
  };

  const handleCloseModal = () => {
    setShowProgressModal(false);
    setProgressSteps([]);
    setTransactionHash(null);
    setTransactionComplete(false);
  };

  const assetInfo = selectedToken && selectedToken.currency !== 'XRP'
    ? getCurrencyInfo(selectedToken.currencyHex || selectedToken.currency, selectedToken.issuer)
    : {
        name: 'XRP',
        icon: (
          <svg className="w-4 h-4 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        description: 'Native Token',
        balance: availableBalance.toString()
      };

  return (
    <div className="bg-gray-900/90 rounded-lg p-6">
      <div className="space-y-6">
        {/* Asset Type */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Asset Type</label>
          <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-green-600/20 flex items-center justify-center">
                {typeof assetInfo.icon === 'string' ? (
                  <span className="text-green-500 font-bold">{assetInfo.icon}</span>
                ) : (
                  assetInfo.icon
                )}
              </div>
              <div>
                <span className="text-white font-medium">{assetInfo.name}</span>
                <p className="text-sm text-gray-400">{assetInfo.description}</p>
              </div>
            </div>
          </div>
          <p className="mt-2 text-sm text-gray-400">
            Available: {parseFloat(assetInfo.balance).toFixed(6)} {assetInfo.name}
            {!selectedToken && ` (${reserveAmount} XRP reserved)`}
          </p>
        </div>

        {/* Destination Address */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Destination Address</label>
          <div className="relative">
            <input
              type="text"
              value={destinationAddress}
              onChange={(e) => setDestinationAddress(e.target.value)}
              className="w-full bg-gray-800/50 border border-gray-700/50 text-white rounded-lg pl-4 pr-12 py-3 focus:border-green-500/50 focus:ring-1 focus:ring-green-500/20"
              placeholder="Enter destination address"
            />
            <button
              onClick={() => setShowScanner(true)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-700/50 rounded-md transition-all duration-200"
              title="Scan QR Code"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0 0h4m-4-8h4m-4 4h4m6-4v1m-4-1v1m-4-1v1m-4-1v1m2-4h12a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2v-8a2 2 0 012-2h2m4 0h2" />
              </svg>
            </button>
          </div>
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Amount</label>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-gray-800/50 border border-gray-700/50 text-white rounded-lg px-4 py-3 pr-16 focus:border-green-500/50 focus:ring-1 focus:ring-green-500/20"
              placeholder="0.00"
              step="any"
              min="0"
              max={availableBalance}
            />
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
              <span className="text-gray-400">{assetInfo.name}</span>
            </div>
          </div>
          {!selectedToken && (
            <p className="mt-2 text-sm text-gray-400">
              Transaction fee: 0.000012 XRP
            </p>
          )}
        </div>

        <button
          onClick={handleSend}
          disabled={loading || !destinationAddress || !amount}
          className="w-full bg-green-600 text-white py-4 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Processing...' : `Send ${assetInfo.name}`}
        </button>
      </div>

      {/* QR Code Scanner Modal */}
      {showScanner && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-900/90 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-700/50">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white">Scan QR Code</h3>
              <button
                onClick={() => setShowScanner(false)}
                className="text-gray-400 hover:text-gray-300 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="mb-4">
              <div id="qr-reader"></div>
              <p className="text-sm text-gray-400 text-center mt-2">
                Position the QR code within the frame to scan
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Progress Modal */}
      {showProgressModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-900/90 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-700/50">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white">Transaction Progress</h3>
              {transactionComplete && (
                <button
                  onClick={() => setShowProgressModal(false)}
                  className="text-gray-400 hover:text-gray-300 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <div className="space-y-4">
              {progressSteps.map((step, index) => (
                <div key={index} className="flex items-center gap-3">
                  {step.status === 'pending' && (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-green-500 border-t-transparent" />
                  )}
                  {step.status === 'complete' && (
                    <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {step.status === 'error' && (
                    <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                  <span className={`text-gray-300 ${
                    step.status === 'complete' ? 'text-green-400' : ''
                  }`}>
                    {step.message}
                  </span>
                </div>
              ))}
            </div>
            {transactionComplete && (
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowProgressModal(false)}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}