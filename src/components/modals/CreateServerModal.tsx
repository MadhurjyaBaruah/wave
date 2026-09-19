import React, { useState, useRef, useCallback } from 'react';
import { Modal } from '../ui/Modal';
import { Radio, Plus, AlertTriangle } from 'lucide-react';
import { Server, Channel } from '../../types/database';

interface CreateServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onServerCreated: (server: Server, channels: Channel[]) => void;
  /** Called when DB sync succeeds — replaces localId server with real DB server */
  onServerSynced?: (localId: string, realServer: Server, realChannels: Channel[]) => void;
}

function makeLocalServer(name: string, description: string, ownerId: string): Server {
  const id = 'srv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const inviteCode = 'WAVE-' + Math.random().toString(36).substring(2, 8).toUpperCase();
  return {
    id,
    name: name.trim().toUpperCase(),
    description: description.trim(),
    owner_id: ownerId,
    invite_code: inviteCode,
    created_at: new Date().toISOString(),
  };
}

function makeLocalChannel(serverId: string): Channel {
  return {
    id: 'chn_' + Math.random().toString(36).substring(2, 9),
    server_id: serverId,
    name: 'general-dispatch',
    type: 'PUBLIC',
    created_at: new Date().toISOString(),
  };
}

export const CreateServerModal: React.FC<CreateServerModalProps> = ({
  isOpen,
  onClose,
  userId,
  onServerCreated,
  onServerSynced,
}) => {

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanup = useCallback(() => {
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Server frequency name is required');
      return;
    }

    cleanup();
    setLoading(true);
    setError(null);

    // --- OPTIMISTIC / LOCAL-FIRST ---
    // Create server in memory immediately so the user never gets stuck
    const localServer = makeLocalServer(trimmedName, description, userId);
    const localChannel = makeLocalChannel(localServer.id);

    // Fire-and-forget: sync to DB in background
    const controller = new AbortController();
    abortRef.current = controller;

    timeoutRef.current = setTimeout(() => {
      controller.abort();
    }, 12000);

    // Immediately give the user their server (optimistic)
    onServerCreated(localServer, [localChannel]);
    onClose();

    // Then sync to database in the background silently
    fetch('/api/servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        name: trimmedName,
        description: description.trim(),
        owner_id: userId,
      }),
    })
      .then(async (res) => {
        cleanup();
        if (res.ok) {
          try {
            const data = await res.json();
            if (data?.server && onServerSynced) {
              // Replace local optimistic server with real DB server
              onServerSynced(localServer.id, data.server, data.channels ?? [localChannel]);
            }
          } catch {
            // JSON parse failure — DB sync happened but response was malformed
          }
        } else {
          const text = await res.text().catch(() => '');
          console.warn('[WAVE] Server sync to DB failed:', res.status, text.slice(0, 200));
        }
      })
      .catch((err) => {
        cleanup();
        if (err?.name !== 'AbortError') {
          console.warn('[WAVE] Server sync to DB error (server will be local only this session):', err?.message || err);
        }
      });

    // Reset form for next time
    setName('');
    setDescription('');
    setLoading(false);
  };


  const handleClose = () => {
    cleanup();
    setLoading(false);
    setError(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="CREATE A SERVER"
      subtitle="Establish new radio frequency group"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-[#FFE8EC] border-2 border-[#FF304F] text-[#FF304F] text-xs font-bold uppercase shadow-[2px_2px_0px_#0A0A0A] flex items-start gap-2">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span>{error}</span>
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
            disabled={loading}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. CSE SQUAD, TACTICAL COMM, SATELLITE 9"
            className="w-full bg-[#F5F2E8] border-2 border-[#0A0A0A] px-3 py-2 text-sm text-[#0A0A0A] font-bold font-mono uppercase focus:outline-none shadow-[2px_2px_0px_#0A0A0A] disabled:opacity-50"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs uppercase font-bold text-[#0A0A0A]">
            Description (Optional)
          </label>
          <textarea
            rows={2}
            value={description}
            disabled={loading}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief purpose of this communication server..."
            className="w-full bg-[#F5F2E8] border-2 border-[#0A0A0A] px-3 py-2 text-sm text-[#0A0A0A] font-bold font-mono focus:outline-none resize-none shadow-[2px_2px_0px_#0A0A0A] disabled:opacity-50"
          />
        </div>

        <div className="p-3 bg-[#F5F2E8] border-2 border-[#0A0A0A] text-xs text-[#0A0A0A] space-y-1 font-bold">
          <p className="text-[#0A0A0A] font-black uppercase">AUTOMATIC PROVISIONING:</p>
          <p>• Creates default public channel: <span className="text-[#0A0A0A] underline">#general-dispatch</span></p>
          <p>• Generates unique invite code for team members</p>
        </div>

        <button
          type="submit"
          disabled={loading || !name.trim()}
          id="submit-create-server-btn"
          className="w-full retro-btn retro-btn-green py-3 text-sm font-black flex items-center justify-center gap-2 shadow-[4px_4px_0px_#0A0A0A] active:translate-y-1 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Plus size={16} />
          <span>{loading ? 'CREATING...' : 'CREATE SERVER'}</span>
        </button>
      </form>
    </Modal>
  );
};
