import React, { useState, useEffect } from 'react';
import { Client, xrpToDrops, dropsToXrp } from 'xrpl';
import toast from 'react-hot-toast';
import { getCurrencyInfo } from '../utils/currencyUtils';
import { PriceChart } from './PriceChart';
import { generateCandlesticks, xrplToChartTimestamp } from '../utils/chartUtils';

// Add known issuers for common currencies
const KNOWN_ISSUERS = {
  'MINT': 'rwCsCz93A1svS6Yv8hFqUeKLdTLhBpvqGD', // MINT token issuer
  'USD': 'rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq', // Gatehub USD issuer
  'EUR': 'rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq', // Gatehub EUR issuer
};

// Common trading pairs
const TRADING_PAIRS = [
  { base: 'MINT', quote: 'XRP' },
  { base: 'USD', quote: 'XRP' },
  { base: 'EUR', quote: 'XRP' },
];

// Timeframe options
const TIMEFRAMES = [
  { label: '5m', value: 300 },
  { label: '15m', value: 900 },
  { label: '1h', value: 3600 },
  { label: '4h', value: 14400 },
  { label: '1d', value: 86400 }
];

export function DexTrading({ wallet, network }) {
  const [selectedPair, setSelectedPair] = useState({ base: 'MINT', quote: 'XRP' });
  const [orderType, setOrderType] = useState('buy');
  const [orderMode, setOrderMode] = useState('market'); // 'market' or 'limit'
  const [price, setPrice] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [orderbook, setOrderbook] = useState({ bids: [], asks: [] });
  const [tradeHistory, setTradeHistory] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState(TIMEFRAMES[0]);
  const [chartData, setChartData] = useState([]);
  const [stats24h, setStats24h] = useState({
    high: 0,
    low: 0,
    volume: 0,
    change: 0
  });

  useEffect(() => {
    if (selectedPair.base && selectedPair.quote) {
      fetchOrderbook();
      fetchTradeHistory();
      fetch24hStats();
    }
  }, [selectedPair.base, selectedPair.quote, selectedTimeframe]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchOrderbook();
        fetchTradeHistory();
        fetch24hStats();
      }, 10000); // Refresh every 10 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh, selectedPair]);

  const fetch24hStats = async () => {
    try {
      const client = new Client(
        network === 'mainnet' 
          ? "wss://xrplcluster.com" 
          : "wss://s.altnet.rippletest.net:51233"
      );
      await client.connect();

      // Get transactions from the last 24 hours
      const endTime = new Date();
      const startTime = new Date(endTime - 24 * 60 * 60 * 1000);

      const response = await client.request({
        command: "account_tx",
        account: KNOWN_ISSUERS[selectedPair.base] || wallet.address,
        start: startTime.toISOString(),
        end: endTime.toISOString(),
        limit: 200
      });

      // Process trades
      const trades = response.result.transactions
        .filter(tx => 
          tx.tx.TransactionType === "Payment" &&
          tx.meta.TransactionResult === "tesSUCCESS"
        )
        .map(tx => ({
          price: calculatePrice(tx.tx.Amount, tx.tx.SendMax || tx.tx.Amount),
          amount: tx.tx.Amount.currency === 'XRP'
            ? dropsToXrp(tx.tx.Amount)
            : tx.tx.Amount.value,
          timestamp: xrplToChartTimestamp(tx.tx.date)
        }));

      if (trades.length > 0) {
        const prices = trades.map(t => t.price);
        const high = Math.max(...prices);
        const low = Math.min(...prices);
        const volume = trades.reduce((sum, t) => sum + parseFloat(t.amount), 0);
        const firstPrice = trades[trades.length - 1].price;
        const lastPrice = trades[0].price;
        const change = ((lastPrice - firstPrice) / firstPrice) * 100;

        setStats24h({
          high,
          low,
          volume,
          change
        });
      }

      await client.disconnect();
    } catch (error) {
      console.error('Error fetching 24h stats:', error);
    }
  };

  const fetchOrderbook = async () => {
    try {
      setRefreshing(true);
      setError(null);
      
      const client = new Client(
        network === 'mainnet' 
          ? "wss://xrplcluster.com" 
          : "wss://s.altnet.rippletest.net:51233"
      );
      await client.connect();

      // Fetch bids (buy orders)
      const bidsRequest = {
        command: "book_offers",
        taker_gets: {
          currency: selectedPair.base,
          issuer: KNOWN_ISSUERS[selectedPair.base]
        },
        taker_pays: selectedPair.quote === 'XRP'
          ? { currency: 'XRP' }
          : {
              currency: selectedPair.quote,
              issuer: KNOWN_ISSUERS[selectedPair.quote]
            },
        limit: 50
      };

      // Fetch asks (sell orders)
      const asksRequest = {
        command: "book_offers",
        taker_gets: selectedPair.quote === 'XRP'
          ? { currency: 'XRP' }
          : {
              currency: selectedPair.quote,
              issuer: KNOWN_ISSUERS[selectedPair.quote]
            },
        taker_pays: {
          currency: selectedPair.base,
          issuer: KNOWN_ISSUERS[selectedPair.base]
        },
        limit: 50
      };

      const [bidsResponse, asksResponse] = await Promise.all([
        client.request(bidsRequest),
        client.request(asksRequest)
      ]);

      // Process and format the orderbook data
      const processedBids = bidsResponse.result.offers?.map(offer => ({
        price: calculatePrice(offer.TakerGets, offer.TakerPays),
        amount: offer.TakerGets.currency === 'XRP' 
          ? dropsToXrp(offer.TakerGets)
          : offer.TakerGets.value,
        total: offer.TakerPays.currency === 'XRP'
          ? dropsToXrp(offer.TakerPays)
          : offer.TakerPays.value,
        account: offer.Account
      })) || [];

      const processedAsks = asksResponse.result.offers?.map(offer => ({
        price: calculatePrice(offer.TakerPays, offer.TakerGets),
        amount: offer.TakerGets.currency === 'XRP'
          ? dropsToXrp(offer.TakerGets)
          : offer.TakerGets.value,
        total: offer.TakerPays.currency === 'XRP'
          ? dropsToXrp(offer.TakerPays)
          : offer.TakerPays.value,
        account: offer.Account
      })) || [];

      setOrderbook({
        bids: processedBids.sort((a, b) => b.price - a.price),
        asks: processedAsks.sort((a, b) => a.price - b.price)
      });

      await client.disconnect();
    } catch (error) {
      console.error('Error fetching orderbook:', error);
      setError('Failed to fetch orderbook. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  const fetchTradeHistory = async () => {
    try {
      const client = new Client(
        network === 'mainnet' 
          ? "wss://xrplcluster.com" 
          : "wss://s.altnet.rippletest.net:51233"
      );
      await client.connect();

      // Get transactions from the last 24 hours
      const endTime = new Date();
      const startTime = new Date(endTime - 24 * 60 * 60 * 1000);

      const response = await client.request({
        command: "account_tx",
        account: KNOWN_ISSUERS[selectedPair.base] || wallet.address,
        start: startTime.toISOString(),
        end: endTime.toISOString(),
        limit: 200
      });

      // Filter and process trades
      const trades = response.result.transactions
        .filter(tx => 
          tx.tx.TransactionType === "Payment" &&
          tx.meta.TransactionResult === "tesSUCCESS"
        )
        .map(tx => ({
          hash: tx.tx.hash,
          price: calculatePrice(tx.tx.Amount, tx.tx.SendMax || tx.tx.Amount),
          amount: tx.tx.Amount.currency === 'XRP'
            ? dropsToXrp(tx.tx.Amount)
            : tx.tx.Amount.value,
          timestamp: xrplToChartTimestamp(tx.tx.date),
          type: tx.tx.Account === wallet.address ? 'sell' : 'buy'
        }));

      setTradeHistory(trades);

      // Generate candlestick data
      const candlesticks = generateCandlesticks(trades, selectedTimeframe.value);
      setChartData(candlesticks);

      await client.disconnect();
    } catch (error) {
      console.error('Error fetching trade history:', error);
    }
  };

  const calculatePrice = (gets, pays) => {
    const getsAmount = gets.currency === 'XRP' ? dropsToXrp(gets) : parseFloat(gets.value);
    const paysAmount = pays.currency === 'XRP' ? dropsToXrp(pays) : parseFloat(pays.value);
    return paysAmount / getsAmount;
  };

  const createOrder = async () => {
    if (!wallet || !price || !amount) {
      toast.error('Please enter both price and amount');
      return;
    }

    try {
      setLoading(true);
      const client = new Client(
        network === 'mainnet' 
          ? "wss://xrplcluster.com" 
          : "wss://s.altnet.rippletest.net:51233"
      );
      await client.connect();

      const takerGets = orderType === 'buy'
        ? {
            currency: selectedPair.base,
            issuer: KNOWN_ISSUERS[selectedPair.base],
            value: amount.toString()
          }
        : selectedPair.quote === 'XRP'
          ? xrpToDrops((parseFloat(amount) * parseFloat(price)).toString())
          : {
              currency: selectedPair.quote,
              issuer: KNOWN_ISSUERS[selectedPair.quote],
              value: (parseFloat(amount) * parseFloat(price)).toString()
            };

      const takerPays = orderType === 'buy'
        ? selectedPair.quote === 'XRP'
          ? xrpToDrops((parseFloat(amount) * parseFloat(price)).toString())
          : {
              currency: selectedPair.quote,
              issuer: KNOWN_ISSUERS[selectedPair.quote],
              value: (parseFloat(amount) * parseFloat(price)).toString()
            }
        : {
            currency: selectedPair.base,
            issuer: KNOWN_ISSUERS[selectedPair.base],
            value: amount.toString()
          };

      const offerCreate = {
        TransactionType: "OfferCreate",
        Account: wallet.address,
        TakerGets: takerGets,
        TakerPays: takerPays
      };

      const prepared = await client.autofill(offerCreate);
      const signed = wallet.sign(prepared);
      const result = await client.submitAndWait(signed.tx_blob);

      if (result.result.meta.TransactionResult === "tesSUCCESS") {
        toast.success('Order created successfully!');
        setPrice('');
        setAmount('');
        fetchOrderbook();
      } else {
        throw new Error(result.result.meta.TransactionResult);
      }

      await client.disconnect();
    } catch (error) {
      toast.error('Error creating order: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-900 text-white p-6 rounded-lg">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold">DEX Trading</h2>
          <select
            value={`${selectedPair.base}/${selectedPair.quote}`}
            onChange={(e) => {
              const [base, quote] = e.target.value.split('/');
              setSelectedPair({ base, quote });
            }}
            className="bg-gray-800 text-white rounded-md border-gray-700 focus:border-blue-500 focus:ring-blue-500"
          >
            {TRADING_PAIRS.map(pair => (
              <option key={`${pair.base}/${pair.quote}`} value={`${pair.base}/${pair.quote}`}>
                {pair.base}/{pair.quote}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            {TIMEFRAMES.map(tf => (
              <button
                key={tf.label}
                onClick={() => setSelectedTimeframe(tf)}
                className={`px-3 py-1 rounded ${
                  selectedTimeframe === tf
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1 rounded text-sm ${
              autoRefresh 
                ? 'bg-green-500 text-white' 
                : 'bg-gray-800 text-gray-400'
            }`}
          >
            {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-gray-800 p-4 rounded-lg">
          <div className="h-96 bg-gray-900 rounded-lg mb-4">
            <PriceChart data={chartData} />
          </div>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-400">24h Change</span>
              <p className={stats24h.change >= 0 ? 'text-green-500' : 'text-red-500'}>
                {stats24h.change.toFixed(2)}%
              </p>
            </div>
            <div>
              <span className="text-gray-400">24h High</span>
              <p className="text-white">{stats24h.high.toFixed(6)}</p>
            </div>
            <div>
              <span className="text-gray-400">24h Low</span>
              <p className="text-white">{stats24h.low.toFixed(6)}</p>
            </div>
            <div>
              <span className="text-gray-400">24h Volume</span>
              <p className="text-white">{stats24h.volume.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Order Form */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="mb-4">
            <div className="flex rounded-md overflow-hidden">
              <button
                onClick={() => setOrderType('buy')}
                className={`flex-1 px-4 py-2 ${
                  orderType === 'buy'
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Buy
              </button>
              <button
                onClick={() => setOrderType('sell')}
                className={`flex-1 px-4 py-2 ${
                  orderType === 'sell'
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Sell
              </button>
            </div>
          </div>

          <div className="mb-4">
            <div className="flex rounded-md overflow-hidden">
              <button
                onClick={() => setOrderMode('market')}
                className={`flex-1 px-4 py-2 ${
                  orderMode === 'market'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Market
              </button>
              <button
                onClick={() => setOrderMode('limit')}
                className={`flex-1 px-4 py-2 ${
                  orderMode === 'limit'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Limit
              </button>
            </div>
          </div>

          {orderMode === 'limit' && (
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-1">Price</label>
              <div className="relative">
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full bg-gray-700 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
                <span className="absolute right-3 top-2 text-gray-400">
                  {selectedPair.quote}
                </span>
              </div>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-1">Amount</label>
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-gray-700 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
              <span className="absolute right-3 top-2 text-gray-400">
                {selectedPair.base}
              </span>
            </div>
          </div>

          {price && amount && (
            <div className="mb-4 p-3 bg-gray-700 rounded-md">
              <p className="text-sm text-gray-400">
                Total: {(parseFloat(price) * parseFloat(amount)).toFixed(6)} {selectedPair.quote}
              </p>
            </div>
          )}

          <button
            onClick={createOrder}
            disabled={loading || !amount || (orderMode === 'limit' && !price)}
            className={`w-full py-3 rounded-md ${
              orderType === 'buy'
                ? 'bg-green-500 hover:bg-green-600'
                : 'bg-red-500 hover:bg-red-600'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {loading ? 'Processing...' : `Place ${orderType.toUpperCase()} Order`}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 mt-6">
        {/* Orderbook */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-4">Orderbook</h3>
          <div className="space-y-2">
            {/* Asks (Sell Orders) */}
            <div className="text-red-500">
              {orderbook.asks.map((ask, index) => (
                <div key={index} className="grid grid-cols-3 text-right text-sm py-1">
                  <span>{ask.price.toFixed(6)}</span>
                  <span>{parseFloat(ask.amount).toFixed(2)}</span>
                  <span>{parseFloat(ask.total).toFixed(2)}</span>
                </div>
              ))}
            </div>

            {/* Spread */}
            <div className="text-center text-gray-400 py-2 text-sm">
              Spread: {orderbook.asks[0] && orderbook.bids[0]
                ? (orderbook.asks[0].price - orderbook.bids[0].price).toFixed(6)
                : '-'
              }
            </div>

            {/* Bids (Buy Orders) */}
            <div className="text-green-500">
              {orderbook.bids.map((bid, index) => (
                <div key={index} className="grid grid-cols-3 text-right text-sm py-1">
                  <span>{bid.price.toFixed(6)}</span>
                  <span>{parseFloat(bid.amount).toFixed(2)}</span>
                  <span>{parseFloat(bid.total).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Trade History */}
        <div className="bg-gray-800 p-4 rounded-lg col-span-2">
          <h3 className="text-lg font-semibold mb-4">Trade History</h3>
          <div className="space-y-2">
            {tradeHistory.map((trade, index) => (
              <div
                key={index}
                className={`grid grid-cols-3 text-right text-sm py-1 ${
                  trade.type === 'buy' ? 'text-green-500' : 'text-red-500'
                }`}
              >
                <span>{trade.price.toFixed(6)}</span>
                <span>{parseFloat(trade.amount).toFixed(2)}</span>
                <span>{new Date(trade.timestamp * 1000).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}