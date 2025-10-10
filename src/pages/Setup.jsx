import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import toast from 'react-hot-toast';

export default function Setup() {
  const [tokens, setTokens] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [selectedIssuer, setSelectedIssuer] = useState('');
  const [selectedReceiver, setSelectedReceiver] = useState('');
  const [exportData, setExportData] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [tokensRes, walletsRes, activityRes] = await Promise.all([
        supabase.from('meme_tokens').select('*').order('created_at', { ascending: false }),
        supabase.from('wallets').select('*').order('created_at', { ascending: false }),
        supabase.from('activity_logs').select('*').order('created_at', { ascending: false })
      ]);

      if (tokensRes.error) throw tokensRes.error;
      if (walletsRes.error) throw walletsRes.error;
      if (activityRes.error) throw activityRes.error;

      setTokens(tokensRes.data || []);
      setWallets(walletsRes.data || []);
      setActivityLogs(activityRes.data || []);

      if (walletsRes.data && walletsRes.data.length >= 2) {
        setSelectedIssuer(walletsRes.data[0]?.id || '');
        setSelectedReceiver(walletsRes.data[1]?.id || '');
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    }
  };

  const saveSettings = async () => {
    if (!selectedIssuer || !selectedReceiver) {
      toast.error('Please select both issuer and receiver wallets');
      return;
    }

    if (selectedIssuer === selectedReceiver) {
      toast.error('Issuer and receiver must be different wallets');
      return;
    }

    try {
      localStorage.setItem('memekings_issuer', selectedIssuer);
      localStorage.setItem('memekings_receiver', selectedReceiver);
      toast.success('Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    }
  };

  const exportAllData = async () => {
    try {
      const data = {
        tokens,
        wallets: wallets.map(w => ({
          ...w,
          encrypted_seed: w.encrypted_seed ? '***ENCRYPTED***' : null
        })),
        activityLogs,
        settings: {
          issuer: selectedIssuer,
          receiver: selectedReceiver
        },
        stats: {
          totalTokens: tokens.length,
          totalWallets: wallets.length,
          totalActivities: activityLogs.length,
          activePools: tokens.filter(t => t.amm_pool_created).length,
          totalXRPLocked: tokens.reduce((sum, t) => sum + (t.amm_xrp_amount || 0), 0)
        },
        exportDate: new Date().toISOString(),
        version: '2.0'
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `memekings-export-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Data exported successfully!');
    } catch (error) {
      console.error('Error exporting data:', error);
      toast.error('Failed to export data');
    }
  };

  const exportTokensCSV = () => {
    try {
      const headers = ['Token Name', 'Issuer Address', 'Supply', 'Market Cap (XRP)', 'XRP Locked', 'Status', 'Created'];
      const rows = tokens.map(t => {
        const marketCap = t.amm_pool_created && t.amm_xrp_amount && t.amm_asset_amount
          ? (t.supply * (t.amm_xrp_amount / t.amm_asset_amount)).toFixed(4)
          : '0';
        return [
          t.token_name,
          t.issuer_address,
          t.supply,
          marketCap,
          t.amm_xrp_amount || 0,
          t.amm_pool_created ? 'Active' : 'Pending',
          new Date(t.created_at).toLocaleString()
        ];
      });

      const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `memekings-tokens-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Tokens exported to CSV!');
    } catch (error) {
      console.error('Error exporting CSV:', error);
      toast.error('Failed to export CSV');
    }
  };

  const importData = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.tokens) {
        throw new Error('Invalid data format - missing tokens');
      }

      const activityCount = data.activityLogs?.length || 0;
      const walletsCount = data.wallets?.length || 0;

      const confirmed = confirm(
        `Import Data Summary:\n` +
        `• ${data.tokens.length} tokens\n` +
        `• ${walletsCount} wallets\n` +
        `• ${activityCount} activity logs\n\n` +
        `This will add to your existing data. Continue?`
      );

      if (!confirmed) return;

      const promises = [];

      if (data.tokens && data.tokens.length > 0) {
        promises.push(
          supabase.from('meme_tokens').upsert(data.tokens, { onConflict: 'id' })
        );
      }

      if (data.wallets && data.wallets.length > 0) {
        promises.push(
          supabase.from('wallets').upsert(data.wallets, { onConflict: 'id' })
        );
      }

      if (data.activityLogs && data.activityLogs.length > 0) {
        promises.push(
          supabase.from('activity_logs').upsert(data.activityLogs, { onConflict: 'id' })
        );
      }

      const results = await Promise.all(promises);
      const errors = results.filter(r => r.error);

      if (errors.length > 0) {
        throw new Error('Some imports failed: ' + errors.map(e => e.error.message).join(', '));
      }

      toast.success(
        `Imported successfully!\n` +
        `${data.tokens.length} tokens, ${walletsCount} wallets, ${activityCount} activities`
      );
      loadData();
    } catch (error) {
      console.error('Error importing data:', error);
      toast.error('Failed to import data: ' + error.message);
    }
  };

  const clearAllData = async () => {
    const confirmed = confirm(
      'WARNING: This will delete ALL tokens, wallets, and activity logs!\n\nThis action cannot be undone. Are you sure?'
    );

    if (!confirmed) return;

    const doubleConfirm = confirm('Are you ABSOLUTELY sure? This will delete everything!');
    if (!doubleConfirm) return;

    try {
      await Promise.all([
        supabase.from('meme_tokens').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
        supabase.from('wallets').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
        supabase.from('activity_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      ]);

      localStorage.clear();
      toast.success('All data cleared!');
      loadData();
    } catch (error) {
      console.error('Error clearing data:', error);
      toast.error('Failed to clear data');
    }
  };

  const issuerWallet = wallets.find(w => w.id === selectedIssuer);
  const receiverWallet = wallets.find(w => w.id === selectedReceiver);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-purple-200">Setup & Configuration</h2>
        <p className="text-purple-400 mt-1">Manage your MEMEKINGS settings and data</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass rounded-lg p-6">
          <h3 className="text-xl font-bold text-purple-200 mb-4">Token Creation Wallets</h3>
          <p className="text-purple-400 text-sm mb-4">
            Default wallets used for automatic token creation
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-purple-300 mb-2">Issuer Wallet (Creates Tokens)</label>
              <div className="input w-full text-purple-400 bg-purple-900/20 cursor-not-allowed">
                {issuerWallet ? `${issuerWallet.address}` : 'No issuer wallet set'}
              </div>
              {issuerWallet && (
                <div className="mt-2 text-xs text-purple-400">
                  Balance: {issuerWallet.balance_xrp || 0} XRP
                </div>
              )}
            </div>

            <div>
              <label className="block text-purple-300 mb-2">Receiver Wallet (Receives Tokens)</label>
              <div className="input w-full text-purple-400 bg-purple-900/20 cursor-not-allowed">
                {receiverWallet ? `${receiverWallet.address}` : 'No receiver wallet set'}
              </div>
              {receiverWallet && (
                <div className="mt-2 text-xs text-purple-400">
                  Balance: {receiverWallet.balance_xrp || 0} XRP
                </div>
              )}
            </div>

            {wallets.length < 2 && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <div className="flex gap-3">
                  <div className="text-yellow-400 text-xl">⚠️</div>
                  <div className="flex-1 text-yellow-200 text-sm">
                    You need at least 2 wallets to create tokens. Go to Wallet Management to add or generate wallets.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="glass rounded-lg p-6">
          <h3 className="text-xl font-bold text-purple-200 mb-4">Data Statistics</h3>
          <div className="space-y-4">
            <div className="p-4 bg-purple-900/20 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-purple-300">Total Tokens</span>
                <span className="text-2xl font-bold text-purple-200">{tokens.length}</span>
              </div>
            </div>

            <div className="p-4 bg-purple-900/20 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-purple-300">Total Wallets</span>
                <span className="text-2xl font-bold text-purple-200">{wallets.length}</span>
              </div>
            </div>

            <div className="p-4 bg-purple-900/20 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-purple-300">Active Pools</span>
                <span className="text-2xl font-bold text-purple-200">
                  {tokens.filter(t => t.amm_pool_created).length}
                </span>
              </div>
            </div>

            <div className="p-4 bg-purple-900/20 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-purple-300">Total XRP Locked</span>
                <span className="text-2xl font-bold text-purple-200">
                  {tokens.reduce((sum, t) => sum + (t.amm_xrp_amount || 0), 0).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="p-4 bg-purple-900/20 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-purple-300">Activity Logs</span>
                <span className="text-2xl font-bold text-purple-200">{activityLogs.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="glass rounded-lg p-6">
        <h3 className="text-xl font-bold text-purple-200 mb-4">Export Data</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={exportAllData}
            className="btn-primary text-white px-6 py-3 rounded-lg font-medium"
          >
            📦 Export All Data (JSON)
          </button>
          <button
            onClick={exportTokensCSV}
            className="btn text-purple-300 px-6 py-3 rounded-lg font-medium"
          >
            📊 Export Tokens (CSV)
          </button>
          <button
            onClick={() => {
              const data = JSON.stringify(wallets, null, 2);
              const blob = new Blob([data], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `wallets-${Date.now()}.json`;
              a.click();
              URL.revokeObjectURL(url);
              toast.success('Wallets exported!');
            }}
            className="btn text-purple-300 px-6 py-3 rounded-lg font-medium"
          >
            💼 Export Wallets (JSON)
          </button>
          <button
            onClick={() => {
              const data = JSON.stringify(activityLogs, null, 2);
              const blob = new Blob([data], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `activity-logs-${Date.now()}.json`;
              a.click();
              URL.revokeObjectURL(url);
              toast.success('Activity logs exported!');
            }}
            className="btn text-purple-300 px-6 py-3 rounded-lg font-medium"
          >
            📜 Export Activity Logs (JSON)
          </button>
        </div>
        <p className="text-purple-400 text-sm mt-3">
          Export your data for backup or migration purposes. "Export All Data" includes everything.
        </p>
      </div>

      <div className="glass rounded-lg p-6">
        <h3 className="text-xl font-bold text-purple-200 mb-4">Import Data</h3>
        <div className="space-y-4">
          <div>
            <label className="btn text-purple-300 px-6 py-3 rounded-lg font-medium cursor-pointer inline-block">
              📥 Import JSON File
              <input
                type="file"
                accept=".json"
                onChange={importData}
                className="hidden"
              />
            </label>
          </div>
          <p className="text-purple-400 text-sm">
            Import previously exported data. This will add to your existing data without deleting anything.
          </p>
        </div>
      </div>

      <div className="glass rounded-lg p-6 border-2 border-red-500/30">
        <h3 className="text-xl font-bold text-red-400 mb-4">Danger Zone</h3>
        <div className="space-y-4">
          <div className="bg-red-500/10 rounded-lg p-4">
            <h4 className="text-red-300 font-bold mb-2">Clear All Data</h4>
            <p className="text-red-200/80 text-sm mb-3">
              This will permanently delete all tokens, wallets, and settings. This action cannot be undone!
            </p>
            <button
              onClick={clearAllData}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium"
            >
              🗑️ Clear All Data
            </button>
          </div>
        </div>
      </div>

      <div className="glass rounded-lg p-6">
        <h3 className="text-xl font-bold text-purple-200 mb-4">Local Storage Info</h3>
        <div className="space-y-2 text-sm text-purple-300">
          <p>• Wallet settings are saved locally in your browser</p>
          <p>• Token and wallet data is stored in Supabase database</p>
          <p>• Export your data regularly for backup</p>
          <p>• Clearing browser data will remove local settings only</p>
        </div>
      </div>
    </div>
  );
}
