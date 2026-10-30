import { SynthParameters } from '../types/synth';

interface ActiveVoice {
  note: number;
  frequency: number;
  osc1: OscillatorNode;
  osc2: OscillatorNode;
  subOsc: OscillatorNode;
  filter: BiquadFilterNode;
  vca: GainNode;
  envGain: GainNode;
  releaseTimer?: number;
}

export class SynthEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private lfo: OscillatorNode | null = null;
  private lfoGain: GainNode | null = null;
  private driveNode: WaveShaperNode | null = null;
  private reverbGain: GainNode | null = null;
  private dryGain: GainNode | null = null;
  private convolver: ConvolverNode | null = null;
  private delayNode: DelayNode | null = null;
  private delayFeedback: GainNode | null = null;

  private activeVoices: Map<number, ActiveVoice> = new Map();
  private currentParams: SynthParameters | null = null;
  private isInitialized = false;

  // Arpeggiator state
  private arpTimer: number | null = null;
  private heldNotes: number[] = [];
  private arpIndex = 0;
  private arpActiveNote: number | null = null;

  // MIDI Controller States (Pitch bend & Sustain pedal)
  private pitchBendMultiplier = 1.0;
  private isSustainActive = false;
  private sustainedNotes: Set<number> = new Set();

  constructor() {
    // AudioContext is initialized on first user interaction to comply with browser autoplay policy
  }

  public init() {
    if (this.isInitialized && this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      
      // Master limiter/gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.75, this.ctx.currentTime);

      // Analyser for real-time LED display
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.75;

      // Soft Drive (WaveShaper)
      this.driveNode = this.ctx.createWaveShaper();
      this.driveNode.curve = this.createDistortionCurve(20);
      this.driveNode.oversample = '2x';

      // Reverb / Space network
      this.convolver = this.ctx.createConvolver();
      this.convolver.buffer = this.createSyntheticImpulse(2.4, 2.0);

      this.delayNode = this.ctx.createDelay();
      this.delayNode.delayTime.setValueAtTime(0.32, this.ctx.currentTime);
      this.delayFeedback = this.ctx.createGain();
      this.delayFeedback.gain.setValueAtTime(0.35, this.ctx.currentTime);

      this.delayNode.connect(this.delayFeedback);
      this.delayFeedback.connect(this.delayNode);

      this.reverbGain = this.ctx.createGain();
      this.reverbGain.gain.setValueAtTime(0.4, this.ctx.currentTime);

      this.dryGain = this.ctx.createGain();
      this.dryGain.gain.setValueAtTime(0.8, this.ctx.currentTime);

      // Routing:
      // Voice -> Drive -> (Dry + Delay + Reverb) -> Master -> Analyser -> Destination
      this.driveNode.connect(this.dryGain);
      this.driveNode.connect(this.convolver);
      this.driveNode.connect(this.delayNode);

      this.convolver.connect(this.reverbGain);
      this.delayNode.connect(this.reverbGain);

      this.dryGain.connect(this.masterGain);
      this.reverbGain.connect(this.masterGain);

      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);

      // Global LFO for filter modulation
      this.lfo = this.ctx.createOscillator();
      this.lfo.type = 'triangle';
      this.lfo.frequency.setValueAtTime(2.0, this.ctx.currentTime);

      this.lfoGain = this.ctx.createGain();
      this.lfoGain.gain.setValueAtTime(200, this.ctx.currentTime);

      this.lfo.connect(this.lfoGain);
      this.lfo.start();

      this.isInitialized = true;
    } catch (e) {
      console.warn('AudioContext initialization deferred:', e);
    }
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  public isAudioActive(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }

  public resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    } else if (!this.ctx) {
      this.init();
    }
  }

  public updateParameters(params: SynthParameters) {
    this.currentParams = params;
    if (!this.ctx) return;

    const t = this.ctx.currentTime;

    // Update LFO
    if (this.lfo) {
      this.lfo.frequency.setTargetAtTime(params.lfoRate, t, 0.05);
    }
    if (this.lfoGain) {
      // Modulate amount based on resonance & cutoff
      const modAmount = (params.cutoff * 0.3) * (params.resonance / 8);
      this.lfoGain.gain.setTargetAtTime(Math.min(modAmount, 3000), t, 0.05);
    }

    // Update Drive
    if (this.driveNode) {
      this.driveNode.curve = this.createDistortionCurve(params.drive);
    }

    // Update Reverb / Wet-Dry mix
    if (this.reverbGain && this.dryGain) {
      const wet = params.reverbMix / 100;
      this.reverbGain.gain.setTargetAtTime(wet * 0.7, t, 0.05);
      this.dryGain.gain.setTargetAtTime((1 - wet * 0.5), t, 0.05);
    }

    // Update active voices filter cutoff & resonance
    this.activeVoices.forEach((voice) => {
      if (voice.filter) {
        voice.filter.frequency.setTargetAtTime(params.cutoff, t, 0.03);
        voice.filter.Q.setTargetAtTime(params.resonance, t, 0.03);
        // Switch 1: false = 24dB steep, true = 12dB smoother
        // We simulate slope with Q adjustments and curve
      }
      if (voice.osc2) {
        // Detune in cents
        const detuneCents = params.detune * 0.5;
        voice.osc2.detune.setTargetAtTime(detuneCents, t, 0.05);
      }
    });

    // Check Arp mode switch
    if (params.switch2) {
      // Start ARP loop if notes are held
      this.startArpLoop();
    } else {
      // Stop ARP loop
      this.stopArpLoop();
    }
  }

  public noteOn(midiNote: number, velocity = 0.8) {
    this.resume();
    if (!this.ctx || !this.masterGain || !this.driveNode) return;

    if (!this.heldNotes.includes(midiNote)) {
      this.heldNotes.push(midiNote);
      this.heldNotes.sort((a, b) => a - b);
    }

    // If ARP mode is active (switch2 = true), ARP loop will handle triggering
    if (this.currentParams?.switch2) {
      this.startArpLoop();
      return;
    }

    this.triggerVoice(midiNote, velocity);
  }

  public noteOff(midiNote: number) {
    this.heldNotes = this.heldNotes.filter((n) => n !== midiNote);

    if (this.currentParams?.switch2) {
      if (this.heldNotes.length === 0) {
        this.stopArpLoop();
      }
      return;
    }

    // If sustain pedal is depressed, keep voice ringing until sustain pedal is released
    if (this.isSustainActive) {
      this.sustainedNotes.add(midiNote);
      return;
    }

    this.releaseVoice(midiNote);
  }

  public setSustainPedal(isDown: boolean) {
    this.isSustainActive = isDown;
    if (!isDown) {
      // Release all voices that were held by the sustain pedal
      this.sustainedNotes.forEach((note) => {
        if (!this.heldNotes.includes(note)) {
          this.releaseVoice(note);
        }
      });
      this.sustainedNotes.clear();
    }
  }

  public setPitchBend(semitones: number) {
    this.pitchBendMultiplier = Math.pow(2, semitones / 12);
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    this.activeVoices.forEach((voice) => {
      const bentFreq = voice.frequency * this.pitchBendMultiplier;
      voice.osc1.frequency.setTargetAtTime(bentFreq, t, 0.015);
      voice.osc2.frequency.setTargetAtTime(bentFreq, t, 0.015);
      voice.subOsc.frequency.setTargetAtTime(bentFreq * 0.5, t, 0.015);
    });
  }

  private triggerVoice(midiNote: number, velocity: number) {
    if (!this.ctx || !this.driveNode) return;

    // Release any previous voice with same note
    if (this.activeVoices.has(midiNote)) {
      this.releaseVoice(midiNote, 0.02);
    }

    const baseFreq = this.midiToFreq(midiNote);
    const freq = baseFreq * this.pitchBendMultiplier;
    const params = this.currentParams || {
      detune: 20,
      cutoff: 2000,
      resonance: 2.5,
      attack: 0.05,
      decay: 1.0,
      drive: 20,
      lfoRate: 2.0,
      reverbMix: 40,
      switch1: false,
      switch2: false,
    };

    const t = this.ctx.currentTime;

    // Oscillators
    const osc1 = this.ctx.createOscillator();
    // Waveform: Sawtooth or Square
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(freq, t);

    const osc2 = this.ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(freq, t);
    osc2.detune.setValueAtTime(params.detune * 0.5, t);

    // Sub oscillator 1 octave down
    const subOsc = this.ctx.createOscillator();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(freq * 0.5, t);

    // VCF Filter
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(params.cutoff, t);
    filter.Q.setValueAtTime(params.resonance, t);

    // Connect LFO to this filter
    if (this.lfoGain) {
      this.lfoGain.connect(filter.frequency);
    }

    // Envelope Generator
    const envGain = this.ctx.createGain();
    const peakGain = Math.max(0.1, Math.min(1.0, velocity * 0.45));
    
    // Attack phase
    envGain.gain.setValueAtTime(0.0001, t);
    envGain.gain.exponentialRampToValueAtTime(peakGain, t + Math.max(0.005, params.attack));
    // Sustain level
    const sustainLevel = Math.max(0.01, peakGain * 0.65);
    envGain.gain.exponentialRampToValueAtTime(sustainLevel, t + params.attack + Math.max(0.05, params.decay * 0.5));

    // Voice level
    const vca = this.ctx.createGain();
    vca.gain.setValueAtTime(1.0, t);

    // Sub oscillator gain
    const subGain = this.ctx.createGain();
    subGain.gain.setValueAtTime(0.3, t);
    subOsc.connect(subGain);

    // Sum oscillators into filter
    osc1.connect(filter);
    osc2.connect(filter);
    subGain.connect(filter);

    filter.connect(envGain);
    envGain.connect(vca);
    vca.connect(this.driveNode);

    osc1.start(t);
    osc2.start(t);
    subOsc.start(t);

    this.activeVoices.set(midiNote, {
      note: midiNote,
      frequency: freq,
      osc1,
      osc2,
      subOsc,
      filter,
      vca,
      envGain,
    });
  }

  private releaseVoice(midiNote: number, customRelease?: number) {
    const voice = this.activeVoices.get(midiNote);
    if (!voice || !this.ctx) return;

    const t = this.ctx.currentTime;
    const releaseTime = customRelease !== undefined ? customRelease : Math.max(0.05, (this.currentParams?.decay || 1.0) * 0.8);

    voice.envGain.gain.cancelScheduledValues(t);
    voice.envGain.gain.setValueAtTime(Math.max(0.0001, voice.envGain.gain.value), t);
    voice.envGain.gain.exponentialRampToValueAtTime(0.0001, t + releaseTime);

    voice.releaseTimer = window.setTimeout(() => {
      try {
        voice.osc1.stop();
        voice.osc2.stop();
        voice.subOsc.stop();
        voice.osc1.disconnect();
        voice.osc2.disconnect();
        voice.subOsc.disconnect();
        if (this.lfoGain) {
          try {
            this.lfoGain.disconnect(voice.filter.frequency);
          } catch {
            // ignore
          }
        }
        voice.filter.disconnect();
        voice.envGain.disconnect();
        voice.vca.disconnect();
      } catch {
        // Voice cleanup
      }
      this.activeVoices.delete(midiNote);
    }, releaseTime * 1000 + 50);
  }

  public allNotesOff() {
    this.heldNotes = [];
    this.stopArpLoop();
    this.activeVoices.forEach((_, note) => {
      this.releaseVoice(note, 0.05);
    });
  }

  // Realistic Physical Switch "Clack" Sound
  public playSwitchSound() {
    this.resume();
    if (!this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, t);
      filter.Q.setValueAtTime(3, t);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, t);
      osc.frequency.exponentialRampToValueAtTime(60, t + 0.025);

      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.04);
    } catch {
      // Audio fallback
    }
  }

  // Arpeggiator Loop
  private startArpLoop() {
    if (this.arpTimer) return;
    if (this.heldNotes.length === 0) return;

    const tick = () => {
      if (this.heldNotes.length === 0 || !this.currentParams?.switch2) {
        this.stopArpLoop();
        return;
      }

      if (this.arpActiveNote !== null) {
        this.releaseVoice(this.arpActiveNote, 0.05);
      }

      const note = this.heldNotes[this.arpIndex % this.heldNotes.length];
      this.arpActiveNote = note;
      this.triggerVoice(note, 0.9);
      this.arpIndex++;

      // Speed tied to LFO or tempo (approx 120-160 BPM 16th notes)
      const lfoSpeed = this.currentParams?.lfoRate || 2.4;
      const intervalMs = Math.max(90, Math.min(350, (1 / (lfoSpeed * 0.8)) * 1000));
      this.arpTimer = window.setTimeout(tick, intervalMs);
    };

    tick();
  }

  private stopArpLoop() {
    if (this.arpTimer) {
      clearTimeout(this.arpTimer);
      this.arpTimer = null;
    }
    if (this.arpActiveNote !== null) {
      this.releaseVoice(this.arpActiveNote, 0.05);
      this.arpActiveNote = null;
    }
    this.arpIndex = 0;
  }

  private midiToFreq(m: number): number {
    return 440 * Math.pow(2, (m - 69) / 12);
  }

  private createDistortionCurve(amount: number): Float32Array<ArrayBuffer> {
    const k = Math.max(0, amount);
    const n_samples = 44100;
    const buffer = new ArrayBuffer(n_samples * 4);
    const curve = new Float32Array(buffer);
    const deg = Math.PI / 180;
    
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      if (k === 0) {
        curve[i] = x;
      } else {
        curve[i] = ((3 + k * 0.5) * x * 20 * deg) / (Math.PI + k * 0.5 * Math.abs(x));
      }
    }
    return curve;
  }

  private createSyntheticImpulse(duration: number, decay: number): AudioBuffer {
    if (!this.ctx) {
      // Dummy buffer if not initialized
      return new AudioBuffer({ length: 1, sampleRate: 44100, numberOfChannels: 2 });
    }
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * duration;
    const impulse = this.ctx.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const n = i / length;
      const env = Math.pow(1 - n, decay);
      left[i] = (Math.random() * 2 - 1) * env;
      right[i] = (Math.random() * 2 - 1) * env;
    }
    return impulse;
  }
}

export const synthAudio = new SynthEngine();
