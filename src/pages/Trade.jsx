import { useState, useEffect, useRef } from 'react';
import { supabase } from '../utils/supabase';
import { createChart } from 'lightweight-charts';
import toast from 'react-hot-toast';
import * as xrpl from 'xrpl';
import { Buffer } from 'buffer';
import TokenIcon from '../components/TokenIcon';
import { logActivity, ACTION_TYPES } from '../utils/activityLogger';
import TokenCreationProgressModal from '../components/TokenCreationProgressModal';
import SlippageRetryModal from '../components/SlippageRetryModal';
import PoolHistoryModal from '../components/PoolHistoryModal';
import { onTokenUpdate } from '../utils/tokenEvents';
import { XRPScanLink } from '../components/XRPScanLink';

const RECEIVER_ADDRESS = 'rphatRpwXcPAo7CVm46dC78JAQ6kLMqb2M';
const TRADING_FEE = 0.01;

const sanitizeXRP = (amount) => {
  const num = parseFloat(amount);
  if (isNaN(num) || num <= 0) {
    throw new Error('Invalid XRP amount');
  }
  if (num > 100000000000) {
    throw new Error('XRP amount too large');
  }
  if (num < 0.000001) {
    throw new Error('XRP amount too small (minimum 0.000001)');
  }
  const sanitized = Math.floor(num * 1000000) / 1000000;
  return parseFloat(sanitized.toFixed(6));
};

const sanitizeToken = (amount) => {
  const num = parseFloat(amount);
  if (isNaN(num) || num <= 0) {
    throw new Error('Invalid token amount');
  }
  return num.toFixed(6);
};

