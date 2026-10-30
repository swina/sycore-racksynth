import React, { useState, useEffect } from 'react';
import { ActiveParamInfo, EncoderKey, LedTheme, SynthParameters, SynthPatch } from '../types/synth';
import { ENCODER_CONFIGS, INITIAL_PATCHES } from '../data/synthPresets';
import { synthAudio } from '../audio/synthEngine';
import { EncoderKnob } from './EncoderKnob';
import { ToggleSwitch } from './ToggleSwitch';
import { LedDisplay } from './LedDisplay';
import { PatchBrowser } from './PatchBrowser';
import { KeyboardController } from './KeyboardController';
import { MidiSettingsModal } from './MidiSettingsModal';
import { midiService, MidiEventLog } from '../services/midiService';
import { Power, Volume2, Sliders, Disc, Radio } from 'lucide-react';

export const RackChassis: React.FC = () => {
  // Patches & Parameters State
  const [patches, setPatches] = useState<SynthPatch[]>(INITIAL_PATCHES);
  const [currentPatch, setCurrentPatch] = useState<SynthPatch>(INITIAL_PATCHES[0]);
  const [params, setParams] = useState<SynthParameters>(INITIAL_PATCHES[0].params);
  
  // UI & Hardware States
  const [theme, setTheme] = useState<LedTheme>('amber');
  const [activeParam, setActiveParam] = useState<ActiveParamInfo | null>(null);
  const [activeEncoderKey, setActiveEncoderKey] = useState<EncoderKey | null>(null);
  const [voiceCount, setVoiceCount] = useState<number>(0);
  const [isPowerOn, setIsPowerOn] = useState<boolean>(true);
  const [masterVolume, setMasterVolume] = useState<number>(85);
  const [clearTimer, setClearTimer] = useState<number | null>(null);

  // MIDI Controller States
  const [isMidiModalOpen, setIsMidiModalOpen] = useState<boolean>(false);
  const [isMidiConnected, setIsMidiConnected] = useState<boolean>(false);
  const [midiDevicesCount, setMidiDevicesCount] = useState<number>(0);
  const [midiChannel, setMidiChannel] = useState<number>(midiService.getSelectedChannel());
  const [lastMidiEventStr, setLastMidiEventStr] = useState<string | null>(null);
  const [isMidiBlink, setIsMidiBlink] = useState<boolean>(false);

  // Initialize Synth Audio & Sync Parameters
  useEffect(() => {
    synthAudio.init();
    synthAudio.updateParameters(params);

    // Initialize Web MIDI API
    midiService.init().then((success) => {
      setIsMidiConnected(success);
      setMidiDevicesCount(midiService.getDevices().length);
    });

    const unsubDevice = midiService.onDeviceChange((devs) => {
      setMidiDevicesCount(devs.length);
      setIsMidiConnected(devs.length > 0);
    });

    const unsubParam = midiService.onParamChange((key, val) => {
      handleParamChange(key, val);
    });

    const unsubSwitch = midiService.onSwitchChange((which, val) => {
      if (which === 1) {
        handleSwitch1Change(val);
      } else {
        handleSwitch2Change(val);
      }
    });

    const unsubPatch = midiService.onPatchChange((patchIdx) => {
      if (patches[patchIdx]) {
        handleSelectPatch(patches[patchIdx]);
      }
    });

    let blinkTimeout: number | undefined;
    const unsubActivity = (ev: MidiEventLog) => {
      setLastMidiEventStr(ev.description);
      setIsMidiBlink(true);
      if (blinkTimeout) clearTimeout(blinkTimeout);
      blinkTimeout = window.setTimeout(() => {
        setIsMidiBlink(false);
      }, 150);
    };
    const unsubAct = midiService.onActivity(unsubActivity);

    return () => {
      unsubDevice();
      unsubParam();
      unsubSwitch();
      unsubPatch();
      unsubAct();
      if (blinkTimeout) clearTimeout(blinkTimeout);
    };
  }, [patches]);

  // Update Synth Engine whenever parameters change
  const handleParamChange = (key: EncoderKey, value: number) => {
    if (!isPowerOn) return;

    setParams((prev) => {
      const next = { ...prev, [key]: value };
      synthAudio.updateParameters(next);
      return next;
    });

    const config = ENCODER_CONFIGS.find((c) => c.key === key);
    if (config) {
      const rawPercent = Math.max(0, Math.min(100, ((value - config.min) / (config.max - config.min)) * 100));
      setActiveParam({
        key,
        label: config.label,
        valueStr: config.formatValue(value),
        rawPercent,
        unit: config.unit,
        timestamp: Date.now(),
      });
      setActiveEncoderKey(key);

      // Auto clear parameter HUD after 3.5 seconds of inactivity to return to main oscilloscope view
      if (clearTimer) clearTimeout(clearTimer);
      const timer = window.setTimeout(() => {
        setActiveParam(null);
        setActiveEncoderKey(null);
      }, 3500);
      setClearTimer(timer);
    }
  };

  // Switch 1 Toggle (Filter Mode: 24dB vs 12dB)
  const handleSwitch1Change = (val: boolean) => {
    if (!isPowerOn) return;
    setParams((prev) => {
      const next = { ...prev, switch1: val };
      synthAudio.updateParameters(next);
      return next;
    });
  };

  // Switch 2 Toggle (Voice Mode: Poly vs Arp)
  const handleSwitch2Change = (val: boolean) => {
    if (!isPowerOn) return;
    setParams((prev) => {
      const next = { ...prev, switch2: val };
      synthAudio.updateParameters(next);
      return next;
    });
  };

  // Patch Select
  const handleSelectPatch = (patch: SynthPatch) => {
    setCurrentPatch(patch);
    setParams(patch.params);
    synthAudio.updateParameters(patch.params);
    setActiveParam({
      key: 'cutoff',
      label: `PATCH LOADED: ${patch.name}`,
      valueStr: `[${patch.category}]`,
      rawPercent: 100,
      unit: '',
      timestamp: Date.now(),
    });
    if (clearTimer) clearTimeout(clearTimer);
    const timer = window.setTimeout(() => {
      setActiveParam(null);
    }, 2500);
    setClearTimer(timer);
  };

  // Randomize Parameters
  const handleRandomize = () => {
    if (!isPowerOn) return;
    const randomized: SynthParameters = {
      detune: Math.floor(Math.random() * 80),
      cutoff: Math.floor(100 + Math.random() * 8000),
      resonance: +(0.5 + Math.random() * 10).toFixed(1),
      attack: +(0.005 + Math.random() * 0.8).toFixed(3),
      decay: +(0.1 + Math.random() * 3.0).toFixed(2),
      drive: Math.floor(Math.random() * 80),
      lfoRate: +(0.2 + Math.random() * 12).toFixed(1),
      reverbMix: Math.floor(20 + Math.random() * 70),
      switch1: Math.random() > 0.5,
      switch2: params.switch2, // preserve play mode
    };
    setParams(randomized);
    synthAudio.updateParameters(randomized);
    setActiveParam({
      key: 'cutoff',
      label: 'RANDOM GENERATED',
      valueStr: 'NEW SEED',
      rawPercent: 100,
      unit: '',
      timestamp: Date.now(),
    });
  };

  // Initialize Default Patch
  const handleInit = () => {
    const initParams: SynthParameters = {
      detune: 0,
      cutoff: 5000,
      resonance: 1.0,
      attack: 0.01,
      decay: 0.8,
      drive: 0,
      lfoRate: 1.0,
      reverbMix: 15,
      switch1: false,
      switch2: false,
    };
    setParams(initParams);
    synthAudio.updateParameters(initParams);
  };

  // Master Volume Change
  const handleMasterVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = Number(e.target.value);
    setMasterVolume(vol);
  };

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-6">
      {/* ============================================================== */}
      {/* 19" STANDARD HARDWARE RACK CHASSIS (19-INCH 2U UNIT)            */}
      {/* ============================================================== */}
      <div className="relative rounded-lg overflow-hidden rack-metal border border-zinc-800 shadow-2xl">
        {/* Subtle top edge specular highlight */}
        <div className="h-0.5 w-full bg-gradient-to-r from-zinc-700 via-zinc-400 to-zinc-700 opacity-60" />

        <div className="flex w-full">
          {/* ========================================== */}
          {/* LEFT RACK EAR WITH MOUNTING BOLTS          */}
          {/* ========================================== */}
          <div className="w-10 sm:w-12 shrink-0 rack-ear border-r border-black/80 flex flex-col justify-between items-center py-6 px-1">
            {/* Top Mount Hole & Bolt */}
            <div className="flex flex-col items-center gap-1">
              <div className="w-5 h-8 rounded-full border border-zinc-700/80 bg-[#0d0f12] flex items-center justify-center p-0.5 shadow-inner">
                <div className="hex-screw" />
              </div>
              <span className="text-[7px] font-mono text-zinc-600 tracking-tighter">19" RACK</span>
            </div>

            {/* Middle Ear Markings */}
            <div className="flex flex-col items-center gap-4 text-[8px] font-mono text-zinc-600 rotate-180 [writing-mode:vertical-rl]">
              <span>UNIT-2U</span>
              <span className="tracking-widest">········</span>
            </div>

            {/* Bottom Mount Hole & Bolt */}
            <div className="w-5 h-8 rounded-full border border-zinc-700/80 bg-[#0d0f12] flex items-center justify-center p-0.5 shadow-inner">
              <div className="hex-screw" />
            </div>
          </div>

          {/* ========================================== */}
          {/* MAIN CHASSIS FRONT FACEPLATE               */}
          {/* ========================================== */}
          <div className="flex-1 flex flex-col p-4 sm:p-6 min-w-0">
            {/* 1. TOP STRIP: Model branding, Patch Selector, and Power */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-zinc-800/80">
              {/* Brand & Model Lockup */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-xs bg-zinc-300 shadow-xs" />
                  <span className="text-sm font-bold tracking-widest text-zinc-100 font-mono">
                    RACK-SYNTH
                  </span>
                </div>
                <span className="text-[11px] font-mono text-zinc-400 border-l border-zinc-700 pl-3">
                  MODEL RS-802
                </span>
              </div>

              {/* Patch Bank Navigation Bar */}
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider hidden sm:inline">
                  PRESET BANK:
                </span>
                <PatchBrowser
                  patches={patches}
                  currentPatch={currentPatch}
                  theme={theme}
                  onSelectPatch={handleSelectPatch}
                  onRandomize={handleRandomize}
                  onInit={handleInit}
                />
              </div>

              {/* Master Volume, MIDI IN & Power Switch */}
              <div className="flex items-center gap-3 sm:gap-4 font-mono">
                {/* Hardware MIDI Port Button & RX Lamp */}
                <button
                  type="button"
                  onClick={() => setIsMidiModalOpen(true)}
                  className="flex items-center gap-2 px-2.5 py-1 rounded bg-[#101216] border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white transition-all text-[11px]"
                  title="MIDI Configuration & USB Devices"
                >
                  <Radio className={`w-3.5 h-3.5 ${isMidiConnected ? 'text-emerald-400' : 'text-zinc-500'}`} />
                  <span className="hidden sm:inline">MIDI IN</span>
                  <div
                    className={`w-2 h-2 rounded-full transition-all duration-75 ${
                      isMidiBlink
                        ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]'
                        : isMidiConnected
                        ? 'bg-emerald-500'
                        : 'bg-zinc-800'
                    }`}
                  />
                </button>

                <div className="h-4 w-px bg-zinc-800" />

                {/* Master Volume Fader Slider */}
                <div className="flex items-center gap-2">
                  <Volume2 className="w-3.5 h-3.5 text-zinc-400" />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={masterVolume}
                    onChange={handleMasterVolumeChange}
                    className="w-16 sm:w-20 accent-zinc-300 cursor-pointer h-1.5 bg-zinc-800 rounded"
                    title={`Master Output: ${masterVolume}%`}
                  />
                  <span className="text-[10px] text-zinc-400 w-6 tabular-nums">{masterVolume}%</span>
                </div>

                <div className="h-4 w-px bg-zinc-800" />

                {/* Power Toggle Button */}
                <button
                  onClick={() => setIsPowerOn(!isPowerOn)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold border transition-all ${
                    isPowerOn
                      ? 'bg-zinc-800 border-zinc-700 text-white'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                  }`}
                  title="Toggle Hardware Power"
                >
                  <Power
                    className={`w-3.5 h-3.5 ${
                      isPowerOn ? 'text-emerald-400 animate-pulse' : 'text-zinc-600'
                    }`}
                  />
                  <span>{isPowerOn ? 'PWR ON' : 'STANDBY'}</span>
                </button>
              </div>
            </div>

            {/* 2. CENTER UPPER DECK: High-Resolution Real-time LED Display */}
            <div className="my-5">
              <LedDisplay
                currentPatch={currentPatch}
                activeParam={activeParam}
                theme={theme}
                onThemeChange={setTheme}
                voiceCount={voiceCount}
                filterMode={params.switch1}
                voiceMode={params.switch2}
                midiChannel={midiChannel}
                lastMidiEvent={lastMidiEventStr}
                isMidiConnected={isMidiConnected}
                onOpenMidiSettings={() => setIsMidiModalOpen(true)}
              />
            </div>

            {/* 3. LOWER CONTROL DECK: 8 Encoders + 2 Heavy Duty Switches */}
            <div className="mt-2 pt-4 border-t border-zinc-800/80">
              <div className="flex flex-col lg:flex-row items-stretch gap-4">
                {/* ------------------------------------------ */}
                {/* LEFT SWITCH: SWITCH 1 (FILTER MODE)       */}
                {/* ------------------------------------------ */}
                <div className="flex items-center justify-center shrink-0">
                  <ToggleSwitch
                    id="switch-1"
                    label="SWITCH 1"
                    topLabel="24dB"
                    topSub="LADDER"
                    bottomLabel="12dB"
                    bottomSub="STATE-VAR"
                    value={params.switch1}
                    theme={theme}
                    onChange={handleSwitch1Change}
                  />
                </div>

                {/* ------------------------------------------ */}
                {/* CENTER: THE 8 PRECISION ROTARY ENCODERS   */}
                {/* ------------------------------------------ */}
                <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 bg-[#0c0e12]/80 p-2.5 rounded-lg border border-zinc-800/80 shadow-inner">
                  {ENCODER_CONFIGS.map((config) => (
                    <EncoderKnob
                      key={config.key}
                      config={config}
                      value={params[config.key]}
                      theme={theme}
                      isActive={activeEncoderKey === config.key}
                      onChange={(newVal) => handleParamChange(config.key, newVal)}
                      onActiveChange={(active) => {
                        if (active) {
                          handleParamChange(config.key, params[config.key]);
                        }
                      }}
                    />
                  ))}
                </div>

                {/* ------------------------------------------ */}
                {/* RIGHT SWITCH: SWITCH 2 (VOICE MODE)       */}
                {/* ------------------------------------------ */}
                <div className="flex items-center justify-center shrink-0">
                  <ToggleSwitch
                    id="switch-2"
                    label="SWITCH 2"
                    topLabel="POLY"
                    topSub="CHORD"
                    bottomLabel="ARP"
                    bottomSub="RUN/HOLD"
                    value={params.switch2}
                    theme={theme}
                    onChange={handleSwitch2Change}
                  />
                </div>
              </div>
            </div>

            {/* 4. BOTTOM HARDWARE CHASSIS FOOTER: Jack visuals and specs */}
            <div className="mt-4 pt-3 border-t border-zinc-800/60 flex flex-wrap items-center justify-between text-[10px] font-mono text-zinc-500">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <Disc className="w-3 h-3 text-zinc-400" />
                  <span>DSP: 24-BIT / 96kHz HYBRID ANALOGUE MODELLING</span>
                </span>
                <span className="hidden md:inline">·</span>
                <span className="hidden md:inline">LOW JITTER REAL-TIME CLOCK</span>
              </div>

              {/* Headphone & Line Out 1/4" Jack visual representation */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-zinc-700 bg-black flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-900 border border-zinc-800" />
                  </div>
                  <span>PHONES</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-zinc-700 bg-black flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-900 border border-zinc-800" />
                  </div>
                  <span>BAL OUT L/R</span>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================== */}
          {/* RIGHT RACK EAR WITH MOUNTING BOLTS         */}
          {/* ========================================== */}
          <div className="w-10 sm:w-12 shrink-0 rack-ear border-l border-black/80 flex flex-col justify-between items-center py-6 px-1">
            {/* Top Mount Hole & Bolt */}
            <div className="w-5 h-8 rounded-full border border-zinc-700/80 bg-[#0d0f12] flex items-center justify-center p-0.5 shadow-inner">
              <div className="hex-screw" />
            </div>

            {/* Middle Ear Markings */}
            <div className="flex flex-col items-center gap-4 text-[8px] font-mono text-zinc-600 rotate-180 [writing-mode:vertical-rl]">
              <span className="tracking-widest">········</span>
              <span>19-INCH</span>
            </div>

            {/* Bottom Mount Hole & Bolt */}
            <div className="w-5 h-8 rounded-full border border-zinc-700/80 bg-[#0d0f12] flex items-center justify-center p-0.5 shadow-inner">
              <div className="hex-screw" />
            </div>
          </div>
        </div>

        {/* Bottom edge shadow */}
        <div className="h-1 w-full bg-gradient-to-b from-transparent to-black/80" />
      </div>

      {/* ============================================================== */}
      {/* INTEGRATED PLAYABLE KEYBOARD CONTROLLER DOCK                   */}
      {/* ============================================================== */}
      <KeyboardController
        theme={theme}
        onVoiceCountChange={setVoiceCount}
        isArpActive={params.switch2}
      />

      {/* ============================================================== */}
      {/* MIDI HARDWARE CONFIGURATION MODAL                              */}
      {/* ============================================================== */}
      <MidiSettingsModal
        isOpen={isMidiModalOpen}
        onClose={() => setIsMidiModalOpen(false)}
        theme={theme}
        isMidiActive={isMidiConnected}
      />
    </div>
  );
};
