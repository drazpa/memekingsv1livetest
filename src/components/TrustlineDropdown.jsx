import React, { useState, useRef, useEffect } from 'react';
import { Buffer } from 'buffer';
import { Wallet as XrplWallet, Client } from 'xrpl';
import toast from 'react-hot-toast';
import { supabase } from '../utils/supabase';

export function TrustlineDropdown({
  wallet,
  network,
  onTrustlineUpdate,
  tokenBalances = []
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinAction, setPinAction] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMemeKingsSetup = async () => {
    if (!wallet) {
      toast.error('Please connect a wallet first');
      return;
    }

    setLoading(true);
    try {
      const client = new Client(
        network === 'mainnet'
          ? 'wss://xrplcluster.com'
          : 'wss://s.altnet.rippletest.net:51233'
      );

      await client.connect();

      try {
        const { data: tokens } = await supabase
          .from('meme_tokens')
          .select('currency_hex, issuer_address')
          .order('created_at', { ascending: true });

        if (!tokens || tokens.length === 0) {
          toast.error('No MEMEKINGS tokens found');
          return;
        }

        let successCount = 0;
        let errorCount = 0;

        for (const token of tokens) {
          try {
            const xrplWallet = XrplWallet.fromSeed(wallet.seed);

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
              successCount++;
            } else {
              errorCount++;
            }
          } catch (err) {
            console.error(`Error setting up trustline for ${token.currency_hex}:`, err);
            errorCount++;
          }
        }

        if (successCount > 0) {
          toast.success(`Successfully set up ${successCount} trustline(s)`);
          if (onTrustlineUpdate) onTrustlineUpdate();
        }
        if (errorCount > 0) {
          toast.error(`Failed to set up ${errorCount} trustline(s)`);
        }
      } finally {
        await client.disconnect();
      }
    } catch (error) {
      console.error('Error setting up MEMEKINGS trustlines:', error);
      toast.error('Failed to set up trustlines');
    } finally {
      setLoading(false);
      setIsOpen(false);
    }
  };

  const handleMemeKingsRemove = async () => {
    if (!wallet) {
      toast.error('Please connect a wallet first');
      return;
    }

    setLoading(true);
    try {
      const client = new Client(
        network === 'mainnet'
          ? 'wss://xrplcluster.com'
          : 'wss://s.altnet.rippletest.net:51233'
      );

      await client.connect();

      try {
        const { data: tokens } = await supabase
          .from('meme_tokens')
          .select('currency_hex, issuer_address')
          .order('created_at', { ascending: true });

        if (!tokens || tokens.length === 0) {
          toast.error('No MEMEKINGS tokens found');
          return;
        }

        let successCount = 0;
        let errorCount = 0;

        for (const token of tokens) {
          const hasBalance = tokenBalances.some(
            tb => tb.currencyHex === token.currency_hex &&
                  tb.issuer === token.issuer_address &&
                  parseFloat(tb.value) > 0
          );

          if (hasBalance) {
            console.log(`Skipping ${token.currency_hex} - has balance`);
            continue;
          }

          try {
            const xrplWallet = XrplWallet.fromSeed(wallet.seed);

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
              successCount++;
            } else {
              errorCount++;
            }
          } catch (err) {
            console.error(`Error removing trustline for ${token.currency_hex}:`, err);
            errorCount++;
          }
        }

        if (successCount > 0) {
          toast.success(`Successfully removed ${successCount} trustline(s)`);
          if (onTrustlineUpdate) onTrustlineUpdate();
        } else if (errorCount === 0) {
          toast.info('No empty trustlines to remove');
        }
        if (errorCount > 0) {
          toast.error(`Failed to remove ${errorCount} trustline(s)`);
        }
      } finally {
        await client.disconnect();
      }
    } catch (error) {
      console.error('Error removing MEMEKINGS trustlines:', error);
      toast.error('Failed to remove trustlines');
    } finally {
      setLoading(false);
      setIsOpen(false);
    }
  };

  const handleXamanLink = () => {
    const xamanUrl = 'https://xumm.app';
    window.open(xamanUrl, '_blank');
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading}
        className="bg-gradient-to-r from-green-600 to-green-500 text-white py-2 px-4 rounded-lg hover:from-green-500 hover:to-green-400 disabled:opacity-50 shadow-lg shadow-green-500/20 transition-all duration-300 flex items-center gap-2"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Processing...
          </>
        ) : (
          <>
            Trust
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </>
        )}
      </button>

      {isOpen && !loading && (
        <div className="absolute right-0 mt-2 w-56 bg-gray-800 rounded-lg shadow-xl border border-gray-700 z-50">
          <div className="py-1">
            <button
              onClick={handleMemeKingsSetup}
              className="w-full text-left px-4 py-3 text-sm text-gray-200 hover:bg-gray-700/50 transition-colors flex items-center gap-3"
            >
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              <div>
                <div className="font-medium">Setup MEMEKINGS</div>
                <div className="text-xs text-gray-400">Add all token trustlines</div>
              </div>
            </button>

            <button
              onClick={handleMemeKingsRemove}
              className="w-full text-left px-4 py-3 text-sm text-gray-200 hover:bg-gray-700/50 transition-colors flex items-center gap-3 border-t border-gray-700"
            >
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              <div>
                <div className="font-medium">Remove MEMEKINGS</div>
                <div className="text-xs text-gray-400">Remove empty trustlines</div>
              </div>
            </button>

            <button
              onClick={handleXamanLink}
              className="w-full text-left px-4 py-3 text-sm text-gray-200 hover:bg-gray-700/50 transition-colors flex items-center gap-3 border-t border-gray-700"
            >
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              <div>
                <div className="font-medium">XAMAN Link</div>
                <div className="text-xs text-gray-400">Open XAMAN app</div>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
