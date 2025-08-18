// =============================
// File: src/propagation/hfModel.ts
// =============================

import { Context, Env, PathResult, Tx, Rx } from '../core/contracts';

/**
 * HF propagation (Official Equations Implementation)
 * ------------------------------------------------
 * Based on HF_EQUATIONS_GUIDE.md
 * 
 * Models 3–30 MHz using:
 *  - Ground-wave: ITU-R P.368-9 model with proper ground factors
 *  - Sky-wave: MUF-based with correct ionospheric layers
 *  - NVIS: E-layer with high takeoff angles
 * 
 * Decision logic:
 *   If mode==='ground' → ground-wave only
 *   If mode==='sky'    → sky-wave only  
 *   If mode==='nvis'   → NVIS only
 *   Else 'auto'        → NVIS → Sky → Ground (best available)
 */

/* ---------------------------------
 * Constants & Utilities
 * --------------------------------- */

const R_EARTH_KM = 6371; // Earth radius in km
const H_E_KM = 110;      // E-layer height
const H_F1_KM = 200;     // F1-layer height  
const H_F2_KM = 300;     // F2-layer height

/** Free-space path loss (dB) */
function fspl_dB(d_km: number, f_MHz: number): number {
  const dk = Math.max(d_km, 1e-6);
  const fm = Math.max(f_MHz, 1e-6);
  return 32.44 + 20 * Math.log10(dk) + 20 * Math.log10(fm);
}

/** Effective antenna height accounting for Earth curvature */
function effective_height_m(h_actual_m: number): number {
  return h_actual_m + Math.pow(h_actual_m, 2) / (2 * R_EARTH_KM * 1000);
}

/** Takeoff angle calculation based on antenna type and height */
function takeoff_angle_deg(tx_height_m: number, f_MHz: number, antenna_type: string = 'dipole'): number {
  const lambda_m = 300 / f_MHz;
  const h_lambda = Math.max(tx_height_m / lambda_m, 0.01); // Avoid log(0)
  
  switch (antenna_type) {
    case 'vertical':
      return Math.min(80, 60 + 5 * Math.log10(h_lambda));
    case 'yagi':
      return Math.max(10, 30 - 8 * Math.log10(h_lambda));
    case 'loop':
      return Math.min(85, 70 + 3 * Math.log10(h_lambda));
    case 'random':
      return 30;
    default: // dipole
      return Math.max(15, 45 - 10 * Math.log10(h_lambda));
  }
}

/* ---------------------------------
 * Ground Wave (ITU-R P.368-9)
 * --------------------------------- */

/** Ground conductivity and permittivity by type */
const GROUND_PROPERTIES = {
  sea: { sigma: 5.0, epsilon: 80.0 },
  wet: { sigma: 0.01, epsilon: 15.0 },
  dry: { sigma: 0.001, epsilon: 4.0 }
};

/** Ground factor calculation */
function ground_factor(groundClass: string, f_MHz: number): number {
  const props = GROUND_PROPERTIES[groundClass as keyof typeof GROUND_PROPERTIES];
  if (!props) return 0.1; // default for unknown ground types
  
  const sigma = props.sigma;
  const epsilon = props.epsilon;
  const f_Hz = f_MHz * 1e6;
  const epsilon_0 = 8.854e-12;
  
  // Ground factor should be higher for better conducting ground
  // This results in lower path loss for sea vs dry ground
  return Math.sqrt(sigma / (2 * Math.PI * f_Hz * epsilon * epsilon_0));
}

/** Curvature factor for Earth's curvature */
function curvature_factor(d_km: number): number {
  return Math.sqrt(1 + Math.pow(d_km / (2 * R_EARTH_KM), 2));
}

/** Height gain factor */
function height_gain_dB(h_tx_m: number, h_rx_m: number): number {
  const h_tx_eff = Math.max(h_tx_m, 10);
  const h_rx_eff = Math.max(h_rx_m, 10);
  return 20 * Math.log10(h_tx_eff / 10) + 20 * Math.log10(h_rx_eff / 10);
}

