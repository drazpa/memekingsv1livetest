import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import toast from 'react-hot-toast';
import TokenIcon from '../components/TokenIcon';

const ACTION_TYPES = {
  token_created: { icon: '🎉', label: 'Token Created', color: 'green' },
  token_sent: { icon: '📤', label: 'Token Sent', color: 'blue' },
  token_received: { icon: '📥', label: 'Token Received', color: 'green' },
  trustline_created: { icon: '🤝', label: 'Trustline Created', color: 'purple' },
  swap_executed: { icon: '💱', label: 'Swap/Trade', color: 'yellow' },
  amm_created: { icon: '🏊', label: 'AMM Pool Created', color: 'cyan' },
  wallet_connected: { icon: '🔗', label: 'Wallet Connected', color: 'green' },
  wallet_disconnected: { icon: '🔌', label: 'Wallet Disconnected', color: 'gray' },
  bot_created: { icon: '🤖', label: 'Bot Created', color: 'blue' },
  bot_started: { icon: '▶️', label: 'Bot Started', color: 'green' },
  bot_stopped: { icon: '⏸️', label: 'Bot Stopped', color: 'orange' }
};

export default function Activity() {
  const [activities, setActivities] = useState([]);
  const [tokens, setTokens] = useState({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [connectedWallet, setConnectedWallet] = useState(null);

  useEffect(() => {
    loadConnectedWallet();
    loadActivities();
  }, []);

  const loadConnectedWallet = () => {
    const stored = localStorage.getItem('connectedWallet');
    if (stored) {
      setConnectedWallet(JSON.parse(stored));
    }
  };

  const loadActivities = async () => {
    try {
      setLoading(true);

      const { data: activityData, error } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      const activities = activityData || [];
      setActivities(activities);

      if (activities.length > 0) {
        const tokenIds = [...new Set(activities.map(a => a.token_id).filter(Boolean))];
        if (tokenIds.length > 0) {
          const { data: tokenData } = await supabase
            .from('meme_tokens')
            .select('id, token_name, currency_code, image_url, issuer_address')
            .in('id', tokenIds);

          const tokenMap = {};
          tokenData?.forEach(token => {
            tokenMap[token.id] = token;
          });
          setTokens(tokenMap);
        }
      }
    } catch (error) {
      console.error('Error loading activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredActivities = activities.filter(activity => {
    if (filter === 'all') return true;
    if (filter === 'mine' && connectedWallet) {
      return activity.user_address === connectedWallet.address;
    }
    return activity.action_type === filter;
  });

  const getActionConfig = (actionType) => {
    return ACTION_TYPES[actionType] || { icon: '📝', label: actionType, color: 'purple' };
  };

  const ActivityCard = ({ activity }) => {
    const config = getActionConfig(activity.action_type);
    const token = activity.token_id ? tokens[activity.token_id] : null;
    const isMyActivity = connectedWallet && activity.user_address === connectedWallet.address;

    return (
      <div className={`glass rounded-lg p-4 hover:bg-purple-900/20 transition-all ${
        isMyActivity ? 'border-l-4 border-green-500' : ''
      }`}>
        <div className="flex items-start gap-4">
          <div className={`text-3xl flex-shrink-0`}>
            {config.icon}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <h3 className="text-purple-200 font-medium">{config.label}</h3>
                <p className="text-purple-400 text-sm mt-1">{activity.description}</p>
              </div>
              <span className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap bg-${config.color}-500/20 text-${config.color}-400`}>
                {config.label}
              </span>
            </div>

            {token && (
              <div className="flex items-center gap-2 mt-3 p-2 bg-purple-900/30 rounded">
                <TokenIcon token={token} size="sm" />
                <span className="text-purple-200 font-medium">{token.token_name}</span>
              </div>
            )}

            {activity.details && Object.keys(activity.details).length > 0 && (
              <div className="mt-3 space-y-1">
                {activity.details.amount && (
                  <div className="text-purple-300 text-sm">
                    Amount: <span className="font-mono">{activity.details.amount}</span>
                  </div>
                )}
                {activity.details.from && (
                  <div className="text-purple-400 text-xs font-mono break-all">
                    From: {activity.details.from}
                  </div>
                )}
                {activity.details.to && (
                  <div className="text-purple-400 text-xs font-mono break-all">
                    To: {activity.details.to}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-purple-500/20">
              <div className="text-purple-500 text-xs">
                {new Date(activity.created_at).toLocaleString()}
              </div>

              {activity.user_address && (
                <a
                  href={`https://testnet.xrpl.org/accounts/${activity.user_address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-400 hover:text-purple-300 text-xs font-mono"
                  title="View wallet on XRPScan"
                >
                  {activity.user_address.slice(0, 8)}...{activity.user_address.slice(-6)}
                </a>
              )}

              {activity.tx_hash && (
                <a
                  href={`https://testnet.xrpl.org/transactions/${activity.tx_hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn text-purple-300 text-xs px-3 py-1 rounded"
                >
                  View on XRPScan
                </a>
              )}

              {isMyActivity && (
                <span className="text-green-400 text-xs font-medium">
                  Your Activity
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-purple-200">Activity</h2>
          <p className="text-purple-400 mt-1">Track all actions and transactions on the platform</p>
        </div>
        <button
          onClick={loadActivities}
          disabled={loading}
          className="btn text-purple-300 px-4 py-2 rounded-lg font-medium disabled:opacity-50"
        >
          {loading ? '🔄 Loading...' : '🔄 Refresh'}
        </button>
      </div>

      <div className="glass rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg transition-all text-sm ${
              filter === 'all' ? 'bg-purple-600 text-white' : 'glass text-purple-300'
            }`}
          >
            All Activity
          </button>
          {connectedWallet && (
            <button
              onClick={() => setFilter('mine')}
              className={`px-4 py-2 rounded-lg transition-all text-sm ${
                filter === 'mine' ? 'bg-green-600 text-white' : 'glass text-purple-300'
              }`}
            >
              My Activity
            </button>
          )}
          {Object.keys(ACTION_TYPES).map(actionType => (
            <button
              key={actionType}
              onClick={() => setFilter(actionType)}
              className={`px-4 py-2 rounded-lg transition-all text-sm ${
                filter === actionType ? 'bg-purple-600 text-white' : 'glass text-purple-300'
              }`}
            >
              {ACTION_TYPES[actionType].icon} {ACTION_TYPES[actionType].label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="glass rounded-lg p-12 text-center">
          <div className="text-4xl mb-4 animate-pulse">⏳</div>
          <div className="text-purple-200 font-medium">Loading activity...</div>
        </div>
      ) : filteredActivities.length > 0 ? (
        <div className="space-y-3">
          {filteredActivities.map((activity) => (
            <ActivityCard key={activity.id} activity={activity} />
          ))}
        </div>
      ) : (
        <div className="glass rounded-lg p-12 text-center">
          <div className="text-6xl mb-4">📭</div>
          <h3 className="text-2xl font-bold text-purple-200 mb-2">No Activity Yet</h3>
          <p className="text-purple-400">
            {filter === 'mine'
              ? 'You haven\'t performed any actions yet'
              : 'No activity found with the selected filter'}
          </p>
        </div>
      )}
    </div>
  );
}
