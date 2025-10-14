import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../utils/supabase';
import ChatMessage from '../components/ChatMessage';
import ChatInput from '../components/ChatInput';
import AIAssistant from '../utils/aiAssistant';

export default function AIChat() {
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const messagesEndRef = useRef(null);
  const aiAssistant = useRef(new AIAssistant());

  useEffect(() => {
    initializeSession();
    loadChatHistory();

    const handleSendAIMessage = (event) => {
      handleSendMessage(event.detail);
    };

    window.addEventListener('sendAIMessage', handleSendAIMessage);

    return () => {
      window.removeEventListener('sendAIMessage', handleSendAIMessage);
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const initializeSession = () => {
    const existingSession = localStorage.getItem('ai_chat_session');
    if (existingSession) {
      setSessionId(existingSession);
    } else {
      const newSession = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setSessionId(newSession);
      localStorage.setItem('ai_chat_session', newSession);
    }
  };

  const loadChatHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_chat_messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(50);

      if (error) throw error;

      if (data && data.length > 0) {
        setMessages(data.map(msg => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.created_at),
          data: msg.metadata
        })));
      } else {
        addWelcomeMessage();
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
      addWelcomeMessage();
    }
  };

  const addWelcomeMessage = () => {
    const welcomeMsg = {
      id: `welcome_${Date.now()}`,
      role: 'assistant',
      content: 'Hello! I\'m your advanced XRPL command-based AI assistant. I can execute commands directly! Try:\n\n**Natural Language Commands:**\n• "SEND rXXX... 15 XRP" - Send XRP instantly\n• "BUY 1000 ORANGE" - Buy tokens\n• "SELL 500 BANANA" - Sell tokens\n• "CHECK BALANCE" - View your balance\n• "PRICE OF BANANA" - Get token price\n• "SETUP TRUSTLINE ORANGE" - Add trustline\n\n**Quick Actions:**\n• "Send 100 APPLE to rXXX..." - Send tokens\n• "What\'s my balance?" - Check wallet\n• "Show top tokens" - Market data\n• "Trade history" - View trades\n\nJust type naturally or use the commands above. What would you like to do?',
      timestamp: new Date(),
      data: null
    };
    setMessages([welcomeMsg]);
  };

  const saveMessage = async (message) => {
    try {
      await supabase.from('ai_chat_messages').insert({
        session_id: sessionId,
        role: message.role,
        content: message.content,
        metadata: message.data || null
      });
    } catch (error) {
      console.error('Error saving message:', error);
    }
  };

  const handleSendMessage = async (content) => {
    const userMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
      data: null
    };

    setMessages(prev => [...prev, userMessage]);
    await saveMessage(userMessage);
    setIsTyping(true);

    try {
      const response = await aiAssistant.current.processMessage(content);

      const assistantMessage = {
        id: `assistant_${Date.now()}`,
        role: 'assistant',
        content: response.content,
        timestamp: new Date(),
        data: response.data || null
      };

      setMessages(prev => [...prev, assistantMessage]);
      await saveMessage(assistantMessage);
    } catch (error) {
      console.error('Error processing message:', error);
      const errorMessage = {
        id: `error_${Date.now()}`,
        role: 'assistant',
        content: 'I apologize, but I encountered an error processing your request. Please try again.',
        timestamp: new Date(),
        data: null
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleClearChat = async () => {
    if (window.confirm('Are you sure you want to clear the chat history?')) {
      try {
        await supabase.from('ai_chat_messages').delete().eq('session_id', sessionId);
        setMessages([]);
        addWelcomeMessage();
        toast.success('Chat history cleared');
      } catch (error) {
        console.error('Error clearing chat:', error);
        toast.error('Failed to clear chat history');
      }
    }
  };

  const handleNewSession = () => {
    const newSession = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setSessionId(newSession);
    localStorage.setItem('ai_chat_session', newSession);
    setMessages([]);
    addWelcomeMessage();
    toast.success('New chat session started');
  };

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 140px)' }}>
      <div className="glass rounded-t-xl p-4 sm:p-6 border-b border-purple-500/20 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center animate-pulse">
              <span className="text-2xl">🤖</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">AI Chat Assistant</h1>
              <p className="text-purple-300/80 text-sm">Your intelligent XRPL companion</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleNewSession}
              className="px-3 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 rounded-lg transition-all duration-200 text-sm border border-purple-500/30 hover:scale-105"
            >
              New Chat
            </button>
            <button
              onClick={handleClearChat}
              className="px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-300 rounded-lg transition-all duration-200 text-sm border border-red-500/30 hover:scale-105"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 glass p-4 sm:p-6 overflow-y-auto" style={{ minHeight: 0 }}>
        <div className="space-y-4">
          {messages.map((message, index) => (
            <div
              key={message.id}
              className="animate-fadeInUp"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <ChatMessage message={message} />
            </div>
          ))}
          {isTyping && (
            <div className="flex items-start gap-3 animate-fadeInUp">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0 animate-pulse">
                <span className="text-sm">🤖</span>
              </div>
              <div className="flex-1 bg-purple-900/30 rounded-lg p-4 border border-purple-500/20">
                <div className="flex gap-2">
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="glass rounded-b-xl p-4 border-t border-purple-500/20 flex-shrink-0">
        <ChatInput onSend={handleSendMessage} disabled={isTyping} />
      </div>
    </div>
  );
}
