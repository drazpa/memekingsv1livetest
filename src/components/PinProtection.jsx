import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

const hashPin = async (pin) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

export function PinProtection({ walletAddress, onSuccess, onCancel }) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isSetup, setIsSetup] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const savedPin = localStorage.getItem(`wallet_pin_${walletAddress}`);
    setIsSetup(!!savedPin);
  }, [walletAddress]);

  const handleSetupPin = async () => {
    if (pin.length < 4 || pin.length > 6) {
      setError('PIN must be 4-6 digits');
      return;
    }

    if (!/^\d+$/.test(pin)) {
      setError('PIN must contain only numbers');
      return;
    }

    if (pin !== confirmPin) {
      setError('PINs do not match');
      return;
    }

    try {
      const hashedPin = await hashPin(pin);
      localStorage.setItem(`wallet_pin_${walletAddress}`, hashedPin);
      toast.success('PIN set successfully');
      onSuccess();
    } catch (error) {
      console.error('Error setting PIN:', error);
      setError('Failed to set PIN');
    }
  };

  const handleVerifyPin = async () => {
    if (!pin) {
      setError('Please enter your PIN');
      return;
    }

    try {
      const savedPin = localStorage.getItem(`wallet_pin_${walletAddress}`);
      const hashedInput = await hashPin(pin);

      if (hashedInput === savedPin) {
        toast.success('PIN verified');
        onSuccess();
      } else {
        setError('Incorrect PIN');
        setPin('');
      }
    } catch (error) {
      console.error('Error verifying PIN:', error);
      setError('Failed to verify PIN');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (isSetup) {
      handleVerifyPin();
    } else {
      handleSetupPin();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-md w-full shadow-2xl">
        <h3 className="text-xl font-bold text-white mb-4">
          {isSetup ? 'Enter PIN' : 'Set PIN'}
        </h3>

        <p className="text-gray-300 text-sm mb-6">
          {isSetup
            ? 'Enter your PIN to view the seed phrase'
            : 'Set a PIN to protect your seed phrase. This PIN will be required to view the seed.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {isSetup ? 'PIN' : 'Enter PIN (4-6 digits)'}
            </label>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength="6"
              value={pin}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '');
                setPin(value);
                setError('');
              }}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 text-center text-2xl tracking-widest focus:border-green-500 focus:ring-green-500/50"
              placeholder="••••"
              autoFocus
            />
          </div>

          {!isSetup && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Confirm PIN
              </label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength="6"
                value={confirmPin}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  setConfirmPin(value);
                  setError('');
                }}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 text-center text-2xl tracking-widest focus:border-green-500 focus:ring-green-500/50"
                placeholder="••••"
              />
            </div>
          )}

          {error && (
            <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              {error}
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-gray-800 text-gray-300 py-3 px-4 rounded-lg hover:bg-gray-700 transition-all duration-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!pin || (!isSetup && !confirmPin)}
              className="flex-1 bg-gradient-to-r from-green-600 to-green-500 text-white py-3 px-4 rounded-lg hover:from-green-500 hover:to-green-400 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-500/20 transition-all duration-300"
            >
              {isSetup ? 'Verify' : 'Set PIN'}
            </button>
          </div>
        </form>

        {isSetup && (
          <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <p className="text-yellow-300 text-xs">
              Forgot your PIN? You'll need to delete and re-import this wallet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
