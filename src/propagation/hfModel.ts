
import { Context, Env, PathResult, Tx, Rx } from '../core/contracts';

/**
 * Calculate Free Space Path Loss (FSPL) in dB
 * FSPL = 32.44 + 20*log10(d_km) + 20*log10(f_MHz)
 */
function fspl_dB(d_km: number, f_MHz: number): number {
  const dk = Math.max(d_km, 0.001);
  const fm = Math.max(f_MHz, 0.001);
  return 32.44 + 20 * Math.log10(dk) + 20 * Math.log10(fm);
}

/**
 * Calculate ground conductivity for HF ground-wave
 */
function getGroundConductivity(groundClass: string): number {
  switch (groundClass) {
    case 'sea': return 5.0;    // Sea water - excellent conductivity
    case 'wet': return 0.01;   // Wet ground - good conductivity
    case 'dry': return 0.001;  // Dry ground - poor conductivity
    default: return 0.01;      // Default to wet
  }
}

/**
 * Calculate HF ground-wave propagation loss
 * 
 * Based on ITU-R P.368-9 ground-wave model
 * Only applicable for f ≤ 10 MHz and d ≤ 300 km
 */
function groundwaveLoss_dB(d_km: number, f_MHz: number, groundClass: string): number {
  // Only applicable for low frequencies and short distances
  if (f_MHz > 10 || d_km > 300) {
    return Number.POSITIVE_INFINITY;
  }

  const conductivity = getGroundConductivity(groundClass);
  const L_fs = fspl_dB(d_km, f_MHz);
  
  // Ground-wave excess loss (simplified ITU model)
  // Higher conductivity = lower loss
  const conductivity_factor = Math.sqrt(1 / Math.max(conductivity, 0.001));
  const excess_loss = 0.1 * d_km * Math.pow(f_MHz, 0.5) * conductivity_factor;
  
  return L_fs + excess_loss;
}

/**
 * Calculate HF sky-wave propagation loss
 * 
 * Sky-wave propagation with ionospheric reflection
 * Only applicable for f ≤ 30 MHz and d > 50 km
 */
function skywaveLoss_dB(d_km: number, f_MHz: number, foF2_MHz: number): number {
  // Only applicable for HF frequencies and longer distances
  if (f_MHz > 30 || d_km <= 50) {
    return Number.POSITIVE_INFINITY;
  }

  // Use F2 layer for sky-wave (height = 300 km)
  const h_iono_km = 300;
  
  // Calculate takeoff angle (simplified)
  const takeoff_angle_rad = Math.atan(d_km / (2 * h_iono_km));
  
  // Check MUF gate
  const muf = foF2_MHz * (1 / Math.cos(takeoff_angle_rad));
  if (f_MHz > muf) {
    return Number.POSITIVE_INFINITY; // Frequency too high
  }
  
  // Calculate hop distance
  const hop_distance_km = 2 * h_iono_km * Math.tan(takeoff_angle_rad);
  
  // Determine number of hops needed
  const num_hops = Math.ceil(d_km / hop_distance_km);
  
  // Limit to 2 hops for V1
  if (num_hops > 2) {
    return Number.POSITIVE_INFINITY;
  }
  
  // Calculate slant distance
  const slant_distance_km = d_km / Math.cos(takeoff_angle_rad);
  const slant_distance_per_hop = slant_distance_km / num_hops;
  
  // Free space loss for slant path
  const fspl = fspl_dB(slant_distance_per_hop, f_MHz);
  
  // Ionospheric absorption (simplified)
  const absorption = 10 * Math.pow(f_MHz, -2) * (1 / Math.cos(takeoff_angle_rad));
  
  // Total loss per hop
  const loss_per_hop = fspl + absorption;
  
  // Total path loss
  let total_loss = num_hops * loss_per_hop;
  
  // Add ground reflection losses for multi-hop
  if (num_hops > 1) {
    total_loss += (num_hops - 1) * 3; // 3 dB per ground reflection
  }
  
  return total_loss;
}

/**
 * Calculate NVIS propagation loss
 * 
 * Near Vertical Incidence Sky-wave for regional coverage
 * Only applicable for f ≤ 7 MHz and d ≤ 500 km
 */
