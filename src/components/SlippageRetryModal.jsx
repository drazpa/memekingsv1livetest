import { useState, useEffect } from 'react';

export default function SlippageRetryModal({
  isOpen,
  currentSlippage,
  suggestedSlippage,
  tradeType,
  amount,
  tokenName,
  onRetry,
  onCancel,
  onClose,
  isRetrying = false,
  retryComplete = false,
  retrySuccess = false,
  retryError = null
}) {
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    if (retryComplete && retrySuccess) {
      const timer = setTimeout(() => {
        onClose();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [retryComplete, retrySuccess, onClose]);

  useEffect(() => {
    if (isRetrying) {
      setCountdown(3);
      const interval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isRetrying]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100] p-4 animate-fadeIn">
      <div className="glass rounded-lg p-8 max-w-md w-full shadow-2xl border border-purple-500/30 animate-slideUp relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-10 h-10 rounded-lg glass hover:bg-red-500/20 text-purple-300 hover:text-red-300 flex items-center justify-center transition-all z-10 text-2xl font-bold"
          aria-label="Close"
        >
          ×
        </button>
        {!retryComplete ? (
          <>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <span className="text-2xl">⚠️</span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-purple-200">Slippage Too Low</h3>
                <p className="text-purple-400 text-sm">Trade couldn't complete</p>
              </div>
            </div>

            <div className="glass rounded-lg p-4 space-y-3 mb-6">
              <div className="flex items-center justify-between">
                <span className="text-purple-400 text-sm">Trade Type</span>
                <span className="text-purple-200 font-medium">{tradeType}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-purple-400 text-sm">Amount</span>
                <span className="text-purple-200 font-medium">{amount} {tokenName}</span>
              </div>
              <div className="h-px bg-purple-500/20 my-2"></div>
              <div className="flex items-center justify-between">
                <span className="text-purple-400 text-sm">Current Slippage</span>
                <span className="text-red-400 font-bold">{currentSlippage}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-purple-400 text-sm">Suggested Slippage</span>
                <span className="text-green-400 font-bold">{suggestedSlippage}%</span>
              </div>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
              <p className="text-blue-300 text-sm">
                <strong>Why did this happen?</strong>
                <br />
                The pool's price moved while your trade was processing. Increasing slippage tolerance allows for more price movement.
              </p>
            </div>

            {isRetrying ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-3">
                  <div className="w-8 h-8 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
                  <span className="text-purple-200 font-medium">Retrying with {suggestedSlippage}% slippage...</span>
                </div>
                {countdown > 0 && (
                  <div className="text-center text-purple-400 text-sm">
                    Executing in {countdown}s
                  </div>
                )}
              </div>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={onCancel}
                  className="flex-1 glass hover:bg-purple-500/10 text-purple-300 py-3 rounded-lg font-medium transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={onRetry}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white py-3 rounded-lg font-medium transition-all shadow-lg"
                >
                  Retry with {suggestedSlippage}%
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center space-y-6">
            {retrySuccess ? (
              <>
                <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
                  <span className="text-5xl">✓</span>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-green-400 mb-2">Trade Successful!</h3>
                  <p className="text-purple-300">Your {tradeType.toLowerCase()} order completed with {suggestedSlippage}% slippage.</p>
                </div>
                <div className="text-purple-400 text-sm">
                  Closing automatically...
                </div>
              </>
            ) : (
              <>
                <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto">
                  <span className="text-5xl">✗</span>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-red-400 mb-2">Retry Failed</h3>
                  <p className="text-purple-300 mb-4">{retryError || 'Trade could not be completed. Please try again manually.'}</p>
                  <div className="glass rounded-lg p-3">
                    <p className="text-purple-400 text-sm">
                      <strong>Suggestions:</strong>
                      <br />
                      • Try a smaller amount
                      <br />
                      • Increase slippage further
                      <br />
                      • Wait for pool liquidity to improve
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-full btn-primary text-white py-3 rounded-lg font-medium"
                >
                  Close
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
