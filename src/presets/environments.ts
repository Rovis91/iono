import { Env, EnvironmentClass } from '../core/contracts';

export interface EnvDefaults {
  n: number;        // log-distance exponent for fallback
  sigma_dB: number; // for V2 probability view
  foliageDepth_m?: number;
}

export const ENV_DEFAULTS: Record<EnvironmentClass, EnvDefaults> = {
  open:     { n: 2.1, sigma_dB: 4 },
  rural:    { n: 2.4, sigma_dB: 5 },
  urban:    { n: 3.5, sigma_dB: 8 },
  forest:   { n: 3.8, sigma_dB: 10, foliageDepth_m: 30 },
  water:    { n: 2.0, sigma_dB: 3 },
  mountain: { n: 2.6, sigma_dB: 6 },
};

/** Helper to build an Env object with sensible defaults */
export function makeEnv(environment: EnvironmentClass, overrides?: Partial<Env>): Env {
  const base: Env = {
    environment,
    kFactor: 1.33,
    groundClass: 'wet',
    foliageDepth_m: ENV_DEFAULTS[environment].foliageDepth_m,
  };
  return { ...base, ...(overrides || {}) };
}