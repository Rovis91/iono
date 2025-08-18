import { GroundClass, Rx } from '../core/contracts';

export interface BandPreset {
  label: string;
  frequency_MHz: number;
  rxDefaults: Partial<Rx> & { height_m: number; gain_dBi: number };
  groundClass?: GroundClass;                     // for HF ground-wave
  foF2_MHz?: number;                             // optional HF default
  propagationMode?: 'auto' | 'ground' | 'sky';   // optional HF default
}

export const BAND_PRESETS: BandPreset[] = [
  // HF (examples)
  {
    label: 'HF 40 m Ground (7.1 MHz)',
    frequency_MHz: 7.1,
    rxDefaults: { height_m: 10, gain_dBi: 0, bandwidth_Hz: 2700, noiseFigure_dB: 5, requiredSNR_dB: 10 },
    groundClass: 'wet',
    propagationMode: 'ground'
  },
  {
    label: 'HF 40 m Sky (7.1 MHz)',
    frequency_MHz: 7.1,
    rxDefaults: { height_m: 10, gain_dBi: 0, bandwidth_Hz: 2700, noiseFigure_dB: 5, requiredSNR_dB: 10 },
    groundClass: 'wet',
    foF2_MHz: 8,             // workable MUF with ~30° takeoff
    propagationMode: 'sky'
  },
  {
    label: 'HF 20 m Sky (14.2 MHz)',
    frequency_MHz: 14.2,
    rxDefaults: { height_m: 10, gain_dBi: 0, bandwidth_Hz: 2700, noiseFigure_dB: 5, requiredSNR_dB: 10 },
    groundClass: 'wet',
    foF2_MHz: 12.5,          // ~threshold for 14.2 MHz at ~30°
    propagationMode: 'sky'
  },

  // V/UHF (unchanged)
  { label: 'VHF 2 m (146 MHz)', frequency_MHz: 146, rxDefaults: { height_m: 1.5, gain_dBi: 0, bandwidth_Hz: 20000, noiseFigure_dB: 5, requiredSNR_dB: 10 } },
  { label: 'UHF 70 cm (446 MHz)', frequency_MHz: 446, rxDefaults: { height_m: 1.5, gain_dBi: 0, bandwidth_Hz: 12500, noiseFigure_dB: 5, requiredSNR_dB: 10 } },
  { label: 'UHF ISM 868 MHz', frequency_MHz: 868, rxDefaults: { height_m: 1.5, gain_dBi: 0, bandwidth_Hz: 125000, noiseFigure_dB: 5, requiredSNR_dB: 8 } },
  { label: 'UHF ISM 915 MHz', frequency_MHz: 915, rxDefaults: { height_m: 1.5, gain_dBi: 0, bandwidth_Hz: 125000, noiseFigure_dB: 5, requiredSNR_dB: 8 } },
];