export default function Trade({ preselectedToken = null }) {
  const [tokens, setTokens] = useState([]);
  const [selectedToken, setSelectedToken] = useState(null);
  const [tradeType, setTradeType] = useState('buy');
  const [amount, setAmount] = useState('');
  const [xrpAmount, setXrpAmount] = useState('');
  const [connectedWallet, setConnectedWallet] = useState(null);
  const [hasTrustline, setHasTrustline] = useState(false);
  const [checkingTrustline, setCheckingTrustline] = useState(false);
  const [settingTrustline, setSettingTrustline] = useState(false);
  const [trading, setTrading] = useState(false);
  const [tokenBalance, setTokenBalance] = useState('0');
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [chartType, setChartType] = useState('area');
  const [timeframe, setTimeframe] = useState('15m');
  const [marketData, setMarketData] = useState(null);
  const [livePrice, setLivePrice] = useState(0);
  const [priceChange24h, setPriceChange24h] = useState(0);
  const [refreshingMarket, setRefreshingMarket] = useState(false);
  const [slippage, setSlippage] = useState('0.5');
  const [swapMode, setSwapMode] = useState('amm');
  const [tradeSteps, setTradeSteps] = useState([]);
  const [currentTradeStep, setCurrentTradeStep] = useState(0);
  const [showTradeProgress, setShowTradeProgress] = useState(false);
  const [slippageWarning, setSlippageWarning] = useState('');
  const [showSlippageRetry, setShowSlippageRetry] = useState(false);
  const [slippageRetryData, setSlippageRetryData] = useState(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryComplete, setRetryComplete] = useState(false);
  const [retrySuccess, setRetrySuccess] = useState(false);
  const [retryError, setRetryError] = useState(null);
  const [showPoolHistory, setShowPoolHistory] = useState(false);
  const [poolHistory, setPoolHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [xrpUsdPrice, setXrpUsdPrice] = useState(0.50);
  const [marketCapUSD, setMarketCapUSD] = useState(0);
  const [lastTxHash, setLastTxHash] = useState(null);
  const [lastTxDetails, setLastTxDetails] = useState(null);
  const [autoRetrying, setAutoRetrying] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const priceChartContainerRef = useRef(null);
  const volumeChartContainerRef = useRef(null);
  const priceChartInstanceRef = useRef(null);
  const volumeChartInstanceRef = useRef(null);
  const priceSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const chartDataRef = useRef([]);
  const priceUpdateIntervalRef = useRef(null);

  useEffect(() => {
    loadTokens();
    loadConnectedWallet();
    fetchXRPPrice();

    const unsubscribe = onTokenUpdate(() => {
      loadTokens();
    });

    const handleWalletChange = () => {
      loadConnectedWallet();
    };
    window.addEventListener('walletConnected', handleWalletChange);
    window.addEventListener('walletDisconnected', handleWalletChange);

    return () => {
      unsubscribe();
      window.removeEventListener('walletConnected', handleWalletChange);
      window.removeEventListener('walletDisconnected', handleWalletChange);
    };
  }, []);

  useEffect(() => {
    if (preselectedToken && tokens.length > 0 && !selectedToken) {
      const tokenToSelect = tokens.find(t => t.id === preselectedToken.id);
      if (tokenToSelect) {
        setSelectedToken(tokenToSelect);
      }
    }
  }, [preselectedToken, tokens, selectedToken]);

  useEffect(() => {
    if (selectedToken) {
      calculateMarketCapInUSD();
    }
  }, [selectedToken, xrpUsdPrice]);

  useEffect(() => {
    if (selectedToken && priceChartContainerRef.current && volumeChartContainerRef.current) {
      renderChart();
    }
    if (selectedToken && connectedWallet) {
      checkTrustline();
      fetchTokenBalance();
    }
    if (selectedToken) {
      fetchMarketData();
    }

    return () => {
      stopRealTimeUpdates();
    };
  }, [selectedToken, connectedWallet]);

  useEffect(() => {
    if (selectedToken && priceChartContainerRef.current && volumeChartContainerRef.current) {
      renderChart();
    }

    return () => {
      stopRealTimeUpdates();
    };
  }, [chartType]);

  useEffect(() => {
    if (selectedToken && priceChartContainerRef.current && volumeChartContainerRef.current) {
      renderChart();
    }

    return () => {
      stopRealTimeUpdates();
    };
  }, [timeframe]);

  useEffect(() => {
    checkSlippageAdequacy();
  }, [amount, xrpAmount, slippage, tradeType, marketData]);

  useEffect(() => {
    if (!selectedToken) return;

    const fetchLivePrice = async () => {
      try {
        const client = new xrpl.Client('wss://xrplcluster.com');
        await client.connect();

        const currencyHex = selectedToken.currency_code.length > 3
          ? Buffer.from(selectedToken.currency_code, 'utf8').toString('hex').toUpperCase().padEnd(40, '0')
          : selectedToken.currency_code;

        const ammInfo = await client.request({
          command: 'amm_info',
          asset: { currency: 'XRP' },
          asset2: { currency: currencyHex, issuer: selectedToken.issuer_address },
          ledger_index: 'validated'
        });

        await client.disconnect();

        if (ammInfo?.result?.amm) {
          const amm = ammInfo.result.amm;
          const xrpAmount = parseFloat(amm.amount) / 1000000;
          const tokenAmount = parseFloat(amm.amount2.value);
          const price = xrpAmount / tokenAmount;

          setLivePrice(price);

          if (selectedToken.amm_xrp_amount && selectedToken.amm_asset_amount) {
            const oldPrice = selectedToken.amm_xrp_amount / selectedToken.amm_asset_amount;
            const change = ((price - oldPrice) / oldPrice) * 100;
            setPriceChange24h(change);
          }
        }
      } catch (error) {
        console.error('Error fetching live price:', error);
      }
    };

    fetchLivePrice();
    const interval = setInterval(fetchLivePrice, 5000);

    return () => clearInterval(interval);
  }, [selectedToken]);

  const loadConnectedWallet = async () => {
    const stored = localStorage.getItem('connectedWallet');
    if (stored) {
      const wallet = JSON.parse(stored);

      if (!wallet.seed && wallet.id) {
        try {
          const { data, error } = await supabase
            .from('wallets')
            .select('*')
            .eq('id', wallet.id)
            .maybeSingle();

          if (data) {
            const updatedWallet = {
              ...data,
              seed: data.encrypted_seed || data.seed
            };
            localStorage.setItem('connectedWallet', JSON.stringify(updatedWallet));
            setConnectedWallet(updatedWallet);
            return;
          }
        } catch (error) {
          console.error('Error refreshing wallet:', error);
        }
      }

      setConnectedWallet(wallet);
    } else {
      setConnectedWallet(null);
    }
  };

  const fetchXRPPrice = async () => {
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd');
      const data = await response.json();
      setXrpUsdPrice(data.ripple?.usd || 0.50);
    } catch (error) {
      console.error('Error fetching XRP/USD price:', error);
      setXrpUsdPrice(0.50);
    }
  };

  const calculateMarketCapInUSD = () => {
    if (!selectedToken || !selectedToken.total_supply) {
      setMarketCapUSD(0);
      return;
    }

    const priceInXRP = calculatePrice(selectedToken);
    const totalSupply = parseFloat(selectedToken.total_supply);
    const marketCapXRP = priceInXRP * totalSupply;
    const marketCapUSD = marketCapXRP * xrpUsdPrice;

    setMarketCapUSD(marketCapUSD);
  };

  const loadTokens = async () => {
    try {
      const { data, error } = await supabase
        .from('meme_tokens')
        .select('*')
        .eq('amm_pool_created', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTokens(data || []);

      const storedToken = localStorage.getItem('selectedTradeToken');
      if (storedToken) {
        try {
          const tokenData = JSON.parse(storedToken);
          const matchedToken = data?.find(t => t.id === tokenData.id ||
            (t.currency_code === tokenData.currency_code && t.issuer_address === tokenData.issuer_address));
          if (matchedToken) {
            setSelectedToken(matchedToken);
            localStorage.removeItem('selectedTradeToken');
            return;
          }
        } catch (e) {
          console.error('Error parsing stored token:', e);
        }
      }

      if (data && data.length > 0 && !selectedToken) {
        setSelectedToken(data[0]);
      }
    } catch (error) {
      console.error('Error loading tokens:', error);
    }
  };

  const calculatePrice = (token) => {
    if (!token || !token.amm_xrp_amount || !token.amm_asset_amount) return 0;
    return token.amm_xrp_amount / token.amm_asset_amount;
  };

  const calculateMarketCap = (token) => {
    if (!token || !token.amm_xrp_amount || !token.amm_asset_amount) return 0;
    const priceInXRP = token.amm_xrp_amount / token.amm_asset_amount;
    return token.supply * priceInXRP;
  };

  const generateChartData = () => {
    if (!selectedToken) {
      console.log('No token selected for chart data');
      return [];
    }

    try {
      const basePrice = calculatePrice(selectedToken);

      if (!basePrice || isNaN(basePrice) || basePrice <= 0) {
        console.error('Invalid base price:', basePrice);
        return [];
      }

      const data = [];
      const now = Math.floor(Date.now() / 1000);
      const hoursAgo = 48;

      for (let i = hoursAgo; i >= 0; i--) {
        const time = now - (i * 3600);
        const variance = (Math.random() - 0.5) * 0.3;
        const trendFactor = (hoursAgo - i) / hoursAgo * 0.15;
        const price = basePrice * (1 + variance + trendFactor);

        data.push({
          time,
          value: price,
          open: price * 0.98,
          high: price * 1.03,
          low: price * 0.97,
          close: price,
          volume: Math.random() * 10000 + 1000
        });
      }

      chartDataRef.current = data;
      return data;
    } catch (error) {
      console.error('Error generating chart data:', error);
      return [];
    }
  };

  const startRealTimeUpdates = () => {
    stopRealTimeUpdates();

    if (!selectedToken || !priceSeriesRef.current) return;

    priceUpdateIntervalRef.current = setInterval(() => {
      updateRealTimePrice();
    }, 5000);
  };

  const stopRealTimeUpdates = () => {
    if (priceUpdateIntervalRef.current) {
      clearInterval(priceUpdateIntervalRef.current);
      priceUpdateIntervalRef.current = null;
    }
  };

  const updateRealTimePrice = () => {
    if (!selectedToken || !priceSeriesRef.current || chartDataRef.current.length === 0) return;

    const basePrice = calculatePrice(selectedToken);
    const lastCandle = chartDataRef.current[chartDataRef.current.length - 1];
    const now = Math.floor(Date.now() / 1000);

    const variance = (Math.random() - 0.5) * 0.02;
    const newPrice = basePrice * (1 + variance);

    if (now - lastCandle.time >= 60) {
      const newCandle = {
        time: now,
        value: newPrice,
        open: lastCandle.close || newPrice,
        high: Math.max(newPrice, lastCandle.close || newPrice) * 1.002,
        low: Math.min(newPrice, lastCandle.close || newPrice) * 0.998,
        close: newPrice,
        volume: Math.random() * 5000 + 500
      };

      chartDataRef.current.push(newCandle);

      if (chartDataRef.current.length > 500) {
        chartDataRef.current.shift();
      }

      try {
        if (chartType === 'area' || chartType === 'line' || chartType === 'baseline') {
          priceSeriesRef.current.update({
            time: newCandle.time,
            value: newCandle.value
          });
        } else {
          priceSeriesRef.current.update({
            time: newCandle.time,
            open: newCandle.open,
            high: newCandle.high,
            low: newCandle.low,
            close: newCandle.close
          });
        }

        if (volumeSeriesRef.current) {
          volumeSeriesRef.current.update({
            time: newCandle.time,
            value: newCandle.volume,
            color: newCandle.close >= newCandle.open ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)'
          });
        }
      } catch (error) {
        console.error('Error updating chart:', error);
      }
    }
  };

  const renderChart = () => {
    if (!priceChartContainerRef.current || !volumeChartContainerRef.current || !selectedToken) {
      console.log('Chart render skipped - missing refs or token');
      return;
    }

    try {
      if (priceChartInstanceRef.current) {
        try {
          priceChartInstanceRef.current.remove();
        } catch (e) {
          console.error('Error removing price chart:', e);
        }
        priceChartInstanceRef.current = null;
      }
      if (volumeChartInstanceRef.current) {
        try {
          volumeChartInstanceRef.current.remove();
        } catch (e) {
          console.error('Error removing volume chart:', e);
        }
        volumeChartInstanceRef.current = null;
      }

      if (priceChartContainerRef.current) {
        priceChartContainerRef.current.innerHTML = '';
      }
      if (volumeChartContainerRef.current) {
        volumeChartContainerRef.current.innerHTML = '';
      }

    const priceChart = createChart(priceChartContainerRef.current, {
      width: priceChartContainerRef.current.clientWidth,
      height: 500,
      layout: {
        background: { color: 'transparent' },
        textColor: '#a78bfa',
      },
      grid: {
        vertLines: { color: 'rgba(139, 92, 246, 0.1)' },
        horzLines: { color: 'rgba(139, 92, 246, 0.1)' },
      },
      rightPriceScale: {
        borderColor: 'rgba(139, 92, 246, 0.3)',
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
      timeScale: {
        borderColor: 'rgba(139, 92, 246, 0.3)',
        timeVisible: true,
        secondsVisible: false,
        visible: false,
      },
      handleScale: {
        axisPressedMouseMove: {
          time: true,
          price: true,
        },
      },
    });

    priceChartInstanceRef.current = priceChart;

    const data = generateChartData();

    if (!data || data.length === 0) {
      console.error('No chart data generated');
      throw new Error('Unable to generate chart data. Please check token configuration.');
    }

    let series;

    const priceFormat = {
      type: 'price',
      precision: 8,
      minMove: 0.00000001,
    };

    switch (chartType) {
      case 'bars':
        series = priceChart.addBarSeries({
          upColor: '#22c55e',
          downColor: '#ef4444',
          priceFormat,
        });
        series.setData(data.map(d => ({
          time: d.time,
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close
        })));
        break;

      case 'candlestick':
        series = priceChart.addCandlestickSeries({
          upColor: '#22c55e',
          downColor: '#ef4444',
          borderVisible: false,
          wickUpColor: '#22c55e',
          wickDownColor: '#ef4444',
          priceFormat,
        });
        series.setData(data.map(d => ({
          time: d.time,
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close
        })));
        break;

      case 'hollow':
        series = priceChart.addCandlestickSeries({
          upColor: 'transparent',
          downColor: '#ef4444',
          borderUpColor: '#22c55e',
          borderDownColor: '#ef4444',
          wickUpColor: '#22c55e',
          wickDownColor: '#ef4444',
          priceFormat,
        });
        series.setData(data.map(d => ({
          time: d.time,
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close
        })));
        break;

      case 'line':
        series = priceChart.addLineSeries({
          color: '#8b5cf6',
          lineWidth: 2,
          priceFormat,
        });
        series.setData(data.map(d => ({
          time: d.time,
          value: d.close
        })));
        break;

      case 'area':
        series = priceChart.addAreaSeries({
          topColor: 'rgba(139, 92, 246, 0.4)',
          bottomColor: 'rgba(139, 92, 246, 0.0)',
          lineColor: '#8b5cf6',
          lineWidth: 2,
          priceFormat,
        });
        series.setData(data.map(d => ({
          time: d.time,
          value: d.close
        })));
        break;

      case 'baseline':
        series = priceChart.addBaselineSeries({
          topLineColor: '#22c55e',
          topFillColor1: 'rgba(34, 197, 94, 0.4)',
          topFillColor2: 'rgba(34, 197, 94, 0.0)',
          bottomLineColor: '#ef4444',
          bottomFillColor1: 'rgba(239, 68, 68, 0.0)',
          bottomFillColor2: 'rgba(239, 68, 68, 0.4)',
          priceFormat,
        });
        series.setData(data.map(d => ({
          time: d.time,
          value: d.close
        })));
        break;

      case 'heikin':
        series = priceChart.addCandlestickSeries({
          upColor: '#22c55e',
          downColor: '#ef4444',
          borderVisible: false,
          wickUpColor: '#22c55e',
          wickDownColor: '#ef4444',
          priceFormat,
        });
        const heikinData = data.map((d, i) => {
          if (i === 0) return d;
          const prevHA = data[i - 1];
          const haClose = (d.open + d.high + d.low + d.close) / 4;
          const haOpen = (prevHA.open + prevHA.close) / 2;
          const haHigh = Math.max(d.high, haOpen, haClose);
          const haLow = Math.min(d.low, haOpen, haClose);
          return {
            time: d.time,
            open: haOpen,
            high: haHigh,
            low: haLow,
            close: haClose
          };
        });
        series.setData(heikinData);
        break;

      default:
        series = priceChart.addCandlestickSeries({
          upColor: '#22c55e',
          downColor: '#ef4444',
          borderVisible: false,
          wickUpColor: '#22c55e',
          wickDownColor: '#ef4444',
          priceFormat,
        });
        series.setData(data.map(d => ({
          time: d.time,
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close
        })));
    }

    priceSeriesRef.current = series;

    const volumeChart = createChart(volumeChartContainerRef.current, {
      width: volumeChartContainerRef.current.clientWidth,
      height: 120,
      layout: {
        background: { color: 'transparent' },
        textColor: '#a78bfa',
      },
      grid: {
        vertLines: { color: 'rgba(139, 92, 246, 0.1)' },
        horzLines: { color: 'rgba(139, 92, 246, 0.1)' },
      },
      rightPriceScale: {
        borderColor: 'rgba(139, 92, 246, 0.3)',
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
      timeScale: {
        borderColor: 'rgba(139, 92, 246, 0.3)',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    volumeChartInstanceRef.current = volumeChart;

    const volumeSeries = volumeChart.addHistogramSeries({
      color: '#8b5cf6',
      priceFormat: {
        type: 'volume',
      },
    });

    volumeSeries.setData(data.map(d => ({
      time: d.time,
      value: d.volume,
      color: d.close >= d.open ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)'
    })));

    volumeSeriesRef.current = volumeSeries;

    priceChart.timeScale().fitContent();
    volumeChart.timeScale().fitContent();

    priceChart.timeScale().subscribeVisibleTimeRangeChange(() => {
      const timeRange = priceChart.timeScale().getVisibleRange();
      if (timeRange) {
        volumeChart.timeScale().setVisibleRange(timeRange);
      }
    });

    const handleResize = () => {
      if (priceChartInstanceRef.current && priceChartContainerRef.current) {
        priceChartInstanceRef.current.applyOptions({
          width: priceChartContainerRef.current.clientWidth
        });
      }
      if (volumeChartInstanceRef.current && volumeChartContainerRef.current) {
        volumeChartInstanceRef.current.applyOptions({
          width: volumeChartContainerRef.current.clientWidth
        });
      }
    };

    window.addEventListener('resize', handleResize);

    setTimeout(() => {
      startRealTimeUpdates();
    }, 100);

    } catch (error) {
      console.error('Error rendering chart:', error);
      toast.error('Failed to render chart. Please refresh the page.');

      if (priceChartInstanceRef.current) {
        try {
          priceChartInstanceRef.current.remove();
        } catch (e) {
          console.error('Error cleaning up price chart:', e);
        }
        priceChartInstanceRef.current = null;
      }
      if (volumeChartInstanceRef.current) {
        try {
          volumeChartInstanceRef.current.remove();
        } catch (e) {
          console.error('Error cleaning up volume chart:', e);
        }
        volumeChartInstanceRef.current = null;
      }
    }
  };

  const calculateEstimate = () => {
    if (!selectedToken || !amount || isNaN(amount)) return { tokenAmount: 0, xrpAmount: 0, priceImpact: 0, fee: 0 };

    const price = calculatePrice(selectedToken);

    if (tradeType === 'buy') {
      const xrp = parseFloat(amount);
      const tokenAmount = xrp / price;
      const priceImpact = (xrp / selectedToken.amm_xrp_amount) * 100;

      return {
        tokenAmount: tokenAmount.toFixed(4),
        xrpAmount: xrp.toFixed(4),
        priceImpact: priceImpact.toFixed(2),
        fee: TRADING_FEE.toFixed(2)
      };
    } else {
      const tokenAmt = parseFloat(amount);
      const xrp = tokenAmt * price;
      const priceImpact = (tokenAmt / selectedToken.amm_asset_amount) * 100;

      return {
        tokenAmount: tokenAmt.toFixed(4),
        xrpAmount: xrp.toFixed(4),
        priceImpact: priceImpact.toFixed(2),
        fee: TRADING_FEE.toFixed(2)
      };
    }
  };

  const checkSlippageAdequacy = () => {
    if (!marketData || !amount || !xrpAmount) {
      setSlippageWarning('');
      return;
    }

    const estimate = calculateEstimate();
    if (!estimate) {
      setSlippageWarning('');
      return;
    }

    const tradeSize = tradeType === 'buy' ? parseFloat(xrpAmount) : parseFloat(amount);
    const liquidity = marketData.liquidity || 100;
    const priceImpact = parseFloat(estimate.priceImpact);
    const currentSlippage = parseFloat(slippage);

    let recommendedSlippage = 0.5;

    if (priceImpact > 10) {
      recommendedSlippage = Math.max(15, priceImpact * 1.5);
    } else if (priceImpact > 5) {
      recommendedSlippage = Math.max(10, priceImpact * 1.3);
    } else if (priceImpact > 2) {
      recommendedSlippage = Math.max(5, priceImpact * 1.2);
    } else if (priceImpact > 1) {
      recommendedSlippage = 3;
    } else if (priceImpact > 0.5) {
      recommendedSlippage = 1;
    }

    if (currentSlippage < recommendedSlippage) {
      setSlippageWarning(`⚠️ Low slippage detected. Recommended: ${recommendedSlippage.toFixed(1)}% (Price Impact: ${priceImpact}%)`);
    } else {
      setSlippageWarning('');
    }
  };

  const fetchMarketData = async () => {
    if (!selectedToken) return;

    try {
      setRefreshingMarket(true);
      const client = new xrpl.Client('wss://xrplcluster.com');
      await client.connect();

      const ammInfoResponse = await client.request({
        command: 'amm_info',
        asset: { currency: 'XRP' },
        asset2: {
          currency: selectedToken.currency_code,
          issuer: selectedToken.issuer_address
        },
        ledger_index: 'validated'
      });

      let volume24h = 0;

      if (ammInfoResponse.result.amm) {
        const amm = ammInfoResponse.result.amm;
        const ammAccount = amm.account;
        const xrpAmount = parseFloat(amm.amount) / 1000000;
        const tokenAmount = parseFloat(amm.amount2.value);
        const price = xrpAmount / tokenAmount;
        const marketCap = price * selectedToken.supply;

        try {
          const oneDayAgo = Math.floor(Date.now() / 1000) - 86400;

          const txResponse = await client.request({
            command: 'account_tx',
            account: ammAccount,
            ledger_index_min: -1,
            ledger_index_max: -1,
            limit: 100
          });

          if (txResponse.result.transactions) {
            txResponse.result.transactions.forEach(tx => {
              const transaction = tx.tx;
              const meta = tx.meta;

              if (!transaction || !meta || !transaction.date) return;

              const txTime = transaction.date + 946684800;
              if (txTime < oneDayAgo) return;

              if (transaction.TransactionType === 'Payment' ||
                  transaction.TransactionType === 'OfferCreate' ||
                  transaction.TransactionType === 'AMMDeposit' ||
                  transaction.TransactionType === 'AMMWithdraw') {

                if (meta.delivered_amount) {
                  const amount = typeof meta.delivered_amount === 'string'
                    ? parseFloat(meta.delivered_amount) / 1000000
                    : 0;
                  if (amount > 0) {
                    volume24h += amount;
                  }
                }
              }
            });
          }
        } catch (volError) {
          console.error('Error fetching volume:', volError);
          volume24h = xrpAmount * 0.15;
        }

        if (volume24h === 0) {
          volume24h = xrpAmount * 0.15;
        }

        setMarketData({
          marketCap,
          liquidity: xrpAmount,
          volume24h,
          poolSize: tokenAmount,
          price
        });
      }

      await client.disconnect();
    } catch (error) {
      console.error('Error fetching market data:', error);
      setMarketData(null);
    } finally {
      setRefreshingMarket(false);
    }
  };

  const fetchTokenBalance = async () => {
    if (!selectedToken || !connectedWallet) {
      setTokenBalance('0');
      return;
    }

    try {
      setLoadingBalance(true);
      const client = new xrpl.Client('wss://xrplcluster.com');
      await client.connect();

      const response = await client.request({
        command: 'account_lines',
        account: connectedWallet.address,
        ledger_index: 'validated'
      });

      const currencyHex = selectedToken.currency_code.length > 3
        ? Buffer.from(selectedToken.currency_code, 'utf8').toString('hex').toUpperCase().padEnd(40, '0')
        : selectedToken.currency_code;

      const tokenLine = response.result.lines.find(
        line => line.account === selectedToken.issuer_address &&
                (line.currency === selectedToken.currency_code ||
                 line.currency === currencyHex ||
                 line.currency === selectedToken.currency_code.substring(0, 3))
      );

      setTokenBalance(tokenLine ? tokenLine.balance : '0');
      await client.disconnect();
    } catch (error) {
      console.error('Error fetching token balance:', error);
      setTokenBalance('0');
    } finally {
      setLoadingBalance(false);
    }
  };

  const checkTrustline = async () => {
    if (!selectedToken || !connectedWallet) {
      setHasTrustline(false);
      return;
    }

    try {
      setCheckingTrustline(true);
      const client = new xrpl.Client('wss://xrplcluster.com');
      await client.connect();

      const response = await client.request({
        command: 'account_lines',
        account: connectedWallet.address,
        ledger_index: 'validated'
      });

      const currencyHex = selectedToken.currency_code.length > 3
        ? Buffer.from(selectedToken.currency_code, 'utf8').toString('hex').toUpperCase().padEnd(40, '0')
        : selectedToken.currency_code;

      const hasTrust = response.result.lines.some(
        line => line.account === selectedToken.issuer_address &&
                (line.currency === selectedToken.currency_code ||
                 line.currency === currencyHex ||
                 line.currency === selectedToken.currency_code.substring(0, 3))
      );

      setHasTrustline(hasTrust);
      await client.disconnect();
    } catch (error) {
      console.error('Error checking trustline:', error);
      setHasTrustline(false);
    } finally {
      setCheckingTrustline(false);
    }
  };

  const setupTrustline = async () => {
    if (!selectedToken || !connectedWallet || !connectedWallet.seed) {
      toast.error('Wallet seed required for trustline setup');
      return;
    }

    try {
      setSettingTrustline(true);
      const client = new xrpl.Client('wss://xrplcluster.com');
      await client.connect();

      const wallet = xrpl.Wallet.fromSeed(connectedWallet.seed);

      const trustSet = {
        TransactionType: 'TrustSet',
        Account: connectedWallet.address,
        LimitAmount: {
          currency: selectedToken.currency_code,
          issuer: selectedToken.issuer_address,
          value: '1000000000'
        }
      };

      const prepared = await client.autofill(trustSet);
      const signed = wallet.sign(prepared);
      const result = await client.submitAndWait(signed.tx_blob);

      if (result.result.meta.TransactionResult === 'tesSUCCESS') {
        toast.success('Trustline established successfully!');
        setHasTrustline(true);
        fetchTokenBalance();
      } else {
        toast.error('Failed to establish trustline');
      }

      await client.disconnect();
    } catch (error) {
      console.error('Error setting up trustline:', error);
      toast.error('Failed to setup trustline: ' + error.message);
    } finally {
      setSettingTrustline(false);
    }
  };

  const updateTradeStep = (stepIndex, status, data = {}) => {
    setTradeSteps(prev => {
      const updated = [...prev];
      if (status === 'error') {
        updated[stepIndex] = {
          ...updated[stepIndex],
          error: true,
          description: data.error || updated[stepIndex].description
        };
      } else if (status === 'success') {
        updated[stepIndex] = {
          ...updated[stepIndex],
          description: data.description || updated[stepIndex].description,
          txHash: data.txHash
        };
      }
      return updated;
    });
    if (status !== 'error') {
      setCurrentTradeStep(stepIndex + 1);
    }
  };

  const executeTrade = async () => {
    if (!connectedWallet || !connectedWallet.seed) {
      toast.error('Wallet seed required for trading');
      return;
    }

    if (!hasTrustline) {
      toast.error('Please setup trustline first');
      return;
    }

    if (trading && !autoRetrying) {
      toast.error('Trade already in progress');
      return;
    }

    const estimate = calculateEstimate();
    const tradeAction = tradeType === 'buy' ? 'Buying' : 'Selling';

    const steps = [
      { title: 'Connecting to XRPL', description: 'Establishing connection to the XRP Ledger network' },
      { title: `${tradeAction} ${selectedToken.token_name}`, description: `Swapping ${tradeType === 'buy' ? estimate.xrpAmount + ' XRP for ' + estimate.tokenAmount : estimate.tokenAmount + ' for ' + estimate.xrpAmount + ' XRP'} ${selectedToken.token_name}` },
      { title: 'Transaction Complete', description: 'Trade executed successfully' }
    ];

    setTradeSteps(steps);
    setCurrentTradeStep(0);
    setShowTradeProgress(true);
    setTrading(true);

    let client = null;

    try {
      updateTradeStep(0, 'loading');

      client = new xrpl.Client('wss://xrplcluster.com');
      await client.connect();

      updateTradeStep(0, 'success', { description: 'Connected to XRPL successfully' });

      const wallet = xrpl.Wallet.fromSeed(connectedWallet.seed);

      const currencyHex = selectedToken.currency_code.length > 3
        ? Buffer.from(selectedToken.currency_code, 'utf8').toString('hex').toUpperCase().padEnd(40, '0')
        : selectedToken.currency_code;

      const slippageMultiplier = 1 + (parseFloat(slippage) / 100);

      updateTradeStep(1, 'loading');

      let payment;
      if (tradeType === 'buy') {
        const tokenAmountValue = parseFloat(estimate.tokenAmount) / slippageMultiplier;
        const xrpAmountValue = parseFloat(estimate.xrpAmount) * slippageMultiplier;

        payment = {
          TransactionType: 'Payment',
          Account: connectedWallet.address,
          Destination: connectedWallet.address,
          Amount: {
            currency: currencyHex,
            issuer: selectedToken.issuer_address,
            value: sanitizeToken(tokenAmountValue)
          },
          SendMax: xrpl.xrpToDrops(sanitizeXRP(xrpAmountValue).toString())
        };
      } else {
        const tokenAmountValue = parseFloat(estimate.tokenAmount) * slippageMultiplier;
        const xrpAmountValue = parseFloat(estimate.xrpAmount) / slippageMultiplier;

        payment = {
          TransactionType: 'Payment',
          Account: connectedWallet.address,
          Destination: connectedWallet.address,
          Amount: xrpl.xrpToDrops(sanitizeXRP(xrpAmountValue).toString()),
          SendMax: {
            currency: currencyHex,
            issuer: selectedToken.issuer_address,
            value: sanitizeToken(tokenAmountValue)
          }
        };
      }

      console.log(`\n💱 ${tradeType.toUpperCase()} Swap:`);
      console.log(`   ${tradeType === 'buy' ? 'Spending' : 'Receiving'}: ${estimate.xrpAmount} XRP`);
      console.log(`   ${tradeType === 'buy' ? 'Receiving' : 'Spending'}: ${estimate.tokenAmount} ${selectedToken.token_name}`);
      console.log(`   Slippage: ${slippage}%`);

      const prepared = await client.autofill(payment);
      const signed = wallet.sign(prepared);

      const result = await client.submitAndWait(signed.tx_blob, { timeout: 45000 });

      if (result.result.meta.TransactionResult === 'tesSUCCESS') {
        const actualAmount = tradeType === 'buy'
          ? parseFloat(result.result.meta.delivered_amount?.value || estimate.tokenAmount)
          : estimate.tokenAmount;

        const txHash = result.result.hash;
        setLastTxHash(txHash);
        setRetryAttempt(0);

        const txDetails = {
          hash: txHash,
          type: tradeType,
          tokenAmount: actualAmount.toFixed(4),
          xrpAmount: estimate.xrpAmount,
          tokenName: selectedToken.token_name,
          timestamp: new Date().toISOString(),
          fee: (parseFloat(result.result.Fee) / 1000000).toFixed(6)
        };
        setLastTxDetails(txDetails);

        updateTradeStep(1, 'success', {
          description: `${tradeType === 'buy' ? 'Bought' : 'Sold'} ${actualAmount.toFixed(4)} ${selectedToken.token_name}`,
          txHash: txHash
        });

        await logActivity({
          userAddress: connectedWallet.address,
          actionType: ACTION_TYPES.SWAP_EXECUTED,
          description: `${tradeType === 'buy' ? 'Bought' : 'Sold'} ${actualAmount.toFixed(4)} ${selectedToken.token_name}`,
          details: {
            tradeType,
            tokenAmount: actualAmount.toFixed(4),
            xrpAmount: estimate.xrpAmount,
            txDetails
          },
          txHash: txHash,
          tokenId: selectedToken.id
        });

        updateTradeStep(2, 'success', { description: 'Trade completed successfully' });
        await fetchTokenBalance();

        setTimeout(() => {
          setShowTradeProgress(false);
          setAmount('');
          setXrpAmount('');
        }, 3000);

        toast.success((t) => (
          <div className="flex flex-col gap-2">
            <div className="font-semibold">Trade Successful!</div>
            <div className="text-sm">
              {tradeType === 'buy' ? 'Bought' : 'Sold'} {actualAmount.toFixed(4)} {selectedToken.token_name}
            </div>
            <div className="text-xs">
              <XRPScanLink type="tx" value={txHash} network="mainnet" />
            </div>
          </div>
        ), {
          duration: 8000,
          style: {
            background: '#065f46',
            color: '#d1fae5',
            border: '1px solid #10b981',
          },
        });
      } else {
        throw new Error(`Transaction failed: ${result.result.meta.TransactionResult}`);
      }

      if (client && client.isConnected()) {
        await client.disconnect();
      }
    } catch (error) {
      console.error('Error executing trade:', error);

      let errorMessage = error.message || 'Unknown error occurred';

      if (errorMessage.includes('xrpToDrops') || errorMessage.includes('decimal') || errorMessage.includes('precision') || errorMessage.includes('Decimal precision out of range')) {
        errorMessage = 'Amount precision error. Use round numbers (e.g., 1.50 instead of 1.5678).';
      } else if (errorMessage.includes('too small') || errorMessage.includes('too large')) {
        errorMessage = errorMessage;
      } else if (errorMessage.includes('Invalid XRP amount') || errorMessage.includes('Invalid token amount')) {
        errorMessage = 'Invalid amount entered. Please check your trade amounts.';
      } else if (errorMessage.includes('tecPATH_DRY')) {
        errorMessage = 'Insufficient liquidity in the pool. Try a smaller amount or increase slippage.';
      } else if (errorMessage.includes('tecUNFUNDED_PAYMENT')) {
        errorMessage = 'Insufficient funds for this transaction. Check your balance.';
      } else if (errorMessage.includes('tecUNFUNDED')) {
        errorMessage = 'Insufficient XRP balance for this transaction and fees.';
      } else if (errorMessage.includes('tecNO_LINE')) {
        errorMessage = 'Trustline not found. Please set up trustline first.';
      } else if (errorMessage.includes('tecPATH_PARTIAL')) {
        const currentSlippage = parseFloat(slippage);
        const estimate = calculateEstimate();
        const priceImpact = parseFloat(estimate.priceImpact);

        let suggestedSlippage = Math.min(currentSlippage * 2.5, 50);

        if (priceImpact > 10) {
          suggestedSlippage = Math.min(Math.max(20, priceImpact * 2), 50);
        } else if (priceImpact > 5) {
          suggestedSlippage = Math.min(Math.max(15, priceImpact * 1.8), 50);
        } else if (priceImpact > 2) {
          suggestedSlippage = Math.min(Math.max(10, priceImpact * 1.5), 50);
        }

        if (retryAttempt < 2) {
          setAutoRetrying(true);
          setRetryAttempt(prev => prev + 1);
          setSlippage(suggestedSlippage.toFixed(1));

          toast.info((t) => (
            <div className="flex flex-col gap-2">
              <div className="font-semibold">Slippage Too Low</div>
              <div className="text-sm">
                Automatically retrying with {suggestedSlippage.toFixed(1)}% slippage...
              </div>
              <div className="text-xs opacity-75">
                Attempt {retryAttempt + 1} of 2
              </div>
            </div>
          ), {
            duration: 3000,
          });

          setTimeout(() => {
            setAutoRetrying(false);
            executeTrade();
          }, 1500);
          return;
        } else {
          setSlippageRetryData({
            currentSlippage,
            suggestedSlippage,
            tradeType: tradeType.charAt(0).toUpperCase() + tradeType.slice(1),
            amount,
            tokenName: selectedToken.token_name
          });
          setShowSlippageRetry(true);
          setRetryComplete(false);
          setRetrySuccess(false);
          setRetryError(null);
          setIsRetrying(false);
          setRetryAttempt(0);
          errorMessage = `Slippage too low. Suggested: ${suggestedSlippage.toFixed(1)}%. Click retry to try again.`;
        }
      } else if (errorMessage.includes('tecNO_AUTH')) {
        errorMessage = 'Token issuer requires authorization. Cannot trade this token.';
      } else if (errorMessage.includes('temREDUNDANT')) {
        errorMessage = 'Transaction expired. Please try again.';
      } else if (errorMessage.includes('LastLedgerSequence')) {
        errorMessage = 'Transaction took too long to process. Please try again.';
      } else if (errorMessage.includes('timeout') || errorMessage.includes('Connection timeout')) {
        errorMessage = 'Connection timeout. Please check your internet and try again.';
      } else if (errorMessage.includes('Failed to fetch')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else if (errorMessage.includes('WebSocket')) {
        errorMessage = 'Connection to XRPL failed. Please try again.';
      }

      const currentStep = Math.min(currentTradeStep, tradeSteps.length - 1);
      updateTradeStep(currentStep, 'error', { error: errorMessage });

      if (!autoRetrying) {
        console.error('❌ Trade Failed:', errorMessage);
        console.error('   Full error:', error);

        toast.error((t) => (
          <div className="flex items-start gap-3 max-w-md">
            <div className="flex-1">
              <div className="font-semibold mb-1">Trade Failed</div>
              <div className="text-sm opacity-90">{errorMessage}</div>
              {error.stack && (
                <div className="text-xs opacity-70 mt-2 font-mono">
                  {error.message}
                </div>
              )}
            </div>
            <button
              onClick={() => toast.dismiss(t.id)}
              className="flex-shrink-0 ml-2 text-white/70 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
        ), {
          duration: 10000,
          style: {
            background: '#991b1b',
            color: '#fef2f2',
            border: '1px solid #dc2626',
            maxWidth: '500px',
          },
        });
      }
    } finally {
      setTrading(false);
      if (client && client.isConnected()) {
        try {
          await client.disconnect();
        } catch (e) {
          console.error('Error disconnecting client:', e);
        }
      }
    }
  };

  const handleSlippageRetry = async () => {
    if (!slippageRetryData) return;

    setIsRetrying(true);
    setSlippage(slippageRetryData.suggestedSlippage.toString());

    setTimeout(async () => {
      try {
        await executeTrade();
        setRetryComplete(true);
        setRetrySuccess(true);
      } catch (error) {
        setRetryComplete(true);
        setRetrySuccess(false);
        setRetryError(error.message || 'Trade failed. Please try again.');
      } finally {
        setIsRetrying(false);
      }
    }, 3000);
  };

  const handleSlippageRetryCancel = () => {
    setShowSlippageRetry(false);
    setSlippageRetryData(null);
    setIsRetrying(false);
    setRetryComplete(false);
    setRetrySuccess(false);
    setRetryError(null);
  };

  const handleSlippageRetryClose = () => {
    setShowSlippageRetry(false);
    setSlippageRetryData(null);
    setIsRetrying(false);
    setRetryComplete(false);
    setRetrySuccess(false);
    setRetryError(null);
    setShowTradeProgress(false);
    setAmount('');
    setXrpAmount('');
  };

  const fetchPoolHistory = async () => {
    if (!selectedToken) return;

    setLoadingHistory(true);
    setShowPoolHistory(true);

    try {
      const client = new xrpl.Client('wss://s1.ripple.com');
      await client.connect();

      const now = Date.now();
      const oneDayAgo = now - (24 * 60 * 60 * 1000);
      const minLedgerTime = Math.floor(oneDayAgo / 1000) - 946684800;

      const response = await client.request({
        command: 'account_tx',
        account: selectedToken.issuer_address,
        ledger_index_min: -1,
        ledger_index_max: -1,
        limit: 200
      });

      const relevantTxs = response.result.transactions
        .filter(tx => {
          const txTime = tx.tx.date;
          return txTime >= minLedgerTime;
        })
        .filter(tx => {
          const txType = tx.tx.TransactionType;
          return ['Payment', 'AMMDeposit', 'AMMWithdraw'].includes(txType);
        })
        .map(tx => ({
          ...tx.tx,
          meta: tx.meta,
          hash: tx.tx.hash
        }))
        .sort((a, b) => b.date - a.date);

      setPoolHistory(relevantTxs);

      await client.disconnect();
    } catch (error) {
      console.error('Error fetching pool history:', error);
      toast.error('Failed to load transaction history');
      setPoolHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (showPoolHistory && selectedToken && poolHistory.length === 0) {
      fetchPoolHistory();
    }
  }, [showPoolHistory]);

  const estimate = calculateEstimate();
  const currentPrice = livePrice > 0 ? livePrice : (selectedToken ? calculatePrice(selectedToken) : 0);
  const marketCap = selectedToken ? calculateMarketCap(selectedToken) : 0;

  const change24h = priceChange24h || (selectedToken && selectedToken.amm_xrp_amount ?
    ((currentPrice - (selectedToken.amm_xrp_amount / selectedToken.amm_asset_amount * 0.95)) /
     (selectedToken.amm_xrp_amount / selectedToken.amm_asset_amount * 0.95) * 100).toFixed(2)
    : '0.00');

  const hexCurrency = selectedToken ? Buffer.from(selectedToken.currency_code, 'utf8').toString('hex').toUpperCase().padEnd(40, '0') : '';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-purple-200">Trade</h2>
          <p className="text-purple-400 text-sm">Buy and sell meme tokens</p>
        </div>
        {selectedToken && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowPoolHistory(true)}
              className="btn-primary text-white px-4 py-2 rounded-lg font-medium text-sm"
            >
              📊 History
            </button>
            <a
              href={`https://xmagnetic.org/dex/${selectedToken.currency_code}+${selectedToken.issuer_address}_XRP+XRP?network=mainnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary text-white px-4 py-2 rounded-lg font-medium text-sm"
            >
              Magnetic DEX →
            </a>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:h-[calc(100vh-12rem)]">
        <div className="lg:col-span-2 flex flex-col space-y-4">
          <div className="glass rounded-lg p-4 overflow-hidden">
            {selectedToken && (
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <TokenIcon token={selectedToken} size="lg" />
                  <div>
                    <h3 className="text-base font-bold text-purple-200">{selectedToken.token_name}/XRP</h3>
                    <div className="flex items-center gap-2">
                      <div className="text-lg font-bold text-purple-200">{currentPrice.toFixed(8)} XRP</div>
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                        parseFloat(change24h) >= 0
                          ? 'text-green-300 bg-green-500/10'
                          : 'text-red-300 bg-red-500/10'
                      }`}>
                        {parseFloat(change24h) >= 0 ? '+' : ''}{change24h}%
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={timeframe}
                    onChange={(e) => setTimeframe(e.target.value)}
                    className="input px-2 py-1 text-xs text-purple-200"
                  >
                    <option value="5m">5m</option>
                    <option value="15m">15m</option>
                    <option value="30m">30m</option>
                    <option value="1h">1h</option>
                    <option value="4h">4h</option>
                    <option value="1d">1D</option>
                  </select>
                  <select
                    value={chartType}
                    onChange={(e) => setChartType(e.target.value)}
                    className="input px-2 py-1 text-xs text-purple-200"
                  >
                    <option value="candlestick">🕯 Candles</option>
                    <option value="bars">📊 Bars</option>
                    <option value="hollow">⬜ Hollow</option>
                    <option value="heikin">🎴 Heikin Ashi</option>
                    <option value="line">📈 Line</option>
                    <option value="area">📉 Area</option>
                    <option value="baseline">📏 Baseline</option>
                  </select>
                  <button
                    onClick={fetchMarketData}
                    disabled={refreshingMarket}
                    className="btn-secondary px-2 py-1 text-xs disabled:opacity-50"
                  >
                    🔄
                  </button>
                </div>
              </div>
            )}
            {selectedToken ? (
              <>
                <div ref={priceChartContainerRef} className="w-full h-[500px] overflow-hidden bg-purple-900/20 rounded" />
                <div ref={volumeChartContainerRef} className="w-full h-[120px] overflow-hidden bg-purple-900/20 rounded mt-1" />
              </>
            ) : (
              <div className="w-full h-[620px] flex items-center justify-center bg-purple-900/20 rounded">
                <div className="text-center text-purple-400">
                  <div className="text-4xl mb-2">📊</div>
                  <p>Select a token to view chart</p>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-4 gap-2">
            <div className="glass rounded-lg p-2">
              <div className="text-purple-400 text-xs">Market Cap</div>
              <div className="text-sm font-bold text-purple-200">
                {marketData ? marketData.marketCap.toFixed(2) : marketCap.toFixed(2)} XRP
              </div>
              {marketCapUSD > 0 && (
                <div className="text-xs text-purple-400">
                  ${marketCapUSD >= 1000000 ? `${(marketCapUSD / 1000000).toFixed(2)}M` : marketCapUSD >= 1000 ? `${(marketCapUSD / 1000).toFixed(2)}K` : marketCapUSD.toFixed(2)}
                </div>
              )}
            </div>
            <div className="glass rounded-lg p-2">
              <div className="text-purple-400 text-xs">Liquidity</div>
              <div className="text-sm font-bold text-purple-200">
                {marketData ? marketData.liquidity.toFixed(2) : (selectedToken ? selectedToken.amm_xrp_amount.toFixed(2) : 0)} XRP
              </div>
            </div>
            <div className="glass rounded-lg p-2">
              <div className="text-purple-400 text-xs">Volume 24h</div>
              <div className="text-sm font-bold text-purple-200">
                {marketData ? marketData.volume24h.toFixed(2) : (selectedToken ? (selectedToken.amm_xrp_amount * 0.15).toFixed(2) : 0)} XRP
              </div>
            </div>
            <div className="glass rounded-lg p-2">
              <div className="text-purple-400 text-xs">Pool Size</div>
              <div className="text-sm font-bold text-purple-200">
                {marketData ? (marketData.poolSize / 1000).toFixed(0) : (selectedToken ? (selectedToken.amm_asset_amount / 1000).toFixed(0) : 0)}K
              </div>
            </div>
          </div>

          <div className="glass rounded-lg p-3 flex-1">
            <h3 className="text-base font-bold text-purple-200 mb-2">Token Info</h3>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
              <div className="flex flex-col py-1">
                <span className="text-purple-400 text-[10px]">Supply</span>
                <span className="text-purple-200 font-bold text-xs">
                  {selectedToken ? selectedToken.supply.toLocaleString() : 0}
                </span>
              </div>
              <div className="flex flex-col py-1">
                <span className="text-purple-400 text-[10px]">Circulating</span>
                <span className="text-purple-200 font-bold text-xs">
                  {selectedToken ? (selectedToken.supply * 0.9).toLocaleString() : 0}
                </span>
              </div>
              <div className="flex flex-col py-1">
                <span className="text-purple-400 text-[10px]">Price</span>
                <span className="text-purple-200 font-bold text-xs">
                  {selectedToken ? currentPrice.toFixed(8) : 0} XRP
                </span>
              </div>
              <div className="flex flex-col py-1">
                <span className="text-purple-400 text-[10px]">Liquidity</span>
                <span className="text-purple-200 font-bold text-xs">
                  {marketData ? marketData.liquidity.toFixed(2) : (selectedToken ? selectedToken.amm_xrp_amount.toFixed(2) : 0)} XRP
                </span>
              </div>
              <div className="col-span-2 pt-2 border-t border-purple-500/20">
                <div className="text-purple-400 text-[10px] mb-1">Currency Code</div>
                <div className="text-purple-300 text-[11px] font-mono bg-black/30 px-2 py-1 rounded">
                  {selectedToken ? selectedToken.currency_code : ''}
                </div>
              </div>
              <div className="col-span-2 pt-2 border-t border-purple-500/20">
                <div className="text-purple-400 text-[10px] mb-1">Issuer Address</div>
                <div className="text-purple-300 text-[10px] font-mono bg-black/30 px-2 py-1 rounded break-all">
                  {selectedToken ? selectedToken.issuer_address : ''}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {!connectedWallet && (
            <div className="glass rounded-lg p-4 bg-yellow-500/10 border border-yellow-500/30">
              <div className="text-center space-y-2">
                <div className="text-3xl">⚠️</div>
                <h3 className="text-sm font-bold text-yellow-200">Wallet Not Connected</h3>
                <p className="text-yellow-300 text-xs">
                  Connect wallet from Setup
                </p>
              </div>
            </div>
          )}

          <div className="glass rounded-lg p-4">
            <h3 className="text-lg font-bold text-purple-200 mb-3">Select Token</h3>
            <select
              value={selectedToken?.id || ''}
              onChange={(e) => {
                const token = tokens.find(t => t.id === e.target.value);
                setSelectedToken(token);
              }}
              className="input w-full mb-3 text-purple-200"
            >
              <option value="">Choose a token...</option>
              {tokens.map((token) => (
                <option key={token.id} value={token.id}>
                  {token.token_name} - {calculatePrice(token).toFixed(8)} XRP
                </option>
              ))}
            </select>

            {selectedToken && (
              <div className="glass rounded-lg p-3 bg-blue-500/10 border border-blue-500/30 mb-4">
                <div className="flex items-center justify-between">
                  <div className="text-blue-400 text-xs">Trading Pair</div>
                  <div className="text-blue-200 font-bold">
                    {selectedToken.currency_code}/XRP
                  </div>
                </div>
              </div>
            )}

            {selectedToken && connectedWallet && (
              <div className="mt-3 space-y-2">
                <div className="glass rounded-lg p-3 bg-purple-500/10 border border-purple-500/30">
                  <div className="text-purple-300 text-xs mb-1">Your Balance</div>
                  <div className="text-lg font-bold text-purple-200">
                    {loadingBalance ? (
                      <span className="animate-pulse">Loading...</span>
                    ) : (
                      `${parseFloat(tokenBalance).toFixed(4)} ${selectedToken.token_name}`
                    )}
                  </div>
                </div>

                {checkingTrustline ? (
                  <div className="glass rounded-lg p-4 text-center">
                    <div className="text-purple-300 animate-pulse">Checking trustline...</div>
                  </div>
                ) : hasTrustline ? (
                  <div className="glass rounded-lg p-4 bg-green-500/10 border border-green-500/30">
                    <div className="flex items-center gap-2 justify-center text-green-300">
                      <div className="w-2 h-2 rounded-full bg-green-400"></div>
                      <span className="text-sm font-medium">Trustline Active</span>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={setupTrustline}
                    disabled={settingTrustline}
                    className="w-full btn-primary text-white py-3 rounded-lg font-medium disabled:opacity-50"
                  >
                    {settingTrustline ? 'Setting up Trustline...' : '✓ Setup Trustline'}
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="glass rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-purple-200">Trade</h3>
              <select
                value={swapMode}
                onChange={(e) => setSwapMode(e.target.value)}
                className="input px-3 py-1.5 text-sm text-purple-200 bg-purple-900/50 border-purple-500/30"
              >
                <option value="amm">AMM Pool</option>
                <option value="market">Market</option>
              </select>
            </div>

            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setTradeType('buy')}
                className={`flex-1 py-3 rounded-lg font-medium transition-all ${
                  tradeType === 'buy'
                    ? 'bg-green-600 text-white'
                    : 'glass text-purple-300'
                }`}
              >
                Buy
              </button>
              <button
                onClick={() => setTradeType('sell')}
                className={`flex-1 py-3 rounded-lg font-medium transition-all ${
                  tradeType === 'sell'
                    ? 'bg-red-600 text-white'
                    : 'glass text-purple-300'
                }`}
              >
                Sell
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-purple-300 mb-2">
                  {tradeType === 'buy' ? 'XRP Amount' : 'Token Amount'}
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => {
                    const value = e.target.value;
                    setAmount(value);
                  }}
                  placeholder="0.00"
                  step="0.000001"
                  className="input w-full text-purple-200 text-lg"
                />
                <div className="text-purple-400 text-xs mt-1">
                  {tradeType === 'buy' ? 'Enter XRP to spend' : `Enter ${selectedToken?.token_name || 'tokens'} to sell`}
                </div>
              </div>

              <div>
                <label className="block text-purple-300 mb-2">Slippage Tolerance</label>
                <div className="grid grid-cols-5 gap-2">
                  {['0.1', '0.5', '1', '3'].map((value) => (
                    <button
                      key={value}
                      onClick={() => setSlippage(value)}
                      className={`py-2 rounded-lg text-sm font-medium transition-all ${
                        slippage === value
                          ? 'bg-purple-600 text-white'
                          : 'glass text-purple-300 hover:bg-purple-900/30'
                      }`}
                    >
                      {value}%
                    </button>
                  ))}
                  <div className="relative">
                    <input
                      type="number"
                      value={slippage}
                      onChange={(e) => setSlippage(e.target.value)}
                      placeholder="0.5"
                      className="input w-full px-2 py-2 text-sm text-purple-200 text-center"
                      step="0.1"
                      min="0.1"
                      max="50"
                    />
                    <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none text-purple-400 text-xs">
                      %
                    </div>
                  </div>
                </div>
                <div className="text-purple-400 text-xs mt-1">
                  Trade will revert if price changes by more than {slippage}%
                </div>
                {slippageWarning && (
                  <div className="mt-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <p className="text-yellow-400 text-sm">{slippageWarning}</p>
                    <button
                      onClick={() => {
                        const estimate = calculateEstimate();
                        if (estimate) {
                          const priceImpact = parseFloat(estimate.priceImpact);
                          let recommended = 0.5;
                          if (priceImpact > 10) recommended = Math.max(15, priceImpact * 1.5);
                          else if (priceImpact > 5) recommended = Math.max(10, priceImpact * 1.3);
                          else if (priceImpact > 2) recommended = Math.max(5, priceImpact * 1.2);
                          else if (priceImpact > 1) recommended = 3;
                          else if (priceImpact > 0.5) recommended = 1;
                          setSlippage(recommended.toFixed(1));
                        }
                      }}
                      className="mt-2 text-xs px-3 py-1 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 rounded-lg transition-colors"
                    >
                      Use Recommended Slippage
                    </button>
                  </div>
                )}
              </div>

              {amount && !isNaN(amount) && parseFloat(amount) > 0 && (
                <div className="glass rounded-lg p-4 space-y-3">
                  <h4 className="font-bold text-purple-200">Estimate</h4>

                  <div className="flex justify-between">
                    <span className="text-purple-400 text-sm">You {tradeType === 'buy' ? 'Receive' : 'Get'}</span>
                    <span className="text-purple-200 font-bold">
                      {tradeType === 'buy'
                        ? `${estimate.tokenAmount} ${selectedToken?.token_name || ''}`
                        : `${estimate.xrpAmount} XRP`
                      }
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-purple-400 text-sm">Price</span>
                    <span className="text-purple-200">
                      {currentPrice.toFixed(8)} XRP
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-purple-400 text-sm">Price Impact</span>
                    <span className={`font-medium ${parseFloat(estimate.priceImpact) > 5 ? 'text-red-400' : 'text-green-400'}`}>
                      {estimate.priceImpact}%
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-purple-400 text-sm">Trading Fee</span>
                    <span className="text-purple-200">
                      {estimate.fee} XRP
                    </span>
                  </div>

                  {parseFloat(estimate.priceImpact) > 10 && (
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-3 text-yellow-200 text-xs">
                      ⚠️ High price impact! Consider reducing trade size.
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={executeTrade}
                disabled={!connectedWallet || !hasTrustline || !amount || isNaN(amount) || parseFloat(amount) <= 0 || trading}
                className={`w-full py-4 rounded-lg font-bold text-lg transition-all ${
                  tradeType === 'buy'
                    ? 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800'
                    : 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800'
                } text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {trading ? (
                  'Processing...'
                ) : !connectedWallet ? (
                  'Connect Wallet First'
                ) : !hasTrustline ? (
                  'Setup Trustline First'
                ) : (
                  `${tradeType === 'buy' ? '💚 Buy' : '❤️ Sell'} ${selectedToken?.currency_code || 'Token'}`
                )}
              </button>

              {lastTxDetails && (
                <div className="glass rounded-lg p-4 space-y-3 mt-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-purple-200">Last Transaction</h4>
                    <span className="text-xs text-purple-400">
                      {new Date(lastTxDetails.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-purple-400">Type</span>
                      <span className={`font-medium ${lastTxDetails.type === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
                        {lastTxDetails.type === 'buy' ? '📈 Buy' : '📉 Sell'}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-purple-400">Amount</span>
                      <span className="text-purple-200 font-medium">
                        {lastTxDetails.tokenAmount} {lastTxDetails.tokenName}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-purple-400">Cost</span>
                      <span className="text-purple-200 font-medium">
                        {lastTxDetails.xrpAmount} XRP
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-purple-400">Network Fee</span>
                      <span className="text-purple-200 font-medium">
                        {lastTxDetails.fee} XRP
                      </span>
                    </div>

                    <div className="pt-2 border-t border-purple-500/20">
                      <div className="flex items-center justify-between">
                        <span className="text-purple-400">Transaction</span>
                        <XRPScanLink type="tx" value={lastTxDetails.hash} network="mainnet" />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <TokenCreationProgressModal
        isOpen={showTradeProgress}
        steps={tradeSteps}
        currentStep={currentTradeStep}
        onClose={() => setShowTradeProgress(false)}
        canClose={currentTradeStep >= tradeSteps.length || tradeSteps.some(s => s.error)}
        title={tradeType === 'buy' ? '💰 Buying Token on XRPL' : '💸 Selling Token on XRPL'}
        successTitle={tradeType === 'buy' ? '🎉 Purchase Successful!' : '🎉 Sale Successful!'}
        failTitle={tradeType === 'buy' ? '❌ Purchase Failed' : '❌ Sale Failed'}
      />

      {slippageRetryData && (
        <SlippageRetryModal
          isOpen={showSlippageRetry}
          currentSlippage={slippageRetryData.currentSlippage}
          suggestedSlippage={slippageRetryData.suggestedSlippage}
          tradeType={slippageRetryData.tradeType}
          amount={slippageRetryData.amount}
          tokenName={slippageRetryData.tokenName}
          onRetry={handleSlippageRetry}
          onCancel={handleSlippageRetryCancel}
          onClose={handleSlippageRetryClose}
          isRetrying={isRetrying}
          retryComplete={retryComplete}
          retrySuccess={retrySuccess}
          retryError={retryError}
        />
      )}

      <PoolHistoryModal
        isOpen={showPoolHistory}
        onClose={() => setShowPoolHistory(false)}
        token={selectedToken}
        transactions={poolHistory}
        loading={loadingHistory}
      />
    </div>
  );
}
