import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../utils/supabase';
import toast from 'react-hot-toast';
import { Client, Wallet as XrplWallet } from 'xrpl';

const DEV_WALLET = 'rphatRpwXcPAo7CVm46dC78JAQ6kLMqb2M';

export default function Social() {
  const [connectedWallet, setConnectedWallet] = useState(null);
  const [walletAssets, setWalletAssets] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [nickname, setNickname] = useState('');
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [activeDMs, setActiveDMs] = useState([]);
  const [selectedDM, setSelectedDM] = useState(null);
  const [dmMessages, setDmMessages] = useState([]);
  const [isVideoActive, setIsVideoActive] = useState(false);
  const [showCameraSelect, setShowCameraSelect] = useState(false);
  const [availableCameras, setAvailableCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [bannedWallets, setBannedWallets] = useState([]);

  const messagesEndRef = useRef(null);
  const dmMessagesEndRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const emojis = ['😀', '😂', '🤣', '😊', '😍', '🥰', '😎', '🤔', '😭', '😱', '🤯', '😴', '🥳', '🤑', '🤗',
    '👍', '👎', '👏', '🙏', '💪', '🤝', '✌️', '🤞', '👌', '🤘', '🔥', '⭐', '✨', '💎', '💰',
    '🚀', '🎉', '🎊', '🏆', '👑', '💯', '💸', '📈', '📊', '🌟'];

  const isDevWallet = connectedWallet?.address === DEV_WALLET;

  useEffect(() => {
    loadConnectedWallet();
    loadOnlineUsers();
    loadBannedWallets();
    subscribeToPresence();

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
      checkIfBanned();
      const storedNickname = localStorage.getItem(`nickname_${connectedWallet.address}`);
      if (storedNickname) {
        setNickname(storedNickname);
        updatePresence(storedNickname, true);
      } else {
        setShowNicknameModal(true);
      }
      loadWalletAssets(connectedWallet);
      loadMessages();
      loadDMConversations();
      subscribeToMessages();
    }
  }, [connectedWallet]);

  useEffect(() => {
    if (selectedDM) {
      loadDMMessages();
      subscribeToDMMessages();
    }
  }, [selectedDM]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (selectedDM) {
      scrollDMToBottom();
    }
  }, [dmMessages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollDMToBottom = () => {
    dmMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

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

  const loadBannedWallets = async () => {
    const { data } = await supabase
      .from('banned_wallets')
      .select('wallet_address');

    if (data) {
      setBannedWallets(data.map(b => b.wallet_address));
    }
  };

  const checkIfBanned = async () => {
    if (!connectedWallet) return;

    const { data } = await supabase
      .from('banned_wallets')
      .select('*')
      .eq('wallet_address', connectedWallet.address)
      .maybeSingle();

    if (data) {
      toast.error('Your wallet has been banned from Social');
      window.dispatchEvent(new Event('walletDisconnected'));
      localStorage.removeItem('connectedWallet');
    }
  };

  const banWallet = async (walletAddress) => {
    if (!isDevWallet) {
      toast.error('Only developer can ban wallets');
      return;
    }

    const reason = prompt('Reason for ban (optional):');

    const { error } = await supabase
      .from('banned_wallets')
      .insert([{
        wallet_address: walletAddress,
        banned_by: connectedWallet.address,
        reason: reason || 'No reason provided'
      }]);

    if (!error) {
      toast.success('Wallet banned successfully');
      loadBannedWallets();
      loadOnlineUsers();
    } else {
      toast.error('Failed to ban wallet');
    }
  };

  const deleteMessage = async (messageId) => {
    if (!isDevWallet) {
      toast.error('Only developer can delete messages');
      return;
    }

    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('id', messageId);

    if (!error) {
      setMessages(messages.filter(m => m.id !== messageId));
      toast.success('Message deleted');
    } else {
      toast.error('Failed to delete message');
    }
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

  const loadMessages = async () => {
    const { data: rooms } = await supabase
      .from('chat_rooms')
      .select('id')
      .eq('type', 'general')
      .maybeSingle();

    if (!rooms) return;

    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('room_id', rooms.id)
      .order('created_at', { ascending: true });

    if (!error) {
      setMessages(data || []);
    }
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel('general_chat')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages'
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'chat_messages'
        },
        (payload) => {
          setMessages((prev) => prev.filter(m => m.id !== payload.old.id));
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
      const filtered = data.filter(u => !bannedWallets.includes(u.wallet_address));
      setOnlineUsers(filtered);
    }
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
    await updatePresence(nickname, true);
    setShowNicknameModal(false);
    toast.success('Nickname saved!');
  };

  const sendMessage = async () => {
    if (!messageInput.trim() || !connectedWallet || !nickname) {
      return;
    }

    const { data: rooms } = await supabase
      .from('chat_rooms')
      .select('id')
      .eq('type', 'general')
      .maybeSingle();

    if (!rooms) return;

    const messageData = {
      room_id: rooms.id,
      wallet_address: connectedWallet.address,
      nickname: nickname,
      message_type: 'text',
      content: messageInput.trim(),
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
  };

  const handleUserClick = (user) => {
    if (user.wallet_address === connectedWallet?.address) return;
    setSelectedUser(user);
    setShowUserModal(true);
  };

  const openDM = async (user) => {
    setShowUserModal(false);

    const participants = [connectedWallet.address, user.wallet_address].sort();

    const { data: existing } = await supabase
      .from('dm_conversations')
      .select('*')
      .eq('participant_1', participants[0])
      .eq('participant_2', participants[1])
      .maybeSingle();

    if (existing) {
      setSelectedDM({ ...existing, otherWallet: user.wallet_address, otherNickname: user.nickname });
    } else {
      const { data: newConv } = await supabase
        .from('dm_conversations')
        .insert([{
          participant_1: participants[0],
          participant_2: participants[1],
          last_message: '',
          last_message_at: new Date().toISOString()
        }])
        .select()
        .single();

      setSelectedDM({ ...newConv, otherWallet: user.wallet_address, otherNickname: user.nickname });
    }

    loadDMConversations();
  };

  const loadDMConversations = async () => {
    if (!connectedWallet) return;

    const { data } = await supabase
      .from('dm_conversations')
      .select('*')
      .or(`participant_1.eq.${connectedWallet.address},participant_2.eq.${connectedWallet.address}`)
      .order('last_message_at', { ascending: false });

    if (data) {
      const enriched = await Promise.all(data.map(async (conv) => {
        const otherWallet = conv.participant_1 === connectedWallet.address
          ? conv.participant_2
          : conv.participant_1;

        const { data: userData } = await supabase
          .from('user_presence')
          .select('nickname')
          .eq('wallet_address', otherWallet)
          .maybeSingle();

        return {
          ...conv,
          otherWallet,
          otherNickname: userData?.nickname || otherWallet.slice(0, 8)
        };
      }));

      setActiveDMs(enriched);
    }
  };

  const loadDMMessages = async () => {
    if (!selectedDM || !connectedWallet) return;

    const { data } = await supabase
      .from('direct_messages')
      .select('*')
      .or(`and(from_wallet.eq.${connectedWallet.address},to_wallet.eq.${selectedDM.otherWallet}),and(from_wallet.eq.${selectedDM.otherWallet},to_wallet.eq.${connectedWallet.address})`)
      .order('created_at', { ascending: true });

    setDmMessages(data || []);
  };

  const subscribeToDMMessages = () => {
    if (!selectedDM) return;

    const channel = supabase
      .channel(`dm_${selectedDM.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages'
        },
        (payload) => {
          if (
            (payload.new.from_wallet === connectedWallet.address && payload.new.to_wallet === selectedDM.otherWallet) ||
            (payload.new.from_wallet === selectedDM.otherWallet && payload.new.to_wallet === connectedWallet.address)
          ) {
            setDmMessages((prev) => [...prev, payload.new]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const sendDM = async () => {
    if (!messageInput.trim() || !selectedDM || !connectedWallet) return;

    const dmData = {
      from_wallet: connectedWallet.address,
      to_wallet: selectedDM.otherWallet,
      from_nickname: nickname,
      to_nickname: selectedDM.otherNickname,
      message_type: 'text',
      content: messageInput.trim(),
      created_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('direct_messages')
      .insert([dmData]);

    if (!error) {
      await supabase
        .from('dm_conversations')
        .update({
          last_message: messageInput.trim(),
          last_message_at: new Date().toISOString()
        })
        .eq('id', selectedDM.id);

      setMessageInput('');
      loadDMConversations();
    }
  };

  const closeDM = () => {
    setSelectedDM(null);
    setDmMessages([]);
  };

  const sendTip = async (recipient) => {
    setShowUserModal(false);

    const tokenOptions = [
      { currency: 'XRP', issuer: 'XRP' },
      ...walletAssets.map(a => ({ currency: a.currency, issuer: a.issuer }))
    ];

    const tokenList = tokenOptions.map((t, i) =>
      `${i + 1}. ${t.currency}${t.currency !== 'XRP' ? ` (${walletAssets.find(a => a.currency === t.currency)?.value || 'N/A'})` : ''}`
    ).join('\n');

    const tokenIndex = prompt(`Select token to tip:\n\n${tokenList}\n\nEnter number:`);
    if (!tokenIndex) return;

    const selectedToken = tokenOptions[parseInt(tokenIndex) - 1];
    if (!selectedToken) {
      toast.error('Invalid token selection');
      return;
    }

    const amount = prompt(`Enter amount of ${selectedToken.currency} to tip:`);
    if (!amount || isNaN(parseFloat(amount))) {
      toast.error('Invalid amount');
      return;
    }

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
          Destination: recipient.wallet_address,
          Amount: String(Math.floor(parseFloat(amount) * 1000000))
        };
      } else {
        payment = {
          TransactionType: 'Payment',
          Account: wallet.address,
          Destination: recipient.wallet_address,
          Amount: {
            currency: selectedToken.currency,
            issuer: selectedToken.issuer,
            value: amount
          }
        };
      }

      const prepared = await client.autofill(payment);
      const signed = wallet.sign(prepared);
      const result = await client.submitAndWait(signed.tx_blob);

      if (result.result.meta.TransactionResult === 'tesSUCCESS') {
        toast.success(`Sent ${amount} ${selectedToken.currency} to ${recipient.nickname}!`);
      } else {
        toast.error('Transaction failed');
      }

      await client.disconnect();
    } catch (error) {
      console.error('Error sending tip:', error);
      toast.error('Failed to send tip');
    }
  };

  const selectCamera = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(d => d.kind === 'videoinput');
      setAvailableCameras(cameras);
      setShowCameraSelect(true);
    } catch (error) {
      toast.error('Failed to enumerate cameras');
    }
  };

  const startVideoWithCamera = async (deviceId) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: deviceId ? { deviceId: { exact: deviceId } } : true,
        audio: true
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }

      setIsVideoActive(true);
      setShowCameraSelect(false);
      toast.success('Video started!');
    } catch (error) {
      console.error('Error starting video:', error);
      toast.error('Failed to start video: ' + error.message);
    }
  };

  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always' },
          audio: true
        });

        if (videoRef.current) {
          videoRef.current.srcObject = screenStream;
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
          }
          streamRef.current = screenStream;
        }

        setIsScreenSharing(true);
        toast.success('Screen sharing started');
      } else {
        await startVideoWithCamera(selectedCamera);
        setIsScreenSharing(false);
      }
    } catch (error) {
      console.error('Error toggling screen share:', error);
      toast.error('Failed to toggle screen share');
    }
  };

  const stopVideo = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsVideoActive(false);
    setIsScreenSharing(false);
    toast.success('Video stopped');
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-purple-900 via-slate-900 to-purple-900">
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Online Users */}
        <div className="w-72 bg-purple-900/20 backdrop-blur-xl flex flex-col border-r border-purple-500/20">
          <div className="p-6 border-b border-purple-500/20">
            <h2 className="text-2xl font-bold text-purple-200">Online Users</h2>
            <p className="text-purple-400 text-sm mt-1">{onlineUsers.length} online</p>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {onlineUsers.map((user) => (
              <button
                key={user.wallet_address}
                onClick={() => handleUserClick(user)}
                className="w-full p-4 rounded-lg bg-purple-800/30 hover:bg-purple-800/50 transition-all duration-300 border border-purple-500/20 hover:border-purple-500/40"
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                      {user.nickname.charAt(0).toUpperCase()}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-purple-900"></div>
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-purple-200 font-bold truncate">{user.nickname}</span>
                      {user.wallet_address === DEV_WALLET && (
                        <span className="text-yellow-400 text-lg" title="Developer">👑</span>
                      )}
                    </div>
                    <div className="text-purple-400 text-xs truncate">{user.wallet_address.slice(0, 12)}...</div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Video Controls */}
          <div className="p-4 border-t border-purple-500/20 space-y-2">
            {!isVideoActive ? (
              <button
                onClick={selectCamera}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white py-3 px-4 rounded-lg font-bold transition-all duration-300"
              >
                Start Video
              </button>
            ) : (
              <>
                <button
                  onClick={toggleScreenShare}
                  className="w-full bg-purple-700/50 hover:bg-purple-700/70 text-white py-2 px-4 rounded-lg font-medium transition-all"
                >
                  {isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
                </button>
                <button
                  onClick={stopVideo}
                  className="w-full bg-red-600/50 hover:bg-red-600/70 text-white py-2 px-4 rounded-lg font-medium transition-all"
                >
                  Stop Video
                </button>
              </>
            )}
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          <div className="p-4 bg-purple-900/20 backdrop-blur-xl border-b border-purple-500/20">
            <h3 className="text-2xl font-bold text-purple-200">General Chat</h3>
            <p className="text-purple-400 text-sm">Public conversation</p>
          </div>

          {/* Video Preview */}
          {isVideoActive && (
            <div className="p-4 bg-purple-900/10">
              <div className="bg-black rounded-lg overflow-hidden border-2 border-purple-500/30">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  className="w-full h-48 object-cover"
                />
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 group ${msg.wallet_address === connectedWallet?.address ? 'flex-row-reverse' : ''}`}
              >
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                  {msg.nickname.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 max-w-2xl">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-purple-200 font-bold">{msg.nickname}</span>
                    {msg.wallet_address === DEV_WALLET && (
                      <span className="text-yellow-400 text-sm" title="Developer">👑</span>
                    )}
                    <span className="text-purple-400 text-xs">{formatTimestamp(msg.created_at)}</span>
                    {isDevWallet && (
                      <button
                        onClick={() => deleteMessage(msg.id)}
                        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 text-xs font-medium transition-all"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  <div className={`p-3 rounded-lg ${
                    msg.wallet_address === connectedWallet?.address
                      ? 'bg-purple-600/30 border border-purple-500/50'
                      : 'bg-purple-800/30 border border-purple-500/20'
                  }`}>
                    <p className="text-purple-100">{msg.content}</p>
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 bg-purple-900/20 backdrop-blur-xl border-t border-purple-500/20">
            <div className="flex gap-2 relative">
              <div className="relative">
                <button
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="bg-purple-800/30 hover:bg-purple-800/50 text-white p-3 rounded-lg border border-purple-500/20 transition-all text-xl"
                  title="Emojis"
                >
                  😀
                </button>
                {showEmojiPicker && (
                  <div className="absolute bottom-full left-0 mb-2 bg-purple-900/95 backdrop-blur-xl p-3 rounded-lg shadow-2xl border border-purple-500/30 z-50">
                    <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto" style={{ width: '320px' }}>
                      {emojis.map((emoji, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setMessageInput(messageInput + emoji);
                            setShowEmojiPicker(false);
                          }}
                          className="hover:bg-purple-700/50 p-2 rounded text-2xl transition-all hover:scale-110"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (selectedDM ? sendDM() : sendMessage())}
                placeholder={nickname ? 'Type a message...' : 'Set nickname first...'}
                disabled={!connectedWallet || !nickname}
                className="flex-1 bg-purple-800/30 text-purple-100 px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 border border-purple-500/20 placeholder-purple-400/50"
              />
              <button
                onClick={selectedDM ? sendDM : sendMessage}
                disabled={!messageInput.trim() || !connectedWallet || !nickname}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-bold transition-all"
              >
                Send
              </button>
            </div>
          </div>
        </div>

        {/* Right Sidebar - DMs */}
        <div className="w-80 bg-purple-900/20 backdrop-blur-xl border-l border-purple-500/20 flex flex-col">
          <div className="p-4 border-b border-purple-500/20">
            <h3 className="text-xl font-bold text-purple-200">Direct Messages</h3>
          </div>

          {selectedDM ? (
            <>
              <div className="p-4 bg-purple-800/30 border-b border-purple-500/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                    {selectedDM.otherNickname.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-purple-200 font-bold">{selectedDM.otherNickname}</div>
                    <div className="text-purple-400 text-xs">{selectedDM.otherWallet.slice(0, 12)}...</div>
                  </div>
                </div>
                <button
                  onClick={closeDM}
                  className="text-purple-400 hover:text-purple-200 transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {dmMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-2 ${msg.from_wallet === connectedWallet?.address ? 'flex-row-reverse' : ''}`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {msg.from_nickname.charAt(0).toUpperCase()}
                    </div>
                    <div className={`p-3 rounded-lg max-w-[70%] ${
                      msg.from_wallet === connectedWallet?.address
                        ? 'bg-purple-600/30 border border-purple-500/50'
                        : 'bg-purple-800/30 border border-purple-500/20'
                    }`}>
                      <p className="text-purple-100 text-sm">{msg.content}</p>
                      <span className="text-purple-400 text-xs mt-1 block">{formatTimestamp(msg.created_at)}</span>
                    </div>
                  </div>
                ))}
                <div ref={dmMessagesEndRef} />
              </div>
            </>
          ) : (
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {activeDMs.length === 0 ? (
                <div className="text-center text-purple-400 text-sm p-8">
                  Click on a user to start a conversation
                </div>
              ) : (
                activeDMs.map((dm) => (
                  <button
                    key={dm.id}
                    onClick={() => setSelectedDM(dm)}
                    className="w-full p-3 rounded-lg bg-purple-800/30 hover:bg-purple-800/50 transition-all border border-purple-500/20 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm">
                        {dm.otherNickname.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-purple-200 font-medium truncate text-sm">{dm.otherNickname}</div>
                        <div className="text-purple-400 text-xs truncate">{dm.last_message || 'No messages yet'}</div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Nickname Modal */}
      {showNicknameModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-purple-900 to-slate-900 rounded-lg p-8 max-w-md w-full border border-purple-500/30">
            <h3 className="text-2xl font-bold text-purple-200 mb-6">Set Your Nickname</h3>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Enter nickname..."
              maxLength={20}
              className="w-full bg-purple-800/30 text-purple-100 px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 border border-purple-500/30 mb-4"
            />
            <button
              onClick={saveNickname}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white py-3 rounded-lg font-bold transition-all"
            >
              Save Nickname
            </button>
          </div>
        </div>
      )}

      {/* User Action Modal */}
      {showUserModal && selectedUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-purple-900 to-slate-900 rounded-lg p-8 max-w-md w-full border border-purple-500/30">
            <div className="text-center mb-6">
              <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-3xl mx-auto mb-4">
                {selectedUser.nickname.charAt(0).toUpperCase()}
              </div>
              <div className="flex items-center justify-center gap-2 mb-2">
                <h3 className="text-2xl font-bold text-purple-200">{selectedUser.nickname}</h3>
                {selectedUser.wallet_address === DEV_WALLET && (
                  <span className="text-yellow-400 text-2xl" title="Developer">👑</span>
                )}
              </div>
              <p className="text-purple-400 text-sm mt-1">{selectedUser.wallet_address}</p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => openDM(selectedUser)}
                className="w-full bg-purple-700/50 hover:bg-purple-700/70 text-white py-3 rounded-lg font-medium transition-all"
              >
                💬 Send Direct Message
              </button>
              <button
                onClick={() => sendTip(selectedUser)}
                className="w-full bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white py-3 rounded-lg font-medium transition-all"
              >
                💸 Send Tip
              </button>
              {isDevWallet && selectedUser.wallet_address !== DEV_WALLET && (
                <button
                  onClick={() => {
                    banWallet(selectedUser.wallet_address);
                    setShowUserModal(false);
                  }}
                  className="w-full bg-red-700/50 hover:bg-red-700/70 text-white py-3 rounded-lg font-medium transition-all"
                >
                  🚫 Ban Wallet
                </button>
              )}
              <button
                onClick={() => setShowUserModal(false)}
                className="w-full bg-slate-700/50 hover:bg-slate-700/70 text-white py-3 rounded-lg font-medium transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Camera Selection Modal */}
      {showCameraSelect && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-purple-900 to-slate-900 rounded-lg p-8 max-w-md w-full border border-purple-500/30">
            <h3 className="text-2xl font-bold text-purple-200 mb-6">Select Camera</h3>
            <div className="space-y-2 mb-4">
              {availableCameras.map((camera) => (
                <button
                  key={camera.deviceId}
                  onClick={() => {
                    setSelectedCamera(camera.deviceId);
                    startVideoWithCamera(camera.deviceId);
                  }}
                  className="w-full bg-purple-800/30 hover:bg-purple-800/50 text-purple-200 px-4 py-3 rounded-lg transition-all text-left"
                >
                  {camera.label || `Camera ${camera.deviceId.slice(0, 8)}`}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowCameraSelect(false)}
              className="w-full bg-slate-700/50 hover:bg-slate-700/70 text-white py-3 rounded-lg font-medium transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
