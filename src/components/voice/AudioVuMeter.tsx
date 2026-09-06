import React from 'react';

interface AudioVuMeterProps {
  level: number; // 0 to 100
  isTransmitting: boolean;
  className?: string;
}

export const AudioVuMeter: React.FC<AudioVuMeterProps> = ({
  level,
  isTransmitting,
  className = '',
}) => {
  const displayPercent = isTransmitting ? Math.max(8, level) : 0;

  return (
    <div className={`w-full space-y-1.5 select-none ${className}`}>
      <div className="flex justify-between text-[10px] font-black uppercase tracking-wider text-[#0A0A0A]">
        <span>Microphone Signal Level</span>
        <span className={isTransmitting ? 'text-[#0A0A0A]' : 'text-[#0A0A0A]/50'}>
          {isTransmitting ? `${displayPercent}%` : 'MUTED'}
        </span>
      </div>

      {/* Geometric Hard-Border Meter */}
      <div className="h-5 w-full bg-[#FFFFFF] border-2 border-[#0A0A0A] shadow-[2px_2px_0px_#0A0A0A] flex p-0.5 items-center">
        <div
          className={`h-full transition-all duration-75 ${
            displayPercent > 85
              ? 'bg-[#FF304F]'
              : displayPercent > 60
              ? 'bg-[#FFD400]'
              : 'bg-[#39FF14]'
          }`}
          style={{ width: `${displayPercent}%` }}
        />
      </div>
    </div>
  );
};
