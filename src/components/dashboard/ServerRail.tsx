import React from 'react';
import { Server, Profile } from '../../types/database';
import { Plus, ArrowRight } from 'lucide-react';

interface ServerRailProps {
  servers: Server[];
  activeServerId: string | null;
  currentUser: Profile;
  onSelectServer: (server: Server) => void;
  onOpenCreateServer: () => void;
  onOpenJoinServer: () => void;
  onOpenProfile: () => void;
  onReturnHome: () => void;
}

export const ServerRail: React.FC<ServerRailProps> = ({
  servers,
  activeServerId,
  currentUser,
  onSelectServer,
  onOpenCreateServer,
  onOpenJoinServer,
  onOpenProfile,
  onReturnHome,
}) => {
  return (
    <nav className="w-[72px] border-r-4 border-[#0A0A0A] bg-[#FFFFFF] flex flex-col items-center py-4 gap-4 select-none z-30 h-full justify-between">
      {/* Top Section: WAVE Home + Server Badges */}
      <div className="flex flex-col items-center gap-4 w-full">
        {/* WAVE Home Logo */}
        <button
          onClick={onReturnHome}
          id="rail-home-btn"
          title="WAVE Home"
          className="w-12 h-12 bg-[#0A0A0A] text-[#39FF14] flex items-center justify-center font-pixel font-bold text-xl border-2 border-[#0A0A0A] cursor-pointer shadow-[2px_2px_0px_#0A0A0A] active:translate-y-0.5"
        >
          W
        </button>

        <div className="w-8 h-[2px] bg-[#0A0A0A]" />

        {/* Server Icons List */}
        <div className="flex flex-col items-center gap-3 w-full max-h-[50vh] overflow-y-auto no-scrollbar">
          {servers.map((s) => {
            const isActive = s.id === activeServerId;
            const initials = s.name
              .split(' ')
              .map((w) => w[0])
              .join('')
              .substring(0, 2)
              .toUpperCase() || 'S';

            return (
              <div key={s.id} className="relative group">
                <button
                  onClick={() => onSelectServer(s)}
                  id={`server-btn-${s.id}`}
                  title={s.name}
                  className={`w-12 h-12 flex items-center justify-center font-pixel font-bold text-lg border-2 border-[#0A0A0A] transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#3B82F6] text-[#FFFFFF] shadow-[3px_3px_0px_#0A0A0A]'
                      : 'bg-[#FFFFFF] text-[#0A0A0A] hover:bg-[#F5F2E8]'
                  }`}
                >
                  {initials}
                </button>

                {/* Geometric Tooltip on Hover */}
                <div className="absolute left-16 top-1/2 -translate-y-1/2 hidden group-hover:block px-3 py-1.5 bg-[#FFFFFF] border-2 border-[#0A0A0A] text-[#0A0A0A] font-mono text-xs whitespace-nowrap z-50 shadow-[3px_3px_0px_#0A0A0A]">
                  <div className="font-bold uppercase">{s.name}</div>
                  <div className="text-[10px] text-[#0A0A0A]/70">INVITE: {s.invite_code}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Create / Join Actions */}
        <button
          onClick={onOpenCreateServer}
          id="rail-create-server-btn"
          title="Create Server"
          className="w-12 h-12 bg-[#FFFFFF] border-2 border-dashed border-[#0A0A0A] flex items-center justify-center text-2xl font-bold cursor-pointer hover:bg-[#F5F2E8] shadow-[2px_2px_0px_#0A0A0A] active:translate-y-0.5"
        >
          <Plus size={20} className="text-[#0A0A0A]" />
        </button>

        <button
          onClick={onOpenJoinServer}
          id="rail-join-server-btn"
          title="Join Server by Code"
          className="w-12 h-12 bg-[#FFFFFF] border-2 border-[#0A0A0A] flex items-center justify-center font-bold cursor-pointer hover:bg-[#F5F2E8] shadow-[2px_2px_0px_#0A0A0A] active:translate-y-0.5"
        >
          <ArrowRight size={18} className="text-[#0A0A0A]" />
        </button>
      </div>

      {/* User Profile Button at Bottom */}
      <div className="flex flex-col items-center">
        <button
          onClick={onOpenProfile}
          id="rail-profile-btn"
          title={`Operator: ${currentUser.display_name}`}
          className="w-12 h-12 bg-[#0A0A0A] text-[#FFFFFF] border-2 border-[#0A0A0A] flex items-center justify-center font-pixel font-bold text-sm shadow-[2px_2px_0px_#0A0A0A] hover:bg-[#333333] cursor-pointer active:translate-y-0.5"
        >
          {currentUser.username.substring(0, 2).toUpperCase()}
        </button>
      </div>
    </nav>
  );
};
