import { Context, Env, EnvironmentClass, PathResult, Tx, Rx } from '../core/contracts';
import { lambda_m, losByHorizon, horizon_km } from '../core/geometry';

/**
 * Calculate Free Space Path Loss (FSPL) in dB
 * 
 * FSPL represents the theoretical path loss in free space without any obstacles
 * or atmospheric effects. It's the fundamental baseline for all propagation models.
 * 
 * Formula: L = 20log10(d) + 20log10(f) + 32.44 where:
 * - d is distance in km
 * - f is frequency in MHz
 * - 32.44 is the constant: 20log10(4π/c) where c is speed of light
 * 
 * @param d_km - Distance in kilometers
 * @param f_MHz - Frequency in MHz
 * @returns Free space path loss in dB
 * 
 * Use cases: LOS propagation modeling, baseline path loss calculation
 * Limits: Valid for any positive distance and frequency; minimum values clamped to avoid singularities
 * Note: This is the theoretical minimum path loss in ideal conditions
 */
function fspl_dB(d_km: number, f_MHz: number): number {
  const dk = Math.max(d_km, 1e-6);
  const fm = Math.max(f_MHz, 1e-6);
  return 20 * Math.log10(dk) + 20 * Math.log10(fm) + 32.44;
}

/**
 * Calculate two-slope path loss model (FSPL → 2-ray ground reflection)
 * 
 * This model accounts for ground reflection effects in line-of-sight propagation.
 * At short distances, FSPL dominates. Beyond the breakpoint, the path loss
 * increases more rapidly due to destructive interference between direct and
 * reflected rays.
 * 
 * Breakpoint formula: d_bp = 4·h_t·h_r/λ where:
 * - h_t, h_r are antenna heights in meters
 * - λ is wavelength in meters
 * 
 * @param d_km - Distance in kilometers
 * @param f_MHz - Frequency in MHz
 * @param h_t_m - Transmitter height in meters
 * @param h_r_m - Receiver height in meters
 * @returns Path loss in dB
 * 
 * Use cases: LOS propagation modeling, ground reflection effects
 * Limits: Valid for any positive values; assumes flat ground reflection
 * Note: This is a median model - actual path loss may vary due to terrain
 */
function twoSlope_dB(d_km: number, f_MHz: number, h_t_m: number, h_r_m: number): number {
  const d_m = Math.max(d_km * 1000, 1);
  const lam = lambda_m(f_MHz);
  const d_bp_m = Math.max((4 * h_t_m * h_r_m) / Math.max(lam, 1e-6), 1);
  if (d_m <= d_bp_m) {
    return fspl_dB(d_m / 1000, f_MHz);
  }
  const L_bp = fspl_dB(d_bp_m / 1000, f_MHz);
  return L_bp + 40 * Math.log10(d_m / d_bp_m);
}

/**
 * Calculate Hata/COST-231 path loss model in dB
 * 
 * The Hata model is an empirical path loss model for urban areas, extended by
 * COST-231 for higher frequencies. It's widely used for cellular and mobile
 * radio system planning.
 * 
 * Key features:
 * - Frequency range: 150-2000 MHz (clamped for validity)
 * - Distance range: 1-20 km (clamped for validity)
 * - Height ranges: TX 30-200m, RX 1-10m (clamped for validity)
 * - Environment-specific corrections for non-urban areas
 * 
 * @param d_km - Distance in kilometers
 * @param f_MHz - Frequency in MHz
 * @param h_t_m - Transmitter height in meters
 * @param h_r_m - Receiver height in meters
 * @param env - Environment class
 * @returns Path loss in dB, or NaN if outside valid range
 * 
 * Use cases: Cellular planning, mobile radio, urban/suburban propagation
 * Limits: f ∈ [150,2000] MHz, d ∈ [1,20] km, ht ∈ [30,200] m, hr ∈ [1,10] m
 * Note: Returns NaN for frequencies outside 150-2000 MHz range
 */
