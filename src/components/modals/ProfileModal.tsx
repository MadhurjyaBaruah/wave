import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Profile } from '../../types/database';
import { soundEffects } from '../../lib/audio/soundEffects';
import { Volume2, VolumeX, Radio, LogOut, Check } from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: Profile;
  onProfileUpdated: (profile: Profile) => void;
  onLogout: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  profile,
  onProfileUpdated,
  onLogout,
}) => {
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [isMuted, setIsMuted] = useState(soundEffects.getIsMuted());
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: Profile = {
      ...profile,
      display_name: displayName.trim() || profile.username,
    };
    localStorage.setItem('wave_user', JSON.stringify(updated));
    onProfileUpdated(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const toggleSound = () => {
    const muted = soundEffects.toggleMute();
    setIsMuted(muted);
    if (!muted) {
      soundEffects.playChannelJoin();
    }
  };

  const testRogerBeep = () => {
    soundEffects.playPttRelease();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="OPERATOR PROFILE"
      subtitle={`Callsign: ${profile.username}`}
    >
      <form onSubmit={handleSave} className="space-y-4">
        <div className="flex items-center gap-3 p-4 bg-[#F5F2E8] border-2 border-[#0A0A0A] shadow-[2px_2px_0px_#0A0A0A]">
          <div className="w-12 h-12 bg-[#0A0A0A] border-2 border-[#0A0A0A] text-[#39FF14] flex items-center justify-center font-pixel text-lg font-bold">
            {profile.username.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="font-pixel text-sm text-[#0A0A0A] font-bold uppercase">
              {profile.display_name}
            </div>
            <div className="font-mono text-xs text-[#0A0A0A]/70 font-bold">
              @{profile.username}
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs uppercase font-bold text-[#0A0A0A]">
            Display Name / Tactical Callsign
          </label>
          <input
            type="text"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full bg-[#F5F2E8] border-2 border-[#0A0A0A] px-3 py-2 text-sm text-[#0A0A0A] font-bold font-mono focus:outline-none shadow-[2px_2px_0px_#0A0A0A]"
          />
        </div>

        {/* Audio Effects Setting */}
        <div className="p-4 bg-[#F5F2E8] border-2 border-[#0A0A0A] space-y-2 shadow-[2px_2px_0px_#0A0A0A]">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold text-[#0A0A0A] flex items-center gap-1.5">
              {isMuted ? <VolumeX size={14} className="text-[#FF304F]" /> : <Volume2 size={14} className="text-[#0A0A0A]" />}
              <span>Tactical Sound FX</span>
            </span>
            <button
              type="button"
              onClick={toggleSound}
              className={`px-3 py-1 text-xs font-mono font-bold border-2 border-[#0A0A0A] cursor-pointer shadow-[2px_2px_0px_#0A0A0A] active:translate-y-0.5 ${
                isMuted
                  ? 'bg-[#FF304F] text-[#FFFFFF]'
                  : 'bg-[#39FF14] text-[#0A0A0A]'
              }`}
            >
              {isMuted ? 'MUTED' : 'ENABLED'}
            </button>
          </div>
          <p className="text-[11px] text-[#0A0A0A]/70 font-bold leading-relaxed">
            Synthesizes authentic hardware mic clicks, squelch bursts, and roger beeps on transmit.
          </p>
          {!isMuted && (
            <button
              type="button"
              onClick={testRogerBeep}
              className="text-[11px] text-[#0A0A0A] font-bold underline hover:text-[#333] flex items-center gap-1 pt-1 cursor-pointer"
            >
              <Radio size={12} /> Test Roger Beep FX
            </button>
          )}
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={onLogout}
            className="retro-btn retro-btn-red px-3 py-2 text-xs font-bold flex items-center gap-1.5 shadow-[2px_2px_0px_#0A0A0A] active:translate-y-0.5"
          >
            <LogOut size={13} />
            <span>DISCONNECT</span>
          </button>

          <button
            type="submit"
            className="retro-btn retro-btn-green px-5 py-2 text-xs font-black flex items-center gap-1.5 shadow-[3px_3px_0px_#0A0A0A] active:translate-y-0.5"
          >
            {saved ? <Check size={14} /> : null}
            <span>{saved ? 'SAVED!' : 'UPDATE PROFILE'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
