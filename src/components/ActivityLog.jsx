import React from 'react';
import { XRPScanLink } from './XRPScanLink';

export function ActivityLog({ activities, network }) {
  const getActivityStyles = (type) => {
    switch (type) {
      case 'PAYMENT_SENT':
        return 'from-red-500/10 to-red-900/10 border-red-500/20';
      case 'PAYMENT_RECEIVED':
        return 'from-green-500/10 to-green-900/10 border-green-500/20';
      case 'TRUSTLINE_CREATED':
        return 'from-purple-500/10 to-purple-900/10 border-purple-500/20';
      case 'TRUSTLINE_REMOVED':
        return 'from-yellow-500/10 to-yellow-900/10 border-yellow-500/20';
      case 'WALLET_GENERATED':
      case 'WALLET_LOADED':
        return 'from-green-500/10 to-green-900/10 border-green-500/20';
      case 'WALLET_DELETED':
        return 'from-red-500/10 to-red-900/10 border-red-500/20';
      case 'ERROR':
        return 'from-red-500/10 to-red-900/10 border-red-500/20';
      default:
        return 'from-gray-500/10 to-gray-900/10 border-gray-500/20';
    }
  };

  const getActivityIcon = (type) => {
    const baseClasses = "w-8 h-8 rounded-full flex items-center justify-center";
    
    switch (type) {
      case 'PAYMENT_SENT':
        return (
          <div className={`${baseClasses} bg-gradient-to-br from-red-500/20 to-red-600/20 shadow-lg shadow-red-500/10`}>
            <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </div>
        );
      case 'PAYMENT_RECEIVED':
        return (
          <div className={`${baseClasses} bg-gradient-to-br from-green-500/20 to-green-600/20 shadow-lg shadow-green-500/10`}>
            <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        );
      case 'TRUSTLINE_CREATED':
        return (
          <div className={`${baseClasses} bg-gradient-to-br from-purple-500/20 to-purple-600/20 shadow-lg shadow-purple-500/10`}>
            <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
          </div>
        );
      case 'TRUSTLINE_REMOVED':
        return (
          <div className={`${baseClasses} bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 shadow-lg shadow-yellow-500/10`}>
            <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" />
            </svg>
          </div>
        );
      case 'ERROR':
        return (
          <div className={`${baseClasses} bg-gradient-to-br from-red-500/20 to-red-600/20 shadow-lg shadow-red-500/10`}>
            <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
      default:
        return (
          <div className={`${baseClasses} bg-gradient-to-br from-gray-500/20 to-gray-600/20 shadow-lg shadow-gray-500/10`}>
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
    }
  };

  const formatAmount = (amount, currency = 'XRP') => {
    if (!amount) return null;
    const formattedAmount = parseFloat(amount).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    });
    return `${formattedAmount} ${currency}`;
  };

  const getActivityDetails = (activity) => {
    switch (activity.type) {
      case 'PAYMENT_SENT':
        return {
          title: 'Payment Sent',
          description: `Sent ${formatAmount(activity.amount, activity.currency)} to ${activity.destination}`,
          details: [
            { label: 'To', value: activity.destination, isAddress: true },
            { label: 'Amount', value: formatAmount(activity.amount, activity.currency) },
            { label: 'Transaction', value: activity.hash, isHash: true }
          ]
        };
      case 'PAYMENT_RECEIVED':
        return {
          title: 'Payment Received',
          description: `Received ${formatAmount(activity.amount, activity.currency)} from ${activity.source}`,
          details: [
            { label: 'From', value: activity.source, isAddress: true },
            { label: 'Amount', value: formatAmount(activity.amount, activity.currency) },
            { label: 'Transaction', value: activity.hash, isHash: true }
          ]
        };
      case 'TRUSTLINE_CREATED':
        return {
          title: 'Trustline Created',
          description: `Created trustline for ${activity.currency}`,
          details: [
            { label: 'Currency', value: activity.currency },
            { label: 'Issuer', value: activity.issuer, isAddress: true },
            { label: 'Transaction', value: activity.hash, isHash: true }
          ]
        };
      case 'TRUSTLINE_REMOVED':
        return {
          title: 'Trustline Removed',
          description: `Removed trustline for ${activity.currency}`,
          details: [
            { label: 'Currency', value: activity.currency },
            { label: 'Issuer', value: activity.issuer, isAddress: true },
            { label: 'Transaction', value: activity.hash, isHash: true }
          ]
        };
      default:
        return {
          title: activity.type.replace(/_/g, ' '),
          description: activity.message,
          details: activity.hash ? [{ label: 'Transaction', value: activity.hash, isHash: true }] : []
        };
    }
  };

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
      {activities.map(activity => {
        const { title, description, details } = getActivityDetails(activity);
        
        return (
          <div 
            key={activity.id} 
            className={`p-4 rounded-lg border backdrop-blur-sm transition-all duration-300 bg-gradient-to-br ${getActivityStyles(activity.type)} hover:translate-y-[-2px]`}
          >
            <div className="flex items-start gap-4">
              {getActivityIcon(activity.type)}
              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                  <div>
                    <h3 className="font-medium text-white">{title}</h3>
                    <p className="text-sm text-gray-300">{description}</p>
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {new Date(activity.timestamp).toLocaleString()}
                  </span>
                </div>
                
                {details && details.length > 0 && (
                  <div className="mt-3 space-y-2 text-sm">
                    {details.map((detail, index) => (
                      <div key={index} className="flex flex-col sm:flex-row gap-2 text-gray-400">
                        <span className="whitespace-nowrap">{detail.label}:</span>
                        {detail.isAddress ? (
                          <XRPScanLink 
                            type="address" 
                            value={detail.value} 
                            network={network}
                            className="text-green-400 hover:text-green-300 truncate" 
                          />
                        ) : detail.isHash ? (
                          <XRPScanLink 
                            type="tx" 
                            value={detail.value} 
                            network={network}
                            className="text-green-400 hover:text-green-300 truncate" 
                          />
                        ) : (
                          <span className="text-white truncate">{detail.value}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
      
      {activities.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          No activity recorded yet
        </div>
      )}
    </div>
  );
}