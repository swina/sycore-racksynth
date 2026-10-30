import React, { useState } from 'react';
import { SynthPatch, LedTheme } from '../types/synth';
import { ChevronLeft, ChevronRight, Folder, RefreshCw, Shuffle } from 'lucide-react';

interface PatchBrowserProps {
  patches: SynthPatch[];
  currentPatch: SynthPatch;
  theme: LedTheme;
  onSelectPatch: (patch: SynthPatch) => void;
  onRandomize: () => void;
  onInit: () => void;
}

export const PatchBrowser: React.FC<PatchBrowserProps> = ({
  patches,
  currentPatch,
  theme,
  onSelectPatch,
  onRandomize,
  onInit,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  const currentIndex = patches.findIndex((p) => p.id === currentPatch.id);

  const handlePrev = () => {
    const prevIdx = (currentIndex - 1 + patches.length) % patches.length;
    onSelectPatch(patches[prevIdx]);
  };

  const handleNext = () => {
    const nextIdx = (currentIndex + 1) % patches.length;
    onSelectPatch(patches[nextIdx]);
  };

  const categories = ['ALL', 'PAD', 'BASS', 'LEAD', 'PLUCK', 'AMBIENT', 'SYNTH'];

  const filteredPatches = filterCategory === 'ALL'
    ? patches
    : patches.filter((p) => p.category === filterCategory);

  const themeBorder = {
    amber: 'border-amber-500/40 text-amber-400',
    cyan: 'border-sky-500/40 text-sky-400',
    green: 'border-emerald-500/40 text-emerald-400',
  }[theme];

  return (
    <div className="relative flex items-center gap-2">
      {/* Stepper Buttons (PREV / NEXT) */}
      <div className="flex items-center rounded bg-[#101216] border border-zinc-800 p-0.5 shadow-sm">
        <button
          onClick={handlePrev}
          title="Previous Patch"
          className="p-1.5 rounded hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="w-px h-4 bg-zinc-800" />
        <button
          onClick={handleNext}
          title="Next Patch"
          className="p-1.5 rounded hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Browse Library Modal Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-[#101216] border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white text-xs font-mono transition-all"
        title="Open Patch Bank Browser"
      >
        <Folder className="w-3.5 h-3.5" />
        <span>BANK</span>
      </button>

      {/* Randomize button */}
      <button
        onClick={onRandomize}
        className="p-1.5 rounded bg-[#101216] border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
        title="Randomize Parameters"
      >
        <Shuffle className="w-3.5 h-3.5" />
      </button>

      {/* Init Patch */}
      <button
        onClick={onInit}
        className="p-1.5 rounded bg-[#101216] border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
        title="Initialize Default Patch"
      >
        <RefreshCw className="w-3.5 h-3.5" />
      </button>

      {/* Patch Library Dropdown Modal */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 top-full mt-2 z-50 w-80 sm:w-96 rounded-lg bg-[#0e1116] border border-zinc-800 shadow-2xl p-3 font-mono">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-2">
              <span className="text-xs font-bold tracking-wider text-zinc-200">
                PRESET BANK ARCHIVE
              </span>
              <button
                onClick={() => setIsOpen(false)}
                className="text-xs text-zinc-500 hover:text-zinc-300"
              >
                CLOSE [ESC]
              </button>
            </div>

            {/* Category tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-2 mb-2 text-[10px]">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(cat)}
                  className={`px-2 py-0.5 rounded transition-colors whitespace-nowrap ${
                    filterCategory === cat
                      ? 'bg-zinc-800 text-white font-bold'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Patch List */}
            <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
              {filteredPatches.map((patch) => {
                const isSelected = patch.id === currentPatch.id;
                return (
                  <button
                    key={patch.id}
                    onClick={() => {
                      onSelectPatch(patch);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left p-2 rounded flex flex-col gap-0.5 transition-all ${
                      isSelected
                        ? `bg-zinc-800/80 border ${themeBorder}`
                        : 'bg-[#12151b] hover:bg-[#161a22] border border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-zinc-200">
                        {patch.number} {patch.name}
                      </span>
                      <span className="text-[10px] text-zinc-500 font-normal">
                        [{patch.category}]
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-400 line-clamp-1">
                      {patch.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
