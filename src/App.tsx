import React, { useState, useEffect } from 'react';
import { RackChassis } from './components/RackChassis';
import { synthAudio } from './audio/synthEngine';
import { Volume2, Sliders, Info, Zap, Radio } from 'lucide-react';

export default function App() {
  const [audioStarted, setAudioStarted] = useState(false);
  const [activeTab, setActiveTab] = useState<'rack' | 'signalFlow' | 'guide'>('rack');

  const startAudio = () => {
    synthAudio.resume();
    setAudioStarted(true);
  };

  useEffect(() => {
    const handleFirstInteraction = () => {
      synthAudio.resume();
      setAudioStarted(true);
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };

    window.addEventListener('click', handleFirstInteraction);
    window.addEventListener('keydown', handleFirstInteraction);

    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#07090c] text-zinc-200 flex flex-col justify-between selection:bg-amber-500/30">
      {/* ============================================================== */}
      {/* 3-ZONE TOP NAVIGATION BAR CONTRACT                              */}
      {/* ============================================================== */}
      <header className="flex items-center justify-between gap-8 px-6 py-4 border-b border-zinc-800/80 bg-[#0a0c0f]/90 backdrop-blur-md sticky top-0 z-50">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-xs bg-amber-400 shadow-[0_0_8px_#f59e0b]" />
          <span className="text-base font-bold tracking-tight text-white font-mono whitespace-nowrap shrink-0">
            RackSynth RS-802
          </span>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-mono font-medium text-zinc-400">
          <button
            onClick={() => setActiveTab('rack')}
            className={`transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'rack' ? 'text-white font-bold' : 'hover:text-zinc-200'
            }`}
          >
            Rack Console
          </button>
          <button
            onClick={() => setActiveTab('signalFlow')}
            className={`transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'signalFlow' ? 'text-white font-bold' : 'hover:text-zinc-200'
            }`}
          >
            Signal Architecture
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'guide' ? 'text-white font-bold' : 'hover:text-zinc-200'
            }`}
          >
            Encoder Matrix
          </button>
        </nav>

        {/* Zone 3: Primary Action (Audio Engine Status) */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={startAudio}
            className={`px-3 py-1.5 text-xs font-mono font-semibold rounded transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${
              audioStarted
                ? 'bg-zinc-800 border border-zinc-700 text-emerald-400 shadow-sm'
                : 'bg-amber-500 text-black hover:bg-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.3)] animate-pulse'
            }`}
            title="Audio Engine Status"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>{audioStarted ? 'DSP ENGINE ACTIVE' : 'CLICK TO ENABLE AUDIO'}</span>
          </button>
        </div>
      </header>

      {/* ============================================================== */}
      {/* MAIN WORKSPACE                                                 */}
      {/* ============================================================== */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-8 flex flex-col justify-center">
        {activeTab === 'rack' && (
          <div className="space-y-6">
            <RackChassis />

            {/* Quick Helper Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono text-zinc-400 bg-[#0c0e12]/60 border border-zinc-800/80 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-zinc-400 shrink-0" />
                <span>
                  <strong className="text-zinc-200">8 Rotary Encoders:</strong> Drag vertically or use mouse wheel (Hold Shift for fine resolution).
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-zinc-400 shrink-0" />
                <span>
                  <strong className="text-zinc-200">2 Physical Switches:</strong> Switch 1 sets filter slope (24/12dB), Switch 2 sets Poly/Arp mode.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-zinc-400 shrink-0" />
                <span>
                  <strong className="text-zinc-200">LED Display:</strong> Real-time parameter feedback, 20-segment LED bar HUD, and 60fps oscilloscope.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  <strong className="text-zinc-200">USB MIDI Support:</strong> Plug & play for keyboards, Pitch Bend, Sustain pedal, and MIDI Learn CC.
                </span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'signalFlow' && (
          <div className="bg-[#0c0e12] border border-zinc-800 rounded-lg p-6 font-mono text-xs text-zinc-300 space-y-4 max-w-4xl mx-auto">
            <h2 className="text-sm font-bold tracking-wider text-white border-b border-zinc-800 pb-2">
              SIGNAL ARCHITECTURE DIAGRAM (RS-802)
            </h2>
            <div className="p-4 rounded bg-[#07090b] border border-zinc-800/80 font-mono text-xs leading-relaxed text-zinc-300 overflow-x-auto whitespace-pre">
{`+-----------------------+     +-------------------+     +---------------------+
| DUAL OSCILLATORS      | --> | VOLTAGE CONTROL   | --> | SOFT SATURATION     |
| Osc 1: Sawtooth       |     | FILTER (VCF)      |     | (Drive Encoder 06)  |
| Osc 2: Detuned Saw    |     | Cutoff (Enc 02)   |     +----------+----------+
| Sub: Triangle (-1 Oct)|     | Reso   (Enc 03)   |                |
+-----------+-----------+     | Slope  (Switch 1) |                v
            ^                 +---------+---------+     +---------------------+
            |                           ^               | STEREO SPACE / DLY  |
    (Detune Enc 01)                     |               | Delay: 320ms        |
                               (LFO Rate Enc 07)        | Reverb (Enc 08)     |
                                                        +----------+----------+
                                                                   |
                                                                   v
+-----------------------+     +-------------------+     +---------------------+
| 60fps LED DISPLAY     | <-- | MASTER ANALYSER   | <-- | MASTER VCA          |
| Oscilloscope Waveform |     | FFT / Time Domain |     | Attack (Enc 04)     |
| Real-Time Bar Graph   |     | Stereo VU Meter   |     | Decay  (Enc 05)     |
+-----------------------+     +-------------------+     +---------------------+`}
            </div>
            <p className="text-zinc-400">
              Each parameter modulated by the 8 rotary encoders and 2 toggle switches delivers instant updates to Web Audio DSP nodes, producing zero-latency, organic sound synthesis.
            </p>
            <button
              onClick={() => setActiveTab('rack')}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded font-mono text-xs"
            >
              Return to Rack Synth
            </button>
          </div>
        )}

        {activeTab === 'guide' && (
          <div className="bg-[#0c0e12] border border-zinc-800 rounded-lg p-6 font-mono text-xs text-zinc-300 space-y-4 max-w-4xl mx-auto">
            <h2 className="text-sm font-bold tracking-wider text-white border-b border-zinc-800 pb-2">
              8 ENCODER CONTROLS & 2 SWITCH SPECIFICATIONS
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 bg-[#080a0d] border border-zinc-800 rounded">
                <span className="text-amber-400 font-bold">01 DETUNE (OSC SPREAD)</span>
                <p className="text-zinc-400 mt-1">Adjusts pitch deviation between oscillator 1 and oscillator 2 up to 50 cents for lush, thick analog chorus and supersaw textures.</p>
              </div>

              <div className="p-3 bg-[#080a0d] border border-zinc-800 rounded">
                <span className="text-amber-400 font-bold">02 CUTOFF (VCF FREQ)</span>
                <p className="text-zinc-400 mt-1">Low-pass filter cutoff frequency ranging from 40 Hz to 16 kHz with smooth logarithmic frequency scaling.</p>
              </div>

              <div className="p-3 bg-[#080a0d] border border-zinc-800 rounded">
                <span className="text-amber-400 font-bold">03 RESONANCE (FILTER Q)</span>
                <p className="text-zinc-400 mt-1">Filter resonance peak Q factor. Emphasizes harmonic frequencies around the cutoff point for squelchy acid sweeps.</p>
              </div>

              <div className="p-3 bg-[#080a0d] border border-zinc-800 rounded">
                <span className="text-amber-400 font-bold">04 ATTACK (ENV RISE)</span>
                <p className="text-zinc-400 mt-1">Envelope attack rise duration, ranging from punchy percussive snaps (5 ms) to slow, soaring ambient pads (2.5 s).</p>
              </div>

              <div className="p-3 bg-[#080a0d] border border-zinc-800 rounded">
                <span className="text-amber-400 font-bold">05 DECAY (ENV FALL)</span>
                <p className="text-zinc-400 mt-1">Voice decay and release time, from ultra-tight staccatos to lingering reverberant decays up to 4.0 seconds.</p>
              </div>

              <div className="p-3 bg-[#080a0d] border border-zinc-800 rounded">
                <span className="text-amber-400 font-bold">06 DRIVE (SATURATION)</span>
                <p className="text-zinc-400 mt-1">Non-linear WaveShaper harmonic saturation. Injects warm analog overdrive and presence to mid-range frequencies.</p>
              </div>

              <div className="p-3 bg-[#080a0d] border border-zinc-800 rounded">
                <span className="text-amber-400 font-bold">07 LFO SPEED (VCF MOD)</span>
                <p className="text-zinc-400 mt-1">Low-frequency oscillator rate (0.2 Hz to 18 Hz) dedicated to continuous filter cutoff modulation.</p>
              </div>

              <div className="p-3 bg-[#080a0d] border border-zinc-800 rounded">
                <span className="text-amber-400 font-bold">08 SPACE (AMBIENCE)</span>
                <p className="text-zinc-400 mt-1">Wet/dry mix for the stereo delay and synthetic impulse reverb chamber, imparting acoustic depth and width.</p>
              </div>

              <div className="p-3 bg-[#080a0d] border border-zinc-800 rounded">
                <span className="text-emerald-400 font-bold">SWITCH 1: FILTER SLOPE</span>
                <p className="text-zinc-400 mt-1">Toggles between steep 4-pole ladder filtering (24dB/oct) and brighter, smoother 2-pole filtering (12dB/oct).</p>
              </div>

              <div className="p-3 bg-[#080a0d] border border-zinc-800 rounded">
                <span className="text-emerald-400 font-bold">SWITCH 2: VOICE MODE</span>
                <p className="text-zinc-400 mt-1">Toggles between full polyphonic chord mode and clock-synced arpeggiator mode with note latching.</p>
              </div>
            </div>

            <button
              onClick={() => setActiveTab('rack')}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded font-mono text-xs"
            >
              Return to Rack Synth
            </button>
          </div>
        )}
      </main>

      {/* ============================================================== */}
      {/* QUIET FOOTER                                                   */}
      {/* ============================================================== */}
      <footer className="border-t border-zinc-900 bg-[#06080a] py-3 px-6 text-center text-xs font-mono text-zinc-500">
        <div className="flex flex-wrap items-center justify-between gap-2 max-w-7xl mx-auto">
          <span>RackSynth RS-802 · Studio Hardware Model</span>
          <span>Web Audio DSP Engine · 8 Encoders · 2 Switches · Real-Time LED HUD</span>
          <span>© 2026 Audio Engineering Labs</span>
        </div>
      </footer>
    </div>
  );
}
