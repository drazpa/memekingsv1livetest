import { useEffect, useRef, useState } from 'react';
import { createChart } from 'lightweight-charts';

export default function AdvancedChart({ token, chartData, timeframe, onTimeframeChange }) {
  const priceChartContainerRef = useRef(null);
  const volumeChartContainerRef = useRef(null);
  const priceChartRef = useRef(null);
  const volumeChartRef = useRef(null);
  const priceSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const [showVolume, setShowVolume] = useState(true);
  const [chartStyle, setChartStyle] = useState('area');
  const [showGrid, setShowGrid] = useState(true);
  const [logScale, setLogScale] = useState(false);

  useEffect(() => {
    if (!priceChartContainerRef.current) return;

    if (!chartData || !Array.isArray(chartData) || chartData.length === 0) {
      console.log('No chart data available yet');
      return;
    }

    try {
      if (priceChartRef.current) {
        try {
          priceChartRef.current.remove();
        } catch (e) {
          console.error('Error removing old price chart:', e);
        }
        priceChartRef.current = null;
      }

      if (volumeChartRef.current) {
        try {
          volumeChartRef.current.remove();
        } catch (e) {
          console.error('Error removing old volume chart:', e);
        }
        volumeChartRef.current = null;
      }

      const priceChart = createChart(priceChartContainerRef.current, {
        width: priceChartContainerRef.current.clientWidth,
        height: 450,
        layout: {
          background: { color: '#1e1b2e' },
          textColor: '#c4b5fd',
        },
        grid: {
          vertLines: { color: showGrid ? '#2d2640' : 'transparent' },
          horzLines: { color: showGrid ? '#2d2640' : 'transparent' },
        },
        crosshair: {
          mode: 1,
          vertLine: {
            color: '#8b5cf6',
            width: 1,
            style: 3,
            labelBackgroundColor: '#4c1d95',
          },
          horzLine: {
            color: '#8b5cf6',
            width: 1,
            style: 3,
            labelBackgroundColor: '#4c1d95',
          },
        },
        rightPriceScale: {
          borderColor: '#3730a3',
          mode: logScale ? 1 : 0,
        },
        timeScale: {
          borderColor: '#3730a3',
          timeVisible: true,
          secondsVisible: false,
        },
      });

      let priceSeries;
      if (chartStyle === 'candlestick') {
        priceSeries = priceChart.addCandlestickSeries({
          upColor: '#26a69a',
          downColor: '#ef5350',
          borderVisible: false,
          wickUpColor: '#26a69a',
          wickDownColor: '#ef5350',
        });
      } else if (chartStyle === 'line') {
        priceSeries = priceChart.addLineSeries({
          color: '#a78bfa',
          lineWidth: 2,
          crosshairMarkerVisible: true,
          crosshairMarkerRadius: 6,
        });
      } else if (chartStyle === 'area') {
        priceSeries = priceChart.addAreaSeries({
          topColor: 'rgba(167, 139, 250, 0.56)',
          bottomColor: 'rgba(167, 139, 250, 0.04)',
          lineColor: 'rgba(167, 139, 250, 1)',
          lineWidth: 2,
        });
      } else if (chartStyle === 'bars') {
        priceSeries = priceChart.addBarSeries({
          upColor: '#26a69a',
          downColor: '#ef5350',
          openVisible: true,
          thinBars: false,
        });
      }

      const formattedData = chartData
        .filter(d => d && d.time && (d.close !== undefined || d.value !== undefined))
        .map(d => {
          if (chartStyle === 'line' || chartStyle === 'area') {
            return {
              time: d.time,
              value: d.close || d.value || 0
            };
          }
          return {
            time: d.time,
            open: d.open || d.close || d.value || 0,
            high: d.high || d.close || d.value || 0,
            low: d.low || d.close || d.value || 0,
            close: d.close || d.value || 0
          };
        });

      if (formattedData.length === 0) {
        console.warn('No valid chart data after formatting');
        return;
      }

      priceSeries.setData(formattedData);
      priceChart.timeScale().fitContent();

      priceChartRef.current = priceChart;
      priceSeriesRef.current = priceSeries;

      if (showVolume && volumeChartContainerRef.current) {
        const volumeChart = createChart(volumeChartContainerRef.current, {
          width: volumeChartContainerRef.current.clientWidth,
          height: 120,
          layout: {
            background: { color: '#1e1b2e' },
            textColor: '#c4b5fd',
          },
          grid: {
            vertLines: { color: showGrid ? '#2d2640' : 'transparent' },
            horzLines: { color: showGrid ? '#2d2640' : 'transparent' },
          },
          rightPriceScale: {
            borderColor: '#3730a3',
          },
          timeScale: {
            borderColor: '#3730a3',
            timeVisible: true,
            secondsVisible: false,
          },
        });

        const volumeSeries = volumeChart.addHistogramSeries({
          color: '#26a69a',
          priceFormat: {
            type: 'volume',
          },
        });

        const volumeData = chartData
          .filter(d => d && d.time)
          .map(d => ({
            time: d.time,
            value: d.volume || 0,
            color: (d.close || 0) >= (d.open || 0) ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)'
          }));

        if (volumeData.length > 0) {
          volumeSeries.setData(volumeData);
          volumeSeriesRef.current = volumeSeries;
        }

        volumeChart.timeScale().fitContent();
        volumeChartRef.current = volumeChart;

        priceChart.timeScale().subscribeVisibleTimeRangeChange((timeRange) => {
          if (timeRange && volumeChart) {
            volumeChart.timeScale().setVisibleRange(timeRange);
          }
        });

        volumeChart.timeScale().subscribeVisibleTimeRangeChange((timeRange) => {
          if (timeRange && priceChart) {
            priceChart.timeScale().setVisibleRange(timeRange);
          }
        });
      }

      const handleResize = () => {
        if (priceChartContainerRef.current && priceChartRef.current) {
          priceChartRef.current.applyOptions({
            width: priceChartContainerRef.current.clientWidth,
          });
        }
        if (volumeChartContainerRef.current && volumeChartRef.current && showVolume) {
          volumeChartRef.current.applyOptions({
            width: volumeChartContainerRef.current.clientWidth,
          });
        }
      };

      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        if (priceChartRef.current) {
          try {
            priceChartRef.current.remove();
          } catch (e) {
            console.error('Error cleaning up price chart:', e);
          }
        }
        if (volumeChartRef.current) {
          try {
            volumeChartRef.current.remove();
          } catch (e) {
            console.error('Error cleaning up volume chart:', e);
          }
        }
      };
    } catch (error) {
      console.error('Error creating advanced chart:', error);
      if (priceChartRef.current) {
        try {
          priceChartRef.current.remove();
        } catch (e) {
          console.error('Error removing price chart after error:', e);
        }
        priceChartRef.current = null;
      }
      if (volumeChartRef.current) {
        try {
          volumeChartRef.current.remove();
        } catch (e) {
          console.error('Error removing volume chart after error:', e);
        }
        volumeChartRef.current = null;
      }
    }
  }, [chartData, chartStyle, showVolume, showGrid, logScale, token]);

  const timeframes = [
    { label: '1m', value: '1m' },
    { label: '3m', value: '3m' },
    { label: '5m', value: '5m' },
    { label: '15m', value: '15m' },
    { label: '30m', value: '30m' },
    { label: '1h', value: '1h' },
    { label: '2h', value: '2h' },
    { label: '4h', value: '4h' },
    { label: '6h', value: '6h' },
    { label: '12h', value: '12h' },
    { label: '24h', value: '1d' },
    { label: '3d', value: '3d' },
    { label: '1w', value: '1w' },
  ];

  const chartStyles = [
    { label: 'Candles', value: 'candlestick', icon: '📊' },
    { label: 'Line', value: 'line', icon: '📈' },
    { label: 'Area', value: 'area', icon: '🌊' },
    { label: 'Bars', value: 'bars', icon: '📉' },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-purple-900/30 border-b border-purple-700/30">
        <div className="flex flex-col gap-2 w-full">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm text-purple-300">Chart Type:</span>
              <div className="flex gap-1">
                {chartStyles.map(style => (
                  <button
                    key={style.value}
                    onClick={() => setChartStyle(style.value)}
                    className={`px-3 py-1 text-sm rounded transition-colors flex items-center gap-1 ${
                      chartStyle === style.value
                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/50'
                        : 'bg-purple-900/50 text-purple-300 hover:bg-purple-800/50 border border-purple-700/30'
                    }`}
                    title={style.label}
                  >
                    <span>{style.icon}</span>
                    <span className="hidden sm:inline">{style.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-purple-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showVolume}
                  onChange={(e) => setShowVolume(e.target.checked)}
                  className="w-4 h-4 text-purple-600 bg-purple-900/50 border-purple-700 rounded focus:ring-purple-500"
                />
                <span>Volume</span>
              </label>

              <label className="flex items-center gap-2 text-sm text-purple-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showGrid}
                  onChange={(e) => setShowGrid(e.target.checked)}
                  className="w-4 h-4 text-purple-600 bg-purple-900/50 border-purple-700 rounded focus:ring-purple-500"
                />
                <span>Grid</span>
              </label>

              <label className="flex items-center gap-2 text-sm text-purple-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={logScale}
                  onChange={(e) => setLogScale(e.target.checked)}
                  className="w-4 h-4 text-purple-600 bg-purple-900/50 border-purple-700 rounded focus:ring-purple-500"
                />
                <span>Log</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 relative bg-purple-950/50">
        {(!chartData || chartData.length === 0) && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-purple-400">
              <div className="text-4xl mb-2">📊</div>
              <p>Loading chart data...</p>
            </div>
          </div>
        )}
        <div ref={priceChartContainerRef} className="w-full h-[450px]" />
        {showVolume && (
          <div ref={volumeChartContainerRef} className="w-full h-[120px] mt-1" />
        )}
      </div>

      {token && (
        <div className="flex items-center justify-between p-3 bg-purple-900/30 border-t border-purple-700/30">
          <div className="flex items-center gap-4 text-sm flex-wrap">
            <div>
              <span className="text-purple-400">Token:</span>
              <span className="ml-2 font-medium text-purple-200">
                {token.token_name} ({token.currency_code})
              </span>
            </div>
            {chartData && chartData.length > 0 && (
              <>
                <div>
                  <span className="text-purple-400">O:</span>
                  <span className="ml-1 text-purple-200">
                    {chartData[chartData.length - 1]?.open?.toFixed(8) || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-purple-400">H:</span>
                  <span className="ml-1 text-green-400">
                    {chartData[chartData.length - 1]?.high?.toFixed(8) || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-purple-400">L:</span>
                  <span className="ml-1 text-red-400">
                    {chartData[chartData.length - 1]?.low?.toFixed(8) || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-purple-400">C:</span>
                  <span className="ml-1 text-purple-100 font-medium">
                    {chartData[chartData.length - 1]?.close?.toFixed(8) || 'N/A'}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
