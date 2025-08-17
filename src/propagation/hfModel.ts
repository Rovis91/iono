// =============================
// File: src/propagation/hfModel.ts
// =============================

import { Context, Env, PathResult, Tx, Rx } from '../core/contracts';

/**
 * HF propagation (V1.5):
 * - Ground-wave (simplified ITU-R P.368-style) for MF/low-HF, short ranges.
 * - Sky-wave (F2) with MUF gate + skip-zone + ≤2 hops.
 * - NVIS (optional) with E-layer, high elevation.
 * - Decision tree: NVIS (if enabled & valid) -> Sky-wave (if foF2 set & valid) -> Ground-wave (if valid) -> BLOCKED.
 *
 * Notes:
 * - Loss-only PathResult; SNR/margin handled by predictLink() (EIRP + sensitivity).
 * - All units: distance km, freq MHz, heights km in ionosphere helpers, gains dBi.
 */

/* ---------------------------
 * Shared helpers
 * ---------------------------
 */

/** Free-space path loss (FSPL) in dB; d in km, f in MHz */
function fspl_dB(d_km: number, f_MHz: number): number {
  const dk = Math.max(d_km, 1e-6);
  const fm = Math.max(f_MHz, 1e-6);
  return 32.44 + 20 * Math.log10(dk) + 20 * Math.log10(fm);
}

/** Clamp utility */
function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/* ---------------------------
 * Ground-wave (simplified)
 * ---------------------------
 *
 * Intended domain:
 * - Frequencies: f ≤ 10 MHz (MF/low-HF)
 * - Ranges: d ≤ 300 km
 *
 * Model:
 *   L_gw(dB) = FSPL(d, f) + k_g(ground) * d_km * sqrt(f_MHz)
 * where:
 *   k_g(sea)=0.02, k_g(wet)=0.05, k_g(dry)=0.08  (empirical V1 heuristic)
 * Lower k_g → lower excess loss (better propagation).
 */

/** Excess-loss slope per ground class (empirical heuristic for V1) */
function kg_by_ground(ground: Env['groundClass']): number {
  switch (ground) {
    case 'sea': return 0.02; // excellent conductivity
    case 'wet': return 0.05; // good
    case 'dry':
    default:    return 0.08; // poor
  }
}

/** Ground-wave validity gate for this simplified model */
function groundwave_applicable(f_MHz: number, d_km: number): boolean {
  return f_MHz <= 10 && d_km <= 300;
}

/** Ground-wave loss (simplified V1) */
function groundwave_loss_dB(d_km: number, f_MHz: number, ground: Env['groundClass']): number {
  if (!groundwave_applicable(f_MHz, d_km)) return Number.POSITIVE_INFINITY;
  const Lfs = fspl_dB(d_km, f_MHz);
  const kg = kg_by_ground(ground);
  const excess = kg * d_km * Math.sqrt(Math.max(f_MHz, 0.0001));
  return Lfs + excess;
}

/* ---------------------------
 * Sky-wave (F2) + skip zone
 * ---------------------------
 *
 * Assumptions (V1.5):
 * - Virtual F2 height h_F2 = 300 km
 * - Takeoff angle α from 2D geometry: α = atan(d / (2 h_F2))
 * - MUF gate: f ≤ foF2 · sec(α)
 * - First-hop skip distance: use a minimum launch α_min ≈ 10° for realism
 *   d_skip ≈ 2 h_F2 tan(α_min)
 * - Hop count N = ceil(d / (2 h_F2 tan α)), capped at N ≤ 2
 * - Per-hop slant: s ≈ 2 h_F2 / sin α
 * - Per-hop loss ≈ FSPL(s) + A_absorb, with A_absorb ∝ sec α · f^(-p)
 *   (use p=2 and a 10 dB scale factor as a simple surrogate)
 * - Add 3 dB per ground reflection (N−1 times)
 */

const H_F2_KM = 300;       // virtual F2 reflection height
const MIN_TAKEOFF_DEG = 10; // conservative min launch angle for skip estimation

/** Takeoff/elevation angle (radians) from ground range and virtual height */
function takeoff_angle_rad_from_range(d_km: number, h_km: number): number {
  return Math.atan(Math.max(d_km, 1e-6) / (2 * Math.max(h_km, 1e-3)));
}

/** MUF via secant law (MHz) */
function muf_secant_MHz(foF2_MHz: number, alpha_rad: number): number {
  const sec = 1 / Math.cos(alpha_rad);
  return foF2_MHz * sec;
}

/** First-hop skip distance (km) for a minimum useful takeoff angle */
function first_hop_skip_km(h_km: number, minAlphaDeg = MIN_TAKEOFF_DEG): number {
  const a = clamp(minAlphaDeg, 1, 30) * Math.PI / 180;
  return 2 * h_km * Math.tan(a);
}

/** Per-hop absorption surrogate (dB) — simple frequency & angle dependence */
function absorption_per_hop_dB(f_MHz: number, alpha_rad: number): number {
  const sec = 1 / Math.cos(alpha_rad);
  // Scale and exponent chosen for plausible behavior; tune as needed
  return 10 * Math.pow(Math.max(f_MHz, 0.1), -2) * sec;
}

