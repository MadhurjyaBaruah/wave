import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Radio, ArrowRight } from 'lucide-react';
import { Server } from '../../types/database';
import { fetchJson } from '../../lib/api';

interface JoinServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onServerJoined: (server: Server) => void;
}

export const JoinServerModal: React.FC<JoinServerModalProps> = ({
  isOpen,
  onClose,
  userId,
  onServerJoined,
}) => {
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) {
      setError('Please enter a valid invite code');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await fetchJson<{ server: Server }>('/api/servers/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invite_code: inviteCode.trim(),
          user_id: userId,
        }),
      });

      onServerJoined(data.server);
      setInviteCode('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'SERVER NOT FOUND: This invite code is invalid or expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="JOIN A SERVER"
      subtitle="Connect to an existing WAVE network"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-[#FFE8EC] border-2 border-[#FF304F] text-[#FF304F] text-xs font-mono space-y-1 shadow-[2px_2px_0px_#0A0A0A]">
            <div className="font-bold font-pixel">SERVER NOT FOUND</div>
            <div>{error}</div>
          </div>
        )}

        <div className="space-y-1">
          <label className="text-xs uppercase font-bold text-[#0A0A0A] flex items-center gap-1.5">
            <Radio size={13} />
            <span>Invite Code *</span>
          </label>
          <input
            type="text"
            required
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            placeholder="e.g. WAVE-TAC01 or WAVE-X7K29P"
            className="w-full bg-[#F5F2E8] border-2 border-[#0A0A0A] px-3 py-2 text-sm text-[#0A0A0A] font-mono font-bold tracking-widest uppercase focus:outline-none shadow-[2px_2px_0px_#0A0A0A]"
          />
        </div>

        <div className="p-3 bg-[#F5F2E8] border-2 border-[#0A0A0A] text-xs text-[#0A0A0A] font-bold">
          Invite codes look like <span className="underline">WAVE-XXXXXX</span>. Ask the server owner or administrator for their code.
        </div>

        <button
          type="submit"
          disabled={loading}
          id="submit-join-server-btn"
          className="w-full retro-btn retro-btn-green py-3 text-sm font-black flex items-center justify-center gap-2 shadow-[4px_4px_0px_#0A0A0A] active:translate-y-1"
        >
          <ArrowRight size={16} />
          <span>{loading ? 'CONNECTING TO FREQUENCY...' : 'JOIN SERVER'}</span>
        </button>
      </form>
    </Modal>
  );
};
