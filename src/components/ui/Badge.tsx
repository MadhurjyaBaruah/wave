import React from 'react';

interface BadgeProps {
  variant?: 'green' | 'red' | 'yellow' | 'blue' | 'neutral';
  children: React.ReactNode;
  pulse?: boolean;
  className?: string;
  id?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  children,
  pulse = false,
  className = '',
  id,
}) => {
  const ledColors = {
    green: 'bg-[#39FF14]',
    red: 'bg-[#FF304F]',
    yellow: 'bg-[#FFD400]',
    blue: 'bg-[#3B82F6]',
    neutral: 'bg-[#0A0A0A]',
  };

  return (
    <span
      id={id}
      className={`inline-flex items-center gap-2 px-2.5 py-1 text-xs font-mono font-bold tracking-widest uppercase border-2 border-[#0A0A0A] bg-[#FFFFFF] text-[#0A0A0A] shadow-[2px_2px_0px_#0A0A0A] ${className}`}
    >
      <span
        className={`w-2.5 h-2.5 border border-[#0A0A0A] ${ledColors[variant]} ${
          pulse ? 'animate-transmitting-pulse' : ''
        }`}
      />
      <span>{children}</span>
    </span>
  );
};