function hata_dB(d_km: number, f_MHz: number, h_t_m: number, h_r_m: number, env: EnvironmentClass): number {
  // Hata model is only valid for 150-2000 MHz
  if (f_MHz < 150 || f_MHz > 2000) return Number.NaN; // outside valid range for this model
  const f = f_MHz; // Use actual frequency, don't clamp
  const ht = Math.min(Math.max(h_t_m, 30), 200);
  const hr = Math.min(Math.max(h_r_m, 1), 10);
  const d = Math.min(Math.max(d_km, 1), 20);

  // Antenna height correction factor a(hr)
  const a_hr = ((): number => {
    if (f >= 300 && f <= 1500 && env === 'urban') {
      return 8.29 * Math.pow(Math.log10(1.54 * hr), 2) - 1.1; // large city variant used for urban
    }
    return (1.1 * Math.log10(f) - 0.7) * hr - (1.56 * Math.log10(f) - 0.8);
  })();

  // Main Hata formula: L = 69.55 + 26.16log10(f) - 13.82log10(ht) - a(hr) + (44.9-6.55log10(ht))log10(d)
  let L = 69.55 + 26.16 * Math.log10(f) - 13.82 * Math.log10(ht) - a_hr
    + (44.9 - 6.55 * Math.log10(ht)) * Math.log10(d);

  // Metropolitan correction C_m: use 3 dB for 'urban', 0 otherwise
  const C_m = (env === 'urban') ? 3 : 0;
  L += C_m;

  // Rural/open/water/mountain correction (Okumura extension)
  if (env === 'open' || env === 'rural' || env === 'water' || env === 'mountain') {
    L += -(4.78 * Math.pow(Math.log10(f), 2) - 18.33 * Math.log10(f) + 40.94);
  }
  // Forest handled separately via foliage
  return L;
}

/**
 * Calculate log-distance path loss model in dB
 * 
 * A simple empirical model that extends free space path loss with an
 * environment-dependent path loss exponent n. Used as fallback when
 * Hata/COST-231 is not applicable.
 * 
 * Formula: L = L0 + 10·n·log10(d/d0) where:
 * - L0 is the reference path loss at distance d0
 * - n is the path loss exponent (environment-dependent)
 * - d is the actual distance
 * - d0 is the reference distance (0.1 km)
 * 
 * @param d_km - Distance in kilometers
 * @param f_MHz - Frequency in MHz
 * @param n - Path loss exponent (environment-dependent)
 * @param d0_km - Reference distance in km (default: 0.1 km)
 * @returns Path loss in dB
 * 
 * Use cases: Fallback model when Hata not applicable, simple propagation modeling
 * Path loss exponents: open(2.1), rural(2.4), urban(3.5), forest(3.8), water(2.0), mountain(2.6)
 * Note: L0 is calculated as free space path loss at reference distance d0
 */
function logDistance_dB(d_km: number, f_MHz: number, n: number, d0_km = 0.1): number {
  const L0 = fspl_dB(Math.max(d0_km, 1e-4), f_MHz);
  return L0 + 10 * n * Math.log10(Math.max(d_km, 1e-6) / d0_km);
}

/**
 * Calculate Weissberger foliage loss model in dB
 * 
 * The Weissberger model estimates additional path loss due to vegetation
 * (trees, forest canopy) along the propagation path. It's applicable for
 * frequencies from 230 MHz to 95 GHz, though used more broadly in practice.
 * 
 * Two regimes based on foliage depth:
 * - Shallow foliage (≤ 14m): L = 0.45·f^0.284·d
 * - Deep foliage (> 14m): L = 1.33·f^0.284·d^0.588 (capped at 400m)
 * 
 * @param f_MHz - Frequency in MHz
 * @param depth_m - Foliage depth along path in meters
 * @returns Additional path loss in dB due to foliage
 * 
 * Use cases: Forest propagation modeling, vegetation impact assessment
 * Limits: Valid for any positive frequency; depth capped at 400m; returns 0 for no foliage
 * Note: Frequency dependency is relatively weak (f^0.284)
 */
function foliage_dB(f_MHz: number, depth_m: number): number {
  if (!depth_m || depth_m <= 0) return 0;
  const f = Math.max(f_MHz, 1);
  if (depth_m <= 14) return 0.45 * Math.pow(f, 0.284) * depth_m;
  const d = Math.min(depth_m, 400);
  return 1.33 * Math.pow(f, 0.284) * Math.pow(d, 0.588);
}

