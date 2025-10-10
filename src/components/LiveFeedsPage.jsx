import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import toast from 'react-hot-toast';

const DEV_WALLET = 'rphatRpwXcPAo7CVm46dC78JAQ6kLMqb2M';

export default function LiveFeedsPage({ onViewStream, connectedWallet }) {
  const [liveStreams, setLiveStreams] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('viewers');
  const [viewMode, setViewMode] = useState('grid');

  useEffect(() => {
    loadCategories();
    loadLiveStreams();
    subscribeToStreams();

    const interval = setInterval(loadLiveStreams, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadCategories = async () => {
    const { data } = await supabase
      .from('stream_categories')
      .select('*')
      .order('name', { ascending: true });

    if (data) {
      setCategories(data);
    }
  };

  const loadLiveStreams = async () => {
    let query = supabase
      .from('live_streams')
      .select('*')
      .eq('is_active', true);

    if (selectedCategory !== 'all') {
      query = query.eq('category', selectedCategory);
    }

    const { data, error } = await query.order('started_at', { ascending: false });

    if (!error && data) {
      let filtered = data;

      if (searchQuery) {
        filtered = filtered.filter(s =>
          s.nickname.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.title.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }

      if (sortBy === 'viewers') {
        filtered.sort((a, b) => b.viewer_count - a.viewer_count);
      } else if (sortBy === 'tips') {
        filtered.sort((a, b) => parseFloat(b.total_tips) - parseFloat(a.total_tips));
      } else if (sortBy === 'crowns') {
        filtered.sort((a, b) => b.crown_count - a.crown_count);
      } else if (sortBy === 'recent') {
        filtered.sort((a, b) => new Date(b.started_at) - new Date(a.started_at));
      }

      setLiveStreams(filtered);
    }
  };

  const subscribeToStreams = () => {
    const channel = supabase
      .channel('live_streams_feed')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_streams'
        },
        () => {
          loadLiveStreams();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  useEffect(() => {
    loadLiveStreams();
  }, [selectedCategory, searchQuery, sortBy]);

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const getStreamDuration = (startTime) => {
    const minutes = Math.floor((new Date() - new Date(startTime)) / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header with Search and Filters */}
      <div className="p-6 bg-purple-900/20 backdrop-blur-xl border-b border-purple-500/20">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-3xl font-bold text-purple-200">Live Streams</h2>
              <p className="text-purple-400 text-sm mt-1">{liveStreams.length} channels live</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-all ${
                  viewMode === 'grid'
                    ? 'bg-purple-600 text-white'
                    : 'bg-purple-800/30 text-purple-400 hover:text-purple-200'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-all ${
                  viewMode === 'list'
                    ? 'bg-purple-600 text-white'
                    : 'bg-purple-800/30 text-purple-400 hover:text-purple-200'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[300px]">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search streams..."
                className="w-full bg-purple-800/30 text-purple-100 px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 border border-purple-500/20 placeholder-purple-400/50"
              />
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-purple-800/30 text-purple-100 px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 border border-purple-500/20"
            >
              <option value="viewers">Most Viewers</option>
              <option value="tips">Most Tips</option>
              <option value="crowns">Most Crowns</option>
              <option value="recent">Recently Started</option>
            </select>
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="px-6 py-4 bg-purple-900/10 border-b border-purple-500/20 overflow-x-auto">
        <div className="max-w-7xl mx-auto flex gap-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
              selectedCategory === 'all'
                ? 'bg-purple-600 text-white'
                : 'bg-purple-800/30 text-purple-300 hover:bg-purple-800/50'
            }`}
          >
            🌟 All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.name)}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                selectedCategory === cat.name
                  ? 'bg-purple-600 text-white'
                  : 'bg-purple-800/30 text-purple-300 hover:bg-purple-800/50'
              }`}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Streams Grid/List */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto">
          {liveStreams.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">📡</div>
              <div className="text-purple-400 text-xl">No live streams found</div>
              <div className="text-purple-500 text-sm mt-2">Try adjusting your filters</div>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {liveStreams.map((stream) => (
                <button
                  key={stream.id}
                  onClick={() => onViewStream(stream)}
                  className="bg-purple-800/30 rounded-lg overflow-hidden border border-purple-500/20 hover:border-purple-500/50 transition-all group"
                >
                  <div className="aspect-video bg-black relative">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-6xl">📹</div>
                    </div>
                    <div className="absolute top-2 right-2 flex items-center gap-2 bg-red-500 px-3 py-1 rounded">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                      <span className="text-white font-bold text-xs">LIVE</span>
                    </div>
                    <div className="absolute top-2 left-2 bg-purple-900/90 backdrop-blur-xl px-3 py-1 rounded">
                      <span className="text-green-400 font-bold text-xs">💸 {parseFloat(stream.total_tips).toFixed(2)}</span>
                    </div>
                    <div className="absolute bottom-2 left-2 bg-black/80 backdrop-blur-xl px-2 py-1 rounded text-xs text-white font-medium">
                      {getStreamDuration(stream.started_at)}
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                        {stream.nickname.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="text-purple-200 font-bold truncate">{stream.nickname}</div>
                          {stream.wallet_address === DEV_WALLET && (
                            <span className="text-yellow-400 text-sm">👑</span>
                          )}
                        </div>
                        <div className="text-purple-400 text-xs truncate">{stream.title}</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3 text-purple-300">
                        <span>👥 {stream.viewer_count}</span>
                        <span>👑 {stream.crown_count}</span>
                      </div>
                      <div className="bg-purple-700/50 px-2 py-1 rounded text-purple-200">
                        {stream.category}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {liveStreams.map((stream) => (
                <button
                  key={stream.id}
                  onClick={() => onViewStream(stream)}
                  className="w-full bg-purple-800/30 rounded-lg p-4 border border-purple-500/20 hover:border-purple-500/50 transition-all group flex items-center gap-4"
                >
                  <div className="w-48 h-28 bg-black rounded-lg flex-shrink-0 relative overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-4xl">📹</div>
                    </div>
                    <div className="absolute top-2 right-2 flex items-center gap-1 bg-red-500 px-2 py-0.5 rounded text-xs">
                      <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                      <span className="text-white font-bold">LIVE</span>
                    </div>
                  </div>
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                        {stream.nickname.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-purple-200 font-bold text-lg">{stream.nickname}</span>
                          {stream.wallet_address === DEV_WALLET && (
                            <span className="text-yellow-400">👑</span>
                          )}
                        </div>
                        <div className="text-purple-400 text-sm">{stream.title}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-3">
                      <div className="bg-purple-700/50 px-3 py-1 rounded text-purple-200 text-sm">
                        {stream.category}
                      </div>
                      <div className="text-purple-300 text-sm">👥 {stream.viewer_count} viewers</div>
                      <div className="text-purple-300 text-sm">👑 {stream.crown_count} crowns</div>
                      <div className="text-green-400 text-sm font-bold">💸 {parseFloat(stream.total_tips).toFixed(2)} XRP</div>
                      <div className="text-purple-400 text-sm ml-auto">Started {formatTimestamp(stream.started_at)}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