/** Sky-wave loss with MUF and skip-zone checks; returns PathResult */
function skywave_loss_dB(d_km: number, f_MHz: number, foF2_MHz: number): PathResult {
  // Basic domain for this simplified sky-wave
  if (f_MHz > 30 || d_km <= 50 || foF2_MHz <= 0) {
    return { loss_dB: 1e6, mode: 'BLOCKED' };
  }

  const alpha = takeoff_angle_rad_from_range(d_km, H_F2_KM);

  // MUF gate
  const muf = muf_secant_MHz(foF2_MHz, alpha);
  if (f_MHz > muf) return { loss_dB: 1e6, mode: 'BLOCKED' };

  // Skip-zone (too short for first hop with a realistic minimum launch angle)
  const d_skip = first_hop_skip_km(H_F2_KM, MIN_TAKEOFF_DEG);
  if (d_km < d_skip) return { loss_dB: 1e6, mode: 'BLOCKED' };

  // Hop geometry
  const hop_range = 2 * H_F2_KM * Math.tan(alpha);
  const hops = Math.max(1, Math.ceil(d_km / Math.max(hop_range, 1e-3)));
  if (hops > 2) return { loss_dB: 1e6, mode: 'BLOCKED' };

  // Per-hop slant distance and loss
  const slant_per_hop_km = (2 * H_F2_KM) / Math.max(Math.sin(alpha), 1e-6);
  const L_fs_per_hop = fspl_dB(slant_per_hop_km, f_MHz);
  const A_absorb = absorption_per_hop_dB(f_MHz, alpha);

  let total = hops * (L_fs_per_hop + A_absorb);
  if (hops > 1) total += (hops - 1) * 3; // 3 dB per ground reflection

  return { loss_dB: total, mode: 'IONO' };
}

/* ---------------------------
 * NVIS (Near-Vertical) optional
 * ---------------------------
 *
 * Assumptions:
 * - E-layer height h_E ≈ 110 km
 * - Fixed high elevation α ≈ 80°
 * - MUF gate: f ≤ foF2 · sec(α)
 * - Stronger absorption surrogate than sky-wave
 * - Single-hop, valid up to ~500 km
 */

const H_E_KM = 110;
const NVIS_ALPHA_DEG = 80;

function nvis_loss_dB(d_km: number, f_MHz: number, foF2_MHz: number): PathResult {
  if (f_MHz > 7 || d_km > 500 || foF2_MHz <= 0) {
    return { loss_dB: 1e6, mode: 'BLOCKED' };
  }
  const alpha = NVIS_ALPHA_DEG * Math.PI / 180;
  // MUF gate for near-vertical incidence
  const muf = muf_secant_MHz(foF2_MHz, alpha);
  if (f_MHz > muf) return { loss_dB: 1e6, mode: 'BLOCKED' };

  // Single-hop slant distance at fixed α
  const slant_km = (2 * H_E_KM) / Math.max(Math.sin(alpha), 1e-6);
  const L_fs = fspl_dB(slant_km, f_MHz);

  // Stronger absorption near D/E layers
  const A_absorb = 15 * Math.pow(Math.max(f_MHz, 0.1), -2) * (1 / Math.cos(alpha));

  return { loss_dB: L_fs + A_absorb, mode: 'NVIS' };
}

/* ---------------------------
 * Public entry point
 * ---------------------------
 */

export function solveHF(tx: Tx, _rx: Rx, env: Env, ctx: Context): PathResult {
  const f = tx.frequency_MHz;
  const d = Math.max(ctx.distance_km, 0.001);

  // Optional: propagation mode coming from ControlPanel (auto | ground | sky)
  // If your HFContext type doesn’t include it, add:
  //   propagationMode?: 'auto' | 'ground' | 'sky'
  const mode = (ctx.hf as any)?.propagationMode as ('auto'|'ground'|'sky'|undefined);
  const foF2 = ctx.hf?.foF2_MHz ?? 0;
  const nvis = !!ctx.hf?.NVIS_enabled;

  // --- Explicit modes first ---
  if (mode === 'ground') {
    const gw = groundwave_loss_dB(d, f, env.groundClass);
    return Number.isFinite(gw) ? { loss_dB: gw, mode: 'GROUND' } : { loss_dB: 1e6, mode: 'BLOCKED' };
  }
  if (mode === 'sky') {
    // NVIS preferred when enabled and in-range
    if (nvis && f <= 7 && d <= 500 && foF2 > 0) {
      const res = nvis_loss_dB(d, f, foF2);
      if (res.mode !== 'BLOCKED' && Number.isFinite(res.loss_dB)) return res;
    }
    if (foF2 > 0) {
      const res = skywave_loss_dB(d, f, foF2);
      if (res.mode !== 'BLOCKED' && Number.isFinite(res.loss_dB)) return res;
    }
    return { loss_dB: 1e6, mode: 'BLOCKED' };
  }

  // --- Auto (default): NVIS -> Sky -> Ground ---
  if (nvis && f <= 7 && d <= 500 && foF2 > 0) {
    const res = nvis_loss_dB(d, f, foF2);
    if (res.mode !== 'BLOCKED' && Number.isFinite(res.loss_dB)) return res;
  }
  if (foF2 > 0) {
    const res = skywave_loss_dB(d, f, foF2);
    if (res.mode !== 'BLOCKED' && Number.isFinite(res.loss_dB)) return res;
  }
  const gw = groundwave_loss_dB(d, f, env.groundClass);
  if (Number.isFinite(gw)) return { loss_dB: gw, mode: 'GROUND' };

  return { loss_dB: 1e6, mode: 'BLOCKED' };
}
