import { Context, Env, LinkResult, Tx, Rx } from '../core/contracts';
import { eirp_dBm, receivedPower_dBm, sensitivity_dBm } from '../core/linkBudget';
import { solveHF } from './hfModel';
import { solveVuhf } from './vuhfModel';

export function predictPath(tx: Tx, rx: Rx, env: Env, ctx: Context) {
  if (tx.frequency_MHz < 30) return solveHF(tx, rx, env, ctx);
  return solveVuhf(tx, rx, env, ctx);
}

export function predictLink(tx: Tx, rx: Rx, env: Env, ctx: Context): LinkResult {
  const path = predictPath(tx, rx, env, ctx);
  const EIRP = eirp_dBm(tx.power_W, tx.gain_dBi, tx.cable_dB);
  const pr = receivedPower_dBm(EIRP, rx.gain_dBi, rx.cable_dB, path.loss_dB);
  const sens = sensitivity_dBm(rx);
  return {
    pr_dBm: pr,
    sensitivity_dBm: sens,
    margin_dB: pr - sens,
    mode: path.mode,
  };
}