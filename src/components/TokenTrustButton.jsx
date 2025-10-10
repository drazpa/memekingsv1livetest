import React, { useState, useEffect } from 'react';
import { Wallet as XrplWallet, Client } from 'xrpl';
import toast from 'react-hot-toast';
import { logActivity, ACTION_TYPES } from '../utils/activityLogger';

export function TokenTrustButton({
  token,
  connectedWallet,
  tokenBalance = 0,
  onTrustlineUpdate,
  className = '',
  size = 'md'
}) {
  const [loading, setLoading] = useState(false);
  const [hasTrustline, setHasTrustline] = useState(false);
  const [checkingTrustline, setCheckingTrustline] = useState(true);

  useEffect(() => {
    if (connectedWallet && token) {
      checkTrustlineStatus();
    }
  }, [connectedWallet, token]);

  const checkTrustlineStatus = async () => {
    if (!connectedWallet || !token) return;

    setCheckingTrustline(true);
    try {
      const client = new Client(
        connectedWallet.network === 'mainnet'
          ? 'wss://xrplcluster.com'
          : 'wss://s.altnet.rippletest.net:51233'
      );

      await client.connect();

      try {
        const response = await client.request({
          command: 'account_lines',
          account: connectedWallet.address,
          ledger_index: 'validated'
        });

        const trustlines = response.result.lines || [];
        const exists = trustlines.some(
          line => line.currency === token.currency_hex &&
                  line.account === token.issuer_address
        );

        setHasTrustline(exists);
      } finally {
        await client.disconnect();
      }
    } catch (error) {
      console.error('Error checking trustline:', error);
    } finally {
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

    setLoading(true);
    try {
      const client = new Client(
        connectedWallet.network === 'mainnet'
          ? 'wss://xrplcluster.com'
          : 'wss://s.altnet.rippletest.net:51233'
      );

      await client.connect();

      try {
        const xrplWallet = XrplWallet.fromSeed(connectedWallet.seed);

        const trustSetTx = {
          TransactionType: 'TrustSet',
          Account: xrplWallet.address,
          LimitAmount: {
            currency: token.currency_hex,
            issuer: token.issuer_address,
            value: '1000000000'
          }
        };

        const prepared = await client.autofill(trustSetTx);
        const signed = xrplWallet.sign(prepared);
        const result = await client.submitAndWait(signed.tx_blob);

        if (result.result.meta.TransactionResult === 'tesSUCCESS') {
          toast.success(`Trustline set for ${token.name}!`);
          setHasTrustline(true);

          await logActivity({
            type: ACTION_TYPES.TRUSTLINE_CREATED,
            walletAddress: connectedWallet.address,
            details: {
              token: token.name,
              symbol: token.symbol,
              issuer: token.issuer_address,
              currency: token.currency_hex
            }
          });

          if (onTrustlineUpdate) {
            onTrustlineUpdate();
          }
        } else {
          toast.error(`Failed to set trustline: ${result.result.meta.TransactionResult}`);
        }
      } finally {
        await client.disconnect();
      }
    } catch (error) {
      console.error('Error setting up trustline:', error);
      toast.error('Failed to set up trustline. Please try again.');
    } finally {
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

    setLoading(true);
    try {
      const client = new Client(
        connectedWallet.network === 'mainnet'
          ? 'wss://xrplcluster.com'
          : 'wss://s.altnet.rippletest.net:51233'
      );

      await client.connect();

      try {
        const xrplWallet = XrplWallet.fromSeed(connectedWallet.seed);

        const trustSetTx = {
          TransactionType: 'TrustSet',
          Account: xrplWallet.address,
          LimitAmount: {
            currency: token.currency_hex,
            issuer: token.issuer_address,
            value: '0'
          }
        };

        const prepared = await client.autofill(trustSetTx);
        const signed = xrplWallet.sign(prepared);
        const result = await client.submitAndWait(signed.tx_blob);

        if (result.result.meta.TransactionResult === 'tesSUCCESS') {
          toast.success(`Trustline removed for ${token.name}!`);
          setHasTrustline(false);

          await logActivity({
            type: ACTION_TYPES.TRUSTLINE_REMOVED,
            walletAddress: connectedWallet.address,
            details: {
              token: token.name,
              symbol: token.symbol,
              issuer: token.issuer_address,
              currency: token.currency_hex
            }
          });

          if (onTrustlineUpdate) {
            onTrustlineUpdate();
          }
        } else {
          toast.error(`Failed to remove trustline: ${result.result.meta.TransactionResult}`);
        }
      } finally {
        await client.disconnect();
      }
    } catch (error) {
      console.error('Error removing trustline:', error);
      toast.error('Failed to remove trustline. Please try again.');
    } finally {
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
