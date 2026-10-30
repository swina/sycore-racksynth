import React, { useRef, useState, useEffect, useCallback } from 'react';
import { EncoderConfig, LedTheme } from '../types/synth';

interface EncoderKnobProps {
  config: EncoderConfig;
  value: number;
  theme: LedTheme;
  isActive: boolean;
  onChange: (value: number) => void;
  onActiveChange: (active: boolean) => void;
}

export const EncoderKnob: React.FC<EncoderKnobProps> = ({
  config,
  value,
  theme,
  isActive,
  onChange,
  onActiveChange,
}) => {
  const knobRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef<number>(0);
  const dragStartVal = useRef<number>(0);

  // Normalize value to 0..1 range
  const normalized = Math.max(0, Math.min(1, (value - config.min) / (config.max - config.min)));
  
  // Angle for the knob pointer: 270 degree arc from -135deg to +135deg
  const angle = -135 + normalized * 270;

  // LED ticks count (17 discrete LEDs around 270 degrees)
  const TOTAL_LEDS = 17;
  const activeLedsCount = Math.round(normalized * TOTAL_LEDS);

  // Handle Dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    onActiveChange(true);
    dragStartY.current = e.clientY;
    dragStartVal.current = value;
  };

  const handleDoubleClick = () => {
    onChange(config.defaultValue);
    onActiveChange(true);
    setTimeout(() => onActiveChange(false), 800);
  };

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    onActiveChange(true);
    const direction = e.deltaY < 0 ? 1 : -1;
    const range = config.max - config.min;
    const stepSize = e.shiftKey ? range * 0.005 : range * 0.025;
    const nextVal = Math.max(config.min, Math.min(config.max, value + direction * stepSize));
    onChange(nextVal);
  }, [config, value, onChange, onActiveChange]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = dragStartY.current - e.clientY;
      const range = config.max - config.min;
      const sensitivity = e.shiftKey ? 400 : 150; // shift for micro fine-tuning
      const deltaVal = (deltaY / sensitivity) * range;
      const nextVal = Math.max(config.min, Math.min(config.max, dragStartVal.current + deltaVal));
      onChange(nextVal);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      onActiveChange(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, config, onChange, onActiveChange]);

  // Touch Support
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      onActiveChange(true);
      dragStartY.current = e.touches[0].clientY;
      dragStartVal.current = value;
    }
  };

  const themeLedColor = {
    amber: {
      on: 'bg-amber-400 shadow-[0_0_6px_#f59e0b]',
      off: 'bg-[#201c18]',
      rim: 'border-amber-500/30',
      activeBorder: 'border-amber-500/80 shadow-[0_0_12px_rgba(245,158,11,0.25)]',
    },
    cyan: {
      on: 'bg-sky-400 shadow-[0_0_6px_#38bdf8]',
      off: 'bg-[#15232d]',
      rim: 'border-sky-500/30',
      activeBorder: 'border-sky-500/80 shadow-[0_0_12px_rgba(56,189,248,0.25)]',
    },
    green: {
      on: 'bg-emerald-400 shadow-[0_0_6px_#22c55e]',
      off: 'bg-[#142319]',
      rim: 'border-emerald-500/30',
      activeBorder: 'border-emerald-500/80 shadow-[0_0_12px_rgba(34,197,94,0.25)]',
    },
  }[theme];

  return (
    <div
      className={`flex flex-col items-center justify-between p-2.5 rounded-lg transition-all duration-150 select-none ${
        isActive
          ? 'bg-[#14181f]/80 ring-1 ring-white/10'
          : 'bg-[#101216]/50 hover:bg-[#13161c]/60'
      }`}
      onWheel={handleWheel}
      title={`${config.label} - Drag vertical or scroll wheel. Double-click to reset.`}
    >
      {/* Top Label */}
      <div className="w-full text-center mb-1.5">
        <div className="flex items-center justify-center gap-1.5">
          <span className="text-[10px] font-mono text-zinc-500 tracking-wider">
            0{config.index}
          </span>
          <span className="text-[11px] font-semibold tracking-wider text-zinc-200">
            {config.label}
          </span>
        </div>
      </div>

      {/* Rotary Encoder Body with Ring of LEDs */}
      <div
        ref={knobRef}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onDoubleClick={handleDoubleClick}
        className="relative w-18 h-18 flex items-center justify-center cursor-ns-resize group"
      >
        {/* LED Ring Arc (17 discrete LEDs around 270 degrees) */}
        {Array.from({ length: TOTAL_LEDS }).map((_, i) => {
          // Angle ranges from -135deg to +135deg (0 is top)
          const stepAngle = -135 + (i / (TOTAL_LEDS - 1)) * 270;
          const rad = (stepAngle - 90) * (Math.PI / 180);
          const radius = 32; // distance from center in px
          const x = Math.cos(rad) * radius;
          const y = Math.sin(rad) * radius;
          const isLit = i <= activeLedsCount;

          return (
            <div
              key={i}
              className={`absolute w-1.5 h-1.5 rounded-full transition-colors duration-75 pointer-events-none ${
                isLit ? themeLedColor.on : themeLedColor.off
              }`}
              style={{
                transform: `translate(${x}px, ${y}px)`,
              }}
            />
          );
        })}

        {/* Center Knurled Knob Cap */}
        <div
          className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-transform ${
            isActive ? themeLedColor.activeBorder : 'border-zinc-800'
          } border shadow-lg`}
          style={{
            background: 'radial-gradient(circle at 40% 35%, #353b45 0%, #1c2027 60%, #121418 100%)',
            boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.2), 0 4px 8px rgba(0,0,0,0.6)',
          }}
        >
          {/* Subtle knurled bezel edge ring */}
          <div className="absolute inset-1 rounded-full border border-white/5 opacity-80" />

          {/* Rotating Pointer Notch */}
          <div
            className="absolute inset-0 flex items-start justify-center transition-transform duration-75"
            style={{ transform: `rotate(${angle}deg)` }}
          >
            <div
              className={`w-1 h-3.5 mt-1 rounded-full ${
                isActive ? themeLedColor.on : 'bg-zinc-200'
              }`}
              style={{
                boxShadow: isActive ? '0 0 6px rgba(255,255,255,0.8)' : '0 1px 2px rgba(0,0,0,0.8)',
              }}
            />
          </div>

          {/* Center Cap Dimple */}
          <div className="w-4 h-4 rounded-full bg-gradient-to-b from-[#181b21] to-[#0c0e12] border border-black/60 shadow-inner" />
        </div>
      </div>

      {/* Value Readout & Sub-Label */}
      <div className="w-full text-center mt-2">
        <div className="text-[11px] font-mono tabular-nums font-semibold tracking-wide text-zinc-100">
          {config.formatValue(value)}
        </div>
        <div className="text-[9px] uppercase tracking-wider text-zinc-500 font-mono">
          {config.subLabel}
        </div>
      </div>
    </div>
  );
};
