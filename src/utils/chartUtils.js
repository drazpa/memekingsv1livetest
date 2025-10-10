// Convert XRPL timestamp to chart timestamp
export function xrplToChartTimestamp(xrplTimestamp) {
  // XRPL timestamps start from 2000-01-01, while Unix timestamps start from 1970-01-01
  const rippleEpochDiff = 946684800;
  return Math.floor(xrplTimestamp + rippleEpochDiff);
}

// Generate candlestick data from trades
export function generateCandlesticks(trades, timeframe) {
  if (!trades || trades.length === 0) return [];

  const candlesticks = new Map();
  
  trades.forEach(trade => {
    const timestamp = Math.floor(trade.timestamp / (timeframe * 1000)) * (timeframe * 1000);
    const price = parseFloat(trade.price);
    const volume = parseFloat(trade.amount);

    if (!candlesticks.has(timestamp)) {
      candlesticks.set(timestamp, {
        time: timestamp / 1000, // TradingView expects Unix timestamp in seconds
        open: price,
        high: price,
        low: price,
        close: price,
        volume: volume
      });
    } else {
      const candle = candlesticks.get(timestamp);
      candle.high = Math.max(candle.high, price);
      candle.low = Math.min(candle.low, price);
      candle.close = price;
      candle.volume += volume;
    }
  });

  return Array.from(candlesticks.values()).sort((a, b) => a.time - b.time);
}

// Format large numbers for volume display
export function formatVolume(volume) {
  if (volume >= 1000000) {
    return `${(volume / 1000000).toFixed(2)}M`;
  }
  if (volume >= 1000) {
    return `${(volume / 1000).toFixed(2)}K`;
  }
  return volume.toFixed(2);
}