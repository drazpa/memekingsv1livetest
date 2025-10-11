import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';

export default function StreamAnalytics() {
  const [stats, setStats] = useState({
    totalStreams: 0,
    activeStreams: 0,
    totalViewers: 0,
    totalTips: 0,
    totalCrowns: 0,
    totalSessions: 0,
    avgSessionDuration: 0,
    totalStreamTime: 0,
    topStreamers: [],
    topCategories: [],
    recentTips: [],
    tokenBreakdown: [],
    sessionsToday: 0,
    tipsToday: 0,
    crownsToday: 0,
    peakConcurrentViewers: 0,
    avgTipsPerSession: 0,
    avgCrownsPerSession: 0,
    topTippers: []
  });

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    const { data: streams } = await supabase
      .from('live_streams')
      .select('*')
      .eq('is_active', true);

    const activeStreams = streams?.length || 0;
    const totalViewers = streams?.reduce((sum, s) => sum + s.viewer_count, 0) || 0;
    const totalTips = streams?.reduce((sum, s) => sum + parseFloat(s.total_tips), 0) || 0;
    const totalCrowns = streams?.reduce((sum, s) => sum + s.crown_count, 0) || 0;
    const peakViewers = streams?.reduce((max, s) => Math.max(max, s.peak_viewers || 0), 0) || 0;

    const { data: allStreams } = await supabase
      .from('live_streams')
      .select('*');

    const totalStreams = allStreams?.length || 0;

    const { data: sessions } = await supabase
      .from('stream_sessions')
      .select('*');

    const totalSessions = sessions?.length || 0;
    const totalStreamTime = sessions?.reduce((sum, s) => sum + (s.duration_seconds || 0), 0) || 0;
    const avgSessionDuration = totalSessions > 0 ? Math.floor(totalStreamTime / totalSessions) : 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sessionsToday = sessions?.filter(s => new Date(s.started_at) >= today).length || 0;

    const { data: tipsToday } = await supabase
      .from('stream_tips')
      .select('amount')
      .gte('created_at', today.toISOString());

    const tipsTodayAmount = tipsToday?.reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0;

    const { data: crownsToday } = await supabase
      .from('stream_reactions')
      .select('*')
      .gte('created_at', today.toISOString());

    const crownsTodayCount = crownsToday?.length || 0;

    const topStreamers = [...(streams || [])]
      .sort((a, b) => parseFloat(b.total_tips) - parseFloat(a.total_tips))
      .slice(0, 10)
      .map(s => ({
        ...s,
        totalSessions: sessions?.filter(ses => ses.streamer_wallet === s.wallet_address).length || 0,
        totalStreamTime: sessions?.filter(ses => ses.streamer_wallet === s.wallet_address)
          .reduce((sum, ses) => sum + (ses.duration_seconds || 0), 0) || 0
      }));

    const categoryCount = {};
    const categoryCrowns = {};
    const categoryTips = {};

    streams?.forEach(s => {
      categoryCount[s.category] = (categoryCount[s.category] || 0) + 1;
      categoryCrowns[s.category] = (categoryCrowns[s.category] || 0) + s.crown_count;
      categoryTips[s.category] = (categoryTips[s.category] || 0) + parseFloat(s.total_tips);
    });

    const topCategories = Object.entries(categoryCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({
        name,
        count,
        crowns: categoryCrowns[name] || 0,
        tips: categoryTips[name] || 0
      }));

    const { data: tips } = await supabase
      .from('stream_tips')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    const currencyTotals = {};
    tips?.forEach(tip => {
      const key = tip.currency;
      if (!currencyTotals[key]) {
        currencyTotals[key] = { currency: key, total: 0, count: 0 };
      }
      currencyTotals[key].total += parseFloat(tip.amount);
      currencyTotals[key].count += 1;
    });

    const tokenBreakdownArray = Object.values(currencyTotals)
      .sort((a, b) => b.total - a.total);

    const avgTipsPerSession = totalSessions > 0
      ? (sessions?.reduce((sum, s) => sum + parseFloat(s.total_tips || 0), 0) || 0) / totalSessions
      : 0;

    const avgCrownsPerSession = totalSessions > 0
      ? (sessions?.reduce((sum, s) => sum + (s.total_crowns || 0), 0) || 0) / totalSessions
      : 0;

    const { data: allTips } = await supabase
      .from('stream_tips')
      .select('from_wallet, from_nickname, amount, currency');

    const tipperTotals = {};
    allTips?.forEach(tip => {
      if (!tipperTotals[tip.from_wallet]) {
        tipperTotals[tip.from_wallet] = {
          wallet: tip.from_wallet,
          nickname: tip.from_nickname,
          total: 0,
          count: 0
        };
      }
      tipperTotals[tip.from_wallet].total += parseFloat(tip.amount);
      tipperTotals[tip.from_wallet].count += 1;
    });

    const topTippers = Object.values(tipperTotals)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    setStats({
      totalStreams,
      activeStreams,
      totalViewers,
      totalTips,
      totalCrowns,
      totalSessions,
      avgSessionDuration,
      totalStreamTime,
      topStreamers,
      topCategories,
      recentTips: tips || [],
      tokenBreakdown: tokenBreakdownArray,
      sessionsToday,
      tipsToday: tipsTodayAmount,
      crownsToday: crownsTodayCount,
      peakConcurrentViewers: peakViewers,
      avgTipsPerSession,
      avgCrownsPerSession,
      topTippers
    });
  };

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-3xl font-bold text-purple-200 mb-6">Advanced Stream Analytics</h2>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <div className="bg-purple-800/30 rounded-lg p-4 border border-purple-500/20">
            <div className="text-purple-400 text-xs mb-1">📊 Total Streams</div>
            <div className="text-purple-200 text-2xl font-bold">{stats.totalStreams}</div>
          </div>
          <div className="bg-purple-800/30 rounded-lg p-4 border border-purple-500/20">
            <div className="text-purple-400 text-xs mb-1">🔴 Live Now</div>
            <div className="text-red-400 text-2xl font-bold">{stats.activeStreams}</div>
          </div>
          <div className="bg-purple-800/30 rounded-lg p-4 border border-purple-500/20">
            <div className="text-purple-400 text-xs mb-1">👥 Total Viewers</div>
            <div className="text-purple-200 text-2xl font-bold">{stats.totalViewers}</div>
          </div>
          <div className="bg-purple-800/30 rounded-lg p-4 border border-purple-500/20">
            <div className="text-purple-400 text-xs mb-1">💸 Total Tips</div>
            <div className="text-green-400 text-2xl font-bold">{stats.totalTips.toFixed(2)}</div>
          </div>
          <div className="bg-purple-800/30 rounded-lg p-4 border border-purple-500/20">
            <div className="text-purple-400 text-xs mb-1">👑 Total Crowns</div>
            <div className="text-yellow-400 text-2xl font-bold">{stats.totalCrowns}</div>
          </div>
          <div className="bg-purple-800/30 rounded-lg p-4 border border-purple-500/20">
            <div className="text-purple-400 text-xs mb-1">📺 Sessions</div>
            <div className="text-purple-200 text-2xl font-bold">{stats.totalSessions}</div>
          </div>
        </div>

        {/* Today's Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 rounded-lg p-4 border border-blue-500/30">
            <div className="text-blue-300 text-sm mb-2">📅 Sessions Today</div>
            <div className="text-blue-200 text-3xl font-bold">{stats.sessionsToday}</div>
          </div>
          <div className="bg-gradient-to-br from-green-600/20 to-green-800/20 rounded-lg p-4 border border-green-500/30">
            <div className="text-green-300 text-sm mb-2">💰 Tips Today</div>
            <div className="text-green-200 text-3xl font-bold">{stats.tipsToday.toFixed(2)}</div>
          </div>
          <div className="bg-gradient-to-br from-yellow-600/20 to-yellow-800/20 rounded-lg p-4 border border-yellow-500/30">
            <div className="text-yellow-300 text-sm mb-2">👑 Crowns Today</div>
            <div className="text-yellow-200 text-3xl font-bold">{stats.crownsToday}</div>
          </div>
          <div className="bg-gradient-to-br from-purple-600/20 to-purple-800/20 rounded-lg p-4 border border-purple-500/30">
            <div className="text-purple-300 text-sm mb-2">⏱️ Avg Session</div>
            <div className="text-purple-200 text-3xl font-bold">{formatDuration(stats.avgSessionDuration)}</div>
          </div>
        </div>

        {/* Advanced Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-purple-800/30 rounded-lg p-4 border border-purple-500/20">
            <div className="text-purple-400 text-sm mb-2">⏰ Total Stream Time</div>
            <div className="text-purple-200 text-2xl font-bold">{formatDuration(stats.totalStreamTime)}</div>
          </div>
          <div className="bg-purple-800/30 rounded-lg p-4 border border-purple-500/20">
            <div className="text-purple-400 text-sm mb-2">📊 Peak Viewers</div>
            <div className="text-purple-200 text-2xl font-bold">{stats.peakConcurrentViewers}</div>
          </div>
          <div className="bg-purple-800/30 rounded-lg p-4 border border-purple-500/20">
            <div className="text-purple-400 text-sm mb-2">💸 Avg Tips/Session</div>
            <div className="text-green-400 text-2xl font-bold">{stats.avgTipsPerSession.toFixed(2)}</div>
          </div>
          <div className="bg-purple-800/30 rounded-lg p-4 border border-purple-500/20">
            <div className="text-purple-400 text-sm mb-2">👑 Avg Crowns/Session</div>
            <div className="text-yellow-400 text-2xl font-bold">{stats.avgCrownsPerSession.toFixed(1)}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Top Streamers */}
          <div className="bg-purple-800/30 rounded-lg p-6 border border-purple-500/20">
            <h3 className="text-xl font-bold text-purple-200 mb-4">🏆 Top Streamers</h3>
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {stats.topStreamers.length === 0 ? (
                <div className="text-center py-8 text-purple-400">No active streamers</div>
              ) : (
                stats.topStreamers.map((stream, idx) => (
                  <div key={stream.id} className="bg-purple-900/30 p-3 rounded-lg">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="text-2xl font-bold text-purple-400">#{idx + 1}</div>
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                        {stream.nickname.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <div className="text-purple-200 font-bold">{stream.nickname}</div>
                        <div className="text-purple-400 text-xs">
                          {stream.totalSessions} sessions • {formatDuration(stream.totalStreamTime)} total
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="bg-purple-800/30 rounded px-2 py-1">
                        <div className="text-purple-400">Viewers</div>
                        <div className="text-purple-200 font-bold">👥 {stream.viewer_count}</div>
                      </div>
                      <div className="bg-green-900/30 rounded px-2 py-1">
                        <div className="text-green-400">Tips</div>
                        <div className="text-green-300 font-bold">💸 {parseFloat(stream.total_tips).toFixed(2)}</div>
                      </div>
                      <div className="bg-yellow-900/30 rounded px-2 py-1">
                        <div className="text-yellow-400">Crowns</div>
                        <div className="text-yellow-300 font-bold">👑 {stream.crown_count}</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Token Breakdown */}
          <div className="bg-purple-800/30 rounded-lg p-6 border border-purple-500/20">
            <h3 className="text-xl font-bold text-purple-200 mb-4">💎 Token Breakdown</h3>
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {stats.tokenBreakdown.length === 0 ? (
                <div className="text-center py-8 text-purple-400">No tips yet</div>
              ) : (
                stats.tokenBreakdown.map((token, idx) => (
                  <div key={idx} className="bg-purple-900/30 p-3 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">{token.currency === 'XRP' ? '💎' : '🪙'}</div>
                      <div>
                        <div className="text-purple-200 font-bold">{token.currency}</div>
                        <div className="text-purple-400 text-sm">{token.count} tips</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-green-400 font-bold text-lg">{token.total.toFixed(4)}</div>
                      <div className="text-purple-400 text-xs">
                        {stats.totalTips > 0 ? ((token.total / stats.totalTips) * 100).toFixed(1) : 0}%
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Top Categories */}
          <div className="bg-purple-800/30 rounded-lg p-6 border border-purple-500/20">
            <h3 className="text-xl font-bold text-purple-200 mb-4">📊 Popular Categories</h3>
            <div className="space-y-3">
              {stats.topCategories.length === 0 ? (
                <div className="text-center py-8 text-purple-400">No categories yet</div>
              ) : (
                stats.topCategories.map((cat, idx) => (
                  <div key={cat.name} className="bg-purple-900/30 p-3 rounded-lg">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="text-2xl font-bold text-purple-400">#{idx + 1}</div>
                      <div className="flex-1">
                        <div className="text-purple-200 font-bold">{cat.name}</div>
                        <div className="text-purple-400 text-sm">{cat.count} stream{cat.count !== 1 ? 's' : ''}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-green-900/30 rounded px-2 py-1">
                        <div className="text-green-400">Tips</div>
                        <div className="text-green-300 font-bold">💸 {cat.tips.toFixed(2)}</div>
                      </div>
                      <div className="bg-yellow-900/30 rounded px-2 py-1">
                        <div className="text-yellow-400">Crowns</div>
                        <div className="text-yellow-300 font-bold">👑 {cat.crowns}</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Top Tippers */}
          <div className="bg-purple-800/30 rounded-lg p-6 border border-purple-500/20">
            <h3 className="text-xl font-bold text-purple-200 mb-4">💸 Top Tippers</h3>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {stats.topTippers.length === 0 ? (
                <div className="text-center py-8 text-purple-400">No tippers yet</div>
              ) : (
                stats.topTippers.map((tipper, idx) => (
                  <div key={tipper.wallet} className="flex items-center gap-3 bg-purple-900/30 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-purple-400">#{idx + 1}</div>
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center text-white font-bold">
                      {tipper.nickname.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="text-purple-200 font-bold">{tipper.nickname}</div>
                      <div className="text-purple-400 text-sm">{tipper.count} tips</div>
                    </div>
                    <div className="text-green-400 font-bold text-lg">
                      {tipper.total.toFixed(2)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Recent Tips */}
        <div className="bg-purple-800/30 rounded-lg p-6 border border-purple-500/20">
          <h3 className="text-xl font-bold text-purple-200 mb-4">💸 Recent Tips</h3>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {stats.recentTips.length === 0 ? (
              <div className="text-center py-8 text-purple-400">No tips yet</div>
            ) : (
              stats.recentTips.map((tip) => (
                <div key={tip.id} className="flex items-center gap-3 bg-purple-900/30 p-3 rounded-lg">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center text-white font-bold text-sm">
                    {tip.from_nickname.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="text-purple-200">
                      <span className="font-bold">{tip.from_nickname}</span>
                      <span className="text-purple-400 mx-2">→</span>
                      <span className="font-bold">{tip.to_nickname}</span>
                    </div>
                  </div>
                  <div className="text-green-400 font-bold">
                    {parseFloat(tip.amount).toFixed(4)} {tip.currency}
                  </div>
                  <div className="text-purple-400 text-sm">
                    {formatTimestamp(tip.created_at)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
