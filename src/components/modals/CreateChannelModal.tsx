import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Hash, Lock, CheckSquare, Square, Plus } from 'lucide-react';
import { Channel, ServerMember } from '../../types/database';

interface CreateChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  serverId: string;
  userId: string;
  members: ServerMember[];
  onChannelCreated: (channel: Channel) => void;
}

export const CreateChannelModal: React.FC<CreateChannelModalProps> = ({
  isOpen,
  onClose,
  serverId,
  userId,
  members,
  onChannelCreated,
}) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([userId]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleMember = (memberId: string) => {
    if (memberId === userId) return; // Always keep creator
    setSelectedMemberIds((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Channel frequency name is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/servers/${serverId}/channels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          type,
          user_id: userId,
          member_ids: type === 'PRIVATE' ? selectedMemberIds : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create channel');
      }

      onChannelCreated(data);
      setName('');
      setType('PUBLIC');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error creating channel');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="CREATE CHANNEL"
      subtitle="Establish new voice frequency"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-[#FFE8EC] border-2 border-[#FF304F] text-[#FF304F] text-xs font-bold uppercase shadow-[2px_2px_0px_#0A0A0A]">
            {error}
          </div>
        )}

        <div className="space-y-1">
          <label className="text-xs uppercase font-bold text-[#0A0A0A]">Channel Name *</label>
          <div className="relative flex items-center">
            <span className="absolute left-3 text-[#0A0A0A] font-bold text-sm">
              {type === 'PUBLIC' ? '#' : '🔒'}
            </span>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
              placeholder="e.g. project-team, recon, field-ops"
              className="w-full bg-[#F5F2E8] border-2 border-[#0A0A0A] pl-9 pr-3 py-2 text-sm text-[#0A0A0A] font-mono font-bold lowercase focus:outline-none shadow-[2px_2px_0px_#0A0A0A]"
            />
          </div>
        </div>

        <div className="space-y-2 pt-1">
          <label className="text-xs uppercase font-bold text-[#0A0A0A]">Channel Type</label>

          <div className="grid grid-cols-1 gap-2">
            {/* PUBLIC OPTION */}
            <div
              onClick={() => setType('PUBLIC')}
              className={`p-3 border-2 border-[#0A0A0A] cursor-pointer transition-all ${
                type === 'PUBLIC'
                  ? 'bg-[#0A0A0A] text-[#FFFFFF] shadow-[3px_3px_0px_#0A0A0A]'
                  : 'bg-[#FFFFFF] text-[#0A0A0A] hover:bg-[#F5F2E8]'
              }`}
            >
              <div className="flex items-center gap-2 font-pixel text-xs font-bold uppercase">
                <Hash size={14} className={type === 'PUBLIC' ? 'text-[#39FF14]' : 'text-[#0A0A0A]'} />
                <span>PUBLIC</span>
              </div>
              <p className={`text-[11px] font-mono mt-1 ${type === 'PUBLIC' ? 'text-[#FFFFFF]/80' : 'text-[#0A0A0A]/70'}`}>
                Everyone in this server can view and transmit on this channel.
              </p>
            </div>

            {/* PRIVATE OPTION */}
            <div
              onClick={() => setType('PRIVATE')}
              className={`p-3 border-2 border-[#0A0A0A] cursor-pointer transition-all ${
                type === 'PRIVATE'
                  ? 'bg-[#0A0A0A] text-[#FFFFFF] shadow-[3px_3px_0px_#0A0A0A]'
                  : 'bg-[#FFFFFF] text-[#0A0A0A] hover:bg-[#F5F2E8]'
              }`}
            >
              <div className="flex items-center gap-2 font-pixel text-xs font-bold uppercase">
                <Lock size={14} className={type === 'PRIVATE' ? 'text-[#FFD400]' : 'text-[#0A0A0A]'} />
                <span>PRIVATE / ENCRYPTED</span>
              </div>
              <p className={`text-[11px] font-mono mt-1 ${type === 'PRIVATE' ? 'text-[#FFFFFF]/80' : 'text-[#0A0A0A]/70'}`}>
                Only selected operators can view or transmit on this channel.
              </p>
            </div>
          </div>
        </div>

        {/* Member selection if private channel */}
        {type === 'PRIVATE' && (
          <div className="space-y-2 pt-2 border-t-2 border-[#0A0A0A]">
            <label className="text-xs uppercase text-[#0A0A0A] font-pixel font-bold flex items-center gap-1.5">
              <Lock size={12} />
              <span>SELECT AUTHORIZED MEMBERS ({selectedMemberIds.length})</span>
            </label>

            <div className="max-h-40 overflow-y-auto space-y-1.5 p-2 bg-[#F5F2E8] border-2 border-[#0A0A0A] shadow-[2px_2px_0px_#0A0A0A]">
              {members.map((m) => {
                const isSelected = selectedMemberIds.includes(m.user_id);
                const isCreator = m.user_id === userId;
                return (
                  <div
                    key={m.user_id}
                    onClick={() => !isCreator && toggleMember(m.user_id)}
                    className={`flex items-center justify-between p-2 border-2 border-[#0A0A0A] cursor-pointer ${
                      isSelected
                        ? 'bg-[#0A0A0A] text-[#FFFFFF] shadow-[2px_2px_0px_#0A0A0A]'
                        : 'bg-[#FFFFFF] text-[#0A0A0A] hover:bg-[#F5F2E8]'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs font-bold">
                      {isSelected ? (
                        <CheckSquare size={14} className="text-[#39FF14]" />
                      ) : (
                        <Square size={14} className="text-[#0A0A0A]" />
                      )}
                      <span>{m.profile?.display_name || m.profile?.username || 'Operator'}</span>
                      {isCreator && (
                        <span className="text-[10px] text-[#FFD400] font-mono font-bold">(CREATOR)</span>
                      )}
                    </div>
                    <span className="text-[10px] uppercase font-mono font-bold">
                      {m.role}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          id="submit-create-channel-btn"
          className="w-full retro-btn retro-btn-green py-3 text-sm font-black flex items-center justify-center gap-2 shadow-[4px_4px_0px_#0A0A0A] active:translate-y-1"
        >
          <Plus size={16} />
          <span>{loading ? 'CREATING...' : type === 'PRIVATE' ? 'CREATE PRIVATE CHANNEL' : 'CREATE CHANNEL'}</span>
        </button>
      </form>
    </Modal>
  );
};
