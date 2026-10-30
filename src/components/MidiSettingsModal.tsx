import React, { useState, useEffect } from 'react';
import { midiService, MidiDevice, MidiEventLog, MidiLearningTarget, MidiCcMap } from '../services/midiService';
import { LedTheme } from '../types/synth';
import { ENCODER_CONFIGS } from '../data/synthPresets';
import { synthAudio } from '../audio/synthEngine';
import { Activity, Check, Disc, Play, RefreshCw, Sliders, X, AlertCircle } from 'lucide-react';

interface MidiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: LedTheme;
  isMidiActive: boolean;
}

export const MidiSettingsModal: React.FC<MidiSettingsModalProps> = ({
  isOpen,
  onClose,
  theme,
  isMidiActive,
}) => {
  const [devices, setDevices] = useState<MidiDevice[]>(midiService.getDevices());
  const [selectedDevice, setSelectedDevice] = useState<string>(midiService.getSelectedDeviceId());
  const [selectedChannel, setSelectedChannel] = useState<number>(midiService.getSelectedChannel());
  const [ccMap, setCcMap] = useState<MidiCcMap>(midiService.getCcMap());
  const [learningTarget, setLearningTarget] = useState<MidiLearningTarget | null>(null);
  const [logs, setLogs] = useState<MidiEventLog[]>(midiService.getRecentLogs());
  const [statusMsg, setStatusMsg] = useState<string>('');

  useEffect(() => {
    if (!isOpen) return;

    // Refresh devices
    setDevices(midiService.getDevices());
    setSelectedDevice(midiService.getSelectedDeviceId());
    setSelectedChannel(midiService.getSelectedChannel());
    setCcMap(midiService.getCcMap());

    const unsubDevice = midiService.onDeviceChange((d) => setDevices(d));
    const unsubActivity = (ev: MidiEventLog) => {
      setLogs((prev) => [ev, ...prev.slice(0, 15)]);
      setCcMap(midiService.getCcMap());
      if (midiService.getLearningTarget() === null) {
        setLearningTarget(null);
      }
    };
    const unsubAct = midiService.onActivity(unsubActivity);

    const unsubStatus = midiService.onStatusChange((_, msg) => {
      if (msg) setStatusMsg(msg);
    });

    return () => {
      unsubDevice();
      unsubAct();
      unsubStatus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDeviceSelect = (id: string) => {
    setSelectedDevice(id);
    midiService.setSelectedDeviceId(id);
  };

  const handleChannelSelect = (ch: number) => {
    setSelectedChannel(ch);
    midiService.setSelectedChannel(ch);
  };

  const handleStartLearn = (target: MidiLearningTarget) => {
    if (learningTarget === target) {
      midiService.cancelMidiLearn();
      setLearningTarget(null);
    } else {
      midiService.startMidiLearn(target);
      setLearningTarget(target);
    }
  };

  const handleResetDefaults = () => {
    midiService.resetDefaultCcMap();
    setCcMap(midiService.getCcMap());
    setLearningTarget(null);
  };

  const handleTestNote = () => {
    synthAudio.resume();
    synthAudio.noteOn(60, 0.85); // Middle C (C4)
    setTimeout(() => {
      synthAudio.noteOff(60);
    }, 400);
  };

  const handlePanic = () => {
    synthAudio.allNotesOff();
  };

  const themeAccent = {
    amber: {
      text: 'text-amber-400',
      border: 'border-amber-500/40',
      badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      button: 'bg-amber-500 text-black hover:bg-amber-400',
    },
    cyan: {
      text: 'text-sky-400',
      border: 'border-sky-500/40',
      badge: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
      button: 'bg-sky-500 text-black hover:bg-sky-400',
    },
    green: {
      text: 'text-emerald-400',
      border: 'border-emerald-500/40',
      badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      button: 'bg-emerald-500 text-black hover:bg-emerald-400',
    },
  }[theme];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/75 backdrop-blur-xs select-none animate-fadeIn">
      <div className="relative w-full max-w-3xl rounded-xl bg-[#0c0e12] border border-zinc-700/80 shadow-2xl overflow-hidden font-mono text-xs flex flex-col max-h-[90vh]">
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800 bg-[#090b0e]">
          <div className="flex items-center gap-3">
            {/* 5-Pin DIN MIDI port visual */}
            <div className="w-6 h-6 rounded-full border border-zinc-600 bg-zinc-900 flex items-center justify-center">
              <div className="grid grid-cols-3 gap-0.5 w-3 h-3 items-center justify-center">
                <div className="w-1 h-1 rounded-full bg-zinc-400 mx-auto" />
                <div className="w-1 h-1 rounded-full bg-zinc-400 mx-auto" />
                <div className="w-1 h-1 rounded-full bg-zinc-400 mx-auto" />
                <div className="w-1 h-1 rounded-full bg-zinc-400 mx-auto" />
                <div className="w-1 h-1 rounded-full bg-zinc-400 mx-auto" />
              </div>
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-wider text-zinc-100 flex items-center gap-2">
                <span>HARDWARE MIDI CONFIGURATION</span>
                <span className={`text-[10px] px-2 py-0.5 rounded border ${themeAccent.badge}`}>
                  WEB MIDI API
                </span>
              </h2>
              <p className="text-[10px] text-zinc-400">
                Support for USB/MIDI keyboards, hardware encoder controllers, and CC mapping
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            title="Close [ESC]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Section 1: Device Selection & Channel */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Input Device Selection */}
            <div className="space-y-2 p-3 rounded-lg bg-[#08090c] border border-zinc-800">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-zinc-300">
                  MIDI INPUT DEVICE
                </label>
                <span className="text-[10px] text-zinc-400">
                  {devices.length} detected
                </span>
              </div>

              <select
                value={selectedDevice}
                onChange={(e) => handleDeviceSelect(e.target.value)}
                className="w-full px-3 py-2 rounded bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs focus:outline-none focus:border-zinc-500"
              >
                <option value="all">All MIDI Devices (Omni)</option>
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.manufacturer})
                  </option>
                ))}
              </select>

              {devices.length === 0 ? (
                <div className="flex items-start gap-1.5 text-[10px] text-zinc-400 pt-1">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    No USB/MIDI controllers detected. Connect a keyboard or MIDI controller and refresh.
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 pt-1">
                  <Check className="w-3 h-3" />
                  <span>Device connected and ready for playback.</span>
                </div>
              )}
            </div>

            {/* MIDI Channel Selection */}
            <div className="space-y-2 p-3 rounded-lg bg-[#08090c] border border-zinc-800">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-zinc-300">
                  MIDI CHANNEL
                </label>
                <span className="text-[10px] text-zinc-400">
                  {selectedChannel === 0 ? 'OMNI' : `CH ${selectedChannel}`}
                </span>
              </div>

              <select
                value={selectedChannel}
                onChange={(e) => handleChannelSelect(Number(e.target.value))}
                className="w-full px-3 py-2 rounded bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs focus:outline-none focus:border-zinc-500"
              >
                <option value={0}>Omni (All Channels 1-16)</option>
                {Array.from({ length: 16 }).map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    Channel {i + 1}
                  </option>
                ))}
              </select>

              <div className="text-[10px] text-zinc-400 pt-1">
                Filter events to a specific channel or receive from any channel (Omni).
              </div>
            </div>
          </div>

          {/* Section 2: MIDI Learn & CC Mapping Matrix */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-2">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-zinc-400" />
                <span className="font-bold text-zinc-200">
                  CC PARAMETER MAPPING & MIDI LEARN
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleResetDefaults}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] transition-colors"
                  title="Restore standard General MIDI CC mapping"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>RESET DEFAULT CC</span>
                </button>
              </div>
            </div>

            {learningTarget && (
              <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/40 text-amber-300 flex items-center justify-between animate-pulse">
                <span className="flex items-center gap-2">
                  <Disc className="w-4 h-4 animate-spin" />
                  <span>
                    MIDI LEARN ACTIVE: Turn an encoder or toggle a switch on your controller to assign{' '}
                    <strong>{learningTarget.toUpperCase()}</strong>...
                  </span>
                </span>
                <button
                  onClick={() => midiService.cancelMidiLearn()}
                  className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-white text-[10px]"
                >
                  CANCEL
                </button>
              </div>
            )}

            {/* Table of Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {/* 8 Encoders */}
              {ENCODER_CONFIGS.map((config) => {
                const assignedCc = ccMap[config.key];
                const isLearning = learningTarget === config.key;

                return (
                  <div
                    key={config.key}
                    className={`p-2.5 rounded-lg border flex items-center justify-between transition-all ${
                      isLearning
                        ? 'border-amber-400 bg-amber-500/10'
                        : 'bg-[#090b0e] border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-zinc-200 text-[11px]">
                        0{config.index} {config.label}
                      </div>
                      <div className="text-[9px] text-zinc-400">
                        {config.subLabel}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-300 text-[10px] font-bold">
                        CC {assignedCc}
                      </span>
                      <button
                        onClick={() => handleStartLearn(config.key)}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                          isLearning
                            ? 'bg-amber-500 text-black animate-pulse'
                            : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                        }`}
                      >
                        {isLearning ? 'WAITING...' : 'LEARN'}
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* 2 Switches */}
              <div
                className={`p-2.5 rounded-lg border flex items-center justify-between transition-all ${
                  learningTarget === 'switch1'
                    ? 'border-amber-400 bg-amber-500/10'
                    : 'bg-[#090b0e] border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div>
                  <div className="font-bold text-zinc-200 text-[11px]">
                    SWITCH 1
                  </div>
                  <div className="text-[9px] text-zinc-400">
                    FILTER SLOPE (24dB / 12dB)
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-300 text-[10px] font-bold">
                    CC {ccMap.switch1}
                  </span>
                  <button
                    onClick={() => handleStartLearn('switch1')}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                      learningTarget === 'switch1'
                        ? 'bg-amber-500 text-black animate-pulse'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                    }`}
                  >
                    {learningTarget === 'switch1' ? 'WAITING...' : 'LEARN'}
                  </button>
                </div>
              </div>

              <div
                className={`p-2.5 rounded-lg border flex items-center justify-between transition-all ${
                  learningTarget === 'switch2'
                    ? 'border-amber-400 bg-amber-500/10'
                    : 'bg-[#090b0e] border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div>
                  <div className="font-bold text-zinc-200 text-[11px]">
                    SWITCH 2
                  </div>
                  <div className="text-[9px] text-zinc-400">
                    VOICE MODE (POLY / ARP)
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-300 text-[10px] font-bold">
                    CC {ccMap.switch2}
                  </span>
                  <button
                    onClick={() => handleStartLearn('switch2')}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                      learningTarget === 'switch2'
                        ? 'bg-amber-500 text-black animate-pulse'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                    }`}
                  >
                    {learningTarget === 'switch2' ? 'WAITING...' : 'LEARN'}
                  </button>
                </div>
              </div>

              {/* Sustain Pedal */}
              <div className="p-2.5 rounded-lg border bg-[#090b0e] border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-zinc-200 text-[11px]">
                    SUSTAIN PEDAL
                  </div>
                  <div className="text-[9px] text-zinc-400">
                    DAMPER / HOLD PEDAL
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-300 text-[10px] font-bold">
                    CC {ccMap.sustain}
                  </span>
                  <span className="text-[9px] text-zinc-500 px-2 py-0.5">
                    STANDARD
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Live MIDI Traffic Monitor */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-zinc-300">
              <div className="flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-zinc-400" />
                <span className="font-bold">REAL-TIME MIDI TRAFFIC MONITOR</span>
              </div>
              <span className="text-[10px] text-zinc-400">
                Recent incoming messages
              </span>
            </div>

            <div className="p-2.5 rounded bg-[#060709] border border-zinc-800/90 h-32 overflow-y-auto space-y-1 font-mono text-[10px]">
              {logs.length === 0 ? (
                <div className="text-zinc-600 italic py-2 text-center">
                  Awaiting MIDI events... Play a note or turn a controller knob.
                </div>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between py-0.5 border-b border-zinc-900/60"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-600">
                        {new Date(log.timestamp).toLocaleTimeString().slice(3)}
                      </span>
                      <span
                        className={`font-semibold ${
                          log.type === 'noteOn'
                            ? 'text-emerald-400'
                            : log.type === 'noteOff'
                            ? 'text-zinc-500'
                            : log.type === 'cc'
                            ? 'text-amber-400'
                            : log.type === 'pitchBend'
                            ? 'text-sky-400'
                            : 'text-purple-400'
                        }`}
                      >
                        [{log.type.toUpperCase()}]
                      </span>
                      <span className="text-zinc-300">{log.description}</span>
                    </div>
                    <span className="text-zinc-500">CH {log.channel}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions: Test utilities & Close */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-800 bg-[#090b0e]">
          <div className="flex items-center gap-2">
            <button
              onClick={handleTestNote}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs transition-colors"
              title="Send test note (C4)"
            >
              <Play className="w-3 h-3" />
              <span>TEST NOTE (C4)</span>
            </button>
            <button
              onClick={handlePanic}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-red-950/40 hover:bg-red-900/50 text-red-300 border border-red-900/60 text-xs transition-colors"
              title="All Notes Off"
            >
              <span>PANIC (ALL OFF)</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-xs transition-colors"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
};
