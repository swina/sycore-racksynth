import React from 'react';
import { LedTheme } from '../types/synth';
import { synthAudio } from '../audio/synthEngine';

interface ToggleSwitchProps {
  id: string;
  label: string;
  topLabel: string;
  topSub?: string;
  bottomLabel: string;
  bottomSub?: string;
  value: boolean; // false = Top position, true = Bottom position
  theme: LedTheme;
  onChange: (value: boolean) => void;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  label,
  topLabel,
  topSub,
  bottomLabel,
  bottomSub,
  value,
  theme,
  onChange,
}) => {
  const handleClick = () => {
    synthAudio.playSwitchSound();
    onChange(!value);
  };

  const themeGlow = {
    amber: {
      on: 'bg-amber-400 shadow-[0_0_8px_#f59e0b]',
      off: 'bg-zinc-800 border-zinc-700',
    },
    cyan: {
      on: 'bg-sky-400 shadow-[0_0_8px_#38bdf8]',
      off: 'bg-zinc-800 border-zinc-700',
    },
    green: {
      on: 'bg-emerald-400 shadow-[0_0_8px_#22c55e]',
      off: 'bg-zinc-800 border-zinc-700',
    },
  }[theme];

  return (
    <div className="flex flex-col items-center justify-between p-3 rounded-lg bg-[#101216]/60 border border-zinc-800/80 shadow-inner h-full min-w-[90px]">
      {/* Title */}
      <span className="text-[10px] font-mono tracking-wider text-zinc-400 uppercase font-semibold">
        {label}
      </span>

      {/* Top Label & Indicator */}
      <div className="flex items-center gap-1.5 my-1">
        <div
          className={`w-2 h-2 rounded-full border transition-all duration-150 ${
            !value ? themeGlow.on : themeGlow.off
          }`}
        />
        <div className="flex flex-col text-left">
          <span
            className={`text-[10px] font-mono font-bold tracking-tight transition-colors ${
              !value ? 'text-zinc-100' : 'text-zinc-500'
            }`}
          >
            {topLabel}
          </span>
          {topSub && <span className="text-[8px] font-mono text-zinc-500">{topSub}</span>}
        </div>
      </div>

      {/* Heavy Duty Metal Bat Toggle Control */}
      <button
        type="button"
        onClick={handleClick}
        className="relative my-2 w-10 h-16 rounded-md bg-[#0a0c0e] border border-zinc-700/80 flex flex-col items-center justify-center cursor-pointer shadow-inner group focus:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400"
        title={`Toggle ${label} (currently ${!value ? topLabel : bottomLabel})`}
      >
        {/* Hex Mounting Nut / Bezel */}
        <div className="absolute w-8 h-8 rounded-full border border-zinc-600/70 bg-gradient-to-b from-[#3a414b] to-[#1c2025] flex items-center justify-center shadow-md">
          <div className="w-5 h-5 rounded-full bg-gradient-to-t from-[#20252b] to-[#101216] border border-black" />
        </div>

        {/* Metal Toggle Bat with Physical Angled Perspective */}
        <div
          className={`relative z-10 w-3.5 h-10 rounded-full transition-transform duration-150 origin-center ease-out ${
            !value ? '-translate-y-2.5 rotate-[-12deg]' : 'translate-y-2.5 rotate-[12deg]'
          }`}
          style={{
            background: 'linear-gradient(90deg, #d4d4d8 0%, #ffffff 35%, #71717a 85%, #27272a 100%)',
            boxShadow: !value
              ? '0 6px 8px rgba(0,0,0,0.7), inset 0 2px 2px rgba(255,255,255,0.8)'
              : '0 -4px 6px rgba(0,0,0,0.8), inset 0 -2px 2px rgba(255,255,255,0.8)',
          }}
        >
          {/* Chrome reflection line */}
          <div className="w-0.5 h-full mx-auto bg-white/60" />
        </div>
      </button>

      {/* Bottom Label & Indicator */}
      <div className="flex items-center gap-1.5 my-1">
        <div
          className={`w-2 h-2 rounded-full border transition-all duration-150 ${
            value ? themeGlow.on : themeGlow.off
          }`}
        />
        <div className="flex flex-col text-left">
          <span
            className={`text-[10px] font-mono font-bold tracking-tight transition-colors ${
              value ? 'text-zinc-100' : 'text-zinc-500'
            }`}
          >
            {bottomLabel}
          </span>
          {bottomSub && <span className="text-[8px] font-mono text-zinc-500">{bottomSub}</span>}
        </div>
      </div>
    </div>
  );
};
