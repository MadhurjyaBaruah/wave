import React from 'react';

interface WaveLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showTagline?: boolean;
  className?: string;
  isTransmitting?: boolean;
}

export const WaveLogo: React.FC<WaveLogoProps> = ({
  size = 'md',
  showTagline = false,
  className = '',
  isTransmitting = false,
}) => {
  const sizeMap = {
    sm: { text: 'text-sm', badge: 'text-[9px] px-1.5 py-0.5', bars: 'h-3' },
    md: { text: 'text-lg', badge: 'text-[11px] px-2.5 py-1', bars: 'h-4' },
    lg: { text: 'text-2xl', badge: 'text-xs px-3 py-1', bars: 'h-5' },
    xl: { text: 'text-3xl', badge: 'text-sm px-4 py-1.5', bars: 'h-6' },
  };

  const current = sizeMap[size];
  const accentText = isTransmitting ? 'text-[#FF304F]' : 'text-[#39FF14]';

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Geometric Block Banner */}
      <div className="flex items-center gap-2">
        <div
          className={`bg-[#0A0A0A] ${accentText} font-pixel font-bold tracking-tighter border-2 border-[#0A0A0A] shadow-[2px_2px_0px_#0A0A0A] ${current.badge} flex items-center gap-2`}
        >
          <span>WAVE // 104.7</span>
          {isTransmitting && (
            <span className="w-2 h-2 bg-[#FF304F] animate-transmitting-pulse" />
          )}
        </div>

        {/* Stepped Geometric Signal Bars */}
        <div className={`flex gap-1 items-end ${current.bars}`}>
          <div className="w-1 h-2 bg-[#0A0A0A]"></div>
          <div className="w-1 h-3 bg-[#0A0A0A]"></div>
          <div className="w-1 h-4 bg-[#0A0A0A]"></div>
          <div className="w-1 h-2 bg-[#0A0A0A] opacity-30"></div>
          <div className="w-1 h-3 bg-[#0A0A0A] opacity-30"></div>
        </div>
      </div>

      {showTagline && (
        <span className="hidden sm:inline-block font-mono text-xs font-bold text-[#0A0A0A] uppercase tracking-widest pl-1 border-l-2 border-[#0A0A0A]">
          Press. Talk. Release.
        </span>
      )}
    </div>
  );
};
