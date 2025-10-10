import React, { useEffect, useState } from 'react';

export default function LiveNotification({ notification, onClose }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300);
    }, 5000);

    return () => clearTimeout(timer);
  }, [onClose]);

  if (!notification) return null;

  return (
    <div
      className={`transform transition-all duration-300 ${
        isVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
      }`}
    >
      {notification.type === 'tip' && (
        <div className="bg-gradient-to-r from-yellow-600 to-orange-600 rounded-lg p-4 shadow-2xl border-2 border-yellow-400/50 min-w-[320px]">
          <div className="flex items-center gap-3">
            <div className="text-4xl animate-bounce">💸</div>
            <div className="flex-1">
              <div className="text-white font-bold text-lg">New Tip!</div>
              <div className="text-yellow-100 text-sm">
                <span className="font-bold">{notification.from}</span> tipped{' '}
                <span className="font-bold">{notification.to}</span>
              </div>
              <div className="text-yellow-200 font-bold text-lg mt-1">
                {notification.amount} {notification.currency}
              </div>
            </div>
          </div>
        </div>
      )}

      {notification.type === 'crown' && (
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg p-4 shadow-2xl border-2 border-purple-400/50 min-w-[320px]">
          <div className="flex items-center gap-3">
            <div className="text-4xl animate-pulse">👑</div>
            <div className="flex-1">
              <div className="text-white font-bold text-lg">Crown Reaction!</div>
              <div className="text-purple-100 text-sm">
                <span className="font-bold">{notification.from}</span> sent a crown to{' '}
                <span className="font-bold">{notification.to}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
