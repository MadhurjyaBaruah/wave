import React, { useState } from 'react';
import { Channel, ChannelPresenceUser, Server, Profile, ServerMember } from '../../types/database';
import { PushToTalkButton } from './PushToTalkButton';
import { AudioVuMeter } from './AudioVuMeter';
import { soundEffects } from '../../lib/audio/soundEffects';
import { 
  Volume2, 
  VolumeX, 
  Lock, 
  Hash, 
  AlertCircle, 
  RefreshCw, 
  Mic, 
  MicOff, 
  Menu,
  Radio,
  ExternalLink
} from 'lucide-react';

interface VoiceConsoleProps {
  server: Server;
  channel: Channel;
  presenceUsers: ChannelPresenceUser[];
  activeSpeaker: { userId: string; username: string } | null;
  isTransmitting: boolean;
  audioLevel: number;
  isConnected: boolean;
  isMicBlocked: boolean;
  currentUser?: Profile;
  members?: ServerMember[];
  hasMicAccess?: boolean;
  onRetryMic: () => void;
  onEnableSimulatedMic?: () => void;
  onRequestLock: () => Promise<boolean>;
  onReleaseLock: () => void;
  onToggleSidebar?: () => void;
}

export const VoiceConsole: React.FC<VoiceConsoleProps> = ({
  server,
  channel,
  presenceUsers,
  activeSpeaker,
  isTransmitting,
  audioLevel,
  isConnected,
  isMicBlocked,
  currentUser,
  members = [],
  hasMicAccess = false,
  onRetryMic,
  onEnableSimulatedMic,
  onRequestLock,
  onReleaseLock,
  onToggleSidebar,
}) => {
  const [isSoundMuted, setIsSoundMuted] = useState(soundEffects.getIsMuted());
  const [showBusyWarning, setShowBusyWarning] = useState(false);

  const toggleSound = () => {
    const muted = soundEffects.toggleMute();
    setIsSoundMuted(muted);
  };

  const isChannelOccupied = Boolean(activeSpeaker && !isTransmitting);

  const handleBusyAlert = () => {
    setShowBusyWarning(true);
    setTimeout(() => setShowBusyWarning(false), 3000);
  };

  return (
    <section className="flex-1 flex flex-col bg-[#FFFFFF] text-[#0A0A0A] font-mono h-full overflow-hidden select-none relative min-w-0">
      {/* Top Mobile Bar if on small screens */}
      <div className="md:hidden px-3 sm:px-4 py-2 sm:py-2.5 bg-[#F5F2E8] border-b-3 sm:border-b-4 border-[#0A0A0A] flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0 truncate">
          <button
            onClick={onToggleSidebar}
            className="p-1.5 bg-[#FFFFFF] text-[#0A0A0A] border-2 border-[#0A0A0A] shadow-[2px_2px_0px_#0A0A0A] cursor-pointer active:translate-y-0.5 shrink-0"
            title="Toggle Sidebar"
          >
            <Menu size={16} />
          </button>
          <span className="font-pixel text-[11px] sm:text-xs font-bold uppercase truncate">
            {channel.name} // {server.name}
          </span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <div className={`w-2.5 h-2.5 border border-[#0A0A0A] ${isConnected ? 'bg-[#39FF14]' : 'bg-[#FFD400]'}`} />
          <span className="text-[9px] sm:text-[10px] font-bold uppercase">{isConnected ? 'ONLINE' : 'SYNCING'}</span>
        </div>
      </div>

      {/* Main Geometric Content: On mobile & tablet portrait, PTT Console is on top for instant access */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 p-3 sm:p-5 md:p-6 lg:p-8 gap-4 sm:gap-6 md:gap-8 overflow-y-auto min-w-0">
        {/* Left Column: Frequency Information & Active Operators (order-2 on mobile, order-1 on desktop) */}
        <div className="flex flex-col gap-4 sm:gap-6 order-2 lg:order-1 min-w-0">
          <div className="space-y-2 sm:space-y-3">
            <div className="flex items-center gap-2 text-[10px] sm:text-xs font-bold text-[#0A0A0A]/70 uppercase tracking-widest truncate">
              {channel.type === 'PUBLIC' ? (
                <Hash size={14} className="text-[#0A0A0A] shrink-0" />
              ) : (
                <Lock size={14} className="text-[#FF304F] shrink-0" />
              )}
              <span className="truncate">{server.name} // {channel.type} FREQUENCY</span>
            </div>

            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black uppercase tracking-tighter text-[#0A0A0A] truncate">
              {channel.name}
            </h2>
            <div className="h-1 w-20 sm:w-24 bg-[#0A0A0A]"></div>
            <p className="text-xs sm:text-sm leading-tight text-[#0A0A0A] font-bold tracking-wider">
              {presenceUsers.length} OPERATOR{presenceUsers.length === 1 ? '' : 'S'} IN CHANNEL
            </p>
          </div>

          {/* Active Transmissions Card */}
          <div className="border-3 sm:border-4 border-[#0A0A0A] p-3 sm:p-5 bg-[#F5F2E8] shadow-[4px_4px_0px_#0A0A0A] sm:shadow-[6px_6px_0px_#0A0A0A] min-w-0">
            <div className="text-xs font-black mb-2.5 sm:mb-3 border-b-2 border-[#0A0A0A] pb-1 uppercase tracking-wider flex justify-between items-center">
              <span>Active Transmissions</span>
              <span className="text-[9px] sm:text-[10px] font-bold text-[#0A0A0A]/60">WEBRTC NET</span>
            </div>

            <div className="space-y-2 sm:space-y-3 max-h-56 sm:max-h-64 overflow-y-auto pr-0.5">
              {presenceUsers.length === 0 ? (
                <div className="py-4 text-center text-xs font-bold text-[#0A0A0A]/50 uppercase">
                  No operators on this frequency
                </div>
              ) : (
                presenceUsers.map((u) => {
                  const isLocalUser = currentUser?.id === u.user_id;
                  const isUserTransmitting = 
                    (isLocalUser && isTransmitting) ||
                    (activeSpeaker?.userId === u.user_id) ||
                    Boolean(u.is_transmitting);

                  const isOwner = u.user_id === server.owner_id;
                  let affiliationFull = '';
                  let affiliationShort = '';
                  if (isLocalUser) {
                    affiliationFull = isOwner ? '[YOU · HOST]' : '[YOU · MEMBER (VIA INVITE)]';
                    affiliationShort = '[YOU]';
                  } else if (isOwner) {
                    affiliationFull = '[HOST / OWNER]';
                    affiliationShort = '[HOST]';
                  } else {
                    affiliationFull = '[MEMBER · JOINED VIA INVITE]';
                    affiliationShort = '[INVITE]';
                  }

                  // Build clear, distinct callsign
                  let displayName = u.display_name || u.username;
                  if (
                    !displayName || 
                    displayName.toLowerCase() === 'radio operator' || 
                    displayName.toLowerCase() === 'operator'
                  ) {
                    if (u.username && u.username.toLowerCase() !== 'operator') {
                      displayName = u.username.startsWith('op_')
                        ? `Operator ${u.username.replace('op_', '')}`
                        : u.username.toUpperCase();
                    } else {
                      const suffix = u.user_id ? u.user_id.slice(-4).toUpperCase() : 'CALL';
                      displayName = `Operator ${suffix}`;
                    }
                  }

                  return (
                    <div
                      key={u.user_id}
                      className={`flex items-center justify-between p-2 sm:p-2.5 border-2 border-[#0A0A0A] gap-2 min-w-0 ${
                        isUserTransmitting
                          ? 'bg-[#0A0A0A] text-[#FFFFFF] shadow-[3px_3px_0px_#FF304F]'
                          : 'bg-[#FFFFFF] text-[#0A0A0A] shadow-[2px_2px_0px_#0A0A0A]'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate min-w-0">
                        <div
                          className={`w-2.5 h-2.5 sm:w-3 sm:h-3 border border-[#0A0A0A] shrink-0 ${
                            isUserTransmitting
                              ? 'bg-[#FF304F] animate-transmitting-pulse'
                              : 'bg-[#39FF14]'
                          }`}
                        />
                        <div className="flex items-baseline gap-1.5 truncate min-w-0">
                          <span className={`text-xs sm:text-sm uppercase truncate ${isUserTransmitting ? 'font-black text-[#FF304F]' : 'font-bold text-[#0A0A0A]'}`}>
                            {displayName}
                          </span>
                          <span className={`text-[9px] sm:text-[10px] font-bold font-mono tracking-tight shrink-0 hidden sm:inline ${isUserTransmitting ? 'text-[#FFFFFF]/80' : 'text-[#0A0A0A]/60'}`}>
                            {affiliationFull}
                          </span>
                          <span className={`text-[9px] font-bold font-mono tracking-tight shrink-0 sm:hidden ${isUserTransmitting ? 'text-[#FFFFFF]/80' : 'text-[#0A0A0A]/60'}`}>
                            {affiliationShort}
                          </span>
                        </div>
                      </div>

                      <span className={`text-[9px] sm:text-[10px] font-black uppercase px-1.5 sm:px-2 py-0.5 border border-[#0A0A0A] shrink-0 ${
                        isUserTransmitting
                          ? 'bg-[#FF304F] text-[#FFFFFF] shadow-[1px_1px_0px_#0A0A0A] animate-pulse'
                          : 'bg-[#F5F2E8] text-[#0A0A0A]'
                      }`}>
                        {isUserTransmitting ? 'TX' : 'IDLE'}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Busy Alert Warning */}
          {showBusyWarning && (
            <div className="border-4 border-[#0A0A0A] p-4 bg-[#FFD400] text-[#0A0A0A] shadow-[4px_4px_0px_#0A0A0A] flex items-center gap-3">
              <AlertCircle size={20} className="shrink-0" />
              <div className="text-xs font-black uppercase leading-tight">
                Channel Busy: {activeSpeaker?.username || 'Another operator'} is currently transmitting.
              </div>
            </div>
          )}

          {/* Microphone Blocked Notice */}
          {isMicBlocked && (
            <div className="border-4 border-[#0A0A0A] p-4 bg-[#FF304F] text-[#FFFFFF] shadow-[4px_4px_0px_#0A0A0A] space-y-3">
              <div className="flex items-center gap-2 font-black text-xs uppercase tracking-wider">
                <MicOff size={16} />
                <span>Microphone Access Required</span>
              </div>
              <p className="text-xs font-bold leading-relaxed text-[#FFFFFF]/90">
                Microphone permission was dismissed or blocked by the browser. You can retry permission, or activate simulated tactical tone mode to transmit over WebRTC without physical hardware.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  onClick={onRetryMic}
                  className="retro-btn bg-[#FFFFFF] text-[#0A0A0A] px-3 py-1 text-xs font-black inline-flex items-center gap-1.5"
                  title="Prompt browser again for microphone access"
                >
                  <RefreshCw size={12} />
                  <span>[ RETRY PERMISSION ]</span>
                </button>

                {onEnableSimulatedMic && (
                  <button
                    onClick={onEnableSimulatedMic}
                    className="retro-btn bg-[#FFD400] text-[#0A0A0A] px-3 py-1 text-xs font-black inline-flex items-center gap-1.5"
                    title="Enable synthetic audio carrier to test walkie-talkie"
                  >
                    <Radio size={12} />
                    <span>[ USE TACTICAL TONE MODE ]</span>
                  </button>
                )}

                {typeof window !== 'undefined' && window.self !== window.top && (
                  <a
                    href={window.location.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="retro-btn bg-[#0A0A0A] text-[#FFFFFF] border-2 border-[#FFFFFF] px-3 py-1 text-xs font-black inline-flex items-center gap-1.5"
                    title="Open app in a separate browser tab to grant permissions"
                  >
                    <ExternalLink size={12} />
                    <span>[ OPEN IN TAB ]</span>
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Walkie-Talkie Push-to-Talk Console (order-1 on mobile for instant access) */}
        <div className="flex flex-col items-center justify-center bg-[#F5F2E8] border-3 sm:border-4 border-[#0A0A0A] p-4 sm:p-6 md:p-8 shadow-[4px_4px_0px_#0A0A0A] sm:shadow-[8px_8px_0px_#0A0A0A] order-1 lg:order-2 min-w-0">
          {/* Status Indicator */}
          <div className="text-center mb-3 sm:mb-6 max-w-full">
            <div className="text-[10px] sm:text-xs font-black uppercase mb-1 tracking-widest text-[#0A0A0A]">
              Channel Status
            </div>
            {isTransmitting ? (
              <div className="text-base sm:text-xl md:text-2xl font-black text-[#FFFFFF] bg-[#FF304F] px-3 sm:px-5 py-1 border-2 border-[#0A0A0A] shadow-[3px_3px_0px_#0A0A0A] animate-transmitting-pulse truncate max-w-[260px] xs:max-w-xs sm:max-w-sm inline-block">
                TRANSMITTING LIVE
              </div>
            ) : isChannelOccupied ? (
              <div className="text-base sm:text-xl md:text-2xl font-black text-[#FF304F] bg-[#0A0A0A] px-3 sm:px-5 py-1 border-2 border-[#0A0A0A] shadow-[3px_3px_0px_#0A0A0A] truncate max-w-[260px] xs:max-w-xs sm:max-w-sm inline-block">
                BUSY // {activeSpeaker?.username.toUpperCase()}
              </div>
            ) : (
              <div className="text-base sm:text-xl md:text-2xl font-black text-[#39FF14] bg-[#0A0A0A] px-3 sm:px-5 py-1 border-2 border-[#0A0A0A] shadow-[3px_3px_0px_#0A0A0A] truncate max-w-[260px] xs:max-w-xs sm:max-w-sm inline-block">
                STANDBY // CLEAR
              </div>
            )}
          </div>

          {/* Microphone Permission Prompt & Status */}
          {!hasMicAccess ? (
            <div className="mb-3 sm:mb-4 text-center max-w-full">
              <button
                onClick={onRetryMic}
                type="button"
                className="retro-btn bg-[#39FF14] text-[#0A0A0A] px-3 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs font-black inline-flex items-center gap-1.5 sm:gap-2 border-2 border-[#0A0A0A] shadow-[2px_2px_0px_#0A0A0A] sm:shadow-[3px_3px_0px_#0A0A0A] hover:translate-y-0.5 active:translate-y-1 transition-transform cursor-pointer max-w-full"
                title="Click to prompt browser for microphone access"
              >
                <Mic size={14} className="text-[#0A0A0A] shrink-0" />
                <span className="truncate">[ 🎙️ ALLOW MICROPHONE ]</span>
              </button>
              <div className="text-[8px] sm:text-[9px] font-bold text-[#0A0A0A]/60 mt-1 uppercase tracking-widest font-mono">
                Click to grant audio access before transmitting
              </div>
            </div>
          ) : (
            <div className="mb-2 sm:mb-3 inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-0.5 sm:py-1 bg-[#0A0A0A] text-[#39FF14] border border-[#39FF14]/40 text-[9px] sm:text-[10px] font-bold font-mono uppercase tracking-widest shadow-[2px_2px_0px_#0A0A0A]">
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#39FF14] inline-block animate-pulse shrink-0" />
              <span>MIC LINKED // READY TO TALK</span>
            </div>
          )}

          {/* Large Circular Geometric PTT Button */}
          <PushToTalkButton
            isChannelOccupied={isChannelOccupied}
            activeSpeakerName={activeSpeaker?.username}
            isTransmitting={isTransmitting}
            disabled={false}
            onRequestLock={onRequestLock}
            onReleaseLock={onReleaseLock}
            onBusyAlert={handleBusyAlert}
          />

          {/* Audio VU Signal Level Meter */}
          <div className="mt-4 sm:mt-6 md:mt-8 w-full max-w-xs">
            <AudioVuMeter level={audioLevel} isTransmitting={isTransmitting} />
          </div>
        </div>
      </div>

      {/* Bottom Speaker & Action Status Bar */}
      <footer className="h-14 sm:h-16 md:h-20 border-t-3 sm:border-t-4 border-[#0A0A0A] bg-[#0A0A0A] text-[#FFFFFF] flex items-center justify-between px-3 sm:px-6 md:px-8 shrink-0 min-w-0 gap-2">
        <div className="flex items-center gap-2 sm:gap-3 md:gap-4 overflow-hidden min-w-0">
          <div className={`w-8 h-8 sm:w-10 sm:h-10 border-2 border-[#FFFFFF] ${activeSpeaker ? 'bg-[#FF304F]' : 'bg-[#3B82F6]'} flex items-center justify-center font-black text-white shrink-0 text-xs sm:text-base`}>
            {activeSpeaker ? (activeSpeaker.username[0]?.toUpperCase() || 'T') : 'W'}
          </div>
          <div className="truncate min-w-0">
            <div className="text-[9px] sm:text-[10px] font-bold uppercase leading-none mb-1 text-[#FFFFFF]/70">
              Current Speaker
            </div>
            <div className={`text-xs sm:text-sm md:text-lg font-black tracking-tighter leading-none truncate max-w-[130px] xs:max-w-[180px] sm:max-w-none ${activeSpeaker ? 'text-[#FF304F]' : 'text-[#39FF14]'}`}>
              {activeSpeaker ? `${activeSpeaker.username.toUpperCase()} // ACTIVE` : 'NONE // CHANNEL QUIET'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            onClick={toggleSound}
            id="console-sound-toggle-btn"
            className="px-2.5 sm:px-4 py-1.5 sm:py-2 bg-[#FFFFFF] text-[#0A0A0A] font-black text-[10px] sm:text-xs border-2 border-[#0A0A0A] shadow-[2px_2px_0px_#FFFFFF] cursor-pointer flex items-center gap-1 sm:gap-1.5 hover:bg-[#F5F2E8] active:translate-y-0.5 shrink-0"
          >
            {isSoundMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
            <span className="hidden xs:inline">{isSoundMuted ? 'UNMUTE FX' : 'MUTE FX'}</span>
          </button>
        </div>
      </footer>
    </section>
  );
};
