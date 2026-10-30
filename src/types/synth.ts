/**
 * Synth Data Structures & Parameter Definitions
 */

export type LedTheme = 'amber' | 'cyan' | 'green';

export interface SynthParameters {
  detune: number;      // 0 - 100 (maps to 0 to 50 cents)
  cutoff: number;      // 20 - 20000 Hz
  resonance: number;   // 0.5 - 15 Q
  attack: number;      // 0.005 - 3.0 seconds
  decay: number;       // 0.05 - 5.0 seconds
  drive: number;       // 0 - 100 %
  lfoRate: number;     // 0.1 - 20.0 Hz
  reverbMix: number;   // 0 - 100 %
  switch1: boolean;    // false = 24dB Ladder, true = 12dB State Variable
  switch2: boolean;    // false = POLY MODE, true = ARP MODE
}

export type EncoderKey = 'detune' | 'cutoff' | 'resonance' | 'attack' | 'decay' | 'drive' | 'lfoRate' | 'reverbMix';

export interface EncoderConfig {
  key: EncoderKey;
  index: number;
  label: string;
  subLabel: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  unit: string;
  formatValue: (val: number) => string;
}

export interface SynthPatch {
  id: string;
  number: string;
  name: string;
  category: 'PAD' | 'BASS' | 'LEAD' | 'PLUCK' | 'AMBIENT' | 'SYNTH';
  author: string;
  description: string;
  params: SynthParameters;
}

export interface ActiveParamInfo {
  key: EncoderKey;
  label: string;
  valueStr: string;
  rawPercent: number;
  unit: string;
  timestamp: number;
}
