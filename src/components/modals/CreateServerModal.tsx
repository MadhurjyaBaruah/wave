import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Radio, Plus } from 'lucide-react';
import { Server, Channel } from '../../types/database';
import { fetchJson } from '../../lib/api';

interface CreateServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onServerCreated: (server: Server, channels: Channel[]) => void;
}

export const CreateServerModal: React.FC<CreateServerModalProps> = ({
  isOpen,
  onClose,
  userId,
  onServerCreated,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Server frequency name is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await fetchJson<{ server: Server; channels: Channel[] }>('/api/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          owner_id: userId,
        }),
      });

      onServerCreated(data.server, data.channels);
      setName('');
      setDescription('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error creating server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="CREATE A SERVER"
      subtitle="Establish new radio frequency group"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-[#FFE8EC] border-2 border-[#FF304F] text-[#FF304F] text-xs font-bold uppercase shadow-[2px_2px_0px_#0A0A0A]">
            {error}
          </div>
        )}

        <div className="space-y-1">
          <label className="text-xs uppercase font-bold text-[#0A0A0A] flex items-center gap-1.5">
            <Radio size={13} />
            <span>Server Name *</span>
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. CSE SQUAD, TACTICAL COMM, SATELLITE 9"
            className="w-full bg-[#F5F2E8] border-2 border-[#0A0A0A] px-3 py-2 text-sm text-[#0A0A0A] font-bold font-mono uppercase focus:outline-none shadow-[2px_2px_0px_#0A0A0A]"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs uppercase font-bold text-[#0A0A0A]">
            Description (Optional)
          </label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief purpose of this communication server..."
            className="w-full bg-[#F5F2E8] border-2 border-[#0A0A0A] px-3 py-2 text-sm text-[#0A0A0A] font-bold font-mono focus:outline-none resize-none shadow-[2px_2px_0px_#0A0A0A]"
          />
        </div>

        <div className="p-3 bg-[#F5F2E8] border-2 border-[#0A0A0A] text-xs text-[#0A0A0A] space-y-1 font-bold">
          <p className="text-[#0A0A0A] font-black uppercase">AUTOMATIC PROVISIONING:</p>
          <p>• Creates default public channels: <span className="text-[#0A0A0A] underline">#general</span> & <span className="text-[#0A0A0A] underline">#radio-net</span></p>
          <p>• Generates unique invite code for team members</p>
        </div>

        <button
          type="submit"
          disabled={loading}
          id="submit-create-server-btn"
          className="w-full retro-btn retro-btn-green py-3 text-sm font-black flex items-center justify-center gap-2 shadow-[4px_4px_0px_#0A0A0A] active:translate-y-1"
        >
          <Plus size={16} />
          <span>{loading ? 'ESTABLISHING FREQUENCY...' : 'CREATE SERVER'}</span>
        </button>
      </form>
    </Modal>
  );
};
