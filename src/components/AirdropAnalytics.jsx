import React from 'react';

export default function AirdropAnalytics({ campaign, transactions, recipients }) {
  const calculateStats = () => {
    const completedTxs = transactions.filter(tx => tx.status === 'completed');
    const failedTxs = transactions.filter(tx => tx.status === 'failed');

    const totalAmount = completedTxs.reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);
    const totalFees = completedTxs.reduce((sum, tx) => sum + parseFloat(tx.fee_xrp || 0), 0);

    const successRate = transactions.length > 0
      ? ((completedTxs.length / transactions.length) * 100).toFixed(1)
      : 0;

    const avgAmount = completedTxs.length > 0
      ? (totalAmount / completedTxs.length).toFixed(6)
      : 0;

    const uniqueRecipients = new Set(transactions.map(tx => tx.recipient_id)).size;

    return {
      totalTransactions: transactions.length,
      completedTransactions: completedTxs.length,
      failedTransactions: failedTxs.length,
      totalAmount,
      totalFees,
      successRate,
      avgAmount,
      uniqueRecipients
    };
  };

  const stats = calculateStats();

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 rounded-xl p-4">
        <div className="text-xs text-blue-300 mb-1">Total Transactions</div>
        <div className="text-2xl font-bold text-white">{stats.totalTransactions}</div>
        <div className="text-xs text-blue-400 mt-1">
          {stats.completedTransactions} completed
        </div>
      </div>

      <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/30 rounded-xl p-4">
        <div className="text-xs text-green-300 mb-1">Success Rate</div>
        <div className="text-2xl font-bold text-white">{stats.successRate}%</div>
        <div className="text-xs text-green-400 mt-1">
          {stats.failedTransactions} failed
        </div>
      </div>

      <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30 rounded-xl p-4">
        <div className="text-xs text-purple-300 mb-1">Total Amount Sent</div>
        <div className="text-2xl font-bold text-white">{stats.totalAmount.toFixed(2)}</div>
        <div className="text-xs text-purple-400 mt-1">
          Avg: {stats.avgAmount}
        </div>
      </div>

      <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/30 rounded-xl p-4">
        <div className="text-xs text-orange-300 mb-1">Total Fees</div>
        <div className="text-2xl font-bold text-white">{stats.totalFees.toFixed(2)} XRP</div>
        <div className="text-xs text-orange-400 mt-1">
          {stats.uniqueRecipients} recipients
        </div>
      </div>
    </div>
  );
}
