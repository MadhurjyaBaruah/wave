import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: string;
  id?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'max-w-lg',
  id = 'wave-modal',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      id={`${id}-backdrop`}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-[#0A0A0A]/75 backdrop-blur-[2px] overflow-hidden"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id={id}
        className={`w-full ${maxWidth} max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] flex flex-col bg-[#FFFFFF] border-3 sm:border-4 border-[#0A0A0A] shadow-[4px_4px_0px_#0A0A0A] sm:shadow-[8px_8px_0px_#0A0A0A] overflow-hidden animate-in fade-in zoom-in-95 duration-100`}
      >
        {/* Modal Header */}
        <div className="shrink-0 flex items-center justify-between px-4 sm:px-5 py-2.5 sm:py-3.5 bg-[#F5F2E8] border-b-3 sm:border-b-4 border-[#0A0A0A]">
          <div className="pr-2 truncate">
            <h2 className="font-pixel text-xs sm:text-sm tracking-wider uppercase font-bold text-[#0A0A0A] truncate">
              {title}
            </h2>
            {subtitle && (
              <p className="text-[10px] sm:text-[11px] font-mono text-[#0A0A0A]/70 uppercase mt-0.5 font-bold truncate">
                {subtitle}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            id={`${id}-close-btn`}
            aria-label="Close modal"
            className="w-7 h-7 shrink-0 flex items-center justify-center bg-[#FFFFFF] text-[#0A0A0A] hover:bg-[#FF304F] hover:text-[#FFFFFF] border-2 border-[#0A0A0A] shadow-[2px_2px_0px_#0A0A0A] transition-colors cursor-pointer active:translate-y-0.5"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Content - Scrollable if content is tall */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 font-mono text-xs sm:text-sm text-[#0A0A0A] bg-[#FFFFFF]">
          {children}
        </div>
      </div>
    </div>
  );
};
