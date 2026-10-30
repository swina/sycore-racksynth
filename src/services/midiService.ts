/**
 * Web MIDI API Service
 * Handles MIDI controller connection, message parsing, CC routing,
 * pitch bend, sustain pedal, and MIDI Learn.
 */

import { EncoderKey } from '../types/synth';
import { ENCODER_CONFIGS } from '../data/synthPresets';
import { synthAudio } from '../audio/synthEngine';

export type MidiLearningTarget = EncoderKey | 'switch1' | 'switch2';

export interface MidiDevice {
  id: string;
  name: string;
  manufacturer: string;
  state: string;
}

export interface MidiEventLog {
  id: string;
  timestamp: number;
  type: 'noteOn' | 'noteOff' | 'cc' | 'pitchBend' | 'programChange' | 'other';
  channel: number;
  data1?: number;
  data2?: number;
  description: string;
}

export type MidiStatus = 'unsupported' | 'disconnected' | 'connecting' | 'connected' | 'error';

export interface MidiCcMap {
  detune: number;
  cutoff: number;
  resonance: number;
  attack: number;
  decay: number;
  drive: number;
  lfoRate: number;
  reverbMix: number;
  switch1: number;
  switch2: number;
  sustain: number;
}

export const DEFAULT_CC_MAP: MidiCcMap = {
  detune: 13,     // General Purpose / Detune
  cutoff: 74,     // Brightness / Sound Controller 5
  resonance: 71,  // Timbre/Resonance / Sound Controller 2
  attack: 73,     // Attack Time / Sound Controller 4
  decay: 72,      // Release Time / Sound Controller 3
  drive: 12,      // Effect Control 1
  lfoRate: 76,    // Sound Controller 7 (or Mod Wheel 1)
  reverbMix: 91,  // Reverb Send Level / Effect 1 Depth
  switch1: 80,    // General Purpose Controller 5
  switch2: 81,    // General Purpose Controller 6
  sustain: 64,    // Damper / Sustain Pedal
};

type ParamChangeHandler = (key: EncoderKey, value: number) => void;
type SwitchChangeHandler = (which: 1 | 2, value: boolean) => void;
type PatchChangeHandler = (patchIndex: number) => void;
type StatusChangeHandler = (status: MidiStatus, message?: string) => void;
type DeviceChangeHandler = (devices: MidiDevice[]) => void;
type ActivityHandler = (event: MidiEventLog) => void;

class MidiService {
  private midiAccess: MIDIAccess | null = null;
  private status: MidiStatus = 'disconnected';
  private selectedDeviceId: string = 'all';
  private selectedChannel: number = 0; // 0 = Omni (all channels), 1-16 = specific channel
  private devices: MidiDevice[] = [];
  private ccMap: MidiCcMap = { ...DEFAULT_CC_MAP };
  private learningTarget: MidiLearningTarget | null = null;
  private recentLogs: MidiEventLog[] = [];

  // Listeners
  private onParamChangeListeners: Set<ParamChangeHandler> = new Set();
  private onSwitchChangeListeners: Set<SwitchChangeHandler> = new Set();
  private onPatchChangeListeners: Set<PatchChangeHandler> = new Set();
  private onStatusChangeListeners: Set<StatusChangeHandler> = new Set();
  private onDeviceChangeListeners: Set<DeviceChangeHandler> = new Set();
  private onActivityListeners: Set<ActivityHandler> = new Set();

  constructor() {
    // Load persisted CC mappings from localStorage if available
    try {
      const savedMap = localStorage.getItem('racksynth_midi_cc_map');
      if (savedMap) {
        this.ccMap = { ...DEFAULT_CC_MAP, ...JSON.parse(savedMap) };
      }
    } catch {
      // Ignore localStorage errors
    }
  }

