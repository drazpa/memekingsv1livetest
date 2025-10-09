export default function ExecutionResult({ result }) {
  return (
    <div className="mt-4 rounded-xl overflow-hidden border border-purple-500/40 animate-fadeInUp"
      style={{
        background: 'linear-gradient(135deg, rgba(88, 28, 135, 0.95), rgba(59, 7, 100, 0.95))',
        backdropFilter: 'blur(20px)'
      }}
    >
      <div className={`p-4 border-b ${
        result.status === 'success'
          ? 'bg-green-900/30 border-green-500/30'
          : result.status === 'error'
          ? 'bg-red-900/30 border-red-500/30'
          : 'bg-purple-900/30 border-purple-500/30'
      }`}>
        <div className="flex items-center gap-3">
          <div className="text-3xl">
            {result.status === 'success' ? '✅' : result.status === 'error' ? '❌' : 'ℹ️'}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-white">{result.title}</h3>
            <p className={`text-sm ${
              result.status === 'success'
                ? 'text-green-300'
                : result.status === 'error'
                ? 'text-red-300'
                : 'text-purple-300'
            }`}>
              {result.message}
            </p>
          </div>
        </div>
      </div>

      {result.data && (
        <div className="p-4 space-y-3 bg-purple-900/20">
          {Object.entries(result.data).map(([key, value]) => (
            <div key={key} className="flex justify-between items-center p-2 bg-purple-950/40 rounded-lg border border-purple-500/20">
              <span className="text-sm text-purple-300 capitalize">
                {key.replace(/_/g, ' ')}:
              </span>
              <span className="text-sm text-white font-medium">{value}</span>
            </div>
          ))}
        </div>
      )}

      {result.transactionHash && (
        <div className="p-4 bg-purple-900/30 border-t border-purple-500/20">
          <div className="text-xs text-purple-300 mb-2">Transaction Hash:</div>
          <div className="flex items-center gap-2 p-2 bg-purple-950/60 rounded-lg border border-purple-500/30">
            <code className="flex-1 text-xs text-purple-200 break-all">{result.transactionHash}</code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(result.transactionHash);
              }}
              className="px-2 py-1 bg-purple-700/40 hover:bg-purple-700/60 text-purple-200 rounded text-xs transition-colors"
            >
              Copy
            </button>
            <button
              onClick={() => {
                window.open(`https://xrpscan.com/tx/${result.transactionHash}`, '_blank');
              }}
              className="px-2 py-1 bg-purple-700/40 hover:bg-purple-700/60 text-purple-200 rounded text-xs transition-colors"
            >
              View
            </button>
          </div>
        </div>
      )}

      {result.actions && result.actions.length > 0 && (
        <div className="p-4 bg-purple-900/30 border-t border-purple-500/20 flex gap-2">
          {result.actions.map((action, index) => (
            <button
              key={index}
              onClick={action.onClick}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                action.style === 'primary'
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:shadow-lg hover:shadow-purple-500/50 text-white'
                  : 'bg-purple-800/40 hover:bg-purple-800/60 text-purple-200 border border-purple-500/30'
              }`}
            >
              {action.icon && <span className="mr-1">{action.icon}</span>}
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