/**
 * Map environment class to path loss exponent n for log-distance model
 * 
 * The path loss exponent n determines how rapidly signal strength decreases
 * with distance in the log-distance model. Higher values indicate more
 * challenging propagation environments.
 * 
 * @param env - Environment class
 * @returns Path loss exponent n
 * 
 * Use cases: Log-distance fallback model, environment-specific propagation
 * Values: open(2.1), rural(2.4), urban(3.5), forest(3.8), water(2.0), mountain(2.6)
 * Note: Higher n = more rapid signal decay with distance
 */
function envToN(env: EnvironmentClass): number {
  switch (env) {
    case 'open': return 2.1;     // Free space-like (minimal obstacles)
    case 'rural': return 2.4;    // Sparse obstacles
    case 'urban': return 3.5;    // Dense urban environment
    case 'forest': return 3.8;   // Heavy vegetation
    case 'water': return 2.0;    // Over-water (excellent propagation)
    case 'mountain': return 2.6; // Hilly terrain
  }
}

/**
 * Solve V/UHF propagation path loss and determine mode
 * 
 * Implements the V/UHF decision tree from the specification:
 * 1. Compute radio horizon using k-factor
 * 2. Build LOS candidate (two-slope FSPL → 2-ray)
 * 3. Build NLOS candidate (Hata/COST-231 or log-distance fallback)
 * 4. Add optional foliage loss for forest environments
 * 5. Perform smooth handover at horizon to eliminate ring seam
 * 6. Blend LOS and NLOS across ±5% of horizon distance
 * 
 * @param tx - Transmitter parameters
 * @param rx - Receiver parameters
 * @param env - Environment parameters (environment class, k-factor, foliage)
 * @param ctx - Context including distance
 * @returns PathResult with loss in dB and propagation mode
 * 
 * Use cases: V/UHF propagation modeling, coverage analysis for 30-3000 MHz
 * Modes: 'LOS' (line-of-sight), 'NLOS' (non-line-of-sight)
 * Features: Seamless horizon handover, environment-specific modeling, foliage effects
 */
export function solveVuhf(tx: Tx, rx: Rx, env: Env, ctx: Context): PathResult {
  const f = tx.frequency_MHz;
  const d = Math.max(ctx.distance_km, 0.001);

  // Compute both candidates to allow a smooth handover at the radio horizon
  const L_los = twoSlope_dB(d, f, tx.height_m, rx.height_m);

  // Median model: Hata/COST-231 with log-distance fallback
  let Lmed = hata_dB(d, f, tx.height_m, rx.height_m, env.environment);
  if (Number.isNaN(Lmed)) {
    const n = envToN(env.environment);
    Lmed = logDistance_dB(d, f, n);
  }

  // Optional foliage adder on the median path only (forest environments)
  let L_nlos = Lmed;
  if (env.environment === 'forest' && env.foliageDepth_m && env.foliageDepth_m > 0) {
    L_nlos += foliage_dB(f, env.foliageDepth_m);
  }

  // Determine radio horizon for handover
  const dH = horizon_km(tx.height_m, rx.height_m, env.kFactor);

  // Adjust NLOS curve so it meets LOS at the handover distance (eliminate ring seam)
  const Llos_at_dH = twoSlope_dB(Math.max(dH, 0.001), f, tx.height_m, rx.height_m);
  let Lmed_at_dH = hata_dB(Math.max(dH, 0.001), f, tx.height_m, rx.height_m, env.environment);
  if (Number.isNaN(Lmed_at_dH)) {
    const n = envToN(env.environment);
    Lmed_at_dH = logDistance_dB(Math.max(dH, 0.001), f, n);
  }
  if (env.environment === 'forest' && env.foliageDepth_m && env.foliageDepth_m > 0) {
    Lmed_at_dH += foliage_dB(f, env.foliageDepth_m);
  }
  const delta = Llos_at_dH - Lmed_at_dH;
  L_nlos += delta;

  // Smooth blend across ±5% of dH to avoid a visible annulus
  const eps = 0.05;
  const dLo = dH * (1 - eps);
  const dHi = dH * (1 + eps);
  const blend = d <= dLo ? 0 : d >= dHi ? 1 : (d - dLo) / Math.max(dHi - dLo, 1e-6);
  const L = (1 - blend) * L_los + blend * L_nlos;
  const mode: PathResult['mode'] = blend < 0.5 ? 'LOS' : 'NLOS';
  return { loss_dB: L, mode };
}