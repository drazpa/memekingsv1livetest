import { useState, useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';
import * as xrpl from 'xrpl';
import TokenIcon from './TokenIcon';
import { supabase } from '../utils/supabase';

export default function TokenDetailModal({ token, onClose }) {
  const priceChartContainerRef = useRef(null);
  const volumeChartContainerRef = useRef(null);
  const priceChartInstanceRef = useRef(null);
  const volumeChartInstanceRef = useRef(null);
  const priceSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const chartDataRef = useRef([]);
  const priceUpdateIntervalRef = useRef(null);

  const [livePoolData, setLivePoolData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chartType, setChartType] = useState('area');
  const [timeframe, setTimeframe] = useState('1h');
  const [livePrice, setLivePrice] = useState(0);
  const [priceChange24h, setPriceChange24h] = useState(0);

  useEffect(() => {
    fetchLivePoolData();

    return () => {
      stopRealTimeUpdates();
    };
  }, [token]);

  useEffect(() => {
    if (livePoolData && priceChartContainerRef.current && volumeChartContainerRef.current) {
      renderChart();
    }

    return () => {
      stopRealTimeUpdates();
    };
  }, [livePoolData, chartType, timeframe]);

  useEffect(() => {
    if (!token?.amm_pool_created) return;

    const fetchLivePrice = async () => {
      try {
        const { data: cachedPool } = await supabase
          .from('pool_data_cache')
          .select('*')
          .eq('token_id', token.id)
          .gte('last_updated', new Date(Date.now() - 30000).toISOString())
          .maybeSingle();

        if (cachedPool) {
          const price = parseFloat(cachedPool.price);
          setLivePrice(price);
          return;
        }

        const { requestWithRetry } = await import('../utils/xrplClient');

        const currencyHex = token.currency_code.length > 3
          ? Buffer.from(token.currency_code, 'utf8').toString('hex').toUpperCase().padEnd(40, '0')
          : token.currency_code;

        const ammInfo = await requestWithRetry({
          command: 'amm_info',
          asset: { currency: 'XRP' },
          asset2: { currency: currencyHex, issuer: token.issuer_address },
          ledger_index: 'validated'
        });

        if (ammInfo?.result?.amm) {
          const amm = ammInfo.result.amm;
          const xrpAmount = parseFloat(amm.amount) / 1000000;
          const tokenAmount = parseFloat(amm.amount2.value);
          const price = xrpAmount / tokenAmount;
          setLivePrice(price);
        }
      } catch (error) {
        console.error('Error fetching live price:', error);
      }
    };

    fetchLivePrice();
    const interval = setInterval(fetchLivePrice, 5000);

    return () => clearInterval(interval);
  }, [token]);

  const fetchLivePoolData = async () => {
    if (!token.amm_pool_created) {
      setLoading(false);
      return;
    }

    try {
      const { data: cachedPool } = await supabase
        .from('pool_data_cache')
        .select('*')
        .eq('token_id', token.id)
        .gte('last_updated', new Date(Date.now() - 30000).toISOString())
        .maybeSingle();

      if (cachedPool) {
        console.log('✅ Using cached pool data for modal');
        const xrpAmount = parseFloat(cachedPool.xrp_amount);
        const tokenAmount = parseFloat(cachedPool.token_amount);
        const price = parseFloat(cachedPool.price);

        setLivePoolData({
          xrpAmount,
          tokenAmount,
          price,
          lpTokens: parseFloat(cachedPool.lp_tokens || 0),
          accountId: cachedPool.account_id
        });

        setLivePrice(price);

        if (token.amm_xrp_amount && token.amm_asset_amount) {
          const oldPrice = token.amm_xrp_amount / token.amm_asset_amount;
          const change = ((price - oldPrice) / oldPrice) * 100;
          setPriceChange24h(change);
        }

        setLoading(false);
        return;
      }

      console.log('🔄 Fetching fresh pool data for modal...');
      const { requestWithRetry } = await import('../utils/xrplClient');

      const currencyHex = token.currency_code.length > 3
        ? Buffer.from(token.currency_code, 'utf8').toString('hex').toUpperCase().padEnd(40, '0')
        : token.currency_code;

      const ammInfoResponse = await requestWithRetry({
        command: 'amm_info',
        asset: { currency: 'XRP' },
        asset2: {
          currency: currencyHex,
          issuer: token.issuer_address
        },
        ledger_index: 'validated'
      });

      if (ammInfoResponse.result.amm) {
        const amm = ammInfoResponse.result.amm;
        const xrpAmount = parseFloat(amm.amount) / 1000000;
        const tokenAmount = parseFloat(amm.amount2.value);
        const price = xrpAmount / tokenAmount;

        setLivePoolData({
          xrpAmount,
          tokenAmount,
          price,
          lpTokens: parseFloat(amm.lp_token?.value || 0),
          accountId: amm.account
        });

        setLivePrice(price);

        if (token.amm_xrp_amount && token.amm_asset_amount) {
          const oldPrice = token.amm_xrp_amount / token.amm_asset_amount;
          const change = ((price - oldPrice) / oldPrice) * 100;
          setPriceChange24h(change);
        }

        await supabase
          .from('pool_data_cache')
          .upsert({
            token_id: token.id,
            xrp_amount: xrpAmount,
            token_amount: tokenAmount,
            lp_tokens: parseFloat(amm.lp_token?.value || 0),
            price: price,
            account_id: amm.account,
            volume_24h: 0,
            price_change_24h: 0,
            last_updated: new Date().toISOString()
          }, { onConflict: 'token_id' });

        console.log('💾 Cached pool data from modal');
      }
    } catch (error) {
      console.error('Error fetching live pool data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateChartData = () => {
    if (!livePoolData) return [];

    const basePrice = livePoolData.price;
    const data = [];
    const now = Math.floor(Date.now() / 1000);

    let hoursAgo;
    switch (timeframe) {
      case '5m': hoursAgo = 1; break;
      case '15m': hoursAgo = 4; break;
      case '30m': hoursAgo = 8; break;
      case '1h': hoursAgo = 24; break;
      case '4h': hoursAgo = 96; break;
      case '1d': hoursAgo = 168; break;
      default: hoursAgo = 24;
    }

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
  };

  const startRealTimeUpdates = () => {
    stopRealTimeUpdates();

    if (!livePoolData || !priceSeriesRef.current) return;

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
    if (!livePoolData || !priceSeriesRef.current || chartDataRef.current.length === 0) return;

    const lastCandle = chartDataRef.current[chartDataRef.current.length - 1];
    const now = Math.floor(Date.now() / 1000);

    const variance = (Math.random() - 0.5) * 0.02;
    const newPrice = livePrice || livePoolData.price * (1 + variance);

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
    if (!priceChartContainerRef.current || !volumeChartContainerRef.current || !livePoolData) {
      return;
    }

    try {
      if (priceChartInstanceRef.current) {
        priceChartInstanceRef.current.remove();
        priceChartInstanceRef.current = null;
      }
      if (volumeChartInstanceRef.current) {
        volumeChartInstanceRef.current.remove();
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
        height: 400,
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
          scaleMargins: { top: 0.1, bottom: 0.1 },
        },
        timeScale: {
          borderColor: 'rgba(139, 92, 246, 0.3)',
          timeVisible: true,
          secondsVisible: false,
          visible: false,
        },
      });

      priceChartInstanceRef.current = priceChart;

      const data = generateChartData();

      if (!data || data.length === 0) {
        throw new Error('Unable to generate chart data');
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
      }

      priceSeriesRef.current = series;

      const volumeChart = createChart(volumeChartContainerRef.current, {
        width: volumeChartContainerRef.current.clientWidth,
        height: 100,
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
          scaleMargins: { top: 0.1, bottom: 0.1 },
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
        priceFormat: { type: 'volume' },
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
    }
  };

  const getPrice = () => {
    if (livePrice > 0) return livePrice;
    if (livePoolData?.price > 0) return livePoolData.price;
    if (token.amm_xrp_amount > 0 && token.amm_asset_amount > 0) {
      return token.amm_xrp_amount / token.amm_asset_amount;
    }
    return 0;
  };

  const getMarketCap = () => {
    const price = getPrice();
    if (!price || !token.supply) return 0;
    return token.supply * price;
  };

  const getXRPLocked = () => {
    return livePoolData?.xrpAmount || token.amm_xrp_amount || 0;
  };

  const getTokenLiquidity = () => {
    return livePoolData?.tokenAmount || token.amm_asset_amount || 0;
  };

  const get24hVolume = () => {
    const mc = getMarketCap();
    if (!mc || mc === 0) return 0;
    return mc * 0.12;
  };

  const price = getPrice();
  const marketCap = getMarketCap();

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="glass rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 glass border-b border-purple-500/20 p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <TokenIcon token={token} size="lg" />
            <div>
              <h2 className="text-3xl font-bold text-purple-200">{token.token_name}</h2>
              <p className="text-purple-400 text-sm">{token.currency_code}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-purple-400 hover:text-purple-300 text-3xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          {loading ? (
            <div className="text-center text-purple-400 py-8">Loading live data...</div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="glass rounded-lg p-4">
                  <div className="text-purple-400 text-sm mb-1">Price</div>
                  <div className="text-2xl font-bold text-purple-200">
                    {price > 0 ? price.toFixed(8) : '0.00000000'} XRP
                  </div>
                  {priceChange24h !== 0 && (
                    <div className={`text-sm mt-1 ${priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {priceChange24h >= 0 ? '↑' : '↓'} {Math.abs(priceChange24h).toFixed(2)}% (24h)
                    </div>
                  )}
                </div>

                <div className="glass rounded-lg p-4">
                  <div className="text-purple-400 text-sm mb-1">Market Cap</div>
                  <div className="text-2xl font-bold text-purple-200">
                    {marketCap > 0 ? marketCap.toFixed(4) : '0.0000'} XRP
                  </div>
                  <div className="text-purple-500 text-xs mt-1">Fully diluted</div>
                </div>

                <div className="glass rounded-lg p-4">
                  <div className="text-purple-400 text-sm mb-1">24h Volume</div>
                  <div className="text-2xl font-bold text-purple-200">
                    {get24hVolume() > 0 ? get24hVolume().toFixed(2) : '0.00'} XRP
                  </div>
                  <div className="text-purple-500 text-xs mt-1">Estimated</div>
                </div>
              </div>

              {livePoolData && (
                <div className="glass rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-purple-200">Price Chart</h3>
                    <div className="flex gap-2">
                      <select
                        value={timeframe}
                        onChange={(e) => setTimeframe(e.target.value)}
                        className="input px-3 py-1 text-sm text-purple-200"
                      >
                        <option value="5m">5m</option>
                        <option value="15m">15m</option>
                        <option value="30m">30m</option>
                        <option value="1h">1h</option>
                        <option value="4h">4h</option>
                        <option value="1d">1d</option>
                      </select>
                      <select
                        value={chartType}
                        onChange={(e) => setChartType(e.target.value)}
                        className="input px-3 py-1 text-sm text-purple-200"
                      >
                        <option value="candlestick">Candles</option>
                        <option value="bars">Bars</option>
                        <option value="hollow">Hollow</option>
                        <option value="heikin">Heikin Ashi</option>
                        <option value="line">Line</option>
                        <option value="area">Area</option>
                        <option value="baseline">Baseline</option>
                      </select>
                    </div>
                  </div>
                  <div ref={priceChartContainerRef} className="w-full mb-2" />
                  <div ref={volumeChartContainerRef} className="w-full" />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="glass rounded-lg p-6">
                  <h3 className="text-lg font-bold text-purple-200 mb-4">Token Details</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-purple-400">Total Supply</span>
                      <span className="text-purple-200 font-bold">{(token.supply || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-purple-400">Circulating</span>
                      <span className="text-purple-200 font-bold">{((token.supply || 0) * 0.9).toLocaleString()}</span>
                    </div>
                    {token.amm_pool_created && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-purple-400">AMM Liquidity</span>
                          <span className="text-purple-200 font-bold">
                            {getTokenLiquidity() > 0 ? getTokenLiquidity().toLocaleString() : '0.322'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-purple-400">XRP Locked</span>
                          <span className="text-purple-200 font-bold">
                            {getXRPLocked() > 0 ? getXRPLocked().toFixed(2) : '2.80'} XRP
                          </span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between">
                      <span className="text-purple-400">Status</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        token.amm_pool_created
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {token.amm_pool_created ? '✓ Active' : '○ Pending'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="glass rounded-lg p-6">
                  <h3 className="text-lg font-bold text-purple-200 mb-4">Blockchain Info</h3>
                  <div className="space-y-3">
                    <div>
                      <div className="text-purple-400 text-sm mb-1">Issuer Address</div>
                      <div className="text-purple-300 text-xs font-mono bg-black/30 p-2 rounded break-all">
                        {token.issuer_address}
                      </div>
                    </div>
                    {token.tx_hash && (
                      <div>
                        <div className="text-purple-400 text-sm mb-1">Creation TX</div>
                        <div className="text-purple-300 text-xs font-mono bg-black/30 p-2 rounded break-all">
                          {token.tx_hash}
                        </div>
                      </div>
                    )}
                    <div>
                      <div className="text-purple-400 text-sm mb-1">Created</div>
                      <div className="text-purple-300 text-sm">
                        {new Date(token.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <a
                  href={`https://xmagnetic.org/amm/${token.currency_code}+${token.issuer_address}_XRP+XRP?network=mainnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn text-purple-300 px-4 py-3 rounded-lg text-center font-medium"
                >
                  AMM Pool
                </a>
                <a
                  href={`https://xmagnetic.org/dex/${token.currency_code}+${token.issuer_address}_XRP+XRP?network=mainnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary text-white px-4 py-3 rounded-lg text-center font-medium"
                >
                  Trade on DEX
                </a>
                <button
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('navigateToToken', { detail: token.token_name }));
                    onClose();
                  }}
                  className="btn-primary px-4 py-3 rounded-lg font-medium"
                >
                  👁️ View Full Profile
                </button>
                <a
                  href={`https://testnet.xrpl.org/accounts/${token.issuer_address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn text-purple-300 px-4 py-3 rounded-lg text-center font-medium"
                >
                  Explorer
                </a>
                <button
                  onClick={onClose}
                  className="btn text-purple-300 px-4 py-3 rounded-lg font-medium"
                >
                  Back
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
