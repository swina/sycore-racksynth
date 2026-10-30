import React, { useEffect, useState, useCallback, useRef } from 'react';
import { synthAudio } from '../audio/synthEngine';
import { midiService, MidiEventLog } from '../services/midiService';
import { LedTheme } from '../types/synth';
import { Play, Square, Music, Volume2, Radio } from 'lucide-react';

interface KeyboardControllerProps {
  theme: LedTheme;
  onVoiceCountChange: (count: number) => void;
  isArpActive: boolean;
}

interface KeyNote {
  note: number; // MIDI number
  name: string;
  isBlack: boolean;
  charKey: string;
}

export const KeyboardController: React.FC<KeyboardControllerProps> = ({
  theme,
  onVoiceCountChange,
  isArpActive,
}) => {
  const [octave, setOctave] = useState<number>(3); // Base octave 3 (C3 = 48)
  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set());
  const [isDroneActive, setIsDroneActive] = useState<boolean>(false);
  const [droneNote, setDroneNote] = useState<number | null>(null);
  const [pitchBendVal, setPitchBendVal] = useState<number>(0); // -1 to +1
  const [modWheelVal, setModWheelVal] = useState<number>(0);   // 0 to 1
  const [midiDeviceName, setMidiDeviceName] = useState<string | null>(null);

  // Generate 2 octaves of notes (25 keys: C to C+2)
  const generateKeys = (baseOctave: number): KeyNote[] => {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const charMap = ['A', 'W', 'S', 'E', 'D', 'F', 'T', 'G', 'Y', 'H', 'U', 'J', 'K', 'O', 'L', 'P', ';'];
    const keys: KeyNote[] = [];

    const startMidi = (baseOctave + 1) * 12; // C3 is 48
    for (let i = 0; i <= 24; i++) {
      const midi = startMidi + i;
      const noteInOct = i % 12;
      const isBlack = [1, 3, 6, 8, 10].includes(noteInOct);
      const name = `${noteNames[noteInOct]}${Math.floor(midi / 12) - 1}`;
      const charKey = charMap[i] || '';
      keys.push({ note: midi, name, isBlack, charKey });
    }
    return keys;
  };

  const keys = generateKeys(octave);

  const startNote = useCallback((midi: number) => {
    synthAudio.resume();
    synthAudio.noteOn(midi, 0.85);
    setActiveNotes((prev) => {
      const next = new Set(prev).add(midi);
      onVoiceCountChange(next.size + (isDroneActive ? 1 : 0));
      return next;
    });
  }, [onVoiceCountChange, isDroneActive]);

  const stopNote = useCallback((midi: number) => {
    // If drone is locked to this note, keep it
    if (isDroneActive && droneNote === midi) return;

    synthAudio.noteOff(midi);
    setActiveNotes((prev) => {
      const next = new Set(prev);
      next.delete(midi);
      onVoiceCountChange(next.size + (isDroneActive ? 1 : 0));
      return next;
    });
  }, [onVoiceCountChange, isDroneActive, droneNote]);

  // Toggle Continuous Drone Note for Hands-Free Encoder Tweaking
  const toggleDrone = () => {
    synthAudio.resume();
    if (isDroneActive) {
      if (droneNote !== null) {
        synthAudio.noteOff(droneNote);
      }
      setIsDroneActive(false);
      setDroneNote(null);
      onVoiceCountChange(activeNotes.size);
    } else {
      const baseMidi = (octave + 1) * 12; // C of current octave
      synthAudio.noteOn(baseMidi, 0.75);
      setIsDroneActive(true);
      setDroneNote(baseMidi);
      onVoiceCountChange(activeNotes.size + 1);
    }
  };

  // Keyboard Event Listeners for Computer Keyboard playing
  useEffect(() => {
    const keyToMidiMap: { [key: string]: number } = {
      KeyA: (octave + 1) * 12,      // C
      KeyW: (octave + 1) * 12 + 1,  // C#
      KeyS: (octave + 1) * 12 + 2,  // D
      KeyE: (octave + 1) * 12 + 3,  // D#
      KeyD: (octave + 1) * 12 + 4,  // E
      KeyF: (octave + 1) * 12 + 5,  // F
      KeyT: (octave + 1) * 12 + 6,  // F#
      KeyG: (octave + 1) * 12 + 7,  // G
      KeyY: (octave + 1) * 12 + 8,  // G#
      KeyH: (octave + 1) * 12 + 9,  // A
      KeyU: (octave + 1) * 12 + 10, // A#
      KeyJ: (octave + 1) * 12 + 11, // B
      KeyK: (octave + 1) * 12 + 12, // C next
      KeyO: (octave + 1) * 12 + 13, // C# next
      KeyL: (octave + 1) * 12 + 14, // D next
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      const midi = keyToMidiMap[e.code];
      if (midi !== undefined) {
        startNote(midi);
      } else if (e.code === 'KeyZ') {
        // Octave down
        setOctave((prev) => Math.max(1, prev - 1));
      } else if (e.code === 'KeyX') {
        // Octave up
        setOctave((prev) => Math.min(6, prev + 1));
      } else if (e.code === 'Space') {
        // Drone toggle
        e.preventDefault();
        toggleDrone();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const midi = keyToMidiMap[e.code];
      if (midi !== undefined) {
        stopNote(midi);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [octave, startNote, stopNote, isDroneActive, droneNote]);

  // Sync external MIDI activity with on-screen visual keys & wheels
  useEffect(() => {
    const checkDevices = () => {
      const devs = midiService.getDevices();
      setMidiDeviceName(devs.length > 0 ? devs[0].name : null);
    };
    checkDevices();
    const unsubDev = midiService.onDeviceChange(checkDevices);

    const unsubActivity = (log: MidiEventLog) => {
      if (log.type === 'noteOn' && log.data1 !== undefined) {
        const note = log.data1;
        setActiveNotes((prev) => {
          const next = new Set(prev).add(note);
          onVoiceCountChange(next.size + (isDroneActive ? 1 : 0));
          return next;
        });
      } else if (log.type === 'noteOff' && log.data1 !== undefined) {
        const note = log.data1;
        setActiveNotes((prev) => {
          const next = new Set(prev);
          next.delete(note);
          onVoiceCountChange(next.size + (isDroneActive ? 1 : 0));
          return next;
        });
      } else if (log.type === 'pitchBend' && log.data1 !== undefined && log.data2 !== undefined) {
        const raw = log.data1 | (log.data2 << 7);
        setPitchBendVal((raw - 8192) / 8192);
      }
    };
    const unsubAct = midiService.onActivity(unsubActivity);

    return () => {
      unsubDev();
      unsubAct();
    };
  }, [onVoiceCountChange, isDroneActive]);

  // Handle on-screen Pitch Bend drag
  const handlePitchWheelChange = (val: number) => {
    setPitchBendVal(val);
    synthAudio.setPitchBend(val * 2); // +/- 2 semitones
  };

  const resetPitchWheel = () => {
    setPitchBendVal(0);
    synthAudio.setPitchBend(0);
  };

  const themeAccent = {
    amber: {
      keyActive: 'bg-amber-400 text-black shadow-[0_0_12px_#f59e0b]',
      blackActive: 'bg-amber-500 shadow-[0_0_12px_#f59e0b]',
      droneBtn: 'bg-amber-500/20 text-amber-400 border-amber-500/50',
    },
    cyan: {
      keyActive: 'bg-sky-400 text-black shadow-[0_0_12px_#38bdf8]',
      blackActive: 'bg-sky-500 shadow-[0_0_12px_#38bdf8]',
      droneBtn: 'bg-sky-500/20 text-sky-400 border-sky-500/50',
    },
    green: {
      keyActive: 'bg-emerald-400 text-black shadow-[0_0_12px_#22c55e]',
      blackActive: 'bg-emerald-500 shadow-[0_0_12px_#22c55e]',
      droneBtn: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50',
    },
  }[theme];

  return (
    <div className="w-full bg-[#0a0c0f] rounded-lg border border-zinc-800/80 p-3 shadow-lg select-none">
      {/* Top Toolbar: Octave Controls, Drone Latch, and Instructions */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-800/80 text-xs font-mono">
        <div className="flex items-center gap-3">
          <span className="text-zinc-500 text-[11px] font-semibold flex items-center gap-1.5">
            <Music className="w-3.5 h-3.5 text-zinc-400" />
            CONTROLLER KEYBOARD
          </span>

          {/* Octave buttons */}
          <div className="flex items-center rounded bg-[#12151b] border border-zinc-800 p-0.5">
            <button
              onClick={() => setOctave((prev) => Math.max(1, prev - 1))}
              disabled={octave <= 1}
              className="px-2 py-0.5 rounded text-zinc-400 hover:text-white disabled:opacity-30 transition-colors"
              title="Octave Down [Z]"
            >
              OCT -
            </button>
            <span className="px-2 font-bold text-zinc-200">
              C{octave}
            </span>
            <button
              onClick={() => setOctave((prev) => Math.min(6, prev + 1))}
              disabled={octave >= 6}
              className="px-2 py-0.5 rounded text-zinc-400 hover:text-white disabled:opacity-30 transition-colors"
              title="Octave Up [X]"
            >
              OCT +
            </button>
          </div>
        </div>

        {/* Drone Hold Button (allows continuous sound while user tweaks the 8 encoders) */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleDrone}
            className={`px-3 py-1 rounded text-[11px] font-bold border transition-all flex items-center gap-1.5 ${
              isDroneActive
                ? themeAccent.droneBtn
                : 'bg-[#12151b] text-zinc-400 border-zinc-800 hover:text-white hover:border-zinc-700'
            }`}
            title="Sustain a continuous test tone to audition encoder filters [SPACE]"
          >
            {isDroneActive ? (
              <>
                <Square className="w-3 h-3 fill-current" />
                <span>DRONE HOLD [ON]</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3 fill-current" />
                <span>DRONE AUDITION</span>
              </>
            )}
          </button>

          {isArpActive && (
            <span className="text-[10px] text-amber-400/90 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded">
              ARP LATCH ACTIVE
            </span>
          )}
        </div>

        {/* Connected USB MIDI Device Indicator */}
        {midiDeviceName ? (
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px]">
            <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
            <span className="truncate max-w-[200px]">MIDI: {midiDeviceName}</span>
          </div>
        ) : (
          <div className="hidden lg:flex items-center gap-1.5 text-[10px] text-zinc-500">
            <Volume2 className="w-3 h-3 text-zinc-500" />
            <span>Play with keyboard [A-K] or connect an external USB/MIDI controller</span>
          </div>
        )}
      </div>

      {/* Main Playing Deck: Pitch/Mod Wheels + Piano Keys */}
      <div className="relative h-28 w-full mt-3 flex justify-center gap-3 overflow-x-auto pb-1">
        {/* Physical Pitch & Mod Wheels */}
        <div className="hidden sm:flex items-center gap-2 px-2 py-1 bg-[#07080a] border border-zinc-800/90 rounded shrink-0">
          {/* Pitch Bend Wheel (Spring Centered) */}
          <div className="flex flex-col items-center h-full justify-between">
            <span className="text-[8px] font-mono text-zinc-500">PITCH</span>
            <div
              className="relative w-5 h-20 bg-zinc-900 border border-zinc-700/80 rounded-xs flex items-center justify-center cursor-ns-resize overflow-hidden"
              onMouseDown={(e) => {
                const startY = e.clientY;
                const onMove = (ev: MouseEvent) => {
                  const delta = (startY - ev.clientY) / 40;
                  handlePitchWheelChange(Math.max(-1, Math.min(1, delta)));
                };
                const onUp = () => {
                  resetPitchWheel();
                  window.removeEventListener('mousemove', onMove);
                  window.removeEventListener('mouseup', onUp);
                };
                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
              }}
              title="Pitch Bend Wheel (Spring-loaded center)"
            >
              {/* Wheel center groove */}
              <div
                className="w-full h-3 bg-zinc-400 rounded-xs shadow-md transition-transform duration-75"
                style={{ transform: `translateY(${-pitchBendVal * 28}px)` }}
              />
            </div>
            <span className="text-[7px] font-mono text-zinc-500">BEND</span>
          </div>

          {/* Modulation Wheel */}
          <div className="flex flex-col items-center h-full justify-between">
            <span className="text-[8px] font-mono text-zinc-500">MOD</span>
            <div
              className="relative w-5 h-20 bg-zinc-900 border border-zinc-700/80 rounded-xs flex items-end justify-center cursor-ns-resize overflow-hidden"
              onMouseDown={(e) => {
                const startY = e.clientY;
                const initial = modWheelVal;
                const onMove = (ev: MouseEvent) => {
                  const delta = (startY - ev.clientY) / 60;
                  const nextVal = Math.max(0, Math.min(1, initial + delta));
                  setModWheelVal(nextVal);
                };
                const onUp = () => {
                  window.removeEventListener('mousemove', onMove);
                  window.removeEventListener('mouseup', onUp);
                };
                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
              }}
              title="Modulation Wheel (CC 01)"
            >
              <div
                className="w-full h-3 bg-zinc-400 rounded-xs shadow-md transition-transform duration-75"
                style={{ transform: `translateY(${-modWheelVal * 56}px)` }}
              />
            </div>
            <span className="text-[7px] font-mono text-zinc-500">WHEEL</span>
          </div>
        </div>

        {/* Piano Keys Visual Representation */}
        <div className="relative flex h-full min-w-[580px] max-w-4xl w-full">
          {/* White Keys */}
          {keys
            .filter((k) => !k.isBlack)
            .map((k) => {
              const isPressed = activeNotes.has(k.note) || (isDroneActive && droneNote === k.note);
              return (
                <button
                  key={k.note}
                  type="button"
                  onMouseDown={() => startNote(k.note)}
                  onMouseUp={() => stopNote(k.note)}
                  onMouseLeave={() => stopNote(k.note)}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    startNote(k.note);
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    stopNote(k.note);
                  }}
                  className={`relative flex-1 h-full rounded-b border border-zinc-900 flex flex-col justify-end items-center pb-1.5 font-mono text-[9px] transition-colors ${
                    isPressed
                      ? themeAccent.keyActive
                      : 'bg-[#e2e8f0] text-zinc-600 hover:bg-[#cbd5e1] active:bg-[#94a3b8]'
                  }`}
                  style={{
                    boxShadow: isPressed
                      ? 'inset 0 -2px 0 rgba(0,0,0,0.5)'
                      : 'inset 0 -4px 0 rgba(0,0,0,0.15), 0 2px 4px rgba(0,0,0,0.4)',
                  }}
                >
                  <span className="font-bold opacity-80">{k.charKey}</span>
                  <span className="text-[8px] opacity-50">{k.name}</span>
                </button>
              );
            })}

          {/* Black Keys overlaid with absolute positioning */}
          {keys.map((k, index) => {
            if (!k.isBlack) return null;

            // Calculate horizontal offset based on white keys before it
            const whiteKeysBefore = keys.slice(0, index).filter((item) => !item.isBlack).length;
            const totalWhiteKeys = keys.filter((item) => !item.isBlack).length;
            const percentLeft = (whiteKeysBefore / totalWhiteKeys) * 100;
            const isPressed = activeNotes.has(k.note) || (isDroneActive && droneNote === k.note);

            return (
              <button
                key={k.note}
                type="button"
                onMouseDown={() => startNote(k.note)}
                onMouseUp={() => stopNote(k.note)}
                onMouseLeave={() => stopNote(k.note)}
                onTouchStart={(e) => {
                  e.preventDefault();
                  startNote(k.note);
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  stopNote(k.note);
                }}
                className={`absolute z-10 w-[3.4%] h-[62%] -ml-[1.7%] rounded-b flex flex-col justify-end items-center pb-1 font-mono text-[8px] transition-colors ${
                  isPressed
                    ? themeAccent.blackActive
                    : 'bg-[#181a20] text-zinc-400 hover:bg-[#252830]'
                }`}
                style={{
                  left: `${percentLeft}%`,
                  boxShadow: '0 4px 6px rgba(0,0,0,0.7), inset 0 -2px 0 rgba(255,255,255,0.1)',
                }}
              >
                <span className="font-bold text-white/80">{k.charKey}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
