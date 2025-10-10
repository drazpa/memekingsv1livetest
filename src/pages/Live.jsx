import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../utils/supabase';
import toast from 'react-hot-toast';

export default function Live() {
  const [connectedWallet, setConnectedWallet] = useState(null);
  const [view, setView] = useState('directory');
  const [liveStreams, setLiveStreams] = useState([]);
  const [myStream, setMyStream] = useState(null);
  const [selectedStream, setSelectedStream] = useState(null);
  const [streamTitle, setStreamTitle] = useState('');
  const [streamDescription, setStreamDescription] = useState('');
  const [selectedToken, setSelectedToken] = useState(null);
  const [availableTokens, setAvailableTokens] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamStats, setStreamStats] = useState({
    minutesStreamed: 0,
    currentEarnings: 0,
    viewerCount: 0,
    peakViewers: 0
  });
  const [earningsPerMinute, setEarningsPerMinute] = useState(0);
  const [countdown, setCountdown] = useState(60);
  const [streamAnalytics, setStreamAnalytics] = useState(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const earningsTimerRef = useRef(null);

  useEffect(() => {
    loadConnectedWallet();
    loadLiveStreams();
    subscribeToStreams();

    const interval = setInterval(loadLiveStreams, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (connectedWallet) {
      loadAvailableTokens();
      loadMyActiveStream();
    }
  }, [connectedWallet]);

  useEffect(() => {
    if (isStreaming && myStream) {
      startEarningsTimer();
      startMinuteCountdown();
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (earningsTimerRef.current) clearInterval(earningsTimerRef.current);
    };
  }, [isStreaming, myStream]);

  const loadConnectedWallet = () => {
    const stored = localStorage.getItem('connectedWallet');
    if (stored) {
      setConnectedWallet(JSON.parse(stored));
    }
  };

  const loadAvailableTokens = async () => {
    const { data } = await supabase
      .from('tokens')
      .select('*')
      .eq('amm_pool_created', true)
      .order('created_at', { ascending: false });

    setAvailableTokens(data || []);
  };

  const loadLiveStreams = async () => {
    const { data } = await supabase
      .from('live_streams')
      .select('*')
      .eq('is_live', true)
      .order('viewer_count', { ascending: false });

    setLiveStreams(data || []);
  };

  const loadMyActiveStream = async () => {
    if (!connectedWallet) return;

    const { data } = await supabase
      .from('live_streams')
      .select('*')
      .eq('streamer_wallet', connectedWallet.address)
      .eq('is_live', true)
      .maybeSingle();

    if (data) {
      setMyStream(data);
      setIsStreaming(true);
      loadStreamAllocation(data.favorite_token_code, data.favorite_token_issuer);
    }
  };

  const loadStreamAllocation = async (tokenCode, tokenIssuer) => {
    const { data } = await supabase
      .from('token_streaming_allocations')
      .select('*')
      .eq('token_code', tokenCode)
      .eq('token_issuer', tokenIssuer)
      .maybeSingle();

    if (data) {
      setEarningsPerMinute(parseFloat(data.reward_per_minute));
    } else {
      const tokenData = availableTokens.find(
        t => t.currency_code === tokenCode && t.issuer_address === tokenIssuer
      );
      if (tokenData) {
        await setupTokenAllocation(tokenData);
      }
    }
  };

  const setupTokenAllocation = async (token) => {
    const totalSupply = parseFloat(token.total_supply || 100000000);
    const allocation = totalSupply * 0.01;
    const yearlyReward = allocation * 0.01;
    const minutesPerYear = 525600;
    const rewardPerMinute = yearlyReward / minutesPerYear;

    const { data } = await supabase
      .from('token_streaming_allocations')
      .upsert({
        token_code: token.currency_code,
        token_issuer: token.issuer_address,
        total_supply: totalSupply,
        allocation_percentage: 1.0,
        total_allocated: allocation,
        apy_percentage: 1.0,
        minutes_per_year: minutesPerYear,
        reward_per_minute: rewardPerMinute
      })
      .select()
      .single();

    if (data) {
      setEarningsPerMinute(parseFloat(data.reward_per_minute));
    }
  };

  const subscribeToStreams = () => {
    const channel = supabase
      .channel('live_streams_changes')
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

  const startStream = async () => {
    if (!streamTitle.trim() || !selectedToken || !connectedWallet) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }

      const nickname = localStorage.getItem(`nickname_${connectedWallet.address}`) || 'Streamer';
      const streamId = `stream_${Date.now()}_${connectedWallet.address.slice(0, 8)}`;

      const { data, error } = await supabase
        .from('live_streams')
        .insert([{
          stream_id: streamId,
          streamer_wallet: connectedWallet.address,
          streamer_nickname: nickname,
          title: streamTitle,
          description: streamDescription,
          favorite_token_code: selectedToken.currency_code,
          favorite_token_issuer: selectedToken.issuer_address,
          is_live: true,
          started_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;

      setMyStream(data);
      setIsStreaming(true);
      setView('streaming');
      await loadStreamAllocation(selectedToken.currency_code, selectedToken.issuer_address);

      await supabase.from('stream_sessions').insert([{
        stream_id: data.id,
        session_start: new Date().toISOString()
      }]);

      toast.success('Stream started!');
    } catch (error) {
      console.error('Error starting stream:', error);
      toast.error('Failed to start stream: ' + error.message);
    }
  };

  const stopStream = async () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    if (myStream) {
      await supabase
        .from('live_streams')
        .update({
          is_live: false,
          ended_at: new Date().toISOString(),
          total_minutes_streamed: streamStats.minutesStreamed,
          total_earned: streamStats.currentEarnings
        })
        .eq('id', myStream.id);

      await supabase
        .from('stream_sessions')
        .update({
          session_end: new Date().toISOString(),
          minutes_streamed: streamStats.minutesStreamed,
          peak_viewers: streamStats.peakViewers,
          total_earned: streamStats.currentEarnings
        })
        .eq('stream_id', myStream.id)
        .is('session_end', null);

      await supabase
        .from('stream_earnings')
        .insert([{
          stream_id: myStream.id,
          streamer_wallet: connectedWallet.address,
          token_code: myStream.favorite_token_code,
          token_issuer: myStream.favorite_token_issuer,
          minutes_streamed: streamStats.minutesStreamed,
          amount_earned: streamStats.currentEarnings,
          allocation_percentage: 1.0
        }]);
    }

    setIsStreaming(false);
    setMyStream(null);
    setView('directory');
    setStreamStats({
      minutesStreamed: 0,
      currentEarnings: 0,
      viewerCount: 0,
      peakViewers: 0
    });

    toast.success(`Stream ended! You earned ${streamStats.currentEarnings.toFixed(4)} tokens`);
  };

  const startEarningsTimer = () => {
    if (earningsTimerRef.current) clearInterval(earningsTimerRef.current);

    earningsTimerRef.current = setInterval(() => {
      setStreamStats(prev => ({
        ...prev,
        minutesStreamed: prev.minutesStreamed + 1,
        currentEarnings: prev.currentEarnings + earningsPerMinute
      }));

      if (myStream) {
        supabase
          .from('live_streams')
          .update({
            total_minutes_streamed: streamStats.minutesStreamed + 1,
            total_earned: streamStats.currentEarnings + earningsPerMinute
          })
          .eq('id', myStream.id);
      }
    }, 60000);
  };

  const startMinuteCountdown = () => {
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          return 60;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            cursor: 'always',
            displaySurface: 'monitor'
          },
          audio: true
        });

        if (videoRef.current) {
          videoRef.current.srcObject = screenStream;
          streamRef.current = screenStream;
        }

        setIsScreenSharing(true);
        toast.success('Screen sharing started');
      } else {
        const cameraStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });

        if (videoRef.current) {
          videoRef.current.srcObject = cameraStream;
          streamRef.current = cameraStream;
        }

        setIsScreenSharing(false);
        toast.success('Switched to camera');
      }
    } catch (error) {
      console.error('Error toggling screen share:', error);
      toast.error('Failed to toggle screen share');
    }
  };

  const watchStream = async (stream) => {
    setSelectedStream(stream);
    setView('watching');

    const nickname = localStorage.getItem(`nickname_${connectedWallet?.address}`) || 'Viewer';

    await supabase.from('stream_viewers').insert([{
      stream_id: stream.id,
      viewer_wallet: connectedWallet?.address || 'anonymous',
      viewer_nickname: nickname
    }]);

    await supabase
      .from('live_streams')
      .update({
        viewer_count: (stream.viewer_count || 0) + 1
      })
      .eq('id', stream.id);
  };

  const leaveStream = async () => {
    if (selectedStream) {
      await supabase
        .from('stream_viewers')
        .update({
          left_at: new Date().toISOString(),
          is_watching: false
        })
        .eq('stream_id', selectedStream.id)
        .eq('viewer_wallet', connectedWallet?.address || 'anonymous')
        .is('left_at', null);

      await supabase
        .from('live_streams')
        .update({
          viewer_count: Math.max(0, (selectedStream.viewer_count || 1) - 1)
        })
        .eq('id', selectedStream.id);
    }

    setSelectedStream(null);
    setView('directory');
  };

  const loadStreamAnalytics = async (streamId) => {
    const { data: sessions } = await supabase
      .from('stream_sessions')
      .select('*')
      .eq('stream_id', streamId);

    const { data: earnings } = await supabase
      .from('stream_earnings')
      .select('*')
      .eq('stream_id', streamId);

    const totalMinutes = sessions?.reduce((sum, s) => sum + (s.minutes_streamed || 0), 0) || 0;
    const totalEarnings = earnings?.reduce((sum, e) => sum + parseFloat(e.amount_earned || 0), 0) || 0;
    const avgViewers = sessions?.reduce((sum, s) => sum + (s.peak_viewers || 0), 0) / (sessions?.length || 1) || 0;

    setStreamAnalytics({
      totalSessions: sessions?.length || 0,
      totalMinutes,
      totalEarnings,
      avgViewers: Math.round(avgViewers),
      sessions: sessions || [],
      earnings: earnings || []
    });
  };

  return (
    <div className="min-h-screen bg-slate-900">
      {view === 'directory' && (
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">Live Streams</h1>
              <p className="text-gray-400">Watch live streams or start streaming to earn tokens</p>
            </div>
            {connectedWallet && (
              <button
                onClick={() => setView('setup')}
                className="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white px-6 py-3 rounded-lg font-medium transition-all duration-300 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                </svg>
                Go Live
              </button>
            )}
          </div>

          {liveStreams.length === 0 ? (
            <div className="bg-slate-800 rounded-xl p-12 text-center border border-slate-700">
              <div className="text-6xl mb-4">📡</div>
              <h3 className="text-2xl font-bold text-white mb-2">No Live Streams</h3>
              <p className="text-gray-400">Be the first to go live and start earning!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {liveStreams.map((stream) => (
                <div key={stream.id} className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700 hover:border-red-500/50 transition-all cursor-pointer group">
                  <div className="relative aspect-video bg-slate-900 flex items-center justify-center">
                    <div className="absolute inset-0 bg-gradient-to-br from-red-500/20 to-pink-500/20 group-hover:from-red-500/30 group-hover:to-pink-500/30 transition-all"></div>
                    <svg className="w-16 h-16 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                    </svg>
                    <div className="absolute top-3 left-3 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                      <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                      LIVE
                    </div>
                    <div className="absolute top-3 right-3 bg-black/70 text-white px-3 py-1 rounded-full text-sm font-medium">
                      {stream.viewer_count || 0} watching
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="text-white font-bold text-lg mb-1">{stream.title}</h3>
                    <p className="text-gray-400 text-sm mb-3 line-clamp-2">{stream.description || 'No description'}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm">
                          {stream.streamer_nickname.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-white text-sm font-medium">{stream.streamer_nickname}</div>
                          <div className="text-gray-500 text-xs">Earning {stream.favorite_token_code}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => watchStream(stream)}
                        className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all"
                      >
                        Watch
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === 'setup' && (
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => setView('directory')}
            className="text-gray-400 hover:text-white mb-6 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Directory
          </button>

          <div className="bg-slate-800 rounded-xl p-8 border border-slate-700">
            <h2 className="text-3xl font-bold text-white mb-6">Setup Your Stream</h2>

            <div className="space-y-6">
              <div>
                <label className="block text-white font-medium mb-2">Stream Title</label>
                <input
                  type="text"
                  value={streamTitle}
                  onChange={(e) => setStreamTitle(e.target.value)}
                  placeholder="Enter a catchy title..."
                  className="w-full bg-slate-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-white font-medium mb-2">Description</label>
                <textarea
                  value={streamDescription}
                  onChange={(e) => setStreamDescription(e.target.value)}
                  placeholder="Tell viewers what your stream is about..."
                  rows={3}
                  className="w-full bg-slate-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-white font-medium mb-2">
                  Select Token to Earn
                  <span className="text-gray-400 text-sm ml-2">(1% allocation, 1% APY)</span>
                </label>
                <select
                  value={selectedToken ? JSON.stringify(selectedToken) : ''}
                  onChange={(e) => {
                    const token = JSON.parse(e.target.value);
                    setSelectedToken(token);
                    setupTokenAllocation(token);
                  }}
                  className="w-full bg-slate-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="">Choose your favorite token...</option>
                  {availableTokens.map((token) => (
                    <option key={token.id} value={JSON.stringify(token)}>
                      {token.name} ({token.symbol})
                    </option>
                  ))}
                </select>
                {earningsPerMinute > 0 && (
                  <p className="text-green-400 text-sm mt-2">
                    You'll earn {earningsPerMinute.toFixed(6)} {selectedToken?.symbol} per minute of streaming
                  </p>
                )}
              </div>

              <button
                onClick={startStream}
                disabled={!streamTitle || !selectedToken}
                className="w-full bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white py-4 rounded-lg font-bold text-lg transition-all duration-300"
              >
                Start Streaming
              </button>
            </div>
          </div>
        </div>
      )}

      {view === 'streaming' && myStream && (
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  className="w-full aspect-video bg-black"
                />
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-red-600 text-white px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2">
                      <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                      LIVE
                    </div>
                    <div className="text-white font-medium">{streamStats.viewerCount} viewers</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={toggleScreenShare}
                      className={`${isScreenSharing ? 'bg-green-600' : 'bg-slate-700'} hover:bg-slate-600 text-white px-4 py-2 rounded-lg transition-all`}
                    >
                      {isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
                    </button>
                    <button
                      onClick={stopStream}
                      className="bg-red-600 hover:bg-red-500 text-white px-6 py-2 rounded-lg font-medium transition-all"
                    >
                      End Stream
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <h3 className="text-white font-bold text-xl mb-2">{myStream.title}</h3>
                <p className="text-gray-400">{myStream.description}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-gradient-to-br from-green-600 to-emerald-600 rounded-xl p-6 text-white">
                <div className="text-sm opacity-80 mb-1">Current Earnings</div>
                <div className="text-4xl font-bold mb-1">
                  {streamStats.currentEarnings.toFixed(4)}
                </div>
                <div className="text-lg opacity-90">{myStream.favorite_token_code}</div>
              </div>

              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <div className="text-center mb-4">
                  <div className="text-gray-400 text-sm mb-2">Next Earning In</div>
                  <div className="text-5xl font-bold text-white">{countdown}s</div>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-1000"
                    style={{ width: `${((60 - countdown) / 60) * 100}%` }}
                  ></div>
                </div>
              </div>

              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 space-y-4">
                <h3 className="text-white font-bold text-lg">Stream Stats</h3>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Minutes Streamed</span>
                    <span className="text-white font-bold">{streamStats.minutesStreamed}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Current Viewers</span>
                    <span className="text-white font-bold">{streamStats.viewerCount}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Peak Viewers</span>
                    <span className="text-white font-bold">{streamStats.peakViewers}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Earnings/Min</span>
                    <span className="text-green-400 font-bold">{earningsPerMinute.toFixed(6)}</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <h3 className="text-white font-bold mb-3">Earning Breakdown</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-gray-400">
                    <span>Token Supply</span>
                    <span className="text-white">{selectedToken?.total_supply || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>Allocation (1%)</span>
                    <span className="text-white">{(parseFloat(selectedToken?.total_supply || 0) * 0.01).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>Yearly APY (1%)</span>
                    <span className="text-white">{(parseFloat(selectedToken?.total_supply || 0) * 0.0001).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>Per Minute</span>
                    <span className="text-green-400 font-bold">{earningsPerMinute.toFixed(6)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {view === 'watching' && selectedStream && (
        <div className="max-w-7xl mx-auto">
          <button
            onClick={leaveStream}
            className="text-gray-400 hover:text-white mb-6 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Leave Stream
          </button>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
                <div className="aspect-video bg-black flex items-center justify-center relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-red-500/20 to-pink-500/20"></div>
                  <svg className="w-24 h-24 text-red-500 relative z-10" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                  </svg>
                  <div className="absolute top-3 left-3 bg-red-600 text-white px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2">
                    <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                    LIVE
                  </div>
                  <div className="absolute top-3 right-3 bg-black/70 text-white px-4 py-2 rounded-full text-sm font-medium">
                    {selectedStream.viewer_count} watching
                  </div>
                </div>
              </div>

              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <h2 className="text-white font-bold text-2xl mb-2">{selectedStream.title}</h2>
                <p className="text-gray-400 mb-4">{selectedStream.description}</p>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center text-white font-bold">
                    {selectedStream.streamer_nickname.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-white font-medium">{selectedStream.streamer_nickname}</div>
                    <div className="text-gray-400 text-sm">Earning {selectedStream.favorite_token_code}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <h3 className="text-white font-bold mb-4">Stream Info</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Earned</span>
                  <span className="text-green-400 font-bold">
                    {(selectedStream.total_earned || 0).toFixed(4)} {selectedStream.favorite_token_code}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Minutes Streamed</span>
                  <span className="text-white font-bold">{selectedStream.total_minutes_streamed || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Current Viewers</span>
                  <span className="text-white font-bold">{selectedStream.viewer_count || 0}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
