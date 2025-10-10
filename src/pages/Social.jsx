import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../utils/supabase';
import toast from 'react-hot-toast';
import { Client, Wallet as XrplWallet } from 'xrpl';
import TipModal from '../components/TipModal';
import LiveFeedsPage from '../components/LiveFeedsPage';
import StreamAnalytics from '../components/StreamAnalytics';
import LiveNotification from '../components/LiveNotification';

const DEV_WALLET = 'rphatRpwXcPAo7CVm46dC78JAQ6kLMqb2M';

export default function Social() {
  const [activeTab, setActiveTab] = useState('chat');
  const [connectedWallet, setConnectedWallet] = useState(null);
  const [walletAssets, setWalletAssets] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [liveStreams, setLiveStreams] = useState([]);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [nickname, setNickname] = useState('');
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [activeDMs, setActiveDMs] = useState([]);
  const [selectedDM, setSelectedDM] = useState(null);
  const [dmMessages, setDmMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStream, setCurrentStream] = useState(null);
  const [showCameraSelect, setShowCameraSelect] = useState(false);
  const [availableCameras, setAvailableCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [cameraPosition, setCameraPosition] = useState('bottom-right');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [bannedWallets, setBannedWallets] = useState([]);
  const [streamTips, setStreamTips] = useState([]);
  const [totalTips, setTotalTips] = useState(0);
  const [viewingStream, setViewingStream] = useState(null);
  const [showTipModal, setShowTipModal] = useState(false);
  const [tipRecipient, setTipRecipient] = useState(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [streamCategory, setStreamCategory] = useState('Just Chatting');
  const [streamDuration, setStreamDuration] = useState(0);
  const [scheduledStreams, setScheduledStreams] = useState([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    title: '',
    description: '',
    category: 'Just Chatting',
    date: '',
    time: '',
    duration: 60
  });

  const messagesEndRef = useRef(null);
  const dmMessagesEndRef = useRef(null);
  const mainVideoRef = useRef(null);
  const pipVideoRef = useRef(null);
  const mainStreamRef = useRef(null);
  const pipStreamRef = useRef(null);

  const emojis = ['😀', '😂', '🤣', '😊', '😍', '🥰', '😎', '🤔', '😭', '😱', '🤯', '😴', '🥳', '🤑', '🤗',
    '👍', '👎', '👏', '🙏', '💪', '🤝', '✌️', '🤞', '👌', '🤘', '🔥', '⭐', '✨', '💎', '💰',
    '🚀', '🎉', '🎊', '🏆', '👑', '💯', '💸', '📈', '📊', '🌟'];

  const isDevWallet = connectedWallet?.address === DEV_WALLET;

  useEffect(() => {
    loadConnectedWallet();
    loadOnlineUsers();
    loadBannedWallets();
    loadLiveStreams();
    loadScheduledStreams();
    subscribeToPresence();
    subscribeToStreams();
    subscribeToTipsAndCrowns();

    const interval = setInterval(() => {
      if (connectedWallet && nickname) {
        updatePresence(nickname, true);
      }
      if (isStreaming && currentStream) {
        updateStreamHeartbeat();
        setStreamDuration(Math.floor((new Date() - new Date(currentStream.started_at)) / 1000));
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      if (connectedWallet && nickname) {
        updatePresence(nickname, false);
      }
      if (isStreaming && currentStream) {
        endStream();
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
    if (viewingStream?.stream_signal) {
      if (viewingStream.wallet_address === connectedWallet?.address) {
        if (viewerVideoRef.current && mainStreamRef.current) {
          viewerVideoRef.current.srcObject = mainStreamRef.current;
          viewerVideoRef.current.play().catch(e => console.error('Play error:', e));
        }
      } else {
        const peer = new Peer({
          initiator: false,
          trickle: false
        });

        peer.on('signal', (signal) => {
          console.log('Viewer signal generated');
        });

        peer.on('stream', (remoteStream) => {
          if (viewerVideoRef.current) {
            viewerVideoRef.current.srcObject = remoteStream;
            viewerVideoRef.current.play().catch(e => console.error('Play error:', e));
          }
        });

        peer.on('error', (err) => {
          console.error('Viewer peer error:', err);
        });

        peer.signal(viewingStream.stream_signal);
        viewerPeerRef.current = peer;

        return () => {
          if (viewerPeerRef.current) {
            viewerPeerRef.current.destroy();
            viewerPeerRef.current = null;
          }
        };
      }
    }
  }, [viewingStream, mainStreamRef.current]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (selectedDM) {
      scrollDMToBottom();
    }
  }, [dmMessages]);

  useEffect(() => {
    if (currentStream) {
      loadStreamTips();
      const interval = setInterval(loadStreamTips, 5000);
      return () => clearInterval(interval);
    }
  }, [currentStream]);

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

  const loadLiveStreams = async () => {
    const { data, error } = await supabase
      .from('live_streams')
      .select('*')
      .eq('is_active', true)
      .order('started_at', { ascending: false });

    if (!error && data) {
      setLiveStreams(data);
    }
  };

  const loadScheduledStreams = async () => {
    const now = new Date();
    const { data, error } = await supabase
      .from('scheduled_streams')
      .select('*')
      .eq('is_active', true)
      .eq('is_cancelled', false)
      .gte('scheduled_at', now.toISOString())
      .order('scheduled_at', { ascending: true });

    if (!error && data) {
      setScheduledStreams(data);
    }
  };

  const createScheduledStream = async () => {
    if (!connectedWallet || !nickname) {
      toast.error('Please connect wallet and set nickname');
      return;
    }

    if (!scheduleForm.title || !scheduleForm.date || !scheduleForm.time) {
      toast.error('Please fill in all required fields');
      return;
    }

    const scheduledAt = new Date(`${scheduleForm.date}T${scheduleForm.time}`);
    if (scheduledAt <= new Date()) {
      toast.error('Schedule time must be in the future');
      return;
    }

    const { error } = await supabase
      .from('scheduled_streams')
      .insert([{
        wallet_address: connectedWallet.address,
        nickname: nickname,
        title: scheduleForm.title,
        description: scheduleForm.description,
        category: scheduleForm.category,
        scheduled_at: scheduledAt.toISOString(),
        duration_minutes: scheduleForm.duration
      }]);

    if (error) {
      toast.error('Failed to schedule stream');
      return;
    }

    toast.success('Stream scheduled successfully!');
    setShowScheduleModal(false);
    setScheduleForm({
      title: '',
      description: '',
      category: 'Just Chatting',
      date: '',
      time: '',
      duration: 60
    });
    loadScheduledStreams();
  };

  const goToScheduledStream = async (scheduled) => {
    if (!connectedWallet) {
      toast.error('Please connect your wallet');
      return;
    }

    if (scheduled.wallet_address !== connectedWallet.address) {
      toast.error('You can only go live for your own scheduled streams');
      return;
    }

    setStreamCategory(scheduled.category);
    setActiveTab('chat');
    setShowCameraSelect(true);
    toast.success(`Starting stream: ${scheduled.title}`);
  };

  const cancelScheduledStream = async (id) => {
    const { error } = await supabase
      .from('scheduled_streams')
      .update({ is_cancelled: true })
      .eq('id', id);

    if (!error) {
      toast.success('Stream cancelled');
      loadScheduledStreams();
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

  const subscribeToTipsAndCrowns = () => {
    const tipsChannel = supabase
      .channel('tips_notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'stream_tips'
        },
        (payload) => {
          showNotification({
            type: 'tip',
            from: payload.new.from_nickname,
            to: payload.new.to_nickname,
            amount: parseFloat(payload.new.amount).toFixed(4),
            currency: payload.new.currency
          });
        }
      )
      .subscribe();

    const crownsChannel = supabase
      .channel('crowns_notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'stream_reactions'
        },
        (payload) => {
          showNotification({
            type: 'crown',
            from: payload.new.from_nickname,
            to: payload.new.from_wallet
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(tipsChannel);
      supabase.removeChannel(crownsChannel);
    };
  };

  const showNotification = (notif) => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, ...notif }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  const sendCrown = async (recipient) => {
    if (!connectedWallet || !nickname) {
      toast.error('Please connect wallet and set nickname');
      return;
    }

    if (!currentStream && !viewingStream) {
      toast.error('No active stream');
      return;
    }

    const streamId = currentStream?.id || viewingStream?.id;

    const { error } = await supabase
      .from('stream_reactions')
      .insert([{
        stream_id: streamId,
        from_wallet: connectedWallet.address,
        from_nickname: nickname,
        reaction_type: 'crown'
      }]);

    if (!error) {
      const { data: stream } = await supabase
        .from('live_streams')
        .select('crown_count')
        .eq('id', streamId)
        .maybeSingle();

      await supabase
        .from('live_streams')
        .update({
          crown_count: (stream?.crown_count || 0) + 1
        })
        .eq('id', streamId);

      const { data: rooms } = await supabase
        .from('chat_rooms')
        .select('id')
        .eq('type', 'general')
        .maybeSingle();

      if (rooms) {
        await supabase
          .from('chat_messages')
          .insert([{
            room_id: rooms.id,
            wallet_address: connectedWallet.address,
            nickname: nickname,
            message_type: 'crown',
            content: `sent a crown to ${recipient.nickname || 'streamer'}! 👑`,
            tip_data: {
              type: 'crown',
              to_nickname: recipient.nickname || 'streamer',
              to_wallet: recipient.wallet_address
            }
          }]);
      }

      toast.success('Crown sent! 👑');
      if (viewingStream) {
        loadStreamDetails(streamId);
      }
    } else {
      toast.error('Failed to send crown');
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
    await updatePresence(nickname, true);
    setShowNicknameModal(false);
    toast.success('Nickname saved!');
  };

  const sendMessage = async () => {
    if (!messageInput.trim() || !connectedWallet || !nickname) {
      toast.error('Please ensure you have a nickname set');
      return;
    }

    const { data: rooms } = await supabase
      .from('chat_rooms')
      .select('id')
      .eq('type', 'general')
      .maybeSingle();

    if (!rooms) {
      toast.error('Chat room not found');
      return;
    }

    const messageData = {
      room_id: rooms.id,
      wallet_address: connectedWallet.address,
      nickname: nickname,
      message_type: 'text',
      content: messageInput.trim()
    };

    const { data, error } = await supabase
      .from('chat_messages')
      .insert([messageData])
      .select();

    if (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message: ' + error.message);
      return;
    }

    if (data && data.length > 0) {
      setMessages((prev) => [...prev, data[0]]);
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
      content: messageInput.trim()
    };

    const { data, error } = await supabase
      .from('direct_messages')
      .insert([dmData])
      .select();

    if (error) {
      toast.error('Failed to send DM: ' + error.message);
      return;
    }

    if (data && data.length > 0) {
      setDmMessages((prev) => [...prev, data[0]]);
    }

    await supabase
      .from('dm_conversations')
      .update({
        last_message: messageInput.trim(),
        last_message_at: new Date().toISOString()
      })
      .eq('id', selectedDM.id);

    setMessageInput('');
    loadDMConversations();
  };

  const closeDM = () => {
    setSelectedDM(null);
    setDmMessages([]);
  };

  const openTipModal = (recipient) => {
    setShowUserModal(false);
    setTipRecipient(recipient);
    setShowTipModal(true);
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

  const startStream = async (deviceId) => {
    try {
      const { data: existing } = await supabase
        .from('live_streams')
        .select('*')
        .eq('wallet_address', connectedWallet.address)
        .eq('is_active', true)
        .maybeSingle();

      if (existing) {
        toast.error('You already have an active stream. Please end it first.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: deviceId ? { deviceId: { exact: deviceId } } : true,
        audio: true
      });

      mainStreamRef.current = stream;
      if (mainVideoRef.current) {
        mainVideoRef.current.srcObject = stream;
        mainVideoRef.current.play().catch(e => console.log('Play error:', e));
      }

      const { data: newStream, error: insertError } = await supabase
        .from('live_streams')
        .insert([{
          wallet_address: connectedWallet.address,
          nickname: nickname,
          title: `${nickname}'s Stream`,
          category: streamCategory,
          is_active: true,
          viewer_count: 0,
          total_tips: 0,
          crown_count: 0
        }])
        .select()
        .single();

      if (insertError) {
        console.error('Error creating stream:', insertError);
        toast.error('Failed to create stream record');
        return;
      }

      console.log('Stream created:', newStream);
      setCurrentStream(newStream);
      setIsStreaming(true);
      setShowCameraSelect(false);

      const peer = new Peer({
        initiator: true,
        trickle: false,
        stream: stream
      });

      peer.on('signal', async (signal) => {
        console.log('Broadcaster signal generated');
        await supabase
          .from('live_streams')
          .update({ stream_signal: signal })
          .eq('id', newStream.id);
      });

      peer.on('error', (err) => {
        console.error('Broadcaster peer error:', err);
      });

      broadcasterPeerRef.current = peer;

      toast.success('🎥 Stream started! You are now LIVE!');
      loadLiveStreams();
    } catch (error) {
      console.error('Error starting stream:', error);
      toast.error('Failed to start stream: ' + error.message);
    }
  };

  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always' },
          audio: true
        });

        if (mainVideoRef.current) {
          mainVideoRef.current.srcObject = screenStream;
          if (mainStreamRef.current && !pipStreamRef.current) {
            pipStreamRef.current = mainStreamRef.current;
            if (pipVideoRef.current) {
              pipVideoRef.current.srcObject = pipStreamRef.current;
            }
          }
          mainStreamRef.current = screenStream;
        }

        setIsScreenSharing(true);
        toast.success('Screen sharing started');
      } else {
        if (pipStreamRef.current) {
          if (mainVideoRef.current) {
            mainVideoRef.current.srcObject = pipStreamRef.current;
          }
          mainStreamRef.current = pipStreamRef.current;
          pipStreamRef.current = null;
          if (pipVideoRef.current) {
            pipVideoRef.current.srcObject = null;
          }
        }
        setIsScreenSharing(false);
      }
    } catch (error) {
      console.error('Error toggling screen share:', error);
      toast.error('Failed to toggle screen share');
    }
  };

  const endStream = async () => {
    if (mainStreamRef.current) {
      mainStreamRef.current.getTracks().forEach(track => track.stop());
      mainStreamRef.current = null;
    }
    if (pipStreamRef.current) {
      pipStreamRef.current.getTracks().forEach(track => track.stop());
      pipStreamRef.current = null;
    }
    if (mainVideoRef.current) {
      mainVideoRef.current.srcObject = null;
    }
    if (pipVideoRef.current) {
      pipVideoRef.current.srcObject = null;
    }

    if (broadcasterPeerRef.current) {
      broadcasterPeerRef.current.destroy();
      broadcasterPeerRef.current = null;
    }

    if (currentStream) {
      await supabase
        .from('live_streams')
        .update({
          is_active: false,
          ended_at: new Date().toISOString()
        })
        .eq('id', currentStream.id);
    }

    setIsStreaming(false);
    setIsScreenSharing(false);
    setCurrentStream(null);
    setStreamTips([]);
    setViewingStream(null);
    setTotalTips(0);
    toast.success('Stream ended');
    loadLiveStreams();
  };

  const updateStreamHeartbeat = async () => {
    if (!currentStream) return;

    await supabase
      .from('live_streams')
      .update({
        updated_at: new Date().toISOString()
      })
      .eq('id', currentStream.id);
  };

  const loadStreamTips = async () => {
    if (!currentStream) return;

    const { data } = await supabase
      .from('stream_tips')
      .select('*')
      .eq('stream_id', currentStream.id)
      .order('created_at', { ascending: false });

    if (data) {
      setStreamTips(data);
      const total = data.reduce((sum, tip) => sum + parseFloat(tip.amount), 0);
      setTotalTips(total.toFixed(4));
    }
  };

  const viewStream = async (stream) => {
    setViewingStream(stream);
    setActiveTab('viewing');
    loadStreamDetails(stream.id);
    joinStream(stream.id);
  };

  const loadStreamDetails = async (streamId) => {
    const { data: tips } = await supabase
      .from('stream_tips')
      .select('*')
      .eq('stream_id', streamId)
      .order('created_at', { ascending: false });

    if (tips) {
      setStreamTips(tips);
      const total = tips.reduce((sum, tip) => sum + parseFloat(tip.amount), 0);
      setTotalTips(total.toFixed(4));
    }

    const { data: viewers } = await supabase
      .from('stream_viewers')
      .select('*')
      .eq('stream_id', streamId);

    if (viewers) {
      setViewerCount(viewers.length);
    }
  };

  const joinStream = async (streamId) => {
    if (!connectedWallet) return;

    await supabase
      .from('stream_viewers')
      .upsert({
        stream_id: streamId,
        viewer_address: connectedWallet.address,
        last_seen: new Date().toISOString()
      });

    await supabase
      .from('live_streams')
      .update({ viewer_count: viewerCount + 1 })
      .eq('id', streamId);
  };

  const closeStreamView = () => {
    if (viewingStream && connectedWallet) {
      leaveStream(viewingStream.id);
    }
    setViewingStream(null);
    setStreamTips([]);
    setTotalTips(0);
    setViewerCount(0);
    setActiveTab('feeds');
  };

  const leaveStream = async (streamId) => {
    if (!connectedWallet) return;

    await supabase
      .from('stream_viewers')
      .delete()
      .eq('stream_id', streamId)
      .eq('viewer_address', connectedWallet.address);

    const { data: viewers } = await supabase
      .from('stream_viewers')
      .select('*')
      .eq('stream_id', streamId);

    await supabase
      .from('live_streams')
      .update({ viewer_count: viewers?.length || 0 })
      .eq('id', streamId);
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const isUserStreaming = (userWallet) => {
    return liveStreams.some(s => s.wallet_address === userWallet && s.is_active);
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-purple-900 via-slate-900 to-purple-900 overflow-hidden">
      {/* Notifications */}
      <div className="fixed top-20 right-6 z-50 space-y-2">
        {notifications.map((notif) => (
          <LiveNotification
            key={notif.id}
            notification={notif}
            onClose={() => setNotifications(prev => prev.filter(n => n.id !== notif.id))}
          />
        ))}
      </div>

      {/* Tab Navigation */}
      <div className="flex-shrink-0 bg-purple-900/20 backdrop-blur-xl border-b border-purple-500/20 px-6 pt-4">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-6 py-3 rounded-t-lg font-bold transition-all ${
              activeTab === 'chat'
                ? 'bg-purple-800/50 text-purple-200 border-t-2 border-x-2 border-purple-500/50'
                : 'text-purple-400 hover:text-purple-200'
            }`}
          >
            Chat
          </button>
          {liveStreams.length > 0 && (
            <button
              onClick={() => setActiveTab('feeds')}
              className={`px-6 py-3 rounded-t-lg font-bold transition-all relative ${
                activeTab === 'feeds'
                  ? 'bg-purple-800/50 text-purple-200 border-t-2 border-x-2 border-purple-500/50'
                  : 'text-purple-400 hover:text-purple-200'
              }`}
            >
              Live Feeds
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
                {liveStreams.length}
              </span>
            </button>
          )}
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`px-6 py-3 rounded-t-lg font-bold transition-all relative ${
              activeTab === 'upcoming'
                ? 'bg-purple-800/50 text-purple-200 border-t-2 border-x-2 border-purple-500/50'
                : 'text-purple-400 hover:text-purple-200'
            }`}
          >
            Upcoming
            {scheduledStreams.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {scheduledStreams.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-6 py-3 rounded-t-lg font-bold transition-all ${
              activeTab === 'analytics'
                ? 'bg-purple-800/50 text-purple-200 border-t-2 border-x-2 border-purple-500/50'
                : 'text-purple-400 hover:text-purple-200'
            }`}
          >
            Analytics
          </button>
        </div>
      </div>

      {activeTab === 'chat' && (
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Left Sidebar - Online Users */}
          <div className="w-72 bg-purple-900/20 backdrop-blur-xl flex flex-col border-r border-purple-500/20 flex-shrink-0">
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
                      {isUserStreaming(user.wallet_address) ? (
                        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-purple-900 animate-pulse"></div>
                      ) : (
                        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-purple-900"></div>
                      )}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-purple-200 font-bold truncate">{user.nickname}</span>
                        {user.wallet_address === DEV_WALLET && (
                          <span className="text-yellow-400 text-lg" title="Developer">👑</span>
                        )}
                        {isUserStreaming(user.wallet_address) && (
                          <span className="text-red-400 text-xs font-bold">LIVE</span>
                        )}
                      </div>
                      <div className="text-purple-400 text-xs truncate">{user.wallet_address.slice(0, 12)}...</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Stream Controls */}
            <div className="p-4 border-t border-purple-500/20 space-y-2">
              {!isStreaming ? (
                <button
                  onClick={selectCamera}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white py-3 px-4 rounded-lg font-bold transition-all duration-300"
                >
                  Start Streaming
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
                    onClick={endStream}
                    className="w-full bg-red-600/50 hover:bg-red-600/70 text-white py-2 px-4 rounded-lg font-medium transition-all"
                  >
                    End Stream
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Main Chat Area */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="p-4 bg-purple-900/20 backdrop-blur-xl border-b border-purple-500/20">
              <h3 className="text-2xl font-bold text-purple-200">General Chat</h3>
              <p className="text-purple-400 text-sm">Public conversation</p>
            </div>

            {/* Stream Preview */}
            {isStreaming && (
              <div className="p-4 bg-purple-900/10">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <div className="text-purple-200 font-bold text-lg">Your Live Stream</div>
                    <div className="text-purple-400 text-sm">Now visible in Live Feeds tab - viewers can watch and chat!</div>
                  </div>
                  <div className="flex items-center gap-2 bg-red-500 px-4 py-2 rounded-lg">
                    <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                    <span className="text-white font-bold">BROADCASTING</span>
                  </div>
                </div>
                <div className="bg-black rounded-lg overflow-hidden border-2 border-purple-500/30 relative aspect-video">
                  <video
                    ref={mainVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  {/* PiP Camera Overlay */}
                  {isScreenSharing && pipStreamRef.current && (
                    <div
                      className={`absolute w-48 h-36 border-2 border-purple-500/50 rounded-lg overflow-hidden cursor-move ${
                        cameraPosition === 'top-left' ? 'top-4 left-4' :
                        cameraPosition === 'top-right' ? 'top-4 right-4' :
                        cameraPosition === 'bottom-left' ? 'bottom-4 left-4' :
                        'bottom-4 right-4'
                      }`}
                    >
                      <video
                        ref={pipVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  {/* Tip Display */}
                  <div className="absolute top-4 left-4 bg-purple-900/90 backdrop-blur-xl px-4 py-2 rounded-lg border border-purple-500/30">
                    <div className="text-purple-200 font-bold text-sm">💸 Total Tips</div>
                    <div className="text-green-400 font-bold text-xl">{totalTips} XRP</div>
                  </div>
                  {/* Live Indicator with Timer */}
                  <div className="absolute top-4 right-4 bg-red-500/90 backdrop-blur-xl px-4 py-2 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                      <span className="text-white font-bold text-sm">LIVE</span>
                    </div>
                    <div className="text-white font-mono text-xs text-center">
                      {Math.floor(streamDuration / 3600)}:{String(Math.floor((streamDuration % 3600) / 60)).padStart(2, '0')}:{String(streamDuration % 60).padStart(2, '0')}
                    </div>
                  </div>
                  {/* Camera Position Selector */}
                  {isScreenSharing && (
                    <div className="absolute bottom-4 left-4 flex gap-2">
                      {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map(pos => (
                        <button
                          key={pos}
                          onClick={() => setCameraPosition(pos)}
                          className={`w-8 h-8 rounded ${
                            cameraPosition === pos
                              ? 'bg-purple-500'
                              : 'bg-purple-800/50 hover:bg-purple-700/70'
                          } transition-all`}
                        />
                      ))}
                    </div>
                  )}
                </div>
                {/* Recent Tips */}
                {streamTips.length > 0 && (
                  <div className="mt-2 space-y-1 max-h-24 overflow-y-auto">
                    {streamTips.slice(0, 5).map((tip) => (
                      <div key={tip.id} className="bg-purple-800/30 px-3 py-1 rounded text-sm flex items-center gap-2">
                        <span className="text-yellow-400">💸</span>
                        <span className="text-purple-200 font-medium">{tip.from_nickname}</span>
                        <span className="text-purple-400">sent</span>
                        <span className="text-green-400 font-bold">{tip.amount} {tip.currency}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => setViewingStream(currentStream)}
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg font-bold transition-all"
                  >
                    📺 View Full Stream
                  </button>
                  <button
                    onClick={endStream}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-bold transition-all"
                  >
                    Stop Stream
                  </button>
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg) => {
                const isTip = msg.message_type === 'tip';
                const isCrown = msg.message_type === 'crown';
                const isSpecial = isTip || isCrown;

                if (isSpecial) {
                  return (
                    <div
                      key={msg.id}
                      className="flex justify-center"
                    >
                      <div className={`px-6 py-3 rounded-xl border-2 ${
                        isTip
                          ? 'bg-gradient-to-r from-yellow-900/50 to-orange-900/50 border-yellow-500/50'
                          : 'bg-gradient-to-r from-purple-900/50 to-pink-900/50 border-purple-500/50'
                      } max-w-md`}>
                        <div className="flex items-center gap-3">
                          <div className="text-3xl">
                            {isTip ? '💸' : '👑'}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-white font-bold">{msg.nickname}</span>
                              {isTip && msg.tip_data && (
                                <>
                                  <span className="text-yellow-300">sent</span>
                                  <span className="text-green-400 font-bold text-lg">
                                    {msg.tip_data.amount} {msg.tip_data.currency}
                                  </span>
                                  <span className="text-yellow-300">to</span>
                                  <span className="text-white font-bold">{msg.tip_data.to_nickname}</span>
                                </>
                              )}
                              {isCrown && (
                                <span className="text-purple-200">{msg.content}</span>
                              )}
                            </div>
                            <div className="text-purple-400 text-xs mt-1">{formatTimestamp(msg.created_at)}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
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
                );
              })}
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
          <div className="w-80 bg-purple-900/20 backdrop-blur-xl border-l border-purple-500/20 flex flex-col flex-shrink-0">
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
      )}

      {activeTab === 'feeds' && (
        <LiveFeedsPage onViewStream={viewStream} connectedWallet={connectedWallet} />
      )}

      {activeTab === 'analytics' && (
        <StreamAnalytics />
      )}

      {activeTab === 'upcoming' && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-3xl font-bold text-purple-200">Upcoming Streams</h2>
                <p className="text-purple-400 mt-1">{scheduledStreams.length} scheduled streams</p>
              </div>
              {connectedWallet && nickname && (
                <button
                  onClick={() => setShowScheduleModal(true)}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-6 py-3 rounded-lg font-bold transition-all flex items-center gap-2"
                >
                  <span>📅</span>
                  Schedule Stream
                </button>
              )}
            </div>

            {scheduledStreams.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-6xl mb-4">📅</div>
                <div className="text-purple-300 text-xl font-bold mb-2">No Upcoming Streams</div>
                <div className="text-purple-400">Schedule a stream to let your audience know when you'll be live!</div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {scheduledStreams.map((scheduled) => {
                  const scheduledDate = new Date(scheduled.scheduled_at);
                  const now = new Date();
                  const hoursUntil = Math.floor((scheduledDate - now) / (1000 * 60 * 60));
                  const isMyStream = connectedWallet?.address === scheduled.wallet_address;

                  return (
                    <div key={scheduled.id} className="bg-purple-800/30 rounded-lg p-5 border border-purple-500/30 hover:border-purple-400/50 transition-all">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                            {scheduled.nickname.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-purple-200 font-bold">{scheduled.nickname}</div>
                            {isMyStream && (
                              <span className="text-xs bg-purple-600 px-2 py-0.5 rounded text-white">Your Stream</span>
                            )}
                          </div>
                        </div>
                        <span className="bg-blue-600/30 text-blue-300 px-2 py-1 rounded text-xs font-bold">
                          {scheduled.category}
                        </span>
                      </div>

                      <h3 className="text-purple-100 font-bold text-lg mb-2">{scheduled.title}</h3>
                      {scheduled.description && (
                        <p className="text-purple-400 text-sm mb-3 line-clamp-2">{scheduled.description}</p>
                      )}

                      <div className="space-y-2 mb-4">
                        <div className="flex items-center gap-2 text-purple-300 text-sm">
                          <span>📅</span>
                          <span>{scheduledDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
                        </div>
                        <div className="flex items-center gap-2 text-purple-300 text-sm">
                          <span>🕐</span>
                          <span>{scheduledDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                        </div>
                        <div className="flex items-center gap-2 text-purple-300 text-sm">
                          <span>⏱️</span>
                          <span>{scheduled.duration_minutes} minutes</span>
                        </div>
                        <div className={`flex items-center gap-2 text-sm font-bold ${
                          hoursUntil < 1 ? 'text-red-400' : hoursUntil < 24 ? 'text-yellow-400' : 'text-purple-400'
                        }`}>
                          <span>⏳</span>
                          <span>
                            {hoursUntil < 1 ? 'Starting soon!' :
                             hoursUntil < 24 ? `In ${hoursUntil} hours` :
                             `In ${Math.floor(hoursUntil / 24)} days`}
                          </span>
                        </div>
                      </div>

                      {isMyStream && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => goToScheduledStream(scheduled)}
                            className="flex-1 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white py-2 px-4 rounded-lg font-bold transition-all"
                          >
                            🎥 Go Live Now
                          </button>
                          <button
                            onClick={() => cancelScheduledStream(scheduled.id)}
                            className="bg-red-600/30 hover:bg-red-600/50 text-red-300 py-2 px-4 rounded-lg font-bold transition-all"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                      {!isMyStream && (
                        <button className="w-full bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 py-2 px-4 rounded-lg font-bold transition-all">
                          🔔 Remind Me
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'viewing' && viewingStream && (
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          <div className="flex-shrink-0 p-4 bg-purple-900/20 backdrop-blur-xl border-b border-purple-500/20 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={closeStreamView}
                className="text-purple-400 hover:text-purple-200 transition-colors"
              >
                ← Back
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                  {viewingStream.nickname.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-purple-200 font-bold">{viewingStream.nickname}</span>
                    {viewingStream.wallet_address === DEV_WALLET && (
                      <span className="text-yellow-400 text-sm">👑</span>
                    )}
                    <span className="flex items-center gap-1 bg-red-500 px-2 py-0.5 rounded text-xs">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                      LIVE
                    </span>
                  </div>
                  <div className="text-purple-400 text-sm">{viewingStream.title}</div>
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                const user = { wallet_address: viewingStream.wallet_address, nickname: viewingStream.nickname };
                openTipModal(user);
              }}
              className="bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white px-6 py-2 rounded-lg font-bold transition-all"
            >
              💸 Send Tip
            </button>
          </div>
          <div className="flex-1 flex overflow-hidden min-h-0">
            <div className="flex-1 bg-black flex flex-col min-w-0">
              <div className="flex-1 flex items-center justify-center relative min-h-0">
                <div className="text-center">
                  <div className="text-8xl mb-4">📹</div>
                  <div className="text-purple-400 text-xl">Stream Preview</div>
                  <div className="text-purple-500 text-sm mt-2">Live video streaming coming soon</div>
                </div>
                <div className="absolute top-4 right-4 flex items-center gap-2 bg-red-500/90 backdrop-blur-xl px-4 py-2 rounded-lg">
                  <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                  <span className="text-white font-bold text-sm">LIVE</span>
                </div>
              </div>

              <div className="flex-shrink-0 p-4 bg-purple-900/20 backdrop-blur-xl border-t border-purple-500/20">
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-purple-800/30 rounded-lg p-4 border border-purple-500/20">
                    <div className="text-purple-400 text-sm mb-1">👥 Viewers</div>
                    <div className="text-purple-200 text-2xl font-bold">{viewerCount}</div>
                  </div>
                  <div className="bg-purple-800/30 rounded-lg p-4 border border-purple-500/20">
                    <div className="text-purple-400 text-sm mb-1">💸 Total Tips</div>
                    <div className="text-green-400 text-2xl font-bold">{totalTips}</div>
                  </div>
                  <div className="bg-purple-800/30 rounded-lg p-4 border border-purple-500/20">
                    <div className="text-purple-400 text-sm mb-1">🎁 Tip Count</div>
                    <div className="text-purple-200 text-2xl font-bold">{streamTips.length}</div>
                  </div>
                  <div className="bg-purple-800/30 rounded-lg p-4 border border-purple-500/20">
                    <div className="text-purple-400 text-sm mb-1">⏱️ Duration</div>
                    <div className="text-purple-200 text-2xl font-bold">
                      {Math.floor((new Date() - new Date(viewingStream.started_at)) / 60000)}m
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="w-96 bg-purple-900/20 backdrop-blur-xl border-l border-purple-500/20 flex flex-col flex-shrink-0">
              <div className="flex-shrink-0 p-4 border-b border-purple-500/20">
                <h3 className="text-xl font-bold text-purple-200">Stream Chat 💬</h3>
                <p className="text-purple-400 text-sm">{messages.length} messages</p>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-5xl mb-3">💬</div>
                    <div className="text-purple-400">No messages yet</div>
                    <div className="text-purple-500 text-sm mt-1">Start the conversation!</div>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isTip = msg.message_type === 'tip';
                    const isCrown = msg.message_type === 'crown';

                    if (isTip || isCrown) {
                      return (
                        <div key={msg.id} className={`px-4 py-3 rounded-lg border ${
                          isTip
                            ? 'bg-gradient-to-r from-yellow-900/40 to-orange-900/40 border-yellow-500/40'
                            : 'bg-gradient-to-r from-purple-900/40 to-pink-900/40 border-purple-500/40'
                        }`}>
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{isTip ? '💸' : '👑'}</span>
                            <div className="flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap text-sm">
                                <span className="text-white font-bold">{msg.nickname}</span>
                                {isTip && msg.tip_data && (
                                  <>
                                    <span className="text-yellow-300">sent</span>
                                    <span className="text-green-400 font-bold">
                                      {msg.tip_data.amount} {msg.tip_data.currency}
                                    </span>
                                    <span className="text-yellow-300">to</span>
                                    <span className="text-white font-bold">{msg.tip_data.to_nickname}</span>
                                  </>
                                )}
                                {isCrown && (
                                  <span className="text-purple-200">{msg.content}</span>
                                )}
                              </div>
                              <div className="text-purple-400 text-xs mt-0.5">{formatTimestamp(msg.created_at)}</div>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={msg.id} className="bg-purple-800/30 rounded-lg p-3 border border-purple-500/20">
                        <div className="flex items-start gap-2">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                            {msg.nickname.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-purple-200 font-bold text-sm">{msg.nickname}</span>
                              {msg.wallet_address === DEV_WALLET && (
                                <span className="text-yellow-400 text-xs">👑</span>
                              )}
                            </div>
                            <div className="text-purple-100 text-sm break-words">{msg.content || msg.message}</div>
                            <div className="text-purple-400 text-xs mt-1">
                              {formatTimestamp(msg.created_at)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-4 border-t border-purple-500/20 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Type a message..."
                    className="flex-1 bg-purple-800/30 text-purple-100 px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 border border-purple-500/20"
                  />
                  <button
                    onClick={sendMessage}
                    className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg font-bold transition-all"
                  >
                    Send
                  </button>
                </div>
                <button
                  onClick={() => {
                    const user = { wallet_address: viewingStream.wallet_address, nickname: viewingStream.nickname };
                    sendCrown(user);
                  }}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white py-2 rounded-lg font-bold transition-all text-sm"
                >
                  👑 Send Crown
                </button>
                <button
                  onClick={() => {
                    const user = { wallet_address: viewingStream.wallet_address, nickname: viewingStream.nickname };
                    openTipModal(user);
                  }}
                  className="w-full bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white py-3 rounded-lg font-bold transition-all"
                >
                  💸 Send Tip
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
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
                onClick={() => openTipModal(selectedUser)}
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
                    startStream(camera.deviceId);
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

      <TipModal
        isOpen={showTipModal}
        onClose={() => {
          setShowTipModal(false);
          setTipRecipient(null);
          if (viewingStream) {
            loadStreamDetails(viewingStream.id);
          }
        }}
        recipient={tipRecipient}
        connectedWallet={connectedWallet}
        nickname={nickname}
        currentStream={viewingStream}
      />

      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-purple-900 rounded-xl max-w-2xl w-full p-6 border-2 border-purple-500/30">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-purple-200">📅 Schedule Stream</h3>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="text-purple-400 hover:text-purple-200 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-purple-300 text-sm font-bold mb-2 block">Stream Title *</label>
                <input
                  type="text"
                  value={scheduleForm.title}
                  onChange={(e) => setScheduleForm({...scheduleForm, title: e.target.value})}
                  className="w-full bg-purple-800/30 text-purple-100 px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 border border-purple-500/20"
                  placeholder="e.g., Trading Strategy Session"
                />
              </div>

              <div>
                <label className="text-purple-300 text-sm font-bold mb-2 block">Description</label>
                <textarea
                  value={scheduleForm.description}
                  onChange={(e) => setScheduleForm({...scheduleForm, description: e.target.value})}
                  className="w-full bg-purple-800/30 text-purple-100 px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 border border-purple-500/20 h-24 resize-none"
                  placeholder="Tell viewers what to expect..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-purple-300 text-sm font-bold mb-2 block">Category *</label>
                  <select
                    value={scheduleForm.category}
                    onChange={(e) => setScheduleForm({...scheduleForm, category: e.target.value})}
                    className="w-full bg-purple-800/30 text-purple-100 px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 border border-purple-500/20"
                  >
                    <option value="Just Chatting">Just Chatting</option>
                    <option value="Trading">Trading</option>
                    <option value="Education">Education</option>
                    <option value="Gaming">Gaming</option>
                    <option value="Music">Music</option>
                    <option value="Art">Art</option>
                    <option value="Crypto Talk">Crypto Talk</option>
                    <option value="Entertainment">Entertainment</option>
                  </select>
                </div>

                <div>
                  <label className="text-purple-300 text-sm font-bold mb-2 block">Duration (minutes) *</label>
                  <input
                    type="number"
                    value={scheduleForm.duration}
                    onChange={(e) => setScheduleForm({...scheduleForm, duration: parseInt(e.target.value)})}
                    className="w-full bg-purple-800/30 text-purple-100 px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 border border-purple-500/20"
                    min="15"
                    step="15"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-purple-300 text-sm font-bold mb-2 block">Date *</label>
                  <input
                    type="date"
                    value={scheduleForm.date}
                    onChange={(e) => setScheduleForm({...scheduleForm, date: e.target.value})}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full bg-purple-800/30 text-purple-100 px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 border border-purple-500/20"
                  />
                </div>

                <div>
                  <label className="text-purple-300 text-sm font-bold mb-2 block">Time *</label>
                  <input
                    type="time"
                    value={scheduleForm.time}
                    onChange={(e) => setScheduleForm({...scheduleForm, time: e.target.value})}
                    className="w-full bg-purple-800/30 text-purple-100 px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 border border-purple-500/20"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowScheduleModal(false)}
                className="flex-1 bg-purple-800/30 hover:bg-purple-800/50 text-purple-200 py-3 rounded-lg font-bold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={createScheduledStream}
                className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white py-3 rounded-lg font-bold transition-all"
              >
                Schedule Stream
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
