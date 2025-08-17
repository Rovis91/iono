/**
 * Calculate great-circle distance between two points using haversine formula
 * 
 * The haversine formula provides accurate distance calculation on a spherical Earth.
 * It accounts for the curvature of the Earth and is more accurate than simple
 * Euclidean distance for geographic coordinates.
 * 
 * @param lat1 - Latitude of first point in degrees
 * @param lon1 - Longitude of first point in degrees  
 * @param lat2 - Latitude of second point in degrees
 * @param lon2 - Longitude of second point in degrees
 * @returns Distance in kilometers
 * 
 * Use cases: Path loss calculations, coverage area analysis, geographic distance measurements
 * Limits: Valid for any latitude/longitude coordinates; assumes spherical Earth (6371 km radius)
 * Accuracy: Within 0.5% for most practical applications
 */
export function haversine_km(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // km - Earth's radius
  const toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Calculate wavelength in meters from frequency in MHz
 * 
 * Uses the fundamental relationship: λ = c/f where c is the speed of light
 * and f is the frequency. This is essential for antenna design and
 * propagation calculations.
 * 
 * @param frequency_MHz - Frequency in MHz
 * @returns Wavelength in meters
 * 
 * Use cases: Antenna design, Fresnel zone calculations, propagation modeling
 * Limits: Valid for any positive frequency; minimum frequency clamped to 0.000001 MHz
 * Note: Uses speed of light in vacuum (2.99792458e8 m/s)
 */
export function lambda_m(frequency_MHz: number): number {
  const c = 2.99792458e8; // m/s - speed of light in vacuum
  return c / (Math.max(frequency_MHz, 0.000001) * 1e6);
}

/**
 * Calculate radio horizon distance in kilometers
 * 
 * The radio horizon is the maximum line-of-sight distance between two antennas
 * considering Earth's curvature. The k-factor accounts for atmospheric refraction
 * which extends the horizon beyond the geometric horizon.
 * 
 * Formula: d = √(2kRe·ht) + √(2kRe·hr) where:
 * - k is the refraction factor (typically 4/3 ≈ 1.33)
 * - Re is Earth's radius (6371 km)
 * - ht, hr are antenna heights in meters
 * 
 * @param h_t_m - Transmitter antenna height in meters
 * @param h_r_m - Receiver antenna height in meters  
 * @param kFactor - Atmospheric refraction factor (typically 1.33)
 * @returns Radio horizon distance in kilometers
 * 
 * Use cases: LOS/NLOS boundary determination, coverage planning, propagation modeling
 * Limits: Valid for any positive heights and k-factor; assumes spherical Earth
 * Typical values: k = 1.33 (standard atmosphere), 1.0 (no refraction), 1.7 (ducting)
 */
export function horizon_km(h_t_m: number, h_r_m: number, kFactor: number): number {
  const Re_km = 6371; // Earth's radius in km
  const term = (h_m: number) => Math.sqrt(2 * kFactor * Re_km * (h_m / 1000));
  return term(h_t_m) + term(h_r_m);
}

/** First Fresnel zone radius (m) at a point between TX (d1) and RX (d2) at wavelength lambda */
export function fresnelR1_m(lambda_m_val: number, d1_m: number, d2_m: number): number {
  return Math.sqrt(Math.max(lambda_m_val, 1e-9) * d1_m * d2_m / Math.max(d1_m + d2_m, 1));
}

/** Simple LOS check (no DEM): true if path length ≤ radio horizon. */
export function losByHorizon(distance_km: number, h_t_m: number, h_r_m: number, kFactor: number): boolean {
  return distance_km <= horizon_km(h_t_m, h_r_m, kFactor);
}