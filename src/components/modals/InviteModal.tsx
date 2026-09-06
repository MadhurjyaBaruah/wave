import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Server } from '../../types/database';
import { Copy, Check } from 'lucide-react';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  server: Server;
}

export const InviteModal: React.FC<InviteModalProps> = ({
  isOpen,
  onClose,
  server,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const inviteLink = typeof window !== 'undefined'
    ? `${window.location.origin}?invite=${server.invite_code}`
    : `https://wave.app?invite=${server.invite_code}`;

  const copyCode = () => {
    navigator.clipboard.writeText(server.invite_code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="INVITE PEOPLE"
      subtitle={`Share connection credentials for ${server.name}`}
    >
      <div className="space-y-5">
        <div className="p-6 bg-[#F5F2E8] border-4 border-[#0A0A0A] shadow-[6px_6px_0px_#0A0A0A] text-center space-y-3">
          <div className="text-xs text-[#0A0A0A]/70 font-mono font-bold uppercase tracking-wider">
            SHARE THIS CODE
          </div>
          <div className="font-pixel text-3xl md:text-4xl text-[#0A0A0A] tracking-widest font-black">
            {server.invite_code}
          </div>
          <button
            onClick={copyCode}
            id="copy-invite-code-btn"
            className="retro-btn retro-btn-green px-5 py-2.5 text-xs font-black inline-flex items-center gap-2 shadow-[3px_3px_0px_#0A0A0A] active:translate-y-0.5"
          >
            {copiedCode ? <Check size={14} /> : <Copy size={14} />}
            <span>{copiedCode ? 'CODE COPIED!' : 'COPY CODE'}</span>
          </button>
        </div>

        <div className="space-y-1">
          <label className="text-xs uppercase font-bold text-[#0A0A0A]">
            Direct Link
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={inviteLink}
              className="flex-1 bg-[#F5F2E8] border-2 border-[#0A0A0A] px-3 py-2 text-xs text-[#0A0A0A] font-bold font-mono select-all focus:outline-none shadow-[2px_2px_0px_#0A0A0A]"
            />
            <button
              onClick={copyLink}
              id="copy-invite-link-btn"
              className="retro-btn px-4 py-2 text-xs font-black flex items-center gap-1.5 shadow-[2px_2px_0px_#0A0A0A] active:translate-y-0.5"
            >
              {copiedLink ? <Check size={14} /> : <Copy size={14} />}
              <span>{copiedLink ? 'COPIED' : 'COPY'}</span>
            </button>
          </div>
        </div>

        <div className="p-3 bg-[#F5F2E8] border-2 border-[#0A0A0A] text-xs text-[#0A0A0A] font-bold">
          Recipients can enter this code in <span className="underline">[ JOIN A SERVER ]</span> on the dashboard or landing page.
        </div>
      </div>
    </Modal>
  );
};