  public isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;
  }

  public async init(): Promise<boolean> {
    if (!this.isSupported()) {
      this.setStatus('unsupported', 'Web MIDI is not supported in this browser');
      return false;
    }

    if (this.midiAccess) {
      return true;
    }

    try {
      this.setStatus('connecting', 'Requesting MIDI controller access...');
      const access = await navigator.requestMIDIAccess({ sysex: false });
      this.midiAccess = access;
      
      this.updateDeviceList();
      this.bindInputs();

      access.onstatechange = () => {
        this.updateDeviceList();
        this.bindInputs();
      };

      this.setStatus('connected', `${this.devices.length} device(s) detected`);
      return true;
    } catch (err: unknown) {
      console.warn('MIDI Access error:', err);
      const msg = err instanceof Error ? err.message : 'MIDI permission denied or unavailable';
      this.setStatus('error', msg);
      return false;
    }
  }

  private setStatus(status: MidiStatus, message?: string) {
    this.status = status;
    this.onStatusChangeListeners.forEach((cb) => cb(status, message));
  }

  private updateDeviceList() {
    if (!this.midiAccess) {
      this.devices = [];
      return;
    }

    const list: MidiDevice[] = [];
    const inputs = this.midiAccess.inputs.values();
    for (const input of inputs) {
      list.push({
        id: input.id,
        name: input.name || `MIDI Device (${input.id})`,
        manufacturer: input.manufacturer || 'Generic',
        state: input.state || 'connected',
      });
    }

    this.devices = list;
    this.onDeviceChangeListeners.forEach((cb) => cb(list));
  }

  private bindInputs() {
    if (!this.midiAccess) return;

    const inputs = this.midiAccess.inputs.values();
    for (const input of inputs) {
      input.onmidimessage = (event: MIDIMessageEvent) => {
        if (this.selectedDeviceId === 'all' || this.selectedDeviceId === input.id) {
          this.handleMidiMessage(event);
        }
      };
    }
  }

  private handleMidiMessage(event: MIDIMessageEvent) {
    const data = event.data;
    if (!data || data.length < 1) return;

    const statusByte = data[0];
    const messageType = statusByte & 0xf0;
    const channel = (statusByte & 0x0f) + 1; // 1-16

    // Channel Filtering: if selectedChannel != 0 and channel doesn't match, ignore
    if (this.selectedChannel !== 0 && this.selectedChannel !== channel) {
      return;
    }

    const data1 = data[1] ?? 0;
    const data2 = data[2] ?? 0;

    let logType: MidiEventLog['type'] = 'other';
    let description = '';

    switch (messageType) {
      case 0x90: { // Note On
        const note = data1;
        const velocity = data2;
        if (velocity > 0) {
          logType = 'noteOn';
          description = `Note ON: ${this.midiNoteToName(note)} (${note}) Vel: ${velocity}`;
          synthAudio.noteOn(note, velocity / 127);
        } else {
          logType = 'noteOff';
          description = `Note OFF: ${this.midiNoteToName(note)} (${note})`;
          synthAudio.noteOff(note);
        }
        break;
      }

      case 0x80: { // Note Off
        const note = data1;
        logType = 'noteOff';
        description = `Note OFF: ${this.midiNoteToName(note)} (${note})`;
        synthAudio.noteOff(note);
        break;
      }

      case 0xB0: { // Control Change (CC)
        const ccNum = data1;
        const ccVal = data2;
        logType = 'cc';
        description = `CC ${ccNum}: ${ccVal}`;

        // Check MIDI Learn mode first
        if (this.learningTarget) {
          this.mapCc(this.learningTarget, ccNum);
          description = `MIDI LEARN: CC ${ccNum} -> ${this.learningTarget.toUpperCase()}`;
          this.learningTarget = null;
          break;
        }

        // Standard Damp/Sustain Pedal (CC 64)
        if (ccNum === this.ccMap.sustain) {
          const isDown = ccVal >= 64;
          synthAudio.setSustainPedal(isDown);
          description = `Sustain Pedal: ${isDown ? 'DOWN' : 'UP'} (CC ${ccNum})`;
          break;
        }

        // Panic / All Notes Off (CC 120 / CC 123)
        if (ccNum === 120 || ccNum === 123) {
          synthAudio.allNotesOff();
          description = `All Notes Off (Panic)`;
          break;
        }

        // Check if CC matches Switch 1
        if (ccNum === this.ccMap.switch1) {
          const switchVal = ccVal >= 64;
          this.onSwitchChangeListeners.forEach((cb) => cb(1, switchVal));
          description = `Switch 1: ${switchVal ? '12dB' : '24dB'}`;
          break;
        }

        // Check if CC matches Switch 2
        if (ccNum === this.ccMap.switch2) {
          const switchVal = ccVal >= 64;
          this.onSwitchChangeListeners.forEach((cb) => cb(2, switchVal));
          description = `Switch 2: ${switchVal ? 'ARP' : 'POLY'}`;
          break;
        }

        // Check if CC matches any of the 8 Encoders
        const encoderKeys: EncoderKey[] = ['detune', 'cutoff', 'resonance', 'attack', 'decay', 'drive', 'lfoRate', 'reverbMix'];
        for (const key of encoderKeys) {
          if (this.ccMap[key] === ccNum) {
            const config = ENCODER_CONFIGS.find((c) => c.key === key);
            if (config) {
              const normalized = ccVal / 127;
              let calculatedVal: number;

              if (key === 'cutoff') {
                // Logarithmic scaling for Cutoff: 40Hz to 16000Hz
                calculatedVal = Math.round(40 * Math.pow(16000 / 40, normalized));
              } else {
                calculatedVal = +(config.min + normalized * (config.max - config.min)).toFixed(2);
              }

              this.onParamChangeListeners.forEach((cb) => cb(key, calculatedVal));
              description = `${config.label}: ${config.formatValue(calculatedVal)} (CC ${ccNum})`;
            }
            break;
          }
        }
        break;
      }

      case 0xE0: { // Pitch Bend
        logType = 'pitchBend';
        const bendRaw = data1 | (data2 << 7); // 0..16383, 8192 is center
        const semitones = ((bendRaw - 8192) / 8192) * 2; // +/- 2 semitones
        synthAudio.setPitchBend(semitones);
        description = `Pitch Bend: ${semitones >= 0 ? '+' : ''}${semitones.toFixed(2)} st`;
        break;
      }

      case 0xC0: { // Program Change (Patch switch)
        logType = 'programChange';
        const patchIdx = data1 % 8; // 8 presets
        this.onPatchChangeListeners.forEach((cb) => cb(patchIdx));
        description = `Program Change: Patch ${patchIdx + 1}`;
        break;
      }

      default:
        description = `Status 0x${statusByte.toString(16).toUpperCase()} Data: ${data1}, ${data2}`;
    }

    const log: MidiEventLog = {
      id: Math.random().toString(36).substring(2, 8),
      timestamp: Date.now(),
      type: logType,
      channel,
      data1,
      data2,
      description,
    };

    this.recentLogs = [log, ...this.recentLogs.slice(0, 19)];
    this.onActivityListeners.forEach((cb) => cb(log));
  }

  // MIDI Learn
  public startMidiLearn(target: MidiLearningTarget) {
    this.learningTarget = target;
  }

  public cancelMidiLearn() {
    this.learningTarget = null;
  }

  public getLearningTarget(): MidiLearningTarget | null {
    return this.learningTarget;
  }

  public mapCc(target: MidiLearningTarget, ccNumber: number) {
    this.ccMap = {
      ...this.ccMap,
      [target]: ccNumber,
    };
    try {
      localStorage.setItem('racksynth_midi_cc_map', JSON.stringify(this.ccMap));
    } catch {
      // ignore
    }
  }

  public resetDefaultCcMap() {
    this.ccMap = { ...DEFAULT_CC_MAP };
    try {
      localStorage.removeItem('racksynth_midi_cc_map');
    } catch {
      // ignore
    }
  }

  // Getters & Setters
  public getCcMap(): MidiCcMap {
    return this.ccMap;
  }

  public getStatus(): MidiStatus {
    return this.status;
  }

  public getDevices(): MidiDevice[] {
    return this.devices;
  }

  public getSelectedDeviceId(): string {
    return this.selectedDeviceId;
  }

  public setSelectedDeviceId(id: string) {
    this.selectedDeviceId = id;
  }

  public getSelectedChannel(): number {
    return this.selectedChannel;
  }

  public setSelectedChannel(channel: number) {
    this.selectedChannel = channel;
  }

  public getRecentLogs(): MidiEventLog[] {
    return this.recentLogs;
  }

  // Event Subscription methods
  public onParamChange(cb: ParamChangeHandler) {
    this.onParamChangeListeners.add(cb);
    return () => this.onParamChangeListeners.delete(cb);
  }

  public onSwitchChange(cb: SwitchChangeHandler) {
    this.onSwitchChangeListeners.add(cb);
    return () => this.onSwitchChangeListeners.delete(cb);
  }

  public onPatchChange(cb: PatchChangeHandler) {
    this.onPatchChangeListeners.add(cb);
    return () => this.onPatchChangeListeners.delete(cb);
  }

  public onStatusChange(cb: StatusChangeHandler) {
    this.onStatusChangeListeners.add(cb);
    return () => this.onStatusChangeListeners.delete(cb);
  }

  public onDeviceChange(cb: DeviceChangeHandler) {
    this.onDeviceChangeListeners.add(cb);
    return () => this.onDeviceChangeListeners.delete(cb);
  }

  public onActivity(cb: ActivityHandler) {
    this.onActivityListeners.add(cb);
    return () => this.onActivityListeners.delete(cb);
  }

  private midiNoteToName(midi: number): string {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const name = notes[midi % 12];
    const oct = Math.floor(midi / 12) - 1;
    return `${name}${oct}`;
  }
}

export const midiService = new MidiService();
