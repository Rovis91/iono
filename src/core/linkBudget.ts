import { Rx } from './contracts';

/**
 * Calculate Effective Isotropic Radiated Power (EIRP) in dBm
 * 
 * EIRP represents the power that would be radiated by an isotropic antenna
 * to produce the same power density as the actual antenna in the direction
 * of maximum radiation.
 * 
 * @param power_W - Transmitter power in Watts
 * @param txGain_dBi - Transmitter antenna gain in dBi (relative to isotropic)
 * @param txCable_dB - Cable/connector losses in dB
 * @returns EIRP in dBm
 * 
 * Use cases: Link budget calculations, regulatory compliance
 * Limits: Valid for any positive power, gain, and loss values
 */
export function eirp_dBm(power_W: number, txGain_dBi: number, txCable_dB: number): number {
  return 10 * Math.log10(power_W * 1000) + txGain_dBi - txCable_dB;
}

/**
 * Calculate thermal noise floor in dBm
 * 
 * Based on Johnson-Nyquist noise: N = kTB where k is Boltzmann's constant,
 * T is temperature (assumed 290K), and B is bandwidth.
 * 
 * @param bandwidth_Hz - Receiver bandwidth in Hz
 * @param noiseFigure_dB - Receiver noise figure in dB
 * @returns Thermal noise floor in dBm
 * 
 * Use cases: Receiver sensitivity calculations, link budget analysis
 * Limits: Valid for any positive bandwidth and noise figure values
 * Note: Assumes 290K (17°C) ambient temperature
 */
export function noiseFloor_dBm(bandwidth_Hz: number, noiseFigure_dB: number): number {
  return -174 + 10 * Math.log10(Math.max(bandwidth_Hz, 1)) + noiseFigure_dB;
}

/**
 * Calculate receiver sensitivity in dBm
 * 
 * Sensitivity is the minimum received power required to achieve the specified
 * signal-to-noise ratio (SNR) at the receiver output.
 * 
 * @param rx - Receiver parameters including bandwidth, noise figure, and required SNR
 * @returns Receiver sensitivity in dBm
 * 
 * Use cases: Link budget analysis, coverage planning, system design
 * Limits: Depends on noise floor and SNR requirements
 */
export function sensitivity_dBm(rx: Rx): number {
  return noiseFloor_dBm(rx.bandwidth_Hz, rx.noiseFigure_dB) + rx.requiredSNR_dB;
}

/**
 * Calculate received power in dBm from link budget
 * 
 * Implements the fundamental link budget equation:
 * Pr = EIRP + Gr - Lpath - Lmisc - Lcable
 * 
 * @param EIRP_dBm - Effective isotropic radiated power in dBm
 * @param rxGain_dBi - Receiver antenna gain in dBi
 * @param rxCable_dB - Receiver cable/connector losses in dB
 * @param pathLoss_dB - Path loss in dB (includes free space + environment)
 * @param miscLoss_dB - Miscellaneous losses in dB (optional, defaults to 0)
 * @returns Received power in dBm
 * 
 * Use cases: Coverage analysis, link margin calculations, system performance evaluation
 * Limits: Valid for any real values; negative received power indicates very weak signals
 */
export function receivedPower_dBm(EIRP_dBm: number, rxGain_dBi: number, rxCable_dB: number, pathLoss_dB: number, miscLoss_dB = 0): number {
  return EIRP_dBm + rxGain_dBi - (pathLoss_dB + miscLoss_dB) - rxCable_dB;
}