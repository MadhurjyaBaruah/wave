import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Server, Channel, ServerMember } from '../../types/database';
import { Trash, Copy, Check, Users, Hash, AlertTriangle, Lock } from 'lucide-react';

interface ServerSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  server: Server;
  channels: Channel[];
  members: ServerMember[];
  currentUserId: string;
  isOwner: boolean;
  isAdmin: boolean;
  onServerUpdated: (server: Server) => void;
  onServerDeleted: (serverId: string) => void;
  onChannelDeleted: (channelId: string) => void;
  onMemberKicked: (memberId: string) => void;
}

export const ServerSettingsModal: React.FC<ServerSettingsModalProps> = ({
  isOpen,
  onClose,
  server,
  channels,
  members,
  currentUserId,
  isOwner,
  isAdmin,
  onServerUpdated,
  onServerDeleted,
  onChannelDeleted,
  onMemberKicked,
}) => {
  const [tab, setTab] = useState<'general' | 'channels' | 'members' | 'invite'>('general');
  const [name, setName] = useState(server.name);
  const [description, setDescription] = useState(server.description || '');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmDeleteServer, setConfirmDeleteServer] = useState(false);

  const handleUpdateGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`/api/servers/${server.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          user_id: currentUserId,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        onServerUpdated(updated);
      }
    } catch {}
    setLoading(false);
  };

  const handleDeleteServer = async () => {
    if (!isOwner) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/servers/${server.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUserId }),
      });
      if (res.ok) {
        onServerDeleted(server.id);
        onClose();
      }
    } catch {}
    setLoading(false);
  };

  const handleDeleteChannel = async (channelId: string) => {
    try {
      const res = await fetch(`/api/channels/${channelId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUserId }),
      });
      if (res.ok) {
        onChannelDeleted(channelId);
      }
    } catch {}
  };

  const handleKickMember = async (targetUserId: string) => {
    try {
      const res = await fetch(`/api/servers/${server.id}/members/${targetUserId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUserId }),
      });
      if (res.ok) {
        onMemberKicked(targetUserId);
      }
    } catch {}
  };

  const copyInvite = () => {
    navigator.clipboard.writeText(server.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="SERVER SETTINGS"
      subtitle={`Configure ${server.name}`}
      maxWidth="max-w-2xl"
    >
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Navigation Tabs */}
        <div className="sm:w-48 flex sm:flex-col gap-1 border-b sm:border-b-0 sm:border-r-2 border-[#0A0A0A] pb-3 sm:pb-0 sm:pr-3">
          <button
            type="button"
            onClick={() => setTab('general')}
            className={`p-2.5 text-left text-xs font-bold uppercase border-2 transition-all cursor-pointer ${
              tab === 'general'
                ? 'bg-[#0A0A0A] text-[#FFFFFF] border-[#0A0A0A] shadow-[2px_2px_0px_#0A0A0A]'
                : 'border-transparent text-[#0A0A0A] hover:bg-[#F5F2E8]'
            }`}
          >
            GENERAL
          </button>
          <button
            type="button"
            onClick={() => setTab('channels')}
            className={`p-2.5 text-left text-xs font-bold uppercase border-2 transition-all cursor-pointer ${
              tab === 'channels'
                ? 'bg-[#0A0A0A] text-[#FFFFFF] border-[#0A0A0A] shadow-[2px_2px_0px_#0A0A0A]'
                : 'border-transparent text-[#0A0A0A] hover:bg-[#F5F2E8]'
            }`}
          >
            CHANNELS ({channels.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('members')}
            className={`p-2.5 text-left text-xs font-bold uppercase border-2 transition-all cursor-pointer ${
              tab === 'members'
                ? 'bg-[#0A0A0A] text-[#FFFFFF] border-[#0A0A0A] shadow-[2px_2px_0px_#0A0A0A]'
                : 'border-transparent text-[#0A0A0A] hover:bg-[#F5F2E8]'
            }`}
          >
            MEMBERS ({members.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('invite')}
            className={`p-2.5 text-left text-xs font-bold uppercase border-2 transition-all cursor-pointer ${
              tab === 'invite'
                ? 'bg-[#0A0A0A] text-[#FFFFFF] border-[#0A0A0A] shadow-[2px_2px_0px_#0A0A0A]'
                : 'border-transparent text-[#0A0A0A] hover:bg-[#F5F2E8]'
            }`}
          >
            INVITE CODE
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 space-y-4">
          {tab === 'general' && (
            <form onSubmit={handleUpdateGeneral} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs uppercase font-bold text-[#0A0A0A]">Server Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!isOwner && !isAdmin}
                  className="w-full bg-[#F5F2E8] border-2 border-[#0A0A0A] px-3 py-2 text-sm text-[#0A0A0A] font-bold font-mono uppercase focus:outline-none shadow-[2px_2px_0px_#0A0A0A]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs uppercase font-bold text-[#0A0A0A]">Description</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={!isOwner && !isAdmin}
                  className="w-full bg-[#F5F2E8] border-2 border-[#0A0A0A] px-3 py-2 text-sm text-[#0A0A0A] font-bold font-mono focus:outline-none resize-none shadow-[2px_2px_0px_#0A0A0A]"
                />
              </div>

              {(isOwner || isAdmin) && (
                <button
                  type="submit"
                  disabled={loading}
                  className="retro-btn retro-btn-green px-4 py-2 text-xs font-black shadow-[2px_2px_0px_#0A0A0A] active:translate-y-0.5"
                >
                  SAVE CHANGES
                </button>
              )}

              {/* Danger Zone: Delete Server */}
              {isOwner && (
                <div className="mt-8 pt-4 border-t-2 border-[#FF304F] space-y-3">
                  <h4 className="text-xs font-pixel font-bold text-[#FF304F] flex items-center gap-1.5 uppercase">
                    <AlertTriangle size={14} />
                    <span>DANGER ZONE: DELETE SERVER</span>
                  </h4>
                  <p className="text-xs text-[#0A0A0A]/70 font-bold">
                    Permanently shuts down this server frequency and disconnects all active operators.
                  </p>

                  {!confirmDeleteServer ? (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteServer(true)}
                      className="retro-btn retro-btn-red px-3 py-1.5 text-xs font-black shadow-[2px_2px_0px_#0A0A0A] active:translate-y-0.5"
                    >
                      DELETE SERVER
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleDeleteServer}
                        className="retro-btn bg-[#FF304F] text-[#FFFFFF] border-2 border-[#0A0A0A] px-3 py-1.5 text-xs font-black shadow-[2px_2px_0px_#0A0A0A] active:translate-y-0.5"
                      >
                        CONFIRM PERMANENT DELETION
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteServer(false)}
                        className="retro-btn px-3 py-1.5 text-xs font-bold"
                      >
                        CANCEL
                      </button>
                    </div>
                  )}
                </div>
              )}
            </form>
          )}

          {tab === 'channels' && (
            <div className="space-y-3">
              <div className="text-xs text-[#0A0A0A]/70 font-bold">
                Manage public and private audio frequencies in this server:
              </div>

              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {channels.map((ch) => (
                  <div
                    key={ch.id}
                    className="flex items-center justify-between p-2.5 bg-[#F5F2E8] border-2 border-[#0A0A0A] shadow-[2px_2px_0px_#0A0A0A]"
                  >
                    <div className="flex items-center gap-2 text-xs font-mono">
                      {ch.type === 'PUBLIC' ? (
                        <Hash size={14} className="text-[#0A0A0A]" />
                      ) : (
                        <Lock size={14} className="text-[#FFD400]" />
                      )}
                      <span className="font-bold text-[#0A0A0A]">{ch.name}</span>
                      <span className="text-[10px] text-[#0A0A0A]/60 font-bold uppercase">
                        [{ch.type}]
                      </span>
                    </div>

                    {(isOwner || isAdmin) && channels.length > 1 && (
                      <button
                        onClick={() => handleDeleteChannel(ch.id)}
                        className="p-1 text-[#0A0A0A] hover:text-[#FF304F] border border-transparent hover:border-[#FF304F] cursor-pointer"
                        title="Delete Channel"
                      >
                        <Trash size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'members' && (
            <div className="space-y-3">
              <div className="text-xs text-[#0A0A0A]/70 font-bold">
                Server operators roster and role authorizations:
              </div>

              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {members.map((m) => {
                  const isSelf = m.user_id === currentUserId;
                  const isTargetOwner = m.role === 'OWNER';
                  return (
                    <div
                      key={m.user_id}
                      className="flex items-center justify-between p-2.5 bg-[#F5F2E8] border-2 border-[#0A0A0A] shadow-[2px_2px_0px_#0A0A0A]"
                    >
                      <div className="flex items-center gap-2 text-xs font-mono">
                        <Users size={14} className="text-[#3B82F6]" />
                        <span className="font-bold text-[#0A0A0A]">
                          {m.profile?.display_name || m.profile?.username || 'Operator'}
                        </span>
                        {isSelf && (
                          <span className="text-[10px] text-[#0A0A0A] font-black underline">(YOU)</span>
                        )}
                        <span className="text-[10px] px-1.5 py-0.5 border border-[#0A0A0A] bg-[#FFFFFF] font-bold text-[#0A0A0A]">
                          {m.role}
                        </span>
                      </div>

                      {(isOwner || isAdmin) && !isSelf && !isTargetOwner && (
                        <button
                          onClick={() => handleKickMember(m.user_id)}
                          className="px-2 py-0.5 text-xs text-[#FF304F] border-2 border-[#FF304F] hover:bg-[#FF304F] hover:text-[#FFFFFF] font-bold cursor-pointer transition-colors"
                        >
                          REMOVE
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'invite' && (
            <div className="space-y-4">
              <div className="text-xs text-[#0A0A0A]/70 font-bold">
                Share this invite code with other operators to let them join your server:
              </div>

              <div className="p-6 bg-[#F5F2E8] border-4 border-[#0A0A0A] shadow-[6px_6px_0px_#0A0A0A] flex flex-col items-center justify-center gap-3">
                <span className="text-xs text-[#0A0A0A]/70 font-mono font-bold uppercase">
                  TACTICAL INVITE CODE
                </span>
                <span className="font-pixel text-3xl tracking-widest text-[#0A0A0A] font-black">
                  {server.invite_code}
                </span>
                <button
                  type="button"
                  onClick={copyInvite}
                  className="mt-2 retro-btn retro-btn-green px-5 py-2 text-xs font-black flex items-center gap-2 shadow-[2px_2px_0px_#0A0A0A] active:translate-y-0.5"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copied ? 'CODE COPIED!' : 'COPY INVITE CODE'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
