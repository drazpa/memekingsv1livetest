import React, { useState, useEffect } from 'react';
import { Wallet as XrplWallet, Client } from 'xrpl';
import { Buffer } from 'buffer';
import toast from 'react-hot-toast';
import { logActivity, ACTION_TYPES } from '../utils/activityLogger';

export function TokenTrustButton({
  token,
  connectedWallet,
  tokenBalance = 0,
  onTrustlineUpdate,
  className = '',
  size = 'md',
  showDropdown = false
}) {
  const [loading, setLoading] = useState(false);
  const [hasTrustline, setHasTrustline] = useState(false);
  const [checkingTrustline, setCheckingTrustline] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const getCurrencyHex = (token) => {
    if (token.currency_hex) return token.currency_hex;
    if (token.currency_code) {
      return token.currency_code.length > 3
        ? Buffer.from(token.currency_code, 'utf8').toString('hex').toUpperCase().padEnd(40, '0')
        : token.currency_code;
    }
    return null;
  };

  const getIssuerAddress = (token) => {
    return token.issuer_address || token.issuer || null;
  };

  useEffect(() => {
    if (connectedWallet && token) {
      checkTrustlineStatus();
    } else {
      setCheckingTrustline(false);
    }
  }, [connectedWallet, token]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownOpen && !event.target.closest('.trust-dropdown')) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  const checkTrustlineStatus = async () => {
    if (!connectedWallet || !token) {
      setCheckingTrustline(false);
      return;
    }

    const currencyHex = getCurrencyHex(token);
    const issuerAddress = getIssuerAddress(token);

    if (!currencyHex || !issuerAddress) {
      console.error('Token missing required fields:', token);
      setCheckingTrustline(false);
      return;
    }

    setCheckingTrustline(true);
    let client = null;

    try {
      const wsUrl = connectedWallet.network === 'mainnet'
        ? 'wss://xrplcluster.com'
        : 'wss://s.altnet.rippletest.net:51233';

      client = new Client(wsUrl);

      await Promise.race([
        client.connect(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Connection timeout')), 10000)
        )
      ]);

      const response = await Promise.race([
        client.request({
          command: 'account_lines',
          account: connectedWallet.address,
          ledger_index: 'validated'
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), 10000)
        )
      ]);

      const trustlines = response.result.lines || [];
      const exists = trustlines.some(
        line => line.currency === currencyHex &&
                line.account === issuerAddress
      );

      setHasTrustline(exists);
    } catch (error) {
      console.error('Error checking trustline:', error);
      if (error.data?.error === 'actNotFound') {
        console.log('Wallet not activated on network');
      }
      setHasTrustline(false);
    } finally {
      try {
        if (client && client.isConnected()) {
          await client.disconnect();
        }
      } catch (disconnectError) {
        console.error('Error disconnecting client:', disconnectError);
      }
      setCheckingTrustline(false);
    }
  };

  const handleSetupTrustline = async () => {
    if (!connectedWallet) {
      toast.error('Please connect a wallet first');
      return;
    }

    if (!token) {
      toast.error('Token information not available');
      return;
    }

    const currencyHex = getCurrencyHex(token);
    const issuerAddress = getIssuerAddress(token);

    if (!currencyHex || !issuerAddress) {
      toast.error('Token missing required information (currency or issuer)');
      return;
    }

    if (!connectedWallet.seed) {
      toast.error('Wallet seed not available. Please reconnect your wallet.');
      return;
    }

    setLoading(true);
    let client = null;

    try {
      const wsUrl = connectedWallet.network === 'mainnet'
        ? 'wss://xrplcluster.com'
        : 'wss://s.altnet.rippletest.net:51233';

      client = new Client(wsUrl);

      await Promise.race([
        client.connect(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Connection timeout')), 15000)
        )
      ]);

      const checkResponse = await Promise.race([
        client.request({
          command: 'account_lines',
          account: connectedWallet.address,
          ledger_index: 'validated'
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), 10000)
        )
      ]);

      const existingTrustlines = checkResponse.result.lines || [];
      const trustlineExists = existingTrustlines.some(
        line => line.currency === currencyHex && line.account === issuerAddress
      );

      if (trustlineExists) {
        toast.success('You already have a trustline for this token!');
        setHasTrustline(true);
        setLoading(false);
        if (client && client.isConnected()) {
          await client.disconnect();
        }
        return;
      }

      const xrplWallet = XrplWallet.fromSeed(connectedWallet.seed);

      if (xrplWallet.address !== connectedWallet.address) {
        throw new Error('Wallet address mismatch. Please reconnect your wallet.');
      }

      const trustSetTx = {
        TransactionType: 'TrustSet',
        Account: xrplWallet.address,
        LimitAmount: {
          currency: currencyHex,
          issuer: issuerAddress,
          value: '1000000000'
        }
      };

      const prepared = await client.autofill(trustSetTx);
      const signed = xrplWallet.sign(prepared);

      const result = await Promise.race([
        client.submitAndWait(signed.tx_blob),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Transaction timeout')), 30000)
        )
      ]);

      if (result.result.meta.TransactionResult === 'tesSUCCESS') {
        toast.success(`Trustline set for ${token.name || token.symbol}!`);
        setHasTrustline(true);

        await logActivity({
          type: ACTION_TYPES.TRUSTLINE_CREATED,
          walletAddress: connectedWallet.address,
          details: {
            token: token.name || token.symbol,
            symbol: token.symbol,
            issuer: issuerAddress,
            currency: currencyHex
          }
        });

        if (onTrustlineUpdate) {
          onTrustlineUpdate();
        }
      } else {
        const errorCode = result.result.meta.TransactionResult;
        let errorMessage = 'Failed to set trustline';

        switch (errorCode) {
          case 'tecNO_DST_INSUF_XRP':
            errorMessage = 'Insufficient XRP balance. You need at least 10 XRP reserve.';
            break;
          case 'tecDST_TAG_NEEDED':
            errorMessage = 'Destination tag required.';
            break;
          case 'tecNO_LINE_INSUF_RESERVE':
            errorMessage = 'Insufficient reserve. You need more XRP in your wallet.';
            break;
          case 'tecUNFUNDED':
            errorMessage = 'Wallet is unfunded. Please add XRP to your wallet.';
            break;
          case 'tefPAST_SEQ':
            errorMessage = 'Transaction sequence error. Please try again.';
            break;
          case 'terRETRY':
            errorMessage = 'Network busy. Please retry in a moment.';
            break;
          default:
            errorMessage = `Failed: ${errorCode}`;
        }

        toast.error(errorMessage);
      }
    } catch (error) {
      console.error('Error setting up trustline:', error);

      let errorMessage = 'Failed to set up trustline';

      if (error.message.includes('timeout') || error.message.includes('Timeout')) {
        errorMessage = 'Connection timed out. The network may be slow. Please try again.';
      } else if (error.message.includes('Connection') || error.message.includes('connect')) {
        errorMessage = 'Unable to connect to the XRPL network. Please check your internet connection and try again.';
      } else if (error.message.includes('address mismatch')) {
        errorMessage = error.message;
      } else if (error.data?.error === 'actNotFound') {
        errorMessage = 'Your wallet is not activated on the network. Please send at least 2 XRP to your wallet first.';
      } else if (error.data?.error === 'amendmentBlocked') {
        errorMessage = 'This transaction type is blocked by the network. Please try again later.';
      } else if (error.data?.error_code === 19) {
        errorMessage = 'Insufficient XRP balance. You need at least 2 XRP plus reserve for trustlines.';
      } else if (error.name === 'RippledError') {
        errorMessage = `Network error: ${error.data?.error_message || 'Unknown error'}`;
      } else if (error.message) {
        errorMessage = `Error: ${error.message}`;
      }

      toast.error(errorMessage);
    } finally {
      try {
        if (client && client.isConnected()) {
          await client.disconnect();
        }
      } catch (disconnectError) {
        console.error('Error disconnecting client:', disconnectError);
      }
      setLoading(false);
    }
  };

  const handleRemoveTrustline = async () => {
    if (!connectedWallet) {
      toast.error('Please connect a wallet first');
      return;
    }

    if (tokenBalance > 0) {
      toast.error('Cannot remove trustline with non-zero balance. Balance must be 0.');
      return;
    }

    const currencyHex = getCurrencyHex(token);
    const issuerAddress = getIssuerAddress(token);

    if (!currencyHex || !issuerAddress) {
      toast.error('Token missing required information');
      return;
    }

    if (!connectedWallet.seed) {
      toast.error('Wallet seed not available. Please reconnect your wallet.');
      return;
    }

    setLoading(true);
    let client = null;

    try {
      await checkTrustlineStatus();

      if (!hasTrustline) {
        toast('No trustline exists for this token', { icon: 'ℹ️' });
        setLoading(false);
        return;
      }

      const wsUrl = connectedWallet.network === 'mainnet'
        ? 'wss://xrplcluster.com'
        : 'wss://s.altnet.rippletest.net:51233';

      client = new Client(wsUrl);

      await Promise.race([
        client.connect(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Connection timeout')), 15000)
        )
      ]);

      const xrplWallet = XrplWallet.fromSeed(connectedWallet.seed);

      if (xrplWallet.address !== connectedWallet.address) {
        throw new Error('Wallet address mismatch. Please reconnect your wallet.');
      }

      const trustSetTx = {
        TransactionType: 'TrustSet',
        Account: xrplWallet.address,
        LimitAmount: {
          currency: currencyHex,
          issuer: issuerAddress,
          value: '0'
        }
      };

      const prepared = await client.autofill(trustSetTx);
      const signed = xrplWallet.sign(prepared);

      const result = await Promise.race([
        client.submitAndWait(signed.tx_blob),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Transaction timeout')), 30000)
        )
      ]);

      if (result.result.meta.TransactionResult === 'tesSUCCESS') {
        toast.success(`Trustline removed for ${token.name || token.symbol}!`);
        setHasTrustline(false);

        await logActivity({
          type: ACTION_TYPES.TRUSTLINE_REMOVED,
          walletAddress: connectedWallet.address,
          details: {
            token: token.name || token.symbol,
            symbol: token.symbol,
            issuer: issuerAddress,
            currency: currencyHex
          }
        });

        if (onTrustlineUpdate) {
          onTrustlineUpdate();
        }
      } else {
        const errorCode = result.result.meta.TransactionResult;
        let errorMessage = 'Failed to remove trustline';

        switch (errorCode) {
          case 'tecNO_LINE':
            errorMessage = 'Trustline does not exist.';
            break;
          case 'tecHAS_OBLIGATIONS':
            errorMessage = 'Cannot remove trustline with obligations.';
            break;
          default:
            errorMessage = `Failed: ${errorCode}`;
        }

        toast.error(errorMessage);
      }
    } catch (error) {
      console.error('Error removing trustline:', error);

      let errorMessage = 'Failed to remove trustline';

      if (error.message.includes('timeout') || error.message.includes('Timeout')) {
        errorMessage = 'Connection timed out. The network may be slow. Please try again.';
      } else if (error.message.includes('Connection') || error.message.includes('connect')) {
        errorMessage = 'Unable to connect to the XRPL network. Please check your internet connection and try again.';
      } else if (error.message.includes('address mismatch')) {
        errorMessage = error.message;
      } else if (error.data?.error === 'actNotFound') {
        errorMessage = 'Your wallet is not activated on the network.';
      } else if (error.name === 'RippledError') {
        errorMessage = `Network error: ${error.data?.error_message || 'Unknown error'}`;
      } else if (error.message) {
        errorMessage = `Error: ${error.message}`;
      }

      toast.error(errorMessage);
    } finally {
      try {
        if (client && client.isConnected()) {
          await client.disconnect();
        }
      } catch (disconnectError) {
        console.error('Error disconnecting client:', disconnectError);
      }
      setLoading(false);
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'px-3 py-1.5 text-xs';
      case 'lg':
        return 'px-6 py-3 text-base';
      default:
        return 'px-4 py-2 text-sm';
    }
  };

  if (checkingTrustline) {
    return (
      <button
        disabled
        className={`bg-gray-700 text-gray-400 rounded-lg disabled:opacity-50 cursor-not-allowed ${getSizeClasses()} ${className}`}
      >
        <svg className="animate-spin h-4 w-4 inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </button>
    );
  }

  if (!connectedWallet) {
    return (
      <button
        disabled
        className={`bg-gray-700 text-gray-400 rounded-lg disabled:opacity-50 cursor-not-allowed ${getSizeClasses()} ${className}`}
      >
        Connect Wallet
      </button>
    );
  }

  if (!showDropdown) {
    if (hasTrustline) {
      if (tokenBalance > 0) {
        return (
          <button
            disabled
            className={`bg-gray-700 text-gray-400 rounded-lg disabled:opacity-50 cursor-not-allowed ${getSizeClasses()} ${className}`}
            title="Trustline active with balance"
          >
            ✓ Trusted
          </button>
        );
      }

      return (
        <button
          onClick={handleRemoveTrustline}
          disabled={loading}
          className={`bg-gradient-to-r from-red-600 to-red-500 text-white rounded-lg hover:from-red-500 hover:to-red-400 disabled:opacity-50 shadow-lg shadow-red-500/20 transition-all duration-300 ${getSizeClasses()} ${className}`}
          title="Remove trustline (balance is 0)"
        >
          {loading ? (
            <svg className="animate-spin h-4 w-4 inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            'Remove Trust'
          )}
        </button>
      );
    }

    return (
      <button
        onClick={handleSetupTrustline}
        disabled={loading}
        className={`bg-gradient-to-r from-green-600 to-green-500 text-white rounded-lg hover:from-green-500 hover:to-green-400 disabled:opacity-50 shadow-lg shadow-green-500/20 transition-all duration-300 ${getSizeClasses()} ${className}`}
      >
        {loading ? (
          <svg className="animate-spin h-4 w-4 inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : (
          'Trust'
        )}
      </button>
    );
  }

  return (
    <div className={`relative trust-dropdown ${className}`}>
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        disabled={loading || checkingTrustline}
        className={`bg-gradient-to-r from-green-600 to-green-500 text-white rounded-lg hover:from-green-500 hover:to-green-400 disabled:opacity-50 shadow-lg shadow-green-500/20 transition-all duration-300 flex items-center gap-2 ${getSizeClasses()}`}
      >
        {loading ? (
          <svg className="animate-spin h-4 w-4 inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : (
          <>
            <span>{hasTrustline ? '✓ Trusted' : 'Trust'}</span>
            <svg className={`w-4 h-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </>
        )}
      </button>

      {dropdownOpen && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden">
          <button
            onClick={() => {
              setDropdownOpen(false);
              handleSetupTrustline();
            }}
            disabled={loading || hasTrustline}
            className="w-full px-4 py-3 text-left hover:bg-slate-700 transition-colors flex items-center gap-3 border-b border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-8 h-8 rounded-lg bg-green-600/20 flex items-center justify-center text-green-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="text-white font-medium">Setup {token.symbol || token.name}</div>
              <div className="text-gray-400 text-xs">Add this token trustline</div>
            </div>
          </button>

          <button
            onClick={() => {
              setDropdownOpen(false);
              handleRemoveTrustline();
            }}
            disabled={loading || !hasTrustline || tokenBalance > 0}
            className="w-full px-4 py-3 text-left hover:bg-slate-700 transition-colors flex items-center gap-3 border-b border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-8 h-8 rounded-lg bg-red-600/20 flex items-center justify-center text-red-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="text-white font-medium">Remove {token.symbol || token.name}</div>
              <div className="text-gray-400 text-xs">
                {tokenBalance > 0 ? 'Balance must be 0' : 'Remove empty trustline'}
              </div>
            </div>
          </button>

          <a
            href={`https://xrpscan.com/account/${getIssuerAddress(token)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full px-4 py-3 text-left hover:bg-slate-700 transition-colors flex items-center gap-3"
            onClick={() => setDropdownOpen(false)}
          >
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 flex items-center justify-center text-blue-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="text-white font-medium">XRPScan Link</div>
              <div className="text-gray-400 text-xs">View issuer details</div>
            </div>
          </a>
        </div>
      )}
    </div>
  );
}