function nvisLoss_dB(d_km: number, f_MHz: number, foF2_MHz: number): number {
  // NVIS specific conditions
  if (f_MHz > 7 || d_km > 500) {
    return Number.POSITIVE_INFINITY;
  }
  
  // Use E-layer for NVIS (height = 110 km)
  const h_iono_km = 110;
  const takeoff_angle_rad = 80 * Math.PI / 180; // High takeoff angle
  
  // NVIS-specific MUF calculation
  const nvis_muf = foF2_MHz * 0.3 * (1 / Math.cos(takeoff_angle_rad));
  if (f_MHz > nvis_muf) {
    return Number.POSITIVE_INFINITY;
  }
  
  // Single-hop NVIS path
  const slant_distance_km = d_km / Math.cos(takeoff_angle_rad);
  const fspl = fspl_dB(slant_distance_km, f_MHz);
  
  // High absorption for NVIS (D-layer)
  const absorption = 15 * Math.pow(f_MHz, -2) * (1 / Math.cos(takeoff_angle_rad));
  
  return fspl + absorption;
}

/**
 * Determine HF propagation mode and calculate path loss
 * 
 * Simple decision tree:
 * 1. If explicit mode selected, use that mode
 * 2. If foF2 provided, try sky-wave first
 * 3. If sky-wave fails, try ground-wave
 * 4. If neither works, return BLOCKED
 */
export function solveHF(tx: Tx, rx: Rx, env: Env, ctx: Context): PathResult {
  const f_MHz = tx.frequency_MHz;
  const d_km = Math.max(ctx.distance_km, 0.001);
  const mode = ctx.hf?.propagationMode || 'auto';
  const foF2_MHz = ctx.hf?.foF2_MHz || 0;
  const nvis_enabled = ctx.hf?.NVIS_enabled || false;
  
  // Debug logging
  if (d_km <= 50) {
    console.log(`HF: f=${f_MHz}MHz, d=${d_km}km, mode=${mode}, foF2=${foF2_MHz}MHz, NVIS=${nvis_enabled}`);
  }
  
  // Handle explicit mode selection
  if (mode === 'ground') {
    const loss = groundwaveLoss_dB(d_km, f_MHz, env.groundClass);
    if (loss !== Number.POSITIVE_INFINITY) {
      return { loss_dB: loss, mode: 'GROUND' };
    } else {
      return { loss_dB: 200, mode: 'BLOCKED' };
    }
  }
  
  if (mode === 'sky') {
    if (foF2_MHz > 0) {
      let loss: number;
      let skyMode: PathResult['mode'];
      
      if (nvis_enabled && f_MHz <= 7) {
        // NVIS mode
        loss = nvisLoss_dB(d_km, f_MHz, foF2_MHz);
        skyMode = 'NVIS';
      } else {
        // Standard sky-wave
        loss = skywaveLoss_dB(d_km, f_MHz, foF2_MHz);
        skyMode = 'IONO';
      }
      
      if (loss !== Number.POSITIVE_INFINITY) {
        return { loss_dB: loss, mode: skyMode };
      }
    }
    return { loss_dB: 200, mode: 'BLOCKED' };
  }
  
  // Auto mode: try sky-wave first, then ground-wave
  if (foF2_MHz > 0) {
    let sky_loss: number;
    let skyMode: PathResult['mode'];
    
    if (nvis_enabled && f_MHz <= 7) {
      // Try NVIS first
      sky_loss = nvisLoss_dB(d_km, f_MHz, foF2_MHz);
      skyMode = 'NVIS';
    } else {
      // Try standard sky-wave
      sky_loss = skywaveLoss_dB(d_km, f_MHz, foF2_MHz);
      skyMode = 'IONO';
    }
    
    if (sky_loss !== Number.POSITIVE_INFINITY) {
      return { loss_dB: sky_loss, mode: skyMode };
    }
  }
  
  // Ground-wave fallback
  const ground_loss = groundwaveLoss_dB(d_km, f_MHz, env.groundClass);
  if (ground_loss !== Number.POSITIVE_INFINITY) {
    return { loss_dB: ground_loss, mode: 'GROUND' };
  }
  
  // No propagation possible
  return { loss_dB: 200, mode: 'BLOCKED' };
}