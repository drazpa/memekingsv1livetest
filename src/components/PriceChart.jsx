import React, { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';

export function PriceChart({ data }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!chartContainerRef.current || !data || data.length === 0) return;

    const handleResize = () => {
      if (chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight
        });
      }
    };

    // Create chart with dark theme
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: 'solid', color: 'transparent' },
        textColor: '#9CA3AF',
      },
      grid: {
        vertLines: { color: '#1F2937' },
        horzLines: { color: '#1F2937' },
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: '#374151',
      },
      rightPriceScale: {
        borderColor: '#374151',
        scaleMargins: {
          top: 0.2,
          bottom: 0.2,
        },
      },
      crosshair: {
        vertLine: {
          color: '#22C55E',
          width: 1,
          style: 3,
          labelBackgroundColor: '#1F2937',
        },
        horzLine: {
          color: '#22C55E',
          width: 1,
          style: 3,
          labelBackgroundColor: '#1F2937',
        },
      },
    });

    // Add area series
    const areaSeries = chart.addAreaSeries({
      lineColor: '#22C55E',
      topColor: 'rgba(34, 197, 94, 0.2)',
      bottomColor: 'rgba(34, 197, 94, 0)',
      lineWidth: 2,
      priceFormat: {
        type: 'price',
        precision: 6,
        minMove: 0.000001,
      },
    });

    // Set data
    areaSeries.setData(data);

    // Fit content
    chart.timeScale().fitContent();

    // Handle resize
    window.addEventListener('resize', handleResize);

    // Save chart reference
    chartRef.current = chart;

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [data]);

  return (
    <div 
      ref={chartContainerRef} 
      className="w-full h-full"
    />
  );
}