import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../utils/supabase';
import ChatMessage from './ChatMessage';
import AIAssistant from '../utils/aiAssistant';

export default function MiniAIChat({ isOpen, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const messagesEndRef = useRef(null);
  const aiAssistant = useRef(new AIAssistant());
  const textareaRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      initializeSession();
      loadRecentMessages();
    }
  }, [isOpen]);

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

  const loadRecentMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_chat_messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(20);

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
      console.error('Error loading messages:', error);
      addWelcomeMessage();
    }
  };

  const addWelcomeMessage = () => {
    const welcomeMsg = {
      id: `welcome_${Date.now()}`,
      role: 'assistant',
      content: '👋 Quick AI Assistant ready! Try:\n• "BUY 1000 ORANGE"\n• "SELL 500 BANANA"\n• "CHECK BALANCE"\n• "PRICE OF APPLE"',
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
    if (!content.trim()) return;

    const userMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
      data: null
    };

    setMessages(prev => [...prev, userMessage]);
    await saveMessage(userMessage);
    setInput('');
    setIsTyping(true);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

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
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
        data: null
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleSendMessage(input.trim());
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleInput = (e) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
  };

  const quickCommands = [
    { label: '💰 Balance', command: 'CHECK BALANCE' },
    { label: '💱 Buy', command: 'I want to buy tokens' },
    { label: '💸 Sell', command: 'I want to sell tokens' }
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div
        className="relative w-full max-w-2xl bg-gradient-to-br from-purple-900/95 to-purple-800/95 rounded-xl border border-purple-500/50 shadow-2xl shadow-purple-500/30 flex flex-col animate-slideUp"
        style={{ maxHeight: '90vh' }}
      >
        <div className="flex items-center justify-between p-4 border-b border-purple-500/30 bg-purple-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center animate-pulse">
              <span className="text-2xl">🤖</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">AI Trading Assistant</h2>
              <p className="text-purple-300/80 text-xs">Execute commands instantly</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-purple-800/40 hover:bg-purple-800/60 text-purple-200 hover:text-white transition-all duration-200 border border-purple-500/30"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ minHeight: 0, maxHeight: '60vh' }}>
          {messages.map((message, index) => (
            <div
              key={message.id}
              className="animate-fadeInUp"
              style={{ animationDelay: `${index * 30}ms` }}
            >
              <ChatMessage message={message} />
            </div>
          ))}
          {isTyping && (
            <div className="flex items-start gap-3 animate-fadeInUp">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0 animate-pulse">
                <span className="text-sm">🤖</span>
              </div>
              <div className="flex-1 bg-purple-900/30 rounded-lg p-3 border border-purple-500/20">
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

        <div className="p-4 border-t border-purple-500/30 bg-purple-900/50 space-y-3">
          <div className="flex flex-wrap gap-2">
            {quickCommands.map((cmd, index) => (
              <button
                key={index}
                onClick={() => handleSendMessage(cmd.command)}
                disabled={isTyping}
                className="px-3 py-1.5 bg-purple-800/40 hover:bg-purple-800/60 text-purple-200 hover:text-white rounded-full text-xs font-medium transition-all duration-200 border border-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105"
              >
                {cmd.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder="Type command: BUY 1000 ORANGE, CHECK BALANCE..."
              disabled={isTyping}
              rows="1"
              className="flex-1 bg-purple-900/40 border border-purple-500/40 rounded-lg px-4 py-2.5 text-white placeholder-purple-400/60 focus:outline-none focus:border-purple-500/60 focus:ring-2 focus:ring-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed resize-none overflow-hidden transition-all duration-200 text-sm"
              style={{ minHeight: '42px', maxHeight: '100px' }}
            />
            <button
              type="submit"
              disabled={isTyping || !input.trim()}
              className="px-5 bg-gradient-to-r from-purple-600 to-blue-600 hover:shadow-lg hover:shadow-purple-500/50 text-white rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none hover:scale-105"
            >
              <span className="hidden sm:inline">Send</span>
              <span className="sm:hidden">➤</span>
            </button>
          </form>

          <div className="text-center text-xs text-purple-400/60">
            Press Enter to send • Shift+Enter for new line
          </div>
        </div>
      </div>
    </div>
  );
}
