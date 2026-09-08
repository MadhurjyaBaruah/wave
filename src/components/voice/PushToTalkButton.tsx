import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Mic, Radio, AlertTriangle } from 'lucide-react';
import { soundEffects } from '../../lib/audio/soundEffects';

interface PushToTalkButtonProps {
  isChannelOccupied: boolean;
  activeSpeakerName?: string;
  isTransmitting: boolean;
  disabled?: boolean;
  onRequestLock: () => Promise<boolean>;
  onReleaseLock: () => void;
  onBusyAlert?: () => void;
}

export const PushToTalkButton: React.FC<PushToTalkButtonProps> = ({
  isChannelOccupied,
  activeSpeakerName,
  isTransmitting,
  disabled = false,
  onRequestLock,
  onReleaseLock,
  onBusyAlert,
}) => {
  const [isPressing, setIsPressing] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const isPressingRef = useRef(false);

  const handleStartTransmitting = useCallback(async () => {
    if (disabled) return;
    if (isChannelOccupied && !isTransmitting) {
      soundEffects.playBusyError();
      if (onBusyAlert) onBusyAlert();
      return;
    }
    if (isPressingRef.current) return;

    isPressingRef.current = true;
    setIsPressing(true);
    soundEffects.playPttStart();

    const granted = await onRequestLock();
    if (!granted) {
      isPressingRef.current = false;
      setIsPressing(false);
      soundEffects.playBusyError();
      if (onBusyAlert) onBusyAlert();
    }
  }, [disabled, isChannelOccupied, isTransmitting, onRequestLock, onBusyAlert]);

  const handleStopTransmitting = useCallback(() => {
    if (!isPressingRef.current) return;
    isPressingRef.current = false;
    setIsPressing(false);
    soundEffects.playPttRelease();
    onReleaseLock();
  }, [onReleaseLock]);

  // Window-level safety: release transmission if mouse leaves window or touches end
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isPressingRef.current) {
        handleStopTransmitting();
      }
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('touchend', handleGlobalMouseUp);

    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('touchend', handleGlobalMouseUp);
    };
  }, [handleStopTransmitting]);

  // Keyboard shortcut: Spacebar or T key to hold to talk
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if ((e.code === 'Space' || e.key === 't' || e.key === 'T') && !e.repeat) {
        e.preventDefault();
        handleStartTransmitting();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (e.code === 'Space' || e.key === 't' || e.key === 'T') {
        e.preventDefault();
        handleStopTransmitting();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleStartTransmitting, handleStopTransmitting]);

  // Geometric Balance button dynamic properties
  let buttonStatusText = 'HOLD TO TALK';
  let buttonSubText = '[SPACEBAR] OR [T]';
  let buttonBg = 'bg-[#FFFFFF]';
  let buttonText = 'text-[#0A0A0A]';
  let buttonShadow = 'shadow-[0_10px_0_#0A0A0A]';
  let iconBg = 'bg-[#0A0A0A] text-[#FFFFFF]';
  let iconComponent = <Mic size={24} className="text-[#39FF14]" />;

  if (isTransmitting) {
    buttonStatusText = 'TRANSMITTING';
    buttonSubText = 'MIC ON AIR';
    buttonBg = 'bg-[#FF304F]';
    buttonText = 'text-[#FFFFFF]';
    buttonShadow = 'shadow-[0_2px_0_#0A0A0A] translate-y-2';
    iconBg = 'bg-[#0A0A0A] text-[#FF304F]';
    iconComponent = <Radio size={24} className="text-[#FF304F] animate-transmitting-pulse" />;
  } else if (isChannelOccupied) {
    buttonStatusText = `${activeSpeakerName || 'OPERATOR'} TALKING`;
    buttonSubText = 'CHANNEL BUSY';
    buttonBg = 'bg-[#FFD400]';
    buttonText = 'text-[#0A0A0A]';
    buttonShadow = 'shadow-[0_8px_0_#0A0A0A]';
    iconBg = 'bg-[#0A0A0A] text-[#FFD400]';
    iconComponent = <AlertTriangle size={24} className="text-[#FFD400]" />;
  }

  return (
    <div className="flex flex-col items-center justify-center select-none py-3">
      <button
        ref={buttonRef}
        id="ptt-talk-button"
        type="button"
        disabled={disabled}
        aria-label={
          isTransmitting
            ? 'Currently transmitting'
            : isChannelOccupied
            ? `Channel occupied by ${activeSpeakerName || 'operator'}`
            : 'Hold to talk'
        }
        onMouseDown={(e) => {
          e.preventDefault();
          handleStartTransmitting();
        }}
        onMouseUp={(e) => {
          e.preventDefault();
          handleStopTransmitting();
        }}
        onMouseLeave={() => {
          if (isPressingRef.current) handleStopTransmitting();
        }}
        onTouchStart={(e) => {
          e.preventDefault();
          handleStartTransmitting();
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          handleStopTransmitting();
        }}
        onTouchCancel={() => {
          if (isPressingRef.current) handleStopTransmitting();
        }}
        className={`group relative w-48 h-48 md:w-52 md:h-52 rounded-full border-8 border-[#0A0A0A] ${buttonBg} ${buttonShadow} flex flex-col items-center justify-center cursor-pointer transition-all duration-75 active:translate-y-2 active:shadow-[0_2px_0_#0A0A0A] focus:outline-none`}
      >
        {/* Inner Circular Well */}
        <div className={`w-14 h-14 ${iconBg} rounded-full mb-2 flex items-center justify-center border-2 border-[#0A0A0A] shadow-[1px_1px_0px_#0A0A0A]`}>
          {iconComponent}
        </div>

        {/* Primary Action Label */}
        <span className={`font-pixel font-bold text-xs uppercase tracking-tighter ${buttonText} text-center px-2 leading-tight`}>
          {buttonStatusText}
        </span>

        {/* Tactical Key Sub-label */}
        <span className={`font-mono text-[9px] font-bold mt-1 uppercase tracking-widest ${isTransmitting ? 'text-white/80' : 'text-[#0A0A0A]/60'}`}>
          {buttonSubText}
        </span>
      </button>
    </div>
  );
};
