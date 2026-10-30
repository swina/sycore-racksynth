import React, { useEffect, useRef, useState } from 'react';
import { ActiveParamInfo, LedTheme, SynthPatch } from '../types/synth';
import { synthAudio } from '../audio/synthEngine';
import { Activity, BarChart2, Radio, Sparkles } from 'lucide-react';

interface LedDisplayProps {
  currentPatch: SynthPatch;
  activeParam: ActiveParamInfo | null;
  theme: LedTheme;
  onThemeChange: (theme: LedTheme) => void;
  voiceCount: number;
  filterMode: boolean; // false = 24dB, true = 12dB
  voiceMode: boolean;  // false = POLY, true = ARP
  midiChannel?: number;
  lastMidiEvent?: string | null;
  isMidiConnected?: boolean;
  onOpenMidiSettings?: () => void;
}

export const LedDisplay: React.FC<LedDisplayProps> = ({
  currentPatch,
  activeParam,
  theme,
  onThemeChange,
  voiceCount,
  filterMode,
  voiceMode,
  midiChannel = 0,
  lastMidiEvent,
  isMidiConnected = false,
  onOpenMidiSettings,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [displayMode, setDisplayMode] = useState<'wave' | 'fft'>('wave');
  const [vuLevel, setVuLevel] = useState<number>(0);

  // Setup live audio visualizer
  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analyser = synthAudio.getAnalyser();
    const bufferLength = analyser ? analyser.frequencyBinCount : 256;
    const timeData = new Uint8Array(bufferLength);
    const freqData = new Uint8Array(bufferLength);

    const render = () => {
      animId = requestAnimationFrame(render);
      const width = canvas.width;
      const height = canvas.height;

      // Dark background with faint phosphor persistence
      ctx.fillStyle = 'rgba(6, 8, 10, 0.45)';
      ctx.fillRect(0, 0, width, height);

      // Colors based on LED Theme
      let strokeColor = '#f59e0b';
      let glowColor = 'rgba(245, 158, 11, 0.4)';
      let gridColor = 'rgba(245, 158, 11, 0.08)';

      if (theme === 'cyan') {
        strokeColor = '#38bdf8';
        glowColor = 'rgba(56, 189, 248, 0.4)';
        gridColor = 'rgba(56, 189, 248, 0.08)';
      } else if (theme === 'green') {
        strokeColor = '#22c55e';
        glowColor = 'rgba(34, 197, 94, 0.4)';
        gridColor = 'rgba(34, 197, 94, 0.08)';
      }

      // Draw subtle phosphor matrix grid
      ctx.lineWidth = 1;
      ctx.strokeStyle = gridColor;
      const gridStep = 20;
      for (let x = 0; x < width; x += gridStep) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridStep) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Center zero-line
      ctx.strokeStyle = glowColor;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      if (analyser && synthAudio.isAudioActive()) {
        if (displayMode === 'wave') {
          analyser.getByteTimeDomainData(timeData);

          // Calculate average amplitude for VU meter
          let sumSquares = 0;
          for (let i = 0; i < timeData.length; i++) {
            const val = (timeData[i] - 128) / 128;
            sumSquares += val * val;
          }
          const rms = Math.sqrt(sumSquares / timeData.length);
          setVuLevel(Math.min(1, rms * 3.5));

          // Draw Oscilloscope trace
          ctx.beginPath();
          ctx.lineWidth = 2.0;
          ctx.strokeStyle = strokeColor;
          ctx.shadowBlur = 8;
          ctx.shadowColor = strokeColor;

          const sliceWidth = width / bufferLength;
          let x = 0;

          for (let i = 0; i < bufferLength; i++) {
            const v = timeData[i] / 128.0;
            const y = (v * height) / 2;

            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
            x += sliceWidth;
          }

          ctx.stroke();
          ctx.shadowBlur = 0; // reset
        } else {
          // FFT Spectrum Analyzer
          analyser.getByteFrequencyData(freqData);

          // RMS for VU
          let maxF = 0;
          for (let i = 0; i < 64; i++) {
            if (freqData[i] > maxF) maxF = freqData[i];
          }
          setVuLevel(maxF / 255);

          const barCount = 36;
          const barWidth = (width / barCount) - 2;

          for (let i = 0; i < barCount; i++) {
            const dataIndex = Math.floor((i / barCount) * (freqData.length * 0.6));
            const barHeight = ((freqData[dataIndex] || 0) / 255) * (height - 10);

            ctx.fillStyle = strokeColor;
            ctx.shadowBlur = 6;
            ctx.shadowColor = glowColor;
            ctx.fillRect(
              i * (barWidth + 2) + 2,
              height - barHeight - 2,
              barWidth,
              barHeight
            );
          }
          ctx.shadowBlur = 0;
        }
      } else {
        // Idle ambient oscilloscope wave
        setVuLevel(0.04);
        ctx.beginPath();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = strokeColor;
        ctx.shadowBlur = 5;
        ctx.shadowColor = glowColor;

        const time = Date.now() * 0.003;
        for (let x = 0; x < width; x += 3) {
          const y = height / 2 + Math.sin(x * 0.05 + time) * 6 * Math.cos(time * 0.5);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [theme, displayMode]);

  const themeClasses = {
    amber: {
      text: 'text-amber-400',
      border: 'border-amber-500/30',
      glow: 'shadow-[0_0_15px_rgba(245,158,11,0.15)]',
      barFill: 'bg-amber-400 shadow-[0_0_8px_#f59e0b]',
      barEmpty: 'bg-amber-950/40',
      badge: 'text-amber-300 border-amber-500/40 bg-amber-500/10',
    },
    cyan: {
      text: 'text-sky-400',
      border: 'border-sky-500/30',
      glow: 'shadow-[0_0_15px_rgba(56,189,248,0.15)]',
      barFill: 'bg-sky-400 shadow-[0_0_8px_#38bdf8]',
      barEmpty: 'bg-sky-950/40',
      badge: 'text-sky-300 border-sky-500/40 bg-sky-500/10',
    },
    green: {
      text: 'text-emerald-400',
      border: 'border-emerald-500/30',
      glow: 'shadow-[0_0_15px_rgba(34,197,94,0.15)]',
      barFill: 'bg-emerald-400 shadow-[0_0_8px_#22c55e]',
      barEmpty: 'bg-emerald-950/40',
      badge: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10',
    },
  }[theme];

  // VU meter discrete LEDs count
  const vuSegments = 8;
  const activeVuSegments = Math.round(vuLevel * vuSegments);

  return (
    <div
      className={`relative w-full rounded-md border ${themeClasses.border} ${themeClasses.glow} bg-[#040608] led-screen-bezel p-3 flex flex-col justify-between overflow-hidden`}
      style={{ minHeight: '190px' }}
    >
      {/* Phosphor Scanlines Glass Reflection */}
      <div className="absolute inset-0 pointer-events-none scanlines z-20 opacity-40" />
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-transparent via-white/[0.02] to-transparent z-20" />

      {/* TOP HEADER: Patch info & Quick status */}
      <div className="relative z-30 flex items-center justify-between border-b border-white/10 pb-2 mb-2 font-mono text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-zinc-400 tracking-wider">PATCH</span>
            <span className={`font-bold text-sm tracking-wider ${themeClasses.text}`}>
              {currentPatch.number}
            </span>
          </div>

          <div className="h-3 w-px bg-white/20" />

          <div className="flex items-center gap-2">
            <span className="font-bold tracking-wider text-zinc-100 text-sm">
              {currentPatch.name}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${themeClasses.badge}`}>
              {currentPatch.category}
            </span>
          </div>
        </div>

        {/* Right side: Hardware switch indicators and Theme picker */}
        <div className="flex items-center gap-3 text-[10px]">
          <div className="flex items-center gap-1.5 text-zinc-400">
            <span>FLT:</span>
            <span className={`font-semibold ${themeClasses.text}`}>
              {!filterMode ? '24dB LADDER' : '12dB STATE-VAR'}
            </span>
          </div>

          <div className="h-3 w-px bg-white/20" />

          <div className="flex items-center gap-1.5 text-zinc-400">
            <span>VOICE:</span>
            <span className={`font-semibold ${themeClasses.text}`}>
              {!voiceMode ? 'POLYPHONIC' : 'ARPEGGIATOR'}
            </span>
          </div>

          <div className="h-3 w-px bg-white/20" />

          {/* Theme selector */}
          <div className="flex items-center gap-1">
            {(['amber', 'cyan', 'green'] as LedTheme[]).map((t) => (
              <button
                key={t}
                onClick={() => onThemeChange(t)}
                className={`w-3 h-3 rounded-full transition-transform ${
                  theme === t ? 'scale-125 ring-1 ring-white' : 'opacity-40 hover:opacity-80'
                }`}
                style={{
                  backgroundColor: t === 'amber' ? '#f59e0b' : t === 'cyan' ? '#38bdf8' : '#22c55e',
                }}
                title={`Switch LED theme to ${t}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* CENTER STAGE: Split between Real-time Parameter HUD and Real-time Oscilloscope */}
      <div className="relative z-30 grid grid-cols-1 md:grid-cols-12 gap-3 flex-1 items-center">
        {/* LEFT / HUD: Active Parameter Real-Time Feedback */}
        <div className="md:col-span-5 flex flex-col justify-center pr-2 font-mono border-r border-white/10">
          {activeParam ? (
            <div className="space-y-1.5 animate-fadeIn">
              <div className="flex items-center justify-between text-[11px] text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-white/70" />
                  <span>EDITING PARAMETER</span>
                </span>
                <span className={`text-[10px] font-bold ${themeClasses.text}`}>
                  {Math.round(activeParam.rawPercent)}%
                </span>
              </div>

              <div className="flex items-baseline justify-between">
                <span className={`text-base font-bold tracking-wider ${themeClasses.text}`}>
                  {activeParam.label}
                </span>
                <span className="text-xl font-bold text-white tracking-wide tabular-nums">
                  {activeParam.valueStr}
                </span>
              </div>

              {/* Segmented LED Bar Graph */}
              <div className="grid grid-cols-20 gap-0.5 w-full pt-1">
                {Array.from({ length: 20 }).map((_, i) => {
                  const percentVal = (i + 1) * 5;
                  const isFilled = percentVal <= activeParam.rawPercent;
                  return (
                    <div
                      key={i}
                      className={`h-3 rounded-xs transition-colors duration-75 ${
                        isFilled ? themeClasses.barFill : themeClasses.barEmpty
                      }`}
                    />
                  );
                })}
              </div>

              <div className="flex justify-between text-[9px] text-zinc-500 pt-0.5">
                <span>MIN</span>
                <span>50%</span>
                <span>MAX</span>
              </div>
            </div>
          ) : (
            <div className="space-y-1 text-zinc-400">
              <div className="text-[10px] tracking-wider text-zinc-500 uppercase">SYNTH ENGINE STATUS</div>
              <div className={`text-sm font-semibold tracking-wide ${themeClasses.text}`}>
                HARDWARE READY
              </div>
              <div className="text-[11px] text-zinc-400 leading-tight">
                Turn any of the 8 encoders to edit parameters or play notes to view the real-time oscilloscope.
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Real-time Oscilloscope & Spectrum Canvas */}
        <div className="md:col-span-7 relative h-28 flex flex-col justify-center">
          <canvas
            ref={canvasRef}
            width={380}
            height={110}
            className="w-full h-full rounded border border-white/5"
          />

          {/* Mode Switch Overlay Buttons */}
          <div className="absolute top-1 right-1 flex items-center gap-1 z-30">
            <button
              onClick={() => setDisplayMode('wave')}
              className={`px-1.5 py-0.5 text-[9px] font-mono rounded flex items-center gap-1 ${
                displayMode === 'wave'
                  ? `${themeClasses.badge} font-bold`
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Activity className="w-2.5 h-2.5" />
              <span>OSC</span>
            </button>
            <button
              onClick={() => setDisplayMode('fft')}
              className={`px-1.5 py-0.5 text-[9px] font-mono rounded flex items-center gap-1 ${
                displayMode === 'fft'
                  ? `${themeClasses.badge} font-bold`
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <BarChart2 className="w-2.5 h-2.5" />
              <span>FFT</span>
            </button>
          </div>
        </div>
      </div>

      {/* BOTTOM FOOTER: Polyphony voices, VU meter, and MIDI telemetry */}
      <div className="relative z-30 flex items-center justify-between border-t border-white/10 pt-1.5 mt-2 font-mono text-[10px] text-zinc-400">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span>VOICES:</span>
            <span className={`font-semibold tabular-nums ${themeClasses.text}`}>
              {voiceCount}/8
            </span>
          </div>

          {/* MIDI Telemetry and Activity Lamp */}
          <button
            type="button"
            onClick={onOpenMidiSettings}
            className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer group"
            title="Open MIDI settings"
          >
            <Radio className={`w-3 h-3 ${isMidiConnected ? themeClasses.text : 'text-zinc-500'}`} />
            <span>MIDI:</span>
            <span className={`font-semibold ${isMidiConnected ? 'text-zinc-100' : 'text-zinc-400'}`}>
              {midiChannel === 0 ? 'OMNI' : `CH ${String(midiChannel).padStart(2, '0')}`}
            </span>
            {/* Blinking RX LED */}
            <div
              className={`w-1.5 h-1.5 rounded-full transition-all duration-75 ${
                lastMidiEvent
                  ? 'bg-emerald-400 shadow-[0_0_6px_#10b981]'
                  : isMidiConnected
                  ? 'bg-zinc-600'
                  : 'bg-zinc-800'
              }`}
            />
          </button>

          {lastMidiEvent ? (
            <div className="hidden sm:flex items-center gap-1 text-[9px] text-zinc-300 bg-white/5 px-2 py-0.5 rounded border border-white/10 animate-pulse">
              <span>RX:</span>
              <span className={`font-semibold ${themeClasses.text}`}>{lastMidiEvent}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span>CLOCK:</span>
              <span className="text-zinc-200">128 BPM</span>
            </div>
          )}
        </div>

        {/* Hardware VU Meter */}
        <div className="flex items-center gap-2">
          <span className="text-[9px] tracking-wider text-zinc-500">OUTPUT VU</span>
          <div className="flex items-center gap-0.5">
            {Array.from({ length: vuSegments }).map((_, i) => {
              const isLit = i <= activeVuSegments;
              let segColor = 'bg-emerald-500 shadow-[0_0_4px_#10b981]';
              if (i >= 5) segColor = 'bg-amber-400 shadow-[0_0_4px_#f59e0b]';
              if (i >= 7) segColor = 'bg-red-500 shadow-[0_0_4px_#ef4444]';

              return (
                <div
                  key={i}
                  className={`w-1.5 h-3 rounded-xs transition-colors duration-75 ${
                    isLit ? segColor : 'bg-zinc-800/80'
                  }`}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
