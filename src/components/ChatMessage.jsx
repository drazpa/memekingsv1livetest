import { useState } from 'react';
import { XRPScanLink } from './XRPScanLink';
import ExecutionCard from './ExecutionCard';
import ExecutionResult from './ExecutionResult';
import * as executionHandlers from '../utils/executionHandlers';
import toast from 'react-hot-toast';

export default function ChatMessage({ message, onAddResult }) {
  const isUser = message.role === 'user';
  const [copiedId, setCopiedId] = useState(null);
  const [executionResult, setExecutionResult] = useState(null);

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const renderActionButtons = () => {
    if (!message.data?.actions) return null;

    return (
      <div className="mt-4 flex flex-wrap gap-2">
        {message.data.actions.map((action, index) => (
          <button
            key={index}
            onClick={() => action.onClick()}
            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
              action.style === 'primary'
                ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:shadow-lg hover:shadow-purple-500/50'
                : action.style === 'danger'
                ? 'bg-red-600/20 text-red-300 border border-red-500/30 hover:bg-red-600/30'
                : 'bg-purple-600/20 text-purple-300 border border-purple-500/30 hover:bg-purple-600/30'
            }`}
          >
            {action.icon && <span className="mr-2">{action.icon}</span>}
            {action.label}
          </button>
        ))}
      </div>
    );
  };

  const renderDataCard = () => {
    if (!message.data?.card) return null;

    const { card } = message.data;

    return (
      <div className="mt-4 glass rounded-lg p-4 border border-purple-500/20">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            {card.icon && <span className="text-2xl">{card.icon}</span>}
            <h3 className="text-lg font-bold text-white">{card.title}</h3>
          </div>
          {card.badge && (
            <span className="px-2 py-1 bg-purple-600/30 text-purple-200 rounded text-xs font-medium">
              {card.badge}
            </span>
          )}
        </div>

        {card.items && (
          <div className="space-y-2">
            {card.items.map((item, index) => (
              <div key={index} className="flex justify-between items-center">
                <span className="text-purple-300/80 text-sm">{item.label}</span>
                <span className="text-white font-medium">{item.value}</span>
              </div>
            ))}
          </div>
        )}

        {card.description && (
          <p className="text-purple-300/70 text-sm mt-3">{card.description}</p>
        )}

        {card.link && (
          <div className="mt-3">
            <XRPScanLink type={card.link.type} value={card.link.value} network="mainnet" />
          </div>
        )}
      </div>
    );
  };

  const renderTable = () => {
    if (!message.data?.table) return null;

    const { table } = message.data;

    return (
      <div className="mt-4 glass rounded-lg overflow-hidden border border-purple-500/20">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-purple-900/30 border-b border-purple-500/20">
                {table.headers.map((header, index) => (
                  <th
                    key={index}
                    className="px-4 py-3 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className="border-b border-purple-500/10 hover:bg-purple-900/20 transition-colors"
                >
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-4 py-3 text-sm text-white">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderQuickActions = () => {
    if (!message.data?.quickActions) return null;

    return (
      <div className="mt-4 flex flex-wrap gap-2">
        {message.data.quickActions.map((action, index) => (
          <button
            key={index}
            onClick={() => action.onClick()}
            className="px-3 py-1.5 bg-purple-900/30 hover:bg-purple-900/50 text-purple-200 rounded-full text-xs font-medium transition-all duration-200 border border-purple-500/20"
          >
            {action.label}
          </button>
        ))}
      </div>
    );
  };

  const handleExecute = async (formData) => {
    const execution = message.data.execution;

    try {
      let result;

      switch (execution.type) {
        case 'send_xrp':
          result = await executionHandlers.executeSendXRP(formData);
          break;
        case 'send_token':
          result = await executionHandlers.executeSendToken(formData);
          break;
        case 'setup_trustline':
          result = await executionHandlers.executeSetupTrustline(formData);
          break;
        case 'buy_token':
          result = await executionHandlers.executeBuyToken(formData);
          break;
        case 'sell_token':
          result = await executionHandlers.executeSellToken(formData);
          break;
        case 'create_bot':
          result = await executionHandlers.executeCreateTradingBot(formData);
          break;
        default:
          throw new Error('Unknown execution type');
      }

      setExecutionResult(result);
      toast.success(result.message);

      if (onAddResult) {
        onAddResult(result);
      }
    } catch (error) {
      const errorResult = {
        status: 'error',
        title: 'Execution Failed',
        message: error.message || 'An error occurred during execution',
        data: null
      };
      setExecutionResult(errorResult);
      toast.error(error.message);
    }
  };

  const renderExecution = () => {
    if (!message.data?.execution) return null;

    return (
      <>
        <ExecutionCard
          execution={message.data.execution}
          onExecute={handleExecute}
        />
        {executionResult && <ExecutionResult result={executionResult} />}
      </>
    );
  };

  const formatContent = (text) => {
    return text.split('\n').map((line, index) => {
      if (line.startsWith('•')) {
        return (
          <li key={index} className="ml-4">
            {line.substring(1).trim()}
          </li>
        );
      }
      return line ? <p key={index}>{line}</p> : <br key={index} />;
    });
  };

  return (
    <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser
            ? 'bg-gradient-to-br from-green-500 to-emerald-600'
            : 'bg-gradient-to-br from-purple-500 to-blue-600'
        }`}
      >
        <span className="text-sm">{isUser ? '👤' : '🤖'}</span>
      </div>

      <div className={`flex-1 max-w-3xl ${isUser ? 'flex justify-end' : ''}`}>
        <div
          className={`rounded-lg p-4 ${
            isUser
              ? 'bg-gradient-to-br from-green-600/20 to-emerald-600/20 border border-green-500/20'
              : 'bg-purple-900/30 border border-purple-500/20'
          }`}
        >
          <div className={`text-sm ${isUser ? 'text-white' : 'text-purple-100'} space-y-2`}>
            {formatContent(message.content)}
          </div>

          {!isUser && (
            <>
              {renderDataCard()}
              {renderTable()}
              {renderExecution()}
              {renderActionButtons()}
              {renderQuickActions()}
            </>
          )}

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-purple-500/10">
            <span className="text-xs text-purple-400/60">
              {message.timestamp.toLocaleTimeString()}
            </span>
            <button
              onClick={() => handleCopy(message.content, message.id)}
              className="text-xs text-purple-400/60 hover:text-purple-300 transition-colors"
            >
              {copiedId === message.id ? '✓ Copied' : '📋 Copy'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