/** Ground wave path loss (ITU-R P.368-9) */
function groundwave_loss_dB(d_km: number, f_MHz: number, groundClass: string, h_tx_m: number, h_rx_m: number): number {
  // Ground wave limits: ≤10 MHz, ≤300 km
  if (f_MHz > 10 || d_km > 300) return Number.POSITIVE_INFINITY;
  
  const lambda_km = 300 / f_MHz / 1000;
  const ground_factor_val = ground_factor(groundClass, f_MHz);
  const curvature_factor_val = curvature_factor(d_km);
  const height_gain = height_gain_dB(h_tx_m, h_rx_m);
  
  const L_fs = fspl_dB(d_km, f_MHz);
  // Ground term: higher ground factor = lower loss
  const ground_term = 20 * Math.log10(1 + Math.pow(d_km / lambda_km, 2) / ground_factor_val * curvature_factor_val);
  
  return L_fs + ground_term - height_gain;
}

/* ---------------------------------
 * Sky Wave (Ionospheric)
 * --------------------------------- */

/** Maximum Usable Frequency calculation */
function muf_MHz(foF2_MHz: number, takeoff_angle_deg: number): number {
  const theta_rad = takeoff_angle_deg * Math.PI / 180;
  return foF2_MHz / Math.cos(theta_rad);
}

/** Hop distance calculation */
function hop_distance_km(iono_height_km: number, takeoff_angle_deg: number): number {
  const theta_rad = takeoff_angle_deg * Math.PI / 180;
  return 2 * iono_height_km * Math.tan(theta_rad);
}

/** Slant distance calculation */
function slant_distance_km(ground_distance_km: number, takeoff_angle_deg: number): number {
  const theta_rad = takeoff_angle_deg * Math.PI / 180;
  return ground_distance_km / Math.cos(theta_rad);
}

/** Ionospheric absorption */
function ionospheric_absorption_dB(f_MHz: number, takeoff_angle_deg: number, layer: 'E' | 'F1' | 'F2'): number {
  const theta_rad = takeoff_angle_deg * Math.PI / 180;
  const sec_theta = 1 / Math.cos(theta_rad);
  
  // Layer-specific coefficients
  const K = layer === 'E' ? 12 : layer === 'F1' ? 8 : 6;
  
  return K * Math.pow(f_MHz, -2) * sec_theta;
}

/** Sky wave path loss */
function skywave_loss_dB(d_km: number, f_MHz: number, foF2_MHz: number, h_tx_m: number): PathResult {
  if (f_MHz > 30 || d_km <= 50 || foF2_MHz <= 0) {
    return { loss_dB: 1e6, mode: 'BLOCKED' };
  }
  
  // Determine ionospheric layer
  let layer: 'E' | 'F1' | 'F2';
  let iono_height_km: number;
  
  if (f_MHz <= 7) {
    layer = 'E';
    iono_height_km = H_E_KM;
  } else if (f_MHz <= 10) {
    layer = 'F1';
    iono_height_km = H_F1_KM;
  } else {
    layer = 'F2';
    iono_height_km = H_F2_KM;
  }
  
  // Calculate takeoff angle
  const takeoff_angle = takeoff_angle_deg(h_tx_m, f_MHz);
  
  // Check MUF
  const muf = muf_MHz(foF2_MHz, takeoff_angle);
  if (f_MHz > muf) {
    return { loss_dB: 1e6, mode: 'BLOCKED' };
  }
  
  // Calculate hop geometry
  const hop_dist = hop_distance_km(iono_height_km, takeoff_angle);
  const hops = Math.ceil(d_km / hop_dist);
  
  // Limit to 2 hops for V1
  if (hops > 2) {
    return { loss_dB: 1e6, mode: 'BLOCKED' };
  }
  
  // Calculate path loss
  const slant_dist = slant_distance_km(d_km, takeoff_angle);
  const L_fs = fspl_dB(slant_dist, f_MHz);
  const L_iono = ionospheric_absorption_dB(f_MHz, takeoff_angle, layer);
  
  // Ground reflection loss for multi-hop
  const reflection_loss = (hops - 1) * 3; // 3 dB per reflection
  
  const total_loss = L_fs + L_iono + reflection_loss;
  
  return { loss_dB: total_loss, mode: 'IONO' };
}

