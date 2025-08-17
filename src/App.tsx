import { useState } from 'react';
import MapView from './ui/MapView';
import ControlPanel from './ui/ControlPanel';
import Legend from './ui/Legend';
import { Tx, Rx, HFContext } from './core/contracts';
import { makeEnv } from './presets/environments';

export default function App() {
  const [tx, setTx] = useState<Tx>({ lat: 48.8566, lon: 2.3522, power_W: 10, gain_dBi: 5, cable_dB: 1, height_m: 30, frequency_MHz: 146 });
  const [rx, setRx] = useState<Rx>({ gain_dBi: 0, cable_dB: 0, height_m: 1.5, bandwidth_Hz: 20000, noiseFigure_dB: 5, requiredSNR_dB: 10 });
  const [env, setEnv] = useState(makeEnv('urban'));
  const [hf, setHf] = useState<HFContext>({ foF2_MHz: 10, NVIS_enabled: false, propagationMode: 'auto' });

  return (
    <div className="w-screen h-screen grid grid-cols-1 md:grid-cols-[360px_1fr]">
      <div className="p-3 space-y-3 overflow-auto bg-gray-50">
        <ControlPanel tx={tx} setTx={setTx} rx={rx} setRx={setRx} env={env} setEnv={setEnv} hf={hf} setHf={setHf} />
        <Legend />
      </div>
      <div className="relative">
        <MapView tx={tx} setTx={setTx} rx={rx} env={env} hf={hf} pxStep={8} />
      </div>
    </div>
  );
}
