import { useState, useEffect } from 'react';

export default function DailyMarketInsights({ tokens, topTokens, category }) {
  const [insights, setInsights] = useState(null);

  useEffect(() => {
    if (tokens.length > 0 && topTokens.length > 0) {
      generateInsights();
    }
  }, [tokens, topTokens, category]);

  const calculatePrice = (token) => {
    if (token.live_price) return token.live_price;
    if (!token.amm_pool_created || !token.amm_xrp_amount || !token.amm_asset_amount) return 0;
    return token.amm_xrp_amount / token.amm_asset_amount;
  };

  const calculate24hChange = (token) => {
    const currentPrice = calculatePrice(token);
    if (!currentPrice) return 0;
    if (!token.initial_xrp_amount || !token.initial_asset_amount) return 0;

    const initialPrice = token.initial_xrp_amount / token.initial_asset_amount;
    if (!initialPrice || initialPrice === 0) return 0;

    return ((currentPrice - initialPrice) / initialPrice) * 100;
  };

  const calculateMarketCap = (token) => {
    const price = calculatePrice(token);
    if (!price) return 0;
    return token.supply * price;
  };

  const generateInsights = () => {
    const topToken = topTokens[0];
    if (!topToken) return;

    const topPrice = calculatePrice(topToken);
    const topChange = calculate24hChange(topToken);
    const topMarketCap = calculateMarketCap(topToken);
    const topLiquidity = topToken.amm_xrp_amount || 0;
    const topVolume = topToken.volume_24h || 0;
    const topTradeCount = topToken.trade_count_24h || 0;

    const avgLiquidity = tokens.reduce((sum, t) => sum + (t.amm_xrp_amount || 0), 0) / tokens.length;
    const avgVolume = tokens.reduce((sum, t) => sum + (t.volume_24h || 0), 0) / tokens.length;
    const avgChange = tokens.reduce((sum, t) => sum + calculate24hChange(t), 0) / tokens.length;

    const liquidityScore = topLiquidity > avgLiquidity ? (topLiquidity / avgLiquidity) : (avgLiquidity / topLiquidity);
    const volumeScore = topVolume > avgVolume ? (topVolume / avgVolume) : 0.5;
    const momentumScore = Math.abs(topChange) > Math.abs(avgChange) ? 1.5 : 1.0;
    const tradeActivityScore = topTradeCount > 10 ? 1.2 : topTradeCount > 5 ? 1.0 : 0.8;

    const overallScore = ((liquidityScore * 0.3) + (volumeScore * 0.25) + (momentumScore * 0.25) + (tradeActivityScore * 0.2)).toFixed(2);

    let recommendation = '';
    let reasoning = [];
    let riskLevel = 'Medium';
    let confidence = 'Moderate';

    if (category === 'price-gainers') {
      if (topChange > 50 && topLiquidity > avgLiquidity * 2) {
        recommendation = 'Strong Buy - High Momentum with Good Liquidity';
        reasoning = [
          `Exceptional 24h gain of ${topChange.toFixed(2)}% indicates strong buying pressure`,
          `Above-average liquidity of ${topLiquidity.toFixed(2)} XRP provides stability`,
          `${topTradeCount} trades in 24h shows active market participation`,
          `Market cap of ${topMarketCap.toFixed(2)} XRP suggests solid foundation`
        ];
        riskLevel = 'Medium-High';
        confidence = 'High';
      } else if (topChange > 20 && topLiquidity > avgLiquidity) {
        recommendation = 'Moderate Buy - Good Opportunity';
        reasoning = [
          `Solid 24h gain of ${topChange.toFixed(2)}% shows positive momentum`,
          `Adequate liquidity of ${topLiquidity.toFixed(2)} XRP reduces slippage risk`,
          `Trading activity with ${topTradeCount} trades indicates interest`,
          `Consider taking partial position to test market reaction`
        ];
        riskLevel = 'Medium';
        confidence = 'Moderate';
      } else {
        recommendation = 'Cautious - Monitor Before Entry';
        reasoning = [
          `Modest gain of ${topChange.toFixed(2)}% may indicate limited momentum`,
          `Liquidity of ${topLiquidity.toFixed(2)} XRP requires careful position sizing`,
          `Only ${topTradeCount} trades suggests lower market activity`,
          `Wait for volume confirmation or better entry point`
        ];
        riskLevel = 'Medium-High';
        confidence = 'Low';
      }
    } else if (category === 'volume-high') {
      if (topVolume > avgVolume * 3 && topLiquidity > avgLiquidity) {
        recommendation = 'Active Trading Opportunity - High Volume';
        reasoning = [
          `Exceptional 24h volume of ${topVolume.toFixed(2)} XRP shows high activity`,
          `${topTradeCount} trades confirm strong market participation`,
          `Good liquidity of ${topLiquidity.toFixed(2)} XRP supports larger trades`,
          `Price at ${topPrice.toFixed(8)} XRP with ${topChange.toFixed(2)}% change`
        ];
        riskLevel = 'Medium';
        confidence = 'High';
      } else {
        recommendation = 'Monitor - Volume Leader';
        reasoning = [
          `Leading volume of ${topVolume.toFixed(2)} XRP indicates interest`,
          `${topTradeCount} trades in 24h period`,
          `Liquidity at ${topLiquidity.toFixed(2)} XRP`,
          `Evaluate price action before entering position`
        ];
        riskLevel = 'Medium';
        confidence = 'Moderate';
      }
    } else if (category === 'value-high') {
      recommendation = 'Established Token - Lower Risk';
      reasoning = [
        `High trading value of ${(topToken.value_24h || 0).toFixed(2)} XRP shows trust`,
        `Strong liquidity pool of ${topLiquidity.toFixed(2)} XRP`,
        `${topTradeCount} trades demonstrate active market`,
        `Market cap of ${topMarketCap.toFixed(2)} XRP indicates maturity`
      ];
      riskLevel = 'Low-Medium';
      confidence = 'High';
    }

    const insights = {
      topToken: {
        name: topToken.token_name,
        code: topToken.currency_code,
        price: topPrice,
        change: topChange,
        marketCap: topMarketCap,
        liquidity: topLiquidity,
        volume: topVolume,
        tradeCount: topTradeCount
      },
      market: {
        avgLiquidity,
        avgVolume,
        avgChange,
        totalTokens: tokens.length,
        activeTokens: tokens.filter(t => (t.volume_24h || 0) > 0).length
      },
      scores: {
        overall: overallScore,
        liquidity: liquidityScore.toFixed(2),
        volume: volumeScore.toFixed(2),
        momentum: momentumScore.toFixed(2),
        tradeActivity: tradeActivityScore.toFixed(2)
      },
      recommendation,
      reasoning,
      riskLevel,
      confidence
    };

    setInsights(insights);
  };

  if (!insights) {
    return (
      <div className="glass rounded-lg p-6 mb-6">
        <div className="text-center text-purple-400">
          Analyzing market data...
        </div>
      </div>
    );
  }

  const getRiskColor = (risk) => {
    if (risk.includes('Low')) return 'text-green-400';
    if (risk.includes('High')) return 'text-red-400';
    return 'text-yellow-400';
  };

  const getConfidenceColor = (conf) => {
    if (conf === 'High') return 'text-green-400';
    if (conf === 'Low') return 'text-red-400';
    return 'text-yellow-400';
  };

  return (
    <div className="space-y-4 mb-6">
      <div className="glass rounded-lg p-6 border-l-4 border-purple-500">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-purple-200 mb-1">Daily Market Insights</h3>
            <p className="text-purple-400 text-sm">AI-powered analysis of today's top performing token</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-purple-400 mb-1">Overall Score</div>
            <div className="text-2xl font-bold text-purple-200">{insights.scores.overall}/10</div>
          </div>
        </div>

        <div className="bg-purple-900/30 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="text-3xl">🎯</div>
            <div>
              <div className="text-lg font-bold text-purple-200">{insights.topToken.name}</div>
              <div className="text-sm text-purple-400">{insights.topToken.code}</div>
            </div>
            <div className="ml-auto text-right">
              <div className="text-lg font-bold text-purple-200">{insights.topToken.price.toFixed(8)} XRP</div>
              <div className={`text-sm font-medium ${insights.topToken.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {insights.topToken.change >= 0 ? '+' : ''}{insights.topToken.change.toFixed(2)}% 24h
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div className="bg-purple-800/30 rounded p-2">
              <div className="text-purple-400 text-xs">Market Cap</div>
              <div className="text-purple-200 font-bold">{insights.topToken.marketCap.toFixed(2)} XRP</div>
            </div>
            <div className="bg-purple-800/30 rounded p-2">
              <div className="text-purple-400 text-xs">Liquidity</div>
              <div className="text-purple-200 font-bold">{insights.topToken.liquidity.toFixed(2)} XRP</div>
            </div>
            <div className="bg-purple-800/30 rounded p-2">
              <div className="text-purple-400 text-xs">24h Volume</div>
              <div className="text-purple-200 font-bold">{insights.topToken.volume.toFixed(2)} XRP</div>
            </div>
            <div className="bg-purple-800/30 rounded p-2">
              <div className="text-purple-400 text-xs">24h Trades</div>
              <div className="text-purple-200 font-bold">{insights.topToken.tradeCount}</div>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">💡</span>
            <h4 className="text-lg font-bold text-purple-200">Recommendation</h4>
          </div>
          <div className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 border border-purple-500/30 rounded-lg p-4">
            <div className="text-lg font-bold text-purple-100 mb-2">{insights.recommendation}</div>
            <div className="flex gap-4 text-sm mb-3">
              <div>
                <span className="text-purple-400">Risk Level: </span>
                <span className={`font-bold ${getRiskColor(insights.riskLevel)}`}>{insights.riskLevel}</span>
              </div>
              <div>
                <span className="text-purple-400">Confidence: </span>
                <span className={`font-bold ${getConfidenceColor(insights.confidence)}`}>{insights.confidence}</span>
              </div>
            </div>
            <div className="space-y-2">
              {insights.reasoning.map((reason, idx) => (
                <div key={idx} className="flex items-start gap-2 text-purple-200">
                  <span className="text-purple-400 mt-1">•</span>
                  <span className="text-sm">{reason}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-purple-500/20 pt-4">
          <h4 className="text-sm font-bold text-purple-300 mb-3">Performance Metrics</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <div className="text-xs text-purple-400 mb-1">Liquidity Score</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-purple-900/50 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(parseFloat(insights.scores.liquidity) * 10, 100)}%` }}
                  />
                </div>
                <span className="text-xs text-purple-200 font-bold">{insights.scores.liquidity}</span>
              </div>
            </div>
            <div>
              <div className="text-xs text-purple-400 mb-1">Volume Score</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-purple-900/50 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(parseFloat(insights.scores.volume) * 10, 100)}%` }}
                  />
                </div>
                <span className="text-xs text-purple-200 font-bold">{insights.scores.volume}</span>
              </div>
            </div>
            <div>
              <div className="text-xs text-purple-400 mb-1">Momentum</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-purple-900/50 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(parseFloat(insights.scores.momentum) * 10, 100)}%` }}
                  />
                </div>
                <span className="text-xs text-purple-200 font-bold">{insights.scores.momentum}</span>
              </div>
            </div>
            <div>
              <div className="text-xs text-purple-400 mb-1">Trade Activity</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-purple-900/50 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-yellow-500 to-orange-500 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(parseFloat(insights.scores.tradeActivity) * 10, 100)}%` }}
                  />
                </div>
                <span className="text-xs text-purple-200 font-bold">{insights.scores.tradeActivity}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <span className="text-yellow-400 text-lg">⚠️</span>
            <div className="text-xs text-yellow-200">
              <strong>Disclaimer:</strong> This analysis is for informational purposes only. Always conduct your own research and never invest more than you can afford to lose. Past performance does not guarantee future results.
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass rounded-lg p-4">
          <div className="text-purple-400 text-sm mb-2">Market Average</div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-purple-300">Liquidity:</span>
              <span className="text-purple-200 font-bold">{insights.market.avgLiquidity.toFixed(2)} XRP</span>
            </div>
            <div className="flex justify-between">
              <span className="text-purple-300">Volume:</span>
              <span className="text-purple-200 font-bold">{insights.market.avgVolume.toFixed(2)} XRP</span>
            </div>
            <div className="flex justify-between">
              <span className="text-purple-300">24h Change:</span>
              <span className={`font-bold ${insights.market.avgChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {insights.market.avgChange >= 0 ? '+' : ''}{insights.market.avgChange.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        <div className="glass rounded-lg p-4">
          <div className="text-purple-400 text-sm mb-2">Market Activity</div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-purple-300">Total Tokens:</span>
              <span className="text-purple-200 font-bold">{insights.market.totalTokens}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-purple-300">Active (24h):</span>
              <span className="text-purple-200 font-bold">{insights.market.activeTokens}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-purple-300">Activity Rate:</span>
              <span className="text-purple-200 font-bold">
                {((insights.market.activeTokens / insights.market.totalTokens) * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        <div className="glass rounded-lg p-4">
          <div className="text-purple-400 text-sm mb-2">Data Freshness</div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-purple-200">Live Data</span>
            </div>
            <div className="text-purple-300 text-xs">
              Updated from XRPL network with 30s cache
            </div>
            <div className="text-purple-300 text-xs">
              Trade counts from verified transactions
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