/* ---------------------------------
 * NVIS (Near-Vertical Incidence)
 * --------------------------------- */

/** NVIS path loss */
function nvis_loss_dB(d_km: number, f_MHz: number, foF2_MHz: number, h_tx_m: number): PathResult {
  // NVIS criteria: ≤7 MHz, ≤500 km, high takeoff angle
  if (f_MHz > 7 || d_km > 500 || foF2_MHz <= 0) {
    return { loss_dB: 1e6, mode: 'BLOCKED' };
  }
  
  const takeoff_angle = takeoff_angle_deg(h_tx_m, f_MHz);
  
  // NVIS requires high takeoff angle (≥75°)
  if (takeoff_angle < 75) {
    return { loss_dB: 1e6, mode: 'BLOCKED' };
  }
  
  // Check MUF for E-layer
  const muf = muf_MHz(foF2_MHz, takeoff_angle);
  if (f_MHz > muf) {
    return { loss_dB: 1e6, mode: 'BLOCKED' };
  }
  
  // Calculate NVIS path loss
  const slant_dist = slant_distance_km(d_km, takeoff_angle);
  const L_fs = fspl_dB(slant_dist, f_MHz);
  const L_iono = ionospheric_absorption_dB(f_MHz, takeoff_angle, 'E');
  
  // Height gain for NVIS
  const height_gain = 20 * Math.log10(h_tx_m / 10);
  
  const total_loss = L_fs + L_iono - height_gain;
  
  return { loss_dB: total_loss, mode: 'NVIS' };
}

/* ---------------------------------
 * Public entry point
 * --------------------------------- */

export function solveHF(tx: Tx, rx: Rx, env: Env, ctx: Context): PathResult {
  const f = tx.frequency_MHz;
  const d = Math.max(ctx.distance_km, 0.001);
  const foF2 = ctx.hf?.foF2_MHz ?? 0;
  const nvis = !!ctx.hf?.NVIS_enabled;
  const mode = ctx.hf?.propagationMode;

  // --- Explicit modes first ---
  if (mode === 'ground') {
    const Lgw = groundwave_loss_dB(d, f, env.groundClass, tx.height_m, rx.height_m);
    return Number.isFinite(Lgw) ? { loss_dB: Lgw, mode: 'GROUND' } : { loss_dB: 1e6, mode: 'BLOCKED' };
  }

  if (mode === 'nvis') {
    const nres = nvis_loss_dB(d, f, foF2, tx.height_m);
    if (nres.mode !== 'BLOCKED') return nres;
    return { loss_dB: 1e6, mode: 'BLOCKED' };
  }

  if (mode === 'sky') {
    const sres = skywave_loss_dB(d, f, foF2, tx.height_m);
    if (sres.mode !== 'BLOCKED') return sres;
    return { loss_dB: 1e6, mode: 'BLOCKED' };
  }

  // --- Auto: NVIS → Sky → Ground ---
  if (nvis && f <= 7 && d <= 500 && foF2 > 0) {
    const nres = nvis_loss_dB(d, f, foF2, tx.height_m);
    if (nres.mode !== 'BLOCKED') return nres;
  }
  
  if (foF2 > 0) {
    const sres = skywave_loss_dB(d, f, foF2, tx.height_m);
    if (sres.mode !== 'BLOCKED') return sres;
  }
  
  // Ground wave as fallback (doesn't need foF2)
  const Lgw = groundwave_loss_dB(d, f, env.groundClass, tx.height_m, rx.height_m);
  if (Number.isFinite(Lgw)) return { loss_dB: Lgw, mode: 'GROUND' };

  return { loss_dB: 1e6, mode: 'BLOCKED' };
}
