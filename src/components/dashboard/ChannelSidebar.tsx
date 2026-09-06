import React from 'react';
import { Server, Channel, ServerRole } from '../../types/database';
import { Hash, Lock, Plus, Settings, UserPlus, LogOut, Copy, Check } from 'lucide-react';

interface ChannelSidebarProps {
  server: Server;
  channels: Channel[];
  activeChannelId: string | null;
  userRole: ServerRole;
  onSelectChannel: (channel: Channel) => void;
  onOpenCreateChannel: () => void;
  onOpenSettings: () => void;
  onOpenInvite: () => void;
  onLeaveServer: () => void;
  className?: string;
}

export const ChannelSidebar: React.FC<ChannelSidebarProps> = ({
  server,
  channels,
  activeChannelId,
  userRole,
  onSelectChannel,
  onOpenCreateChannel,
  onOpenSettings,
  onOpenInvite,
  onLeaveServer,
  className = '',
}) => {
  const [copied, setCopied] = React.useState(false);
  const isOwnerOrAdmin = userRole === 'OWNER' || userRole === 'ADMIN';
  const publicChannels = channels.filter((c) => c.type === 'PUBLIC');
  const privateChannels = channels.filter((c) => c.type === 'PRIVATE');

  const copyInvite = () => {
    navigator.clipboard.writeText(server.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <aside
      className={`w-64 border-r-4 border-[#0A0A0A] bg-[#FFFFFF] flex flex-col justify-between select-none ${className}`}
    >
      {/* Top Header & Channels */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Server Title Header */}
        <div className="p-4 border-b-2 border-[#0A0A0A] bg-[#F5F2E8] flex items-center justify-between">
          <div className="overflow-hidden pr-2">
            <div className="font-bold text-xs tracking-widest uppercase text-[#0A0A0A] truncate">
              CHANNELS // {server.name}
            </div>
            <div className="text-[10px] text-[#0A0A0A]/60 font-bold uppercase mt-0.5 truncate">
              ROLE: {userRole}
            </div>
          </div>

          {isOwnerOrAdmin && (
            <button
              onClick={onOpenSettings}
              id="channel-sidebar-settings-btn"
              title="Server Settings"
              className="p-1 bg-[#FFFFFF] text-[#0A0A0A] border-2 border-[#0A0A0A] shadow-[2px_2px_0px_#0A0A0A] hover:bg-[#F5F2E8] cursor-pointer active:translate-y-0.5"
            >
              <Settings size={14} />
            </button>
          )}
        </div>

        {/* Channels List */}
        <div className="flex-1 p-2 space-y-4 overflow-y-auto">
          {/* Public Channels Section */}
          <div className="space-y-1">
            <div className="flex items-center justify-between px-2 py-1 text-[10px] font-black uppercase text-[#0A0A0A]/60 tracking-wider">
              <span>Public Channels</span>
              {isOwnerOrAdmin && (
                <button
                  onClick={onOpenCreateChannel}
                  title="Add Channel"
                  className="hover:text-[#0A0A0A] text-[#0A0A0A]/60"
                >
                  <Plus size={13} />
                </button>
              )}
            </div>

            <div className="space-y-1">
              {publicChannels.length === 0 ? (
                <div className="text-[11px] text-[#0A0A0A]/40 italic px-2 py-1">
                  No channels
                </div>
              ) : (
                publicChannels.map((ch) => {
                  const isActive = ch.id === activeChannelId;

                  return (
                    <button
                      key={ch.id}
                      onClick={() => onSelectChannel(ch)}
                      id={`channel-btn-${ch.id}`}
                      className={`w-full p-2.5 font-bold flex items-center justify-between cursor-pointer transition-colors text-xs uppercase border-2 ${
                        isActive
                          ? 'bg-[#0A0A0A] text-[#FFFFFF] border-[#0A0A0A] shadow-[2px_2px_0px_#0A0A0A]'
                          : 'bg-transparent text-[#0A0A0A] border-transparent hover:bg-[#F5F2E8] hover:border-[#0A0A0A]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <span className={isActive ? 'text-[#39FF14]' : 'text-[#0A0A0A]/50'}>
                          #
                        </span>
                        <span className="truncate">{ch.name}</span>
                      </div>
                      {isActive && (
                        <div className="w-2 h-2 bg-[#39FF14] border border-[#0A0A0A] shrink-0" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Private Channels Section */}
          {privateChannels.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between px-2 py-1 text-[10px] font-black uppercase text-[#0A0A0A]/60 tracking-wider">
                <span>Encrypted / Private</span>
              </div>

              <div className="space-y-1">
                {privateChannels.map((ch) => {
                  const isActive = ch.id === activeChannelId;

                  return (
                    <button
                      key={ch.id}
                      onClick={() => onSelectChannel(ch)}
                      id={`channel-btn-${ch.id}`}
                      className={`w-full p-2.5 font-bold flex items-center justify-between cursor-pointer transition-colors text-xs uppercase border-2 ${
                        isActive
                          ? 'bg-[#0A0A0A] text-[#FFFFFF] border-[#0A0A0A] shadow-[2px_2px_0px_#0A0A0A]'
                          : 'bg-transparent text-[#0A0A0A] border-transparent hover:bg-[#F5F2E8] hover:border-[#0A0A0A]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Lock size={12} className={isActive ? 'text-[#FFD400]' : 'text-[#0A0A0A]/50'} />
                        <span className="truncate">{ch.name}</span>
                      </div>
                      {isActive && (
                        <div className="w-2 h-2 bg-[#FFD400] border border-[#0A0A0A] shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Server Invite Bar */}
      <div className="p-4 border-t-2 border-[#0A0A0A] bg-[#FFFFFF] space-y-2">
        <div className="flex items-center justify-between text-[10px] uppercase font-bold text-[#0A0A0A]/60">
          <span>Server Invite Code</span>
          <button
            onClick={onOpenInvite}
            className="text-[10px] font-bold text-[#0A0A0A] hover:underline uppercase"
          >
            Share
          </button>
        </div>

        <div className="flex gap-1.5">
          <input
            type="text"
            readOnly
            value={server.invite_code}
            className="w-full bg-[#F5F2E8] border-2 border-[#0A0A0A] px-2 py-1 text-xs font-bold outline-none text-[#0A0A0A]"
          />
          <button
            onClick={copyInvite}
            title="Copy Invite Code"
            className="px-2 bg-[#FFFFFF] border-2 border-[#0A0A0A] shadow-[2px_2px_0px_#0A0A0A] flex items-center justify-center cursor-pointer hover:bg-[#F5F2E8] active:translate-y-0.5"
          >
            {copied ? <Check size={14} className="text-[#39FF14]" /> : <Copy size={14} />}
          </button>
        </div>

        {userRole !== 'OWNER' && (
          <button
            onClick={onLeaveServer}
            id="sidebar-leave-server-btn"
            className="w-full mt-2 py-1 bg-[#FFFFFF] text-[#FF304F] border-2 border-[#0A0A0A] hover:bg-[#FF304F] hover:text-[#FFFFFF] text-[10px] font-black uppercase flex items-center justify-center gap-1 shadow-[2px_2px_0px_#0A0A0A] active:translate-y-0.5 transition-colors"
          >
            <LogOut size={12} />
            <span>LEAVE SERVER</span>
          </button>
        )}
      </div>
    </aside>
  );
};
