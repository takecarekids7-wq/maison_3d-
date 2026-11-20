import React, { useState } from 'react';
import { RotateCw, X } from 'lucide-react';

interface OriginalPlanModalProps {
  onClose: () => void;
}

export const OriginalPlanModal: React.FC<OriginalPlanModalProps> = ({ onClose }) => {
  // Photo was captured upside down; default to 180deg right-side up to match 3D model
  const [rotated180, setRotated180] = useState(true);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Plan manuscrit original"
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-white/15 bg-[#181a1e] text-zinc-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
          <div className="flex items-center gap-3 text-sm">
            <span className="font-semibold">Plan original fourni</span>
            <span className="text-zinc-500" aria-hidden="true">
              ·
            </span>
            <span className="font-mono-tabular text-xs text-zinc-400">
              {rotated180 ? 'Redressé 180° (aligné sur la 3D)' : 'Orientation brute de la photo'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRotated180((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-white/10 whitespace-nowrap shrink-0"
            >
              <RotateCw className="h-3.5 w-3.5" />
              Pivoter 180°
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center overflow-auto bg-[#111317] p-4">
          <img
            src="/assets/aistudio/IMG-20261117-WA0000_406f3ec0.jpg"
            alt="Plan architectural manuscrit de la villa 22m par 15m"
            referrerPolicy="no-referrer"
            className={`max-h-[74vh] w-auto rounded object-contain transition-transform duration-300 ${
              rotated180 ? 'rotate-180' : ''
            }`}
          />
        </div>
      </div>
    </div>
  );
};
