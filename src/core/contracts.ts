/**
 * Authoritative types & units for V1.
 * - Heights in **meters**
 * - Frequencies in **MHz**
 * - Distances in **km** (for path loss)
 * - Gains in **dBi**; losses in **dB**
 */

export type EnvironmentClass = 'open' | 'rural' | 'urban' | 'forest' | 'water' | 'mountain';
export type GroundClass = 'sea' | 'wet' | 'dry';

export interface Tx {
  lat: number;          // deg
  lon: number;          // deg
  power_W: number;      // W
  gain_dBi: number;     // dBi
  cable_dB: number;     // dB
  height_m: number;     // m (AGL)
  frequency_MHz: number;// MHz
}

export interface Rx {
  gain_dBi: number;     // dBi
  cable_dB: number;     // dB
  height_m: number;     // m (AGL)
  bandwidth_Hz: number; // Hz
  noiseFigure_dB: number; // dB
  requiredSNR_dB: number; // dB (use Eb/N0 mapping upstream if needed)
}

export interface Env {
  environment: EnvironmentClass; // dropdown — no sub-city split
  kFactor: number;               // e.g., 1.33
  groundClass: GroundClass;      // for HF ground-wave
  foliageDepth_m?: number;       // for V/UHF foliage penalty (optional)
}

export interface HFContext {
  foF2_MHz: number;       // MUF slider (V1) - renamed from MUF_MHz to match spec
  NVIS_enabled: boolean; // NVIS hint toggle
  propagationMode: 'auto' | 'ground' | 'sky'; // New: explicit mode selection
}

export interface Context {
  /**
   * For per-pixel compute, supply great-circle distance in km.
   * Guard with Math.max(d_km, 0.001) before path loss to avoid singularities.
   */
  distance_km: number;
  timeUTC?: string; // label only in V1
  hf?: HFContext;
}

export type PathMode = 'IONO' | 'NVIS' | 'GROUND' | 'LOS' | 'NLOS' | 'DIFFRACTION' | 'BLOCKED';

export interface PathResult {
  loss_dB: number;
  mode: PathMode;
}

export interface LinkResult {
  pr_dBm: number;
  sensitivity_dBm: number;
  margin_dB: number; // render metric in V1
  mode: PathMode;
}