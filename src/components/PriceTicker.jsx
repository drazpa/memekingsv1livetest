import React, { useState, useEffect } from 'react';

export function PriceTicker() {
  const [price, setPrice] = useState(null);
  const [priceChange, setPriceChange] = useState({ value: 0, percentage: 0 });
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const response = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd&include_24hr_change=true',
          {
            headers: {
              'Accept': 'application/json',
              'Cache-Control': 'no-cache'
            }
          }
        );
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.ripple || typeof data.ripple.usd === 'undefined') {
          throw new Error('Invalid price data format');
        }
        
        setPrice(data.ripple.usd);
        setPriceChange({
          value: data.ripple.usd_24h_change,
          percentage: data.ripple.usd_24h_change
        });
        setError(false);
      } catch (error) {
        console.error('Error fetching XRP price:', error);
        setError(true);
      }
    };

    // Fetch immediately
    fetchPrice();

    // Then fetch every minute
    const interval = setInterval(fetchPrice, 60000);

    return () => clearInterval(interval);
  }, []);

  if (error) return null;
  if (!price) return null;

  return (
    <div className="flex items-center gap-2 bg-gray-800/50 rounded-lg px-3 py-1 border border-gray-700/50">
      <span className="text-sm font-medium text-gray-300">XRP</span>
      <span className="text-sm font-bold text-white">
        ${price.toFixed(4)}
      </span>
      {priceChange.percentage !== 0 && (
        <span className={`text-xs ${priceChange.percentage >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {priceChange.percentage >= 0 ? '↑' : '↓'}
          {Math.abs(priceChange.percentage).toFixed(2)}%
        </span>
      )}
    </div>
  );
}