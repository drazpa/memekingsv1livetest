import React from 'react';

export function ProgressModal({ isOpen, steps }) {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">Transaction Progress</h3>
        <div className="space-y-4">
          {steps.map((step, index) => (
            <div key={index} className="flex items-center gap-3">
              {step.status === 'pending' && (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-green-500 border-t-transparent" />
              )}
              {step.status === 'complete' && (
                <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              )}
              {step.status === 'error' && (
                <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              <span className={`text-gray-300 ${
                step.status === 'complete' ? 'text-green-400' : ''
              }`}>
                {step.message}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}