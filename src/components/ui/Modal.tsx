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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0A0A0A]/75 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id={id}
        className={`w-full ${maxWidth} bg-[#FFFFFF] border-4 border-[#0A0A0A] shadow-[8px_8px_0px_#0A0A0A] overflow-hidden animate-in fade-in zoom-in-95 duration-100`}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#F5F2E8] border-b-4 border-[#0A0A0A]">
          <div>
            <h2 className="font-pixel text-sm tracking-wider uppercase font-bold text-[#0A0A0A]">
              {title}
            </h2>
            {subtitle && (
              <p className="text-[11px] font-mono text-[#0A0A0A]/70 uppercase mt-0.5 font-bold">
                {subtitle}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            id={`${id}-close-btn`}
            aria-label="Close modal"
            className="w-7 h-7 flex items-center justify-center bg-[#FFFFFF] text-[#0A0A0A] hover:bg-[#FF304F] hover:text-[#FFFFFF] border-2 border-[#0A0A0A] shadow-[2px_2px_0px_#0A0A0A] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 font-mono text-sm text-[#0A0A0A] bg-[#FFFFFF]">{children}</div>
      </div>
    </div>
  );
};
