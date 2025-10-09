import { useState, useRef } from 'react';

export default function ChatInput({ onSend, disabled }) {
  const [input, setInput] = useState('');
  const textareaRef = useRef(null);

  const quickPrompts = [
    { label: '💰 Check my balance', prompt: 'Check my wallet balance' },
    { label: '📊 Top tokens', prompt: 'Show me the top performing tokens today' },
    { label: '🔄 Recent trades', prompt: 'Show my recent trade history' },
    { label: '📈 Market overview', prompt: 'Give me a market overview' }
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim() && !disabled) {
      onSend(input.trim());
      setInput('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
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
    e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
  };

  const handleQuickPrompt = (prompt) => {
    if (!disabled) {
      onSend(prompt);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {quickPrompts.map((prompt, index) => (
          <button
            key={index}
            onClick={() => handleQuickPrompt(prompt.prompt)}
            disabled={disabled}
            className="px-3 py-1.5 bg-purple-900/30 hover:bg-purple-900/50 text-purple-200 rounded-full text-xs font-medium transition-all duration-200 border border-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {prompt.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Ask me anything about XRPL, tokens, trading, or the platform..."
          disabled={disabled}
          rows="1"
          className="flex-1 bg-purple-900/20 border border-purple-500/30 rounded-lg px-4 py-3 text-white placeholder-purple-400/50 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed resize-none overflow-hidden"
          style={{ minHeight: '48px', maxHeight: '150px' }}
        />
        <button
          type="submit"
          disabled={disabled || !input.trim()}
          className="px-6 bg-gradient-to-r from-purple-600 to-blue-600 hover:shadow-lg hover:shadow-purple-500/50 text-white rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
        >
          <span className="hidden sm:inline">Send</span>
          <span className="sm:hidden">➤</span>
        </button>
      </form>

      <div className="flex items-center justify-center gap-2 text-xs text-purple-400/60">
        <span>💡 Tip: Press Enter to send, Shift+Enter for new line</span>
      </div>
    </div>
  );
}
