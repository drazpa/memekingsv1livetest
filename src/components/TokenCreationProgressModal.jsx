export default function TokenCreationProgressModal({ isOpen, steps, currentStep, onClose, canClose, title, successTitle, failTitle }) {
  if (!isOpen) return null;

  const getStepStatus = (stepIndex) => {
    if (stepIndex < currentStep) return 'completed';
    if (stepIndex === currentStep) return 'active';
    return 'pending';
  };

  const getStepIcon = (status) => {
    if (status === 'completed') return '✓';
    if (status === 'active') return '⏳';
    return '○';
  };

  const completedSteps = steps.filter((_, i) => i <= currentStep).length;
  const progress = Math.min(100, (completedSteps / steps.length) * 100);

  const defaultTitle = title || '🚀 Creating Token on XRPL';
  const defaultSuccessTitle = successTitle || '🎉 Token Created Successfully!';
  const defaultFailTitle = failTitle || '❌ Token Creation Failed';

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass rounded-lg p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-10 h-10 rounded-lg glass hover:bg-red-500/20 text-purple-300 hover:text-red-300 flex items-center justify-center transition-all z-10 text-2xl font-bold"
          aria-label="Close"
        >
          ×
        </button>
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-purple-200 mb-2">
              {steps.some(s => s.error)
                ? defaultFailTitle
                : currentStep >= steps.length
                ? defaultSuccessTitle
                : defaultTitle}
            </h2>
            <p className="text-purple-400">
              {steps.some(s => s.error)
                ? 'An error occurred during the transaction. Please review the details below.'
                : currentStep >= steps.length
                ? 'Your transaction has been completed successfully'
                : 'Please wait while we process your transaction...'}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm text-purple-300 mb-1">
              <span>Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-purple-900/30 rounded-full h-3 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500 ease-out rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="space-y-3">
            {steps.map((step, index) => {
              const status = getStepStatus(index);
              const icon = getStepIcon(status);

              return (
                <div
                  key={index}
                  className={`flex items-start gap-4 p-4 rounded-lg transition-all ${
                    step.error
                      ? 'bg-red-500/10 border border-red-500/30'
                      : status === 'completed'
                      ? 'bg-green-500/10 border border-green-500/30'
                      : status === 'active'
                        ? 'bg-purple-500/20 border border-purple-500/50 animate-pulse'
                        : 'bg-purple-900/20 border border-purple-500/20'
                  }`}
                >
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                    step.error
                      ? 'bg-red-500 text-white'
                      : status === 'completed'
                      ? 'bg-green-500 text-white'
                      : status === 'active'
                        ? 'bg-purple-500 text-white'
                        : 'bg-purple-900/50 text-purple-400'
                  }`}>
                    {step.error ? '✕' : icon}
                  </div>

                  <div className="flex-1">
                    <div className={`font-semibold mb-1 ${
                      step.error
                        ? 'text-red-300'
                        : status === 'completed'
                        ? 'text-green-300'
                        : status === 'active'
                          ? 'text-purple-200'
                          : 'text-purple-400'
                    }`}>
                      {step.title}
                    </div>
                    <div className={`text-sm ${
                      step.error
                        ? 'text-red-300'
                        : status === 'completed' || status === 'active'
                        ? 'text-purple-300'
                        : 'text-purple-500'
                    }`}>
                      {step.description}
                    </div>
                    {step.txHash && (
                      <a
                        href={`https://testnet.xrpl.org/transactions/${step.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-purple-400 hover:text-purple-300 mt-2 inline-block"
                      >
                        View Transaction: {step.txHash.slice(0, 20)}...
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {canClose && (
            <div className="flex gap-3 pt-4">
              <button
                onClick={onClose}
                className="btn-primary text-white px-6 py-3 rounded-lg font-medium flex-1"
              >
                {steps.some(s => s.error) ? 'Close' : 'Close & View Token'}
              </button>
            </div>
          )}

          {!canClose && (
            <div className="text-center text-purple-400 text-sm">
              Please wait while we create your token...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
