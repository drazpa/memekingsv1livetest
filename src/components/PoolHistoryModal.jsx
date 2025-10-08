import { useEffect } from 'react';

export default function PoolHistoryModal({ isOpen, onClose, token, transactions, loading }) {
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleString();
  };

  const formatAmount = (amount) => {
    const num = parseFloat(amount);
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
    return num.toFixed(2);
  };

  const getTransactionType = (tx) => {
    if (tx.TransactionType === 'AMMDeposit') return 'Deposit';
    if (tx.TransactionType === 'AMMWithdraw') return 'Withdraw';
    if (tx.TransactionType === 'Payment') {
      if (tx.meta?.delivered_amount && typeof tx.meta.delivered_amount === 'string') {
        return 'Buy';
      } else {
        return 'Sell';
      }
    }
    return tx.TransactionType;
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'Buy':
        return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'Sell':
        return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'Deposit':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'Withdraw':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      default:
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100] p-4 animate-fadeIn" onClick={onClose}>
      <div className="glass rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-slideUp" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-2xl font-bold text-purple-200">AMM Pool History</h3>
            <p className="text-purple-400 text-sm mt-1">
              {token?.token_name} - Last 24 Hours
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-lg glass hover:bg-purple-500/20 flex items-center justify-center text-purple-300 text-xl transition-all"
          >
            ×
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-20">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto"></div>
              <p className="text-purple-300">Loading transaction history...</p>
            </div>
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-20">
            <div className="text-center space-y-3">
              <div className="text-6xl">📊</div>
              <h4 className="text-xl font-bold text-purple-200">No Transactions Found</h4>
              <p className="text-purple-400">No AMM pool activity in the last 24 hours</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-3">
            <div className="grid grid-cols-4 gap-4 mb-4 px-4 text-sm font-semibold text-purple-400">
              <div>Type</div>
              <div>Amount</div>
              <div>Account</div>
              <div className="text-right">Time</div>
            </div>

            {transactions.map((tx, index) => {
              const type = getTransactionType(tx);
              const typeColor = getTypeColor(type);

              return (
                <div
                  key={tx.hash || index}
                  className="glass rounded-lg p-4 hover:bg-purple-500/10 transition-all"
                >
                  <div className="grid grid-cols-4 gap-4 items-center">
                    <div>
                      <div className={`inline-flex px-3 py-1 rounded-lg text-xs font-medium border ${typeColor}`}>
                        {type}
                      </div>
                    </div>

                    <div>
                      <div className="text-purple-200 font-medium text-sm">
                        {tx.Amount ? (
                          typeof tx.Amount === 'string' ? (
                            `${formatAmount(parseInt(tx.Amount) / 1000000)} XRP`
                          ) : (
                            `${formatAmount(tx.Amount.value)} ${tx.Amount.currency}`
                          )
                        ) : (
                          'N/A'
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="text-purple-300 text-xs font-mono">
                        {tx.Account ? `${tx.Account.substring(0, 8)}...${tx.Account.substring(tx.Account.length - 6)}` : 'Unknown'}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-purple-400 text-xs">
                        {formatTime(tx.date ? (tx.date + 946684800) * 1000 : Date.now())}
                      </div>
                      {tx.hash && (
                        <a
                          href={`https://livenet.xrpl.org/transactions/${tx.hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-purple-500 hover:text-purple-400 text-xs mt-1 inline-block"
                        >
                          View →
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-purple-500/20 flex justify-between items-center">
          <div className="text-purple-400 text-sm">
            {transactions.length} transaction{transactions.length !== 1 ? 's' : ''} found
          </div>
          <button
            onClick={onClose}
            className="btn-primary text-white px-6 py-2 rounded-lg font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
