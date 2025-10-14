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
          background: { color: '#1a1d28' },
          textColor: '#d1d4dc',
        },
        grid: {
          vertLines: { color: showGrid ? '#2b2f3e' : 'transparent' },
          horzLines: { color: showGrid ? '#2b2f3e' : 'transparent' },
        },
        crosshair: {
          mode: 1,
          vertLine: {
            color: '#758696',
            width: 1,
            style: 3,
            labelBackgroundColor: '#363c4e',
          },
          horzLine: {
            color: '#758696',
            width: 1,
            style: 3,
            labelBackgroundColor: '#363c4e',
          },
        },
        rightPriceScale: {
          borderColor: '#2b2f3e',
          mode: logScale ? 1 : 0,
        },
        timeScale: {
          borderColor: '#2b2f3e',
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
          color: '#2196F3',
          lineWidth: 2,
          crosshairMarkerVisible: true,
          crosshairMarkerRadius: 6,
        });
      } else if (chartStyle === 'area') {
        priceSeries = priceChart.addAreaSeries({
          topColor: 'rgba(33, 150, 243, 0.56)',
          bottomColor: 'rgba(33, 150, 243, 0.04)',
          lineColor: 'rgba(33, 150, 243, 1)',
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
            background: { color: '#1a1d28' },
            textColor: '#d1d4dc',
          },
          grid: {
            vertLines: { color: showGrid ? '#2b2f3e' : 'transparent' },
            horzLines: { color: showGrid ? '#2b2f3e' : 'transparent' },
          },
          rightPriceScale: {
            borderColor: '#2b2f3e',
          },
          timeScale: {
            borderColor: '#2b2f3e',
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
  }, [chartData, chartStyle, showVolume, showGrid, logScale]);

  const timeframes = [
    { label: '1m', value: '1m' },
    { label: '5m', value: '5m' },
    { label: '15m', value: '15m' },
    { label: '1h', value: '1h' },
    { label: '4h', value: '4h' },
    { label: '24h', value: '1d' },
  ];

  const chartStyles = [
    { label: 'Candles', value: 'candlestick', icon: '📊' },
    { label: 'Line', value: 'line', icon: '📈' },
    { label: 'Area', value: 'area', icon: '🌊' },
    { label: 'Bars', value: 'bars', icon: '📉' },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Timeframe:</span>
          <div className="flex gap-1">
            {timeframes.map(tf => (
              <button
                key={tf.value}
                onClick={() => onTimeframeChange?.(tf.value)}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  timeframe === tf.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Chart Type:</span>
          <div className="flex gap-1">
            {chartStyles.map(style => (
              <button
                key={style.value}
                onClick={() => setChartStyle(style.value)}
                className={`px-3 py-1 text-sm rounded transition-colors flex items-center gap-1 ${
                  chartStyle === style.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
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
          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showVolume}
              onChange={(e) => setShowVolume(e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
            />
            <span>Volume</span>
          </label>

          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showGrid}
              onChange={(e) => setShowGrid(e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
            />
            <span>Grid</span>
          </label>

          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={logScale}
              onChange={(e) => setLogScale(e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
            />
            <span>Log</span>
          </label>
        </div>
      </div>

      <div className="flex-1 relative bg-gray-900">
        {(!chartData || chartData.length === 0) && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-gray-400">
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
        <div className="flex items-center justify-between p-3 bg-gray-800 border-t border-gray-700">
          <div className="flex items-center gap-4 text-sm flex-wrap">
            <div>
              <span className="text-gray-400">Token:</span>
              <span className="ml-2 font-medium text-white">
                {token.token_name} ({token.currency_code})
              </span>
            </div>
            {chartData && chartData.length > 0 && (
              <>
                <div>
                  <span className="text-gray-400">O:</span>
                  <span className="ml-1 text-gray-200">
                    {chartData[chartData.length - 1]?.open?.toFixed(8) || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">H:</span>
                  <span className="ml-1 text-green-400">
                    {chartData[chartData.length - 1]?.high?.toFixed(8) || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">L:</span>
                  <span className="ml-1 text-red-400">
                    {chartData[chartData.length - 1]?.low?.toFixed(8) || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">C:</span>
                  <span className="ml-1 text-white font-medium">
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
