import { useState, useRef, useEffect } from 'react';
import { AI_COMMANDS, getAllCommands, searchCommands } from '../utils/aiCommands';

export default function CommandDropdown({ onSelectCommand, onClose }) {
  const [selectedCategory, setSelectedCategory] = useState('WALLET');
  const [searchQuery, setSearchQuery] = useState('');
  const [editablePrompt, setEditablePrompt] = useState('');
  const [selectedCommand, setSelectedCommand] = useState(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const categories = Object.keys(AI_COMMANDS);
  const displayCommands = searchQuery
    ? searchCommands(searchQuery)
    : AI_COMMANDS[selectedCategory] || [];

  const handleCommandClick = (command) => {
    setSelectedCommand(command);
    setEditablePrompt(command.prompt);
  };

  const handleSendCommand = () => {
    if (editablePrompt.trim()) {
      onSelectCommand(editablePrompt.trim());
      onClose();
    }
  };

  const handleQuickSend = (prompt) => {
    onSelectCommand(prompt);
    onClose();
  };

  return (
    <div
      ref={dropdownRef}
      className="absolute bottom-full left-0 right-0 mb-2 glass rounded-xl border border-purple-500/30 shadow-2xl shadow-purple-500/20 overflow-hidden animate-slideUp"
      style={{ maxHeight: '70vh' }}
    >
      <div className="p-4 border-b border-purple-500/20">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search commands..."
          className="w-full bg-purple-900/20 border border-purple-500/30 rounded-lg px-4 py-2 text-white placeholder-purple-400/50 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20"
        />
      </div>

      <div className="flex h-[400px]">
        <div className="w-48 border-r border-purple-500/20 overflow-y-auto">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => {
                setSelectedCategory(category);
                setSearchQuery('');
              }}
              className={`w-full text-left px-4 py-3 transition-all duration-200 ${
                selectedCategory === category
                  ? 'bg-purple-600/30 text-white border-r-2 border-purple-400'
                  : 'text-purple-300 hover:bg-purple-900/20'
              }`}
            >
              <div className="font-medium text-sm">
                {category.replace('_', ' ')}
              </div>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {displayCommands.length > 0 ? (
            <div className="space-y-1">
              {displayCommands.map((command) => (
                <div
                  key={command.id}
                  className={`group rounded-lg transition-all duration-200 ${
                    selectedCommand?.id === command.id
                      ? 'bg-purple-600/20 border border-purple-500/30'
                      : 'hover:bg-purple-900/20'
                  }`}
                >
                  <button
                    onClick={() => handleCommandClick(command)}
                    className="w-full text-left px-3 py-2"
                  >
                    <div className="font-medium text-white text-sm">
                      {command.label}
                    </div>
                    <div className="text-purple-400/70 text-xs mt-0.5 line-clamp-1">
                      {command.prompt}
                    </div>
                  </button>
                  <button
                    onClick={() => handleQuickSend(command.prompt)}
                    className="w-full text-center px-3 py-1.5 text-xs text-purple-300 hover:text-white border-t border-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Quick Send ➤
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-purple-400/60">
              No commands found
            </div>
          )}
        </div>
      </div>

      {selectedCommand && (
        <div className="border-t border-purple-500/20 p-4 bg-purple-900/20">
          <div className="mb-2 text-xs text-purple-300 font-medium">
            Edit prompt before sending:
          </div>
          <textarea
            value={editablePrompt}
            onChange={(e) => setEditablePrompt(e.target.value)}
            className="w-full bg-purple-900/30 border border-purple-500/30 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20"
            rows="3"
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleSendCommand}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:shadow-lg hover:shadow-purple-500/50 text-white rounded-lg font-medium transition-all duration-200"
            >
              Send Command
            </button>
            <button
              onClick={() => {
                setSelectedCommand(null);
                setEditablePrompt('');
              }}
              className="px-4 py-2 bg-purple-900/30 hover:bg-purple-900/50 text-purple-300 rounded-lg font-medium transition-all duration-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="px-4 py-2 bg-purple-900/30 border-t border-purple-500/20 flex items-center justify-between">
        <span className="text-xs text-purple-400/60">
          {displayCommands.length} commands available
        </span>
        <button
          onClick={onClose}
          className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
        >
          Close (Esc)
        </button>
      </div>
    </div>
  );
}
