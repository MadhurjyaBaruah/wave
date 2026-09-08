import React, { useState } from 'react';
import { Channel, ChannelPresenceUser, Server } from '../../types/database';
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
    <section className="flex-1 flex flex-col bg-[#FFFFFF] text-[#0A0A0A] font-mono h-full overflow-hidden select-none relative">
      {/* Top Mobile Bar if on small screens */}
      <div className="md:hidden px-4 py-2.5 bg-[#F5F2E8] border-b-4 border-[#0A0A0A] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleSidebar}
            className="p-1.5 bg-[#FFFFFF] text-[#0A0A0A] border-2 border-[#0A0A0A] shadow-[2px_2px_0px_#0A0A0A]"
            title="Toggle Sidebar"
          >
            <Menu size={16} />
          </button>
          <span className="font-pixel text-xs font-bold uppercase truncate">
            {channel.name} // {server.name}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 border border-[#0A0A0A] ${isConnected ? 'bg-[#39FF14]' : 'bg-[#FFD400]'}`} />
          <span className="text-[10px] font-bold uppercase">{isConnected ? 'ONLINE' : 'CONNECTING'}</span>
        </div>
      </div>

      {/* Main Geometric Grid Content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 p-6 md:p-8 gap-6 md:gap-8 overflow-y-auto">
        {/* Left Column: Frequency Information & Active Operators */}
        <div className="flex flex-col gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-[#0A0A0A]/70 uppercase tracking-widest">
              {channel.type === 'PUBLIC' ? (
                <Hash size={16} className="text-[#0A0A0A]" />
              ) : (
                <Lock size={16} className="text-[#FF304F]" />
              )}
              <span>{server.name} // {channel.type} FREQUENCY</span>
            </div>

            <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-[#0A0A0A]">
              {channel.name}
            </h2>
            <div className="h-1 w-24 bg-[#0A0A0A]"></div>
            <p className="text-sm leading-tight text-[#0A0A0A] font-bold tracking-wider">
              {presenceUsers.length} OPERATOR{presenceUsers.length === 1 ? '' : 'S'} IN CHANNEL
            </p>
          </div>

          {/* Active Transmissions Card */}
          <div className="border-4 border-[#0A0A0A] p-5 bg-[#F5F2E8] shadow-[6px_6px_0px_#0A0A0A]">
            <div className="text-xs font-black mb-3 border-b-2 border-[#0A0A0A] pb-1 uppercase tracking-wider flex justify-between items-center">
              <span>Active Transmissions</span>
              <span className="text-[10px] font-bold text-[#0A0A0A]/60">WEBRTC NET</span>
            </div>

            <div className="space-y-3 max-h-64 overflow-y-auto">
              {presenceUsers.length === 0 ? (
                <div className="py-4 text-center text-xs font-bold text-[#0A0A0A]/50 uppercase">
                  No operators on this frequency
                </div>
              ) : (
                presenceUsers.map((u) => {
                  const isUserTransmitting = activeSpeaker?.userId === u.user_id;

                  return (
                    <div
                      key={u.user_id}
                      className={`flex items-center justify-between p-2 border-2 border-[#0A0A0A] ${
                        isUserTransmitting
                          ? 'bg-[#0A0A0A] text-[#FFFFFF] shadow-[3px_3px_0px_#FF304F]'
                          : 'bg-[#FFFFFF] text-[#0A0A0A] shadow-[2px_2px_0px_#0A0A0A]'
                      }`}
                    >
                      <div className="flex items-center gap-3 truncate">
                        <div
                          className={`w-3 h-3 border border-[#0A0A0A] shrink-0 ${
                            isUserTransmitting
                              ? 'bg-[#FF304F] animate-transmitting-pulse'
                              : 'bg-[#39FF14]'
                          }`}
                        />
                        <span className={`text-sm uppercase truncate ${isUserTransmitting ? 'font-black text-[#FF304F]' : 'font-bold'}`}>
                          {u.display_name || u.username}
                        </span>
                      </div>

                      <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 border border-[#0A0A0A] ${
                        isUserTransmitting
                          ? 'bg-[#FF304F] text-[#FFFFFF]'
                          : 'bg-[#F5F2E8] text-[#0A0A0A]'
                      }`}>
                        {isUserTransmitting ? 'TRANSMITTING' : 'IDLE'}
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

        {/* Right Column: Walkie-Talkie Push-to-Talk Console */}
        <div className="flex flex-col items-center justify-center bg-[#F5F2E8] border-4 border-[#0A0A0A] p-6 md:p-8 shadow-[8px_8px_0px_#0A0A0A]">
          {/* Status Indicator */}
          <div className="text-center mb-6">
            <div className="text-xs font-black uppercase mb-1 tracking-widest text-[#0A0A0A]">
              Channel Status
            </div>
            {isTransmitting ? (
              <div className="text-2xl font-black text-[#FFFFFF] bg-[#FF304F] px-5 py-1 border-2 border-[#0A0A0A] shadow-[3px_3px_0px_#0A0A0A] animate-transmitting-pulse">
                TRANSMITTING LIVE
              </div>
            ) : isChannelOccupied ? (
              <div className="text-2xl font-black text-[#FF304F] bg-[#0A0A0A] px-5 py-1 border-2 border-[#0A0A0A] shadow-[3px_3px_0px_#0A0A0A]">
                BUSY // {activeSpeaker?.username.toUpperCase()}
              </div>
            ) : (
              <div className="text-2xl font-black text-[#39FF14] bg-[#0A0A0A] px-5 py-1 border-2 border-[#0A0A0A] shadow-[3px_3px_0px_#0A0A0A]">
                STANDBY // CLEAR
              </div>
            )}
          </div>

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
          <div className="mt-8 w-full max-w-xs">
            <AudioVuMeter level={audioLevel} isTransmitting={isTransmitting} />
          </div>
        </div>
      </div>

      {/* Bottom Speaker & Action Status Bar */}
      <footer className="h-16 md:h-20 border-t-4 border-[#0A0A0A] bg-[#0A0A0A] text-[#FFFFFF] flex items-center justify-between px-6 md:px-8">
        <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
          <div className={`w-10 h-10 border-2 border-[#FFFFFF] ${activeSpeaker ? 'bg-[#FF304F]' : 'bg-[#3B82F6]'} flex items-center justify-center font-black text-white shrink-0`}>
            {activeSpeaker ? (activeSpeaker.username[0]?.toUpperCase() || 'T') : 'W'}
          </div>
          <div className="truncate">
            <div className="text-[10px] font-bold uppercase leading-none mb-1 text-[#FFFFFF]/70">
              Current Speaker
            </div>
            <div className={`text-sm md:text-lg font-black tracking-tighter leading-none truncate ${activeSpeaker ? 'text-[#FF304F]' : 'text-[#39FF14]'}`}>
              {activeSpeaker ? `${activeSpeaker.username.toUpperCase()} // ACTIVE` : 'NONE // CHANNEL QUIET'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleSound}
            id="console-sound-toggle-btn"
            className="px-3 md:px-4 py-2 bg-[#FFFFFF] text-[#0A0A0A] font-black text-xs border-2 border-[#0A0A0A] shadow-[2px_2px_0px_#FFFFFF] cursor-pointer flex items-center gap-1.5 hover:bg-[#F5F2E8] active:translate-y-0.5"
          >
            {isSoundMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            <span className="hidden sm:inline">{isSoundMuted ? 'UNMUTE FX' : 'MUTE FX'}</span>
          </button>
        </div>
      </footer>
    </section>
  );
};
