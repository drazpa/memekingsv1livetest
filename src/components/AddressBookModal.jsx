import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import toast from 'react-hot-toast';

export default function AddressBookModal({ isOpen, onClose, onSelectAddress, walletAddress }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingContact, setEditingContact] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    notes: '',
    is_favorite: false
  });

  useEffect(() => {
    if (isOpen && walletAddress) {
      loadContacts();
    }
  }, [isOpen, walletAddress]);

  const loadContacts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('address_book')
        .select('*')
        .eq('wallet_address', walletAddress)
        .order('is_favorite', { ascending: false })
        .order('name', { ascending: true });

      if (error) throw error;
      setContacts(data || []);
    } catch (error) {
      console.error('Error loading contacts:', error);
      toast.error('Failed to load address book');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (!formData.name || !formData.address) {
        toast.error('Name and address are required');
        return;
      }

      if (editingContact) {
        const { error } = await supabase
          .from('address_book')
          .update({
            name: formData.name,
            address: formData.address,
            notes: formData.notes,
            is_favorite: formData.is_favorite
          })
          .eq('id', editingContact.id);

        if (error) throw error;
        toast.success('Contact updated successfully');
      } else {
        const { error } = await supabase
          .from('address_book')
          .insert({
            wallet_address: walletAddress,
            name: formData.name,
            address: formData.address,
            notes: formData.notes,
            is_favorite: formData.is_favorite
          });

        if (error) throw error;
        toast.success('Contact added successfully');
      }

      setShowForm(false);
      setEditingContact(null);
      setFormData({ name: '', address: '', notes: '', is_favorite: false });
      loadContacts();
    } catch (error) {
      console.error('Error saving contact:', error);
      toast.error('Failed to save contact');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this contact?')) return;

    try {
      const { error } = await supabase
        .from('address_book')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Contact deleted');
      loadContacts();
    } catch (error) {
      console.error('Error deleting contact:', error);
      toast.error('Failed to delete contact');
    }
  };

  const handleEdit = (contact) => {
    setEditingContact(contact);
    setFormData({
      name: contact.name,
      address: contact.address,
      notes: contact.notes || '',
      is_favorite: contact.is_favorite
    });
    setShowForm(true);
  };

  const toggleFavorite = async (contact) => {
    try {
      const { error } = await supabase
        .from('address_book')
        .update({ is_favorite: !contact.is_favorite })
        .eq('id', contact.id);

      if (error) throw error;
      loadContacts();
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast.error('Failed to update favorite');
    }
  };

  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] rounded-xl overflow-hidden border border-purple-500/40"
        style={{
          background: 'linear-gradient(135deg, rgba(88, 28, 135, 0.98), rgba(59, 7, 100, 0.98))',
          backdropFilter: 'blur(20px)'
        }}
      >
        <div className="p-6 border-b border-purple-500/30 bg-purple-900/40">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-white">📇 Address Book</h2>
            <button
              onClick={onClose}
              className="text-purple-300 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search contacts..."
            className="w-full bg-purple-950/60 border border-purple-500/40 rounded-lg px-4 py-2 text-white placeholder-purple-400/60 focus:outline-none focus:border-purple-400/60 focus:ring-2 focus:ring-purple-500/30"
          />
        </div>

        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
          {showForm ? (
            <div className="space-y-4 mb-6 p-4 bg-purple-900/30 rounded-lg border border-purple-500/30">
              <h3 className="text-lg font-bold text-white">
                {editingContact ? 'Edit Contact' : 'Add New Contact'}
              </h3>
              <div>
                <label className="block text-sm font-medium text-purple-200 mb-1">
                  Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="John Doe"
                  className="w-full bg-purple-950/60 border border-purple-500/40 rounded-lg px-3 py-2 text-white placeholder-purple-400/50 focus:outline-none focus:border-purple-400/60 focus:ring-2 focus:ring-purple-500/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-purple-200 mb-1">
                  XRPL Address <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="rXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                  className="w-full bg-purple-950/60 border border-purple-500/40 rounded-lg px-3 py-2 text-white placeholder-purple-400/50 focus:outline-none focus:border-purple-400/60 focus:ring-2 focus:ring-purple-500/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-purple-200 mb-1">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Optional notes about this contact"
                  className="w-full bg-purple-950/60 border border-purple-500/40 rounded-lg px-3 py-2 text-white placeholder-purple-400/50 focus:outline-none focus:border-purple-400/60 focus:ring-2 focus:ring-purple-500/30 resize-none"
                  rows="2"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_favorite"
                  checked={formData.is_favorite}
                  onChange={(e) => setFormData({ ...formData, is_favorite: e.target.checked })}
                  className="w-4 h-4 text-purple-600 bg-purple-950/60 border-purple-500/40 rounded focus:ring-purple-500/30"
                />
                <label htmlFor="is_favorite" className="text-sm text-purple-200">
                  Mark as favorite
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:shadow-lg hover:shadow-purple-500/50 text-white rounded-lg font-medium transition-all duration-200"
                >
                  {editingContact ? 'Update Contact' : 'Add Contact'}
                </button>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setEditingContact(null);
                    setFormData({ name: '', address: '', notes: '', is_favorite: false });
                  }}
                  className="px-4 py-2 bg-purple-800/40 hover:bg-purple-800/60 text-purple-200 rounded-lg font-medium transition-all duration-200 border border-purple-500/30"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="w-full mb-4 px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:shadow-lg hover:shadow-purple-500/50 text-white rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2"
            >
              <span>➕</span>
              Add New Contact
            </button>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="text-center py-12 text-purple-300/60">
              {searchQuery ? 'No contacts found' : 'No contacts yet. Add your first contact!'}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredContacts.map((contact) => (
                <div
                  key={contact.id}
                  className="p-4 bg-purple-900/30 rounded-lg border border-purple-500/20 hover:border-purple-500/40 transition-all duration-200"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleFavorite(contact)}
                          className="text-xl hover:scale-110 transition-transform"
                        >
                          {contact.is_favorite ? '⭐' : '☆'}
                        </button>
                        <h3 className="text-lg font-bold text-white">{contact.name}</h3>
                      </div>
                      <p className="text-sm text-purple-300/80 mt-1 font-mono break-all">
                        {contact.address}
                      </p>
                      {contact.notes && (
                        <p className="text-sm text-purple-400/60 mt-2">{contact.notes}</p>
                      )}
                    </div>
                    <div className="flex gap-2 ml-4">
                      {onSelectAddress && (
                        <button
                          onClick={() => onSelectAddress(contact)}
                          className="px-3 py-1.5 bg-green-600/30 hover:bg-green-600/50 text-green-200 rounded-lg text-sm font-medium transition-all duration-200 border border-green-500/30"
                        >
                          Select
                        </button>
                      )}
                      <button
                        onClick={() => handleEdit(contact)}
                        className="px-3 py-1.5 bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 rounded-lg text-sm font-medium transition-all duration-200 border border-blue-500/30"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(contact.id)}
                        className="px-3 py-1.5 bg-red-600/30 hover:bg-red-600/50 text-red-200 rounded-lg text-sm font-medium transition-all duration-200 border border-red-500/30"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-purple-500/30 bg-purple-900/40">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-purple-800/40 hover:bg-purple-800/60 text-purple-200 rounded-lg font-medium transition-all duration-200 border border-purple-500/30"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
