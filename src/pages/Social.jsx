import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../utils/supabase';
import toast from 'react-hot-toast';
import { Client, Wallet as XrplWallet } from 'xrpl';

export default function Social() {
  const [connectedWallet, setConnectedWallet] = useState(null);
  const [walletAssets, setWalletAssets] = useState([]);
  const [availableTokens, setAvailableTokens] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [nickname, setNickname] = useState('');
  const [userAvatar, setUserAvatar] = useState(null);
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [tipRecipient, setTipRecipient] = useState(null);
  const [selectedToken, setSelectedToken] = useState(null);
  const [tipAmount, setTipAmount] = useState('');
  const [sendingTip, setSendingTip] = useState(false);
  const [activeVideoRoom, setActiveVideoRoom] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [isVideoActive, setIsVideoActive] = useState(false);
  const [roomAnalytics, setRoomAnalytics] = useState({
    totalMessages: 0,
    totalTips: 0,
    activeUsers: 0
  });

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const emojis = ['😀', '😂', '🤣', '❤️', '😍', '😭', '😊', '👍', '👎', '🙏', '💪', '🔥', '⭐', '✨', '🎉', '🎊', '💎', '💰', '🚀', '🌟', '💯', '👏', '🤝', '💼', '📈', '📊', '🏆', '👑', '💵', '💸'];

  useEffect(() => {
    loadConnectedWallet();
    loadChatRooms();
    loadAvailableTokens();
    subscribeToPresence();
    loadOnlineUsers();

    const interval = setInterval(() => {
      if (connectedWallet && nickname) {
        updatePresence(nickname, true);
      }
    }, 30000);

    return () => {
      clearInterval(interval);
      if (connectedWallet && nickname) {
        updatePresence(nickname, false);
      }
    };
  }, []);

  useEffect(() => {
    if (connectedWallet) {
      const storedNickname = localStorage.getItem(`nickname_${connectedWallet.address}`);
      const storedAvatar = localStorage.getItem(`avatar_${connectedWallet.address}`);
      if (storedNickname) {
        setNickname(storedNickname);
        setUserAvatar(storedAvatar);
        updatePresence(storedNickname, true);
      } else {
        setShowNicknameModal(true);
      }
      loadWalletAssets(connectedWallet);
    }
  }, [connectedWallet]);

  useEffect(() => {
    if (selectedRoom) {
      loadMessages();
      loadRoomAnalytics();
      subscribeToMessages();
    }
  }, [selectedRoom]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadConnectedWallet = () => {
    const stored = localStorage.getItem('connectedWallet');
    if (stored) {
      setConnectedWallet(JSON.parse(stored));
    }

    const handleWalletChange = () => {
      const stored = localStorage.getItem('connectedWallet');
      if (stored) {
        setConnectedWallet(JSON.parse(stored));
      } else {
        setConnectedWallet(null);
        setWalletAssets([]);
      }
    };

    window.addEventListener('walletConnected', handleWalletChange);
    window.addEventListener('walletDisconnected', handleWalletChange);

    return () => {
      window.removeEventListener('walletConnected', handleWalletChange);
      window.removeEventListener('walletDisconnected', handleWalletChange);
    };
  };

  const loadAvailableTokens = async () => {
    const { data } = await supabase
      .from('tokens')
      .select('*')
      .order('created_at', { ascending: false });

    setAvailableTokens(data || []);
  };

  const loadWalletAssets = async (wallet) => {
    if (!wallet?.address) return;

    try {
      const client = new Client(
        wallet.network === 'mainnet'
          ? 'wss://xrplcluster.com'
          : 'wss://s.altnet.rippletest.net:51233'
      );

      await client.connect();

      const response = await client.request({
        command: 'account_lines',
        account: wallet.address,
        ledger_index: 'validated'
      });

      const assets = response.result.lines || [];
      setWalletAssets(assets);

      await client.disconnect();
    } catch (error) {
      console.error('Error loading wallet assets:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadChatRooms = async () => {
    const { data, error } = await supabase
      .from('chat_rooms')
      .select('*')
      .order('created_at', { ascending: true });

    if (!error && data) {
      setRooms(data);
      if (data.length > 0 && !selectedRoom) {
        setSelectedRoom(data[0]);
      }
    }
  };

  const loadMessages = async () => {
    if (!selectedRoom) return;

    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('room_id', selectedRoom.id)
      .order('created_at', { ascending: true });

    if (!error) {
      setMessages(data || []);
    }
  };

  const loadRoomAnalytics = async () => {
    if (!selectedRoom) return;

    const { data: messagesData } = await supabase
      .from('chat_messages')
      .select('id')
      .eq('room_id', selectedRoom.id);

    const { data: tipsData } = await supabase
      .from('chat_tips')
      .select('amount')
      .in('message_id', (messagesData || []).map(m => m.id));

    const { data: usersData } = await supabase
      .from('user_presence')
      .select('wallet_address')
      .eq('is_online', true);

    setRoomAnalytics({
      totalMessages: messagesData?.length || 0,
      totalTips: tipsData?.length || 0,
      activeUsers: usersData?.length || 0
    });
  };

  const subscribeToMessages = () => {
    if (!selectedRoom) return;

    const channel = supabase
      .channel(`room_${selectedRoom.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_id=eq.${selectedRoom.id}`
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
          loadRoomAnalytics();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const subscribeToPresence = () => {
    const channel = supabase
      .channel('user_presence_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_presence'
        },
        () => {
          loadOnlineUsers();
          loadRoomAnalytics();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const loadOnlineUsers = async () => {
    const { data, error } = await supabase
      .from('user_presence')
      .select('*')
      .eq('is_online', true)
      .order('nickname', { ascending: true });

    if (!error && data) {
      setOnlineUsers(data);
    }
  };

  const updatePresence = async (displayName, online) => {
    if (!connectedWallet) return;

    await supabase
      .from('user_presence')
      .upsert({
        wallet_address: connectedWallet.address,
        nickname: displayName,
        is_online: online,
        last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (online) {
      loadOnlineUsers();
    }
  };

  const saveNickname = async () => {
    if (!nickname.trim() || !connectedWallet) {
      toast.error('Please enter a nickname');
      return;
    }

    localStorage.setItem(`nickname_${connectedWallet.address}`, nickname);
    if (userAvatar) {
      localStorage.setItem(`avatar_${connectedWallet.address}`, userAvatar);
    }

    await updatePresence(nickname, true);
    setShowNicknameModal(false);
    toast.success('Profile saved!');
  };

  const sendMessage = async () => {
    if ((!messageInput.trim() && !imagePreview) || !connectedWallet || !nickname || !selectedRoom) {
      return;
    }

    const messageData = {
      room_id: selectedRoom.id,
      wallet_address: connectedWallet.address,
      nickname: nickname,
      message_type: imagePreview ? 'image' : 'text',
      content: messageInput.trim() || 'Image',
      image_url: imagePreview,
      created_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('chat_messages')
      .insert([messageData]);

    if (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
      return;
    }

    setMessageInput('');
    setImagePreview(null);
  };

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const openTipModal = (user) => {
    if (!connectedWallet) {
      toast.error('Connect wallet to send tips');
      return;
    }
    setTipRecipient(user);
    setShowTipModal(true);
  };

  const sendTip = async () => {
    if (!selectedToken || !tipAmount || !tipRecipient || !connectedWallet) {
      toast.error('Please select token and enter amount');
      return;
    }

    setSendingTip(true);

    try {
      const client = new Client(
        connectedWallet.network === 'mainnet'
          ? 'wss://xrplcluster.com'
          : 'wss://s.altnet.rippletest.net:51233'
      );

      await client.connect();

      const wallet = XrplWallet.fromSeed(connectedWallet.seed);

      let payment;
      if (selectedToken.currency === 'XRP') {
        payment = {
          TransactionType: 'Payment',
          Account: wallet.address,
          Destination: tipRecipient.wallet_address,
          Amount: String(Math.floor(parseFloat(tipAmount) * 1000000))
        };
      } else {
        payment = {
          TransactionType: 'Payment',
          Account: wallet.address,
          Destination: tipRecipient.wallet_address,
          Amount: {
            currency: selectedToken.currency,
            issuer: selectedToken.issuer,
            value: tipAmount
          }
        };
      }

      const prepared = await client.autofill(payment);
      const signed = wallet.sign(prepared);
      const result = await client.submitAndWait(signed.tx_blob);

      if (result.result.meta.TransactionResult === 'tesSUCCESS') {
        const txHash = result.result.hash;

        const tipMessage = {
          room_id: selectedRoom.id,
          wallet_address: connectedWallet.address,
          nickname: nickname,
          message_type: 'tip',
          content: `💸 Sent ${tipAmount} ${selectedToken.currency} to ${tipRecipient.nickname}`,
          tip_data: {
            from: connectedWallet.address,
            to: tipRecipient.wallet_address,
            token: selectedToken.currency,
            amount: tipAmount,
            tx_hash: txHash
          }
        };

        await supabase.from('chat_messages').insert([tipMessage]);

        await supabase.from('chat_tips').insert([{
          from_wallet: connectedWallet.address,
          to_wallet: tipRecipient.wallet_address,
          token_code: selectedToken.currency,
          token_issuer: selectedToken.issuer || 'XRP',
          amount: tipAmount,
          tx_hash: txHash,
          status: 'completed'
        }]);

        toast.success('Tip sent successfully!');
        setShowTipModal(false);
        setTipAmount('');
        setSelectedToken(null);
        loadRoomAnalytics();
      } else {
        toast.error('Transaction failed');
      }

      await client.disconnect();
    } catch (error) {
      console.error('Error sending tip:', error);
      toast.error('Failed to send tip');
    } finally {
      setSendingTip(false);
    }
  };

  const startVideoRoom = async () => {
    if (!connectedWallet || !nickname) {
      toast.error('Connect wallet and set nickname first');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }

      const { data, error } = await supabase
        .from('video_rooms')
        .insert([{
          room_name: `${nickname}'s Room`,
          host_wallet: connectedWallet.address,
          room_type: 'conference',
          is_active: true
        }])
        .select()
        .single();

      if (error) throw error;

      setActiveVideoRoom(data);
      setIsVideoActive(true);
      toast.success('Video room started!');
    } catch (error) {
      console.error('Error starting video:', error);
      toast.error('Failed to start video: ' + error.message);
    }
  };

  const stopVideoRoom = async () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    if (activeVideoRoom) {
      await supabase
        .from('video_rooms')
        .update({
          is_active: false,
          ended_at: new Date().toISOString()
        })
        .eq('id', activeVideoRoom.id);
    }

    setActiveVideoRoom(null);
    setIsVideoActive(false);
    toast.success('Video room ended');
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const getTokenImage = (tokenCode, tokenIssuer) => {
    const token = availableTokens.find(
      t => t.currency_code === tokenCode && t.issuer_address === tokenIssuer
    );
    return token?.image_url || null;
  };

  const getUserAvatar = (msg) => {
    if (msg.wallet_address === connectedWallet?.address && userAvatar) {
      return userAvatar;
    }
    return null;
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-900 via-blue-900/20 to-slate-900">
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Rooms */}
        <div className="w-72 bg-slate-900/50 backdrop-blur-xl flex flex-col border-r border-blue-500/20">
          <div className="p-6 border-b border-blue-500/20 bg-gradient-to-r from-blue-600/10 to-purple-600/10">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Chat Rooms
            </h2>
            <p className="text-gray-400 text-sm mt-1">{rooms.length} rooms available</p>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {rooms.map((room) => (
              <button
                key={room.id}
                onClick={() => setSelectedRoom(room)}
                className={`w-full p-4 rounded-xl text-left transition-all duration-300 ${
                  selectedRoom?.id === room.id
                    ? 'bg-gradient-to-r from-blue-600/30 to-purple-600/30 border-2 border-blue-500/50 shadow-lg shadow-blue-500/20'
                    : 'bg-slate-800/50 hover:bg-slate-800/80 border-2 border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
                  <div className="flex-1">
                    <div className="text-white font-bold">{room.name}</div>
                    <div className="text-gray-400 text-xs capitalize">{room.type}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Video Controls */}
          <div className="p-4 border-t border-blue-500/20 space-y-2">
            {!isVideoActive ? (
              <button
                onClick={startVideoRoom}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white py-3 px-4 rounded-xl font-bold transition-all duration-300 shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                </svg>
                Start Video Room
              </button>
            ) : (
              <button
                onClick={stopVideoRoom}
                className="w-full bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white py-3 px-4 rounded-xl font-bold transition-all duration-300 shadow-lg shadow-red-500/30"
              >
                End Video Room
              </button>
            )}
            <button
              onClick={() => setShowSettingsModal(true)}
              className="w-full bg-slate-800/50 hover:bg-slate-800/80 text-white py-2 px-4 rounded-xl font-medium transition-all duration-300 border border-blue-500/20"
            >
              Settings
            </button>
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col bg-slate-900/30 backdrop-blur-sm">
          {/* Chat Header with Analytics */}
          <div className="bg-slate-900/50 backdrop-blur-xl border-b border-blue-500/20">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    {selectedRoom?.name}
                  </h3>
                  <p className="text-gray-400 text-sm">{onlineUsers.length} users online</p>
                </div>
                {activeVideoRoom && (
                  <div className="bg-gradient-to-r from-green-600/20 to-emerald-600/20 border border-green-500/50 text-green-400 px-4 py-2 rounded-xl font-bold flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    Video Room Active
                  </div>
                )}
              </div>

              {/* Analytics Dashboard */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-blue-600/10 to-blue-600/5 border border-blue-500/20 rounded-xl p-4">
                  <div className="text-blue-400 text-sm font-medium mb-1">Total Messages</div>
                  <div className="text-3xl font-bold text-white">{roomAnalytics.totalMessages}</div>
                </div>
                <div className="bg-gradient-to-br from-purple-600/10 to-purple-600/5 border border-purple-500/20 rounded-xl p-4">
                  <div className="text-purple-400 text-sm font-medium mb-1">Tips Sent</div>
                  <div className="text-3xl font-bold text-white">{roomAnalytics.totalTips}</div>
                </div>
                <div className="bg-gradient-to-br from-green-600/10 to-green-600/5 border border-green-500/20 rounded-xl p-4">
                  <div className="text-green-400 text-sm font-medium mb-1">Active Users</div>
                  <div className="text-3xl font-bold text-white">{roomAnalytics.activeUsers}</div>
                </div>
              </div>
            </div>

            {/* Video Preview */}
            {isVideoActive && (
              <div className="px-6 pb-4">
                <div className="bg-black rounded-xl overflow-hidden border-2 border-blue-500/50 shadow-lg shadow-blue-500/20">
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    className="w-full h-48 object-cover"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex items-start gap-4 group ${
                  msg.wallet_address === connectedWallet?.address ? 'flex-row-reverse' : ''
                }`}
              >
                <div className="relative flex-shrink-0">
                  {getUserAvatar(msg) ? (
                    <img
                      src={getUserAvatar(msg)}
                      alt="avatar"
                      className="w-12 h-12 rounded-xl object-cover border-2 border-blue-500/50"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                      {msg.nickname.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-slate-900"></div>
                </div>

                <div className={`flex-1 max-w-2xl ${msg.wallet_address === connectedWallet?.address ? 'items-end' : ''}`}>
                  <div className="flex items-baseline gap-3 mb-1">
                    <span className="text-white font-bold text-lg">{msg.nickname}</span>
                    <span className="text-gray-500 text-xs">{formatTimestamp(msg.created_at)}</span>
                    {msg.wallet_address !== connectedWallet?.address && (
                      <button
                        onClick={() => openTipModal({ wallet_address: msg.wallet_address, nickname: msg.nickname })}
                        className="opacity-0 group-hover:opacity-100 text-yellow-400 hover:text-yellow-300 text-xs font-medium transition-all"
                      >
                        💸 Tip
                      </button>
                    )}
                  </div>

                  {msg.message_type === 'tip' ? (
                    <div className="bg-gradient-to-r from-yellow-600/20 to-orange-600/20 border-2 border-yellow-500/50 rounded-2xl p-4 shadow-lg shadow-yellow-500/10">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center text-2xl">
                          💸
                        </div>
                        <div className="flex-1">
                          <div className="text-yellow-300 font-bold text-lg">{msg.content}</div>
                          {msg.tip_data?.tx_hash && (
                            <a
                              href={`https://xrpscan.com/tx/${msg.tip_data.tx_hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-400 hover:text-blue-300 hover:underline mt-1 inline-block"
                            >
                              View Transaction →
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : msg.message_type === 'image' ? (
                    <div className={`${
                      msg.wallet_address === connectedWallet?.address
                        ? 'bg-gradient-to-br from-blue-600/30 to-purple-600/30 border-blue-500/50'
                        : 'bg-slate-800/50 border-slate-700/50'
                    } border-2 rounded-2xl p-4 shadow-lg`}>
                      <p className="text-gray-300 mb-3">{msg.content}</p>
                      {msg.image_url && (
                        <img
                          src={msg.image_url}
                          alt="Shared"
                          className="max-w-md rounded-xl border-2 border-blue-500/30"
                        />
                      )}
                    </div>
                  ) : (
                    <div className={`${
                      msg.wallet_address === connectedWallet?.address
                        ? 'bg-gradient-to-br from-blue-600/30 to-purple-600/30 border-blue-500/50'
                        : 'bg-slate-800/50 border-slate-700/50'
                    } border-2 rounded-2xl p-4 shadow-lg`}>
                      <p className="text-white text-lg leading-relaxed">{msg.content}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div className="p-6 bg-slate-900/50 backdrop-blur-xl border-t border-blue-500/20">
            {imagePreview && (
              <div className="mb-4 relative inline-block">
                <img src={imagePreview} alt="Preview" className="h-24 rounded-xl border-2 border-blue-500/50" />
                <button
                  onClick={() => setImagePreview(null)}
                  className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-7 h-7 flex items-center justify-center font-bold shadow-lg"
                >
                  ×
                </button>
              </div>
            )}
            <div className="flex gap-3">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="bg-slate-800/50 hover:bg-slate-800/80 text-white p-3 rounded-xl border border-blue-500/20 transition-all"
                title="Upload Image"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="bg-slate-800/50 hover:bg-slate-800/80 text-white p-3 rounded-xl border border-blue-500/20 transition-all text-xl"
                  title="Emojis"
                >
                  😀
                </button>
                {showEmojiPicker && (
                  <div className="absolute bottom-full left-0 mb-2 bg-slate-800/95 backdrop-blur-xl p-3 rounded-xl shadow-2xl border border-blue-500/30 grid grid-cols-6 gap-2 max-w-xs z-50">
                    {emojis.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => {
                          setMessageInput(messageInput + emoji);
                          setShowEmojiPicker(false);
                        }}
                        className="hover:bg-slate-700/50 p-2 rounded-lg text-2xl transition-all hover:scale-110"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder={nickname ? `Message ${selectedRoom?.name}...` : 'Set nickname first...'}
                disabled={!connectedWallet || !nickname}
                className="flex-1 bg-slate-800/50 text-white px-6 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 border border-blue-500/20 placeholder-gray-500"
              />
              <button
                onClick={sendMessage}
                disabled={(!messageInput.trim() && !imagePreview) || !connectedWallet || !nickname}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white px-8 py-3 rounded-xl font-bold transition-all duration-300 shadow-lg shadow-blue-500/30"
              >
                Send
              </button>
            </div>
          </div>
        </div>

        {/* Right Sidebar - Online Users */}
        <div className="w-80 bg-slate-900/50 backdrop-blur-xl border-l border-blue-500/20 flex flex-col">
          <div className="p-6 border-b border-blue-500/20 bg-gradient-to-r from-purple-600/10 to-blue-600/10">
            <h3 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              Online - {onlineUsers.length}
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {onlineUsers.map((user) => (
              <div
                key={user.wallet_address}
                className="bg-slate-800/30 hover:bg-slate-800/60 p-4 rounded-xl cursor-pointer group transition-all duration-300 border border-blue-500/10 hover:border-blue-500/30"
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                      {user.nickname.charAt(0).toUpperCase()}
                    </div>
                    <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-slate-900 animate-pulse"></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-bold truncate">{user.nickname}</div>
                    <div className="text-gray-400 text-xs truncate">{user.wallet_address.slice(0, 12)}...</div>
                  </div>
                  {user.wallet_address !== connectedWallet?.address && (
                    <button
                      onClick={() => openTipModal(user)}
                      className="opacity-0 group-hover:opacity-100 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-white text-xs px-3 py-2 rounded-lg font-bold transition-all shadow-lg"
                    >
                      💸 Tip
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Nickname Modal */}
      {showNicknameModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-8 max-w-md w-full border-2 border-blue-500/50 shadow-2xl shadow-blue-500/20">
            <h3 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-6">
              Create Your Profile
            </h3>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-white font-medium mb-2">Nickname</label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Enter your nickname..."
                  maxLength={20}
                  className="w-full bg-slate-800/50 text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 border border-blue-500/30"
                />
              </div>

              <div>
                <label className="block text-white font-medium mb-2">Choose Avatar (Optional)</label>
                <div className="grid grid-cols-5 gap-2">
                  {availableTokens.slice(0, 10).map((token) => (
                    token.image_url && (
                      <button
                        key={token.id}
                        onClick={() => setUserAvatar(token.image_url)}
                        className={`p-2 rounded-xl border-2 transition-all ${
                          userAvatar === token.image_url
                            ? 'border-blue-500 bg-blue-500/20'
                            : 'border-slate-700 hover:border-blue-500/50'
                        }`}
                      >
                        <img src={token.image_url} alt={token.symbol} className="w-full h-full object-cover rounded-lg" />
                      </button>
                    )
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={saveNickname}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white py-4 rounded-xl font-bold text-lg transition-all duration-300 shadow-lg shadow-blue-500/30"
            >
              Save Profile
            </button>
          </div>
        </div>
      )}

      {/* Tip Modal */}
      {showTipModal && tipRecipient && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-8 max-w-md w-full border-2 border-yellow-500/50 shadow-2xl shadow-yellow-500/20">
            <h3 className="text-3xl font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent mb-6">
              Send Tip to {tipRecipient.nickname}
            </h3>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-gray-400 font-medium mb-2">Select Token</label>
                <select
                  value={selectedToken ? JSON.stringify(selectedToken) : ''}
                  onChange={(e) => setSelectedToken(JSON.parse(e.target.value))}
                  className="w-full bg-slate-800/50 text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-500 border border-yellow-500/30"
                >
                  <option value="">Choose token...</option>
                  <option value={JSON.stringify({ currency: 'XRP', issuer: 'XRP' })}>XRP</option>
                  {walletAssets?.map((asset, idx) => (
                    <option
                      key={idx}
                      value={JSON.stringify({ currency: asset.currency, issuer: asset.issuer })}
                    >
                      {asset.currency} ({parseFloat(asset.value).toFixed(2)} available)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-400 font-medium mb-2">Amount</label>
                <input
                  type="number"
                  value={tipAmount}
                  onChange={(e) => setTipAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  className="w-full bg-slate-800/50 text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-500 border border-yellow-500/30"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowTipModal(false);
                  setTipAmount('');
                  setSelectedToken(null);
                }}
                className="flex-1 bg-slate-800/50 hover:bg-slate-800/80 text-white py-3 rounded-xl font-medium transition-all border border-blue-500/20"
              >
                Cancel
              </button>
              <button
                onClick={sendTip}
                disabled={sendingTip || !selectedToken || !tipAmount}
                className="flex-1 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold transition-all shadow-lg"
              >
                {sendingTip ? 'Sending...' : '💸 Send Tip'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-8 max-w-md w-full border-2 border-blue-500/50 shadow-2xl">
            <h3 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-6">
              Settings
            </h3>

            <div className="space-y-4 mb-6">
              <button
                onClick={() => {
                  setShowSettingsModal(false);
                  setShowNicknameModal(true);
                }}
                className="w-full bg-slate-800/50 hover:bg-slate-800/80 text-white p-4 rounded-xl text-left transition-all border border-blue-500/20"
              >
                <div className="font-bold mb-1">Edit Profile</div>
                <div className="text-gray-400 text-sm">Change nickname and avatar</div>
              </button>

              <div className="bg-slate-800/30 p-4 rounded-xl border border-blue-500/10">
                <div className="text-gray-400 text-sm mb-2">Current Profile</div>
                <div className="flex items-center gap-3">
                  {userAvatar ? (
                    <img src={userAvatar} alt="avatar" className="w-12 h-12 rounded-xl border-2 border-blue-500/50" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                      {nickname.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="text-white font-bold">{nickname}</div>
                    <div className="text-gray-400 text-xs">{connectedWallet?.address.slice(0, 12)}...</div>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowSettingsModal(false)}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white py-3 rounded-xl font-bold transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
