import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../utils/supabase';
import toast from 'react-hot-toast';
import { Client, Wallet as XrplWallet } from 'xrpl';
import { Buffer } from 'buffer';

export default function Social() {
  const [connectedWallet, setConnectedWallet] = useState(null);
  const [walletAssets, setWalletAssets] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [nickname, setNickname] = useState('');
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);
  const [tipRecipient, setTipRecipient] = useState(null);
  const [selectedToken, setSelectedToken] = useState(null);
  const [tipAmount, setTipAmount] = useState('');
  const [sendingTip, setSendingTip] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [videoRooms, setVideoRooms] = useState([]);
  const [activeVideoRoom, setActiveVideoRoom] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const emojis = ['😀', '😂', '❤️', '👍', '🚀', '💎', '🔥', '⭐', '💰', '🎉', '👏', '💪', '🌟', '✨'];

  useEffect(() => {
    const stored = localStorage.getItem('connectedWallet');
    if (stored) {
      const wallet = JSON.parse(stored);
      setConnectedWallet(wallet);
      loadWalletAssets(wallet);
    }

    const handleWalletChange = () => {
      const stored = localStorage.getItem('connectedWallet');
      if (stored) {
        const wallet = JSON.parse(stored);
        setConnectedWallet(wallet);
        loadWalletAssets(wallet);
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
  }, []);

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

  useEffect(() => {
    if (connectedWallet) {
      const storedNickname = localStorage.getItem(`nickname_${connectedWallet.address}`);
      if (storedNickname) {
        setNickname(storedNickname);
        updatePresence(storedNickname, true);
      } else {
        setShowNicknameModal(true);
      }
    }

    loadChatRooms();
    loadVideoRooms();

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
  }, [connectedWallet]);

  useEffect(() => {
    if (selectedRoom) {
      loadMessages();
      subscribeToMessages();
    }
  }, [selectedRoom]);

  useEffect(() => {
    subscribeToPresence();
    loadOnlineUsers();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadChatRooms = async () => {
    const { data, error } = await supabase
      .from('chat_rooms')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading rooms:', error);
      return;
    }

    setRooms(data || []);
    if (data && data.length > 0 && !selectedRoom) {
      setSelectedRoom(data[0]);
    }
  };

  const loadMessages = async () => {
    if (!selectedRoom) return;

    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('room_id', selectedRoom.id)
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) {
      console.error('Error loading messages:', error);
      return;
    }

    setMessages(data || []);
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

  const saveNickname = () => {
    if (!nickname.trim() || !connectedWallet) {
      toast.error('Please enter a nickname');
      return;
    }

    localStorage.setItem(`nickname_${connectedWallet.address}`, nickname);
    updatePresence(nickname, true);
    setShowNicknameModal(false);
    toast.success('Nickname saved!');
  };

  const sendMessage = async () => {
    if (!messageInput.trim() || !connectedWallet || !nickname || !selectedRoom) {
      return;
    }

    const messageData = {
      room_id: selectedRoom.id,
      wallet_address: connectedWallet.address,
      nickname: nickname,
      message_type: imagePreview ? 'image' : 'text',
      content: messageInput.trim(),
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
          content: `Sent ${tipAmount} ${selectedToken.currency} to ${tipRecipient.nickname}`,
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

  const loadVideoRooms = async () => {
    const { data } = await supabase
      .from('video_rooms')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    setVideoRooms(data || []);
  };

  const createVideoRoom = async (roomType) => {
    if (!connectedWallet || !nickname) {
      toast.error('Connect wallet first');
      return;
    }

    const roomName = `${nickname}'s ${roomType === 'livestream' ? 'Live Stream' : 'Conference'}`;

    const { data, error } = await supabase
      .from('video_rooms')
      .insert([{
        room_name: roomName,
        host_wallet: connectedWallet.address,
        room_type: roomType,
        is_active: true
      }])
      .select()
      .single();

    if (error) {
      toast.error('Failed to create room');
      return;
    }

    setActiveVideoRoom(data);
    toast.success('Video room created!');
    setShowVideoModal(false);
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="h-screen flex flex-col bg-slate-900">
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Rooms */}
        <div className="w-64 bg-slate-800 flex flex-col border-r border-slate-700">
          <div className="p-4 border-b border-slate-700">
            <h2 className="text-xl font-bold text-white">Chat Rooms</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {rooms.map((room) => (
              <button
                key={room.id}
                onClick={() => setSelectedRoom(room)}
                className={`w-full px-4 py-3 text-left hover:bg-slate-700 transition-colors ${
                  selectedRoom?.id === room.id ? 'bg-slate-700 border-l-4 border-blue-500' : ''
                }`}
              >
                <div className="text-white font-medium">{room.name}</div>
                <div className="text-gray-400 text-xs capitalize">{room.type}</div>
              </button>
            ))}
          </div>

          {/* Video Controls */}
          <div className="p-4 border-t border-slate-700 space-y-2">
            <button
              onClick={() => setShowVideoModal(true)}
              className="w-full bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white py-2 px-4 rounded-lg font-medium transition-all duration-300"
            >
              Start Video Room
            </button>
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col bg-slate-900">
          {/* Chat Header */}
          <div className="h-16 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-6">
            <div>
              <h3 className="text-white font-bold text-lg">{selectedRoom?.name}</h3>
              <p className="text-gray-400 text-sm">{onlineUsers.length} online</p>
            </div>
            {activeVideoRoom && (
              <div className="bg-green-600/20 text-green-400 px-4 py-2 rounded-lg">
                Video Room Active
              </div>
            )}
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                  {msg.nickname.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-white font-medium">{msg.nickname}</span>
                    <span className="text-gray-500 text-xs">{formatTimestamp(msg.created_at)}</span>
                    {msg.wallet_address !== connectedWallet?.address && (
                      <button
                        onClick={() => openTipModal({ wallet_address: msg.wallet_address, nickname: msg.nickname })}
                        className="text-yellow-400 hover:text-yellow-300 text-xs ml-2"
                      >
                        Send Tip
                      </button>
                    )}
                  </div>
                  {msg.message_type === 'tip' ? (
                    <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-3 mt-1 max-w-md">
                      <div className="text-yellow-300 font-medium">{msg.content}</div>
                      {msg.tip_data?.tx_hash && (
                        <a
                          href={`https://xrpscan.com/tx/${msg.tip_data.tx_hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:underline mt-1 block"
                        >
                          View Transaction
                        </a>
                      )}
                    </div>
                  ) : msg.message_type === 'image' ? (
                    <div className="mt-1">
                      <p className="text-gray-300">{msg.content}</p>
                      {msg.image_url && (
                        <img
                          src={msg.image_url}
                          alt="Shared"
                          className="mt-2 max-w-md rounded-lg border border-slate-700"
                        />
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-300 mt-1">{msg.content}</p>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div className="p-4 bg-slate-800 border-t border-slate-700">
            {imagePreview && (
              <div className="mb-2 relative inline-block">
                <img src={imagePreview} alt="Preview" className="h-20 rounded border border-slate-600" />
                <button
                  onClick={() => setImagePreview(null)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center"
                >
                  ×
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="bg-slate-700 hover:bg-slate-600 text-white p-3 rounded-lg"
                title="Upload Image"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="bg-slate-700 hover:bg-slate-600 text-white p-3 rounded-lg"
                  title="Emojis"
                >
                  😀
                </button>
                {showEmojiPicker && (
                  <div className="absolute bottom-full mb-2 bg-slate-700 p-2 rounded-lg shadow-xl grid grid-cols-7 gap-1">
                    {emojis.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => {
                          setMessageInput(messageInput + emoji);
                          setShowEmojiPicker(false);
                        }}
                        className="hover:bg-slate-600 p-2 rounded text-xl"
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
                placeholder={nickname ? `Message ${selectedRoom?.name}` : 'Set nickname first...'}
                disabled={!connectedWallet || !nickname}
                className="flex-1 bg-slate-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={sendMessage}
                disabled={!messageInput.trim() || !connectedWallet || !nickname}
                className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium transition-all duration-300"
              >
                Send
              </button>
            </div>
          </div>
        </div>

        {/* Right Sidebar - Online Users */}
        <div className="w-64 bg-slate-800 border-l border-slate-700 flex flex-col">
          <div className="p-4 border-b border-slate-700">
            <h3 className="text-white font-bold">Online - {onlineUsers.length}</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {onlineUsers.map((user) => (
              <div
                key={user.wallet_address}
                className="flex items-center gap-3 p-3 hover:bg-slate-700 rounded-lg cursor-pointer group"
              >
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white font-bold text-sm">
                    {user.nickname.charAt(0).toUpperCase()}
                  </div>
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-800"></div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-medium truncate">{user.nickname}</div>
                  <div className="text-gray-400 text-xs truncate">{user.wallet_address.slice(0, 8)}...</div>
                </div>
                {user.wallet_address !== connectedWallet?.address && (
                  <button
                    onClick={() => openTipModal(user)}
                    className="opacity-0 group-hover:opacity-100 bg-yellow-500 hover:bg-yellow-400 text-white text-xs px-2 py-1 rounded"
                  >
                    Tip
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Nickname Modal */}
      {showNicknameModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl p-6 max-w-md w-full border border-slate-700">
            <h3 className="text-2xl font-bold text-white mb-4">Set Your Nickname</h3>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Enter nickname..."
              maxLength={20}
              className="w-full bg-slate-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
            />
            <button
              onClick={saveNickname}
              className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white py-3 rounded-lg font-medium"
            >
              Save Nickname
            </button>
          </div>
        </div>
      )}

      {/* Tip Modal */}
      {showTipModal && tipRecipient && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl p-6 max-w-md w-full border border-slate-700">
            <h3 className="text-2xl font-bold text-white mb-4">
              Send Tip to {tipRecipient.nickname}
            </h3>

            <div className="mb-4">
              <label className="block text-gray-400 text-sm mb-2">Select Token</label>
              <select
                value={selectedToken ? JSON.stringify(selectedToken) : ''}
                onChange={(e) => setSelectedToken(JSON.parse(e.target.value))}
                className="w-full bg-slate-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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

            <div className="mb-4">
              <label className="block text-gray-400 text-sm mb-2">Amount</label>
              <input
                type="number"
                value={tipAmount}
                onChange={(e) => setTipAmount(e.target.value)}
                placeholder="0.00"
                step="0.01"
                className="w-full bg-slate-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowTipModal(false);
                  setTipAmount('');
                  setSelectedToken(null);
                }}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                onClick={sendTip}
                disabled={sendingTip || !selectedToken || !tipAmount}
                className="flex-1 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white py-3 rounded-lg font-medium"
              >
                {sendingTip ? 'Sending...' : 'Send Tip'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video Room Modal */}
      {showVideoModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl p-6 max-w-md w-full border border-slate-700">
            <h3 className="text-2xl font-bold text-white mb-4">Create Video Room</h3>
            <p className="text-gray-400 mb-6">Choose the type of video room you want to create</p>

            <div className="space-y-3">
              <button
                onClick={() => createVideoRoom('conference')}
                className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white py-4 rounded-lg font-medium flex items-center justify-center gap-2"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Video Conference
              </button>

              <button
                onClick={() => createVideoRoom('livestream')}
                className="w-full bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white py-4 rounded-lg font-medium flex items-center justify-center gap-2"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z" />
                </svg>
                Live Stream
              </button>

              <button
                onClick={() => setShowVideoModal(false)}
                className="w-full bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg font-medium"
              >
                Cancel
              </button>
            </div>

            {videoRooms.length > 0 && (
              <div className="mt-6 pt-6 border-t border-slate-700">
                <h4 className="text-white font-medium mb-3">Active Rooms</h4>
                <div className="space-y-2">
                  {videoRooms.map((room) => (
                    <div key={room.id} className="bg-slate-700 p-3 rounded-lg flex items-center justify-between">
                      <div>
                        <div className="text-white text-sm">{room.room_name}</div>
                        <div className="text-gray-400 text-xs">{room.room_type}</div>
                      </div>
                      <button className="bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded text-sm">
                        Join
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
