import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';

export default function StreamAnalytics() {
  const [stats, setStats] = useState({
    totalStreams: 0,
    activeStreams: 0,
    totalViewers: 0,
    totalTips: 0,
    totalCrowns: 0,
    topStreamers: [],
    topCategories: [],
    recentTips: []
  });

  useEffect(() => {
    loadAnalytics();
    const interval = setInterval(loadAnalytics, 30000);
    return () => clearInterval(interval);
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

    const { data: allStreams } = await supabase
      .from('live_streams')
      .select('*');

    const totalStreams = allStreams?.length || 0;

    const topStreamers = [...(streams || [])]
      .sort((a, b) => parseFloat(b.total_tips) - parseFloat(a.total_tips))
      .slice(0, 10);

    const categoryCount = {};
    streams?.forEach(s => {
      categoryCount[s.category] = (categoryCount[s.category] || 0) + 1;
    });
    const topCategories = Object.entries(categoryCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    const { data: tips } = await supabase
      .from('stream_tips')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    setStats({
      totalStreams,
      activeStreams,
      totalViewers,
      totalTips,
      totalCrowns,
      topStreamers,
      topCategories,
      recentTips: tips || []
    });
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-3xl font-bold text-purple-200 mb-6">Stream Analytics</h2>

        {/* Top Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="bg-purple-800/30 rounded-lg p-6 border border-purple-500/20">
            <div className="text-purple-400 text-sm mb-2">📊 Total Streams</div>
            <div className="text-purple-200 text-3xl font-bold">{stats.totalStreams}</div>
          </div>
          <div className="bg-purple-800/30 rounded-lg p-6 border border-purple-500/20">
            <div className="text-purple-400 text-sm mb-2">🔴 Live Now</div>
            <div className="text-red-400 text-3xl font-bold">{stats.activeStreams}</div>
          </div>
          <div className="bg-purple-800/30 rounded-lg p-6 border border-purple-500/20">
            <div className="text-purple-400 text-sm mb-2">👥 Total Viewers</div>
            <div className="text-purple-200 text-3xl font-bold">{stats.totalViewers}</div>
          </div>
          <div className="bg-purple-800/30 rounded-lg p-6 border border-purple-500/20">
            <div className="text-purple-400 text-sm mb-2">💸 Tips Earned</div>
            <div className="text-green-400 text-3xl font-bold">{stats.totalTips.toFixed(2)}</div>
          </div>
          <div className="bg-purple-800/30 rounded-lg p-6 border border-purple-500/20">
            <div className="text-purple-400 text-sm mb-2">👑 Total Crowns</div>
            <div className="text-yellow-400 text-3xl font-bold">{stats.totalCrowns}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Top Streamers */}
          <div className="bg-purple-800/30 rounded-lg p-6 border border-purple-500/20">
            <h3 className="text-xl font-bold text-purple-200 mb-4">🏆 Top Streamers</h3>
            <div className="space-y-3">
              {stats.topStreamers.length === 0 ? (
                <div className="text-center py-8 text-purple-400">No active streamers</div>
              ) : (
                stats.topStreamers.map((stream, idx) => (
                  <div key={stream.id} className="flex items-center gap-3 bg-purple-900/30 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-purple-400">#{idx + 1}</div>
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                      {stream.nickname.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="text-purple-200 font-bold">{stream.nickname}</div>
                      <div className="text-purple-400 text-sm">👥 {stream.viewer_count} viewers</div>
                    </div>
                    <div className="text-right">
                      <div className="text-green-400 font-bold">{parseFloat(stream.total_tips).toFixed(2)} XRP</div>
                      <div className="text-yellow-400 text-sm">👑 {stream.crown_count}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Top Categories */}
          <div className="bg-purple-800/30 rounded-lg p-6 border border-purple-500/20">
            <h3 className="text-xl font-bold text-purple-200 mb-4">📊 Popular Categories</h3>
            <div className="space-y-3">
              {stats.topCategories.length === 0 ? (
                <div className="text-center py-8 text-purple-400">No categories yet</div>
              ) : (
                stats.topCategories.map((cat, idx) => (
                  <div key={cat.name} className="flex items-center gap-3 bg-purple-900/30 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-purple-400">#{idx + 1}</div>
                    <div className="flex-1">
                      <div className="text-purple-200 font-bold">{cat.name}</div>
                      <div className="text-purple-400 text-sm">{cat.count} stream{cat.count !== 1 ? 's' : ''}</div>
                    </div>
                    <div className="w-24 bg-purple-900/50 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-purple-500 to-pink-500 h-full rounded-full"
                        style={{ width: `${(cat.count / stats.activeStreams) * 100}%` }}
                      />
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
          <div className="space-y-2">
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
