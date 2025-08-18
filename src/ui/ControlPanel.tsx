import { useMemo } from 'react';
import type { Tx, Rx, Env, HFContext, EnvironmentClass, GroundClass } from '../core/contracts';
import { BAND_PRESETS } from '../presets/bands';

interface Props {
  tx: Tx; setTx: (v: Tx) => void;
  rx: Rx; setRx: (v: Rx) => void;
  env: Env; setEnv: (v: Env) => void;
  hf: HFContext; setHf: (v: HFContext) => void;
}

export default function ControlPanel({ tx, setTx, rx, setRx, env, setEnv, hf, setHf }: Props) {
  const isHF = tx.frequency_MHz < 30;
  const nvisApplicable = isHF && tx.frequency_MHz <= 7;

  const presetValue = useMemo(() => {
    const p = BAND_PRESETS.find(p => Math.abs(p.frequency_MHz - tx.frequency_MHz) < 1e-6);
    return p ? p.label : 'custom';
  }, [tx.frequency_MHz]);

  return (
    <div className="p-3 space-y-3 text-sm bg-white/90 rounded-xl shadow">
      <h3 className="font-semibold">Band & Preset</h3>
      <select
        className="border rounded p-1 w-full"
        value={presetValue} 
        onChange={(e) => {
          const label = e.target.value;
          if (label === 'custom') return;
          const p = BAND_PRESETS.find(x => x.label === label)!;
          setTx({ ...tx, frequency_MHz: p.frequency_MHz });
          if (p.groundClass) setEnv({ ...env, groundClass: p.groundClass });
          // Apply HF defaults if available
          if (p.foF2_MHz || p.propagationMode) {
            console.log(`Applying HF preset: foF2=${p.foF2_MHz}MHz, mode=${p.propagationMode}`);
            setHf({
              ...hf,
              ...(p.foF2_MHz !== undefined && { foF2_MHz: p.foF2_MHz }),
              ...(p.propagationMode !== undefined && { propagationMode: p.propagationMode })
            });
          }
          // Apply RX defaults
          setRx({
            ...rx,
            height_m: p.rxDefaults.height_m,
            gain_dBi: p.rxDefaults.gain_dBi,
            bandwidth_Hz: p.rxDefaults.bandwidth_Hz ?? rx.bandwidth_Hz,
            noiseFigure_dB: p.rxDefaults.noiseFigure_dB ?? rx.noiseFigure_dB,
            requiredSNR_dB: p.rxDefaults.requiredSNR_dB ?? rx.requiredSNR_dB,
          });
        }}
      >
        <option value="custom">Custom…</option>
        {BAND_PRESETS.map(p => <option key={p.label} value={p.label}>{p.label}</option>)}
      </select>

      <div className="grid grid-cols-2 gap-2">
        <Num label="Frequency (MHz)" value={tx.frequency_MHz} onChange={v=>setTx({ ...tx, frequency_MHz: v })} />
        <span className="text-xs self-end">Band: <b>{isHF ? 'HF' : 'V/UHF'}</b></span>
      </div>

      <h3 className="font-semibold">Transmitter</h3>
      <div className="grid grid-cols-2 gap-2">
        <Num label="Power (W)" value={tx.power_W} onChange={v=>setTx({ ...tx, power_W: v })} />
        <Num label="Gain (dBi)" value={tx.gain_dBi} onChange={v=>setTx({ ...tx, gain_dBi: v })} />
        <Num label="Cable loss (dB)" value={tx.cable_dB} onChange={v=>setTx({ ...tx, cable_dB: v })} />
        <Num label="Height (m)" value={tx.height_m} onChange={v=>setTx({ ...tx, height_m: v })} />
      </div>

      <h3 className="font-semibold">Receiver (preset defaults; change if needed)</h3>
      <details>
        <summary className="cursor-pointer text-xs text-gray-700">Advanced RX (BW/NF/SNR)</summary>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <Num label="RX Gain (dBi)" value={rx.gain_dBi} onChange={v=>setRx({ ...rx, gain_dBi: v })} />
          <Num label="RX Height (m)" value={rx.height_m} onChange={v=>setRx({ ...rx, height_m: v })} />
          <Num label="Bandwidth (Hz)" value={rx.bandwidth_Hz} onChange={v=>setRx({ ...rx, bandwidth_Hz: v })} />
          <Num label="Noise Fig (dB)" value={rx.noiseFigure_dB} onChange={v=>setRx({ ...rx, noiseFigure_dB: v })} />
          <Num label="Req. SNR (dB)" value={rx.requiredSNR_dB} onChange={v=>setRx({ ...rx, requiredSNR_dB: v })} />
        </div>
      </details>

      <h3 className="font-semibold">Propagation Controls</h3>
             {/* HF controls */}
       <div className={`grid grid-cols-2 gap-2 ${isHF ? '' : 'opacity-50 pointer-events-none'}`}>
         <Num label="foF2 (MHz)" value={hf.foF2_MHz} onChange={v=>setHf({ ...hf, foF2_MHz: v })} />
         <Toggle label="NVIS Enabled" checked={nvisApplicable ? hf.NVIS_enabled : false} disabled={!nvisApplicable} onChange={c=>setHf({ ...hf, NVIS_enabled: c })} />
         <div className="col-span-2 text-xs text-gray-600">
           {nvisApplicable ? "NVIS works for ≤7 MHz, ≤500 km. Use 'NVIS Only' mode to force NVIS." : "NVIS only available for ≤7 MHz"}
         </div>
         <div className="col-span-2">
           <label className="text-xs text-gray-600">Propagation Mode (HF only)</label>
           <select
            className="border rounded p-1 w-full"
            disabled={!isHF}
            value={hf.propagationMode ?? 'auto'}
            onChange={e=>setHf({ ...hf, propagationMode: e.target.value as 'auto' | 'ground' | 'sky' | 'nvis' })}
          >
            <option value="auto">Auto (NVIS → Sky → Ground)</option>
            <option value="nvis">NVIS Only (≤7 MHz, ≤500 km)</option>
            <option value="sky">Sky Wave Only (F2 layer)</option>
            <option value="ground">Ground Wave Only</option>
          </select>
         </div>
         <div className="col-span-2">
           <label className="text-xs text-gray-600">Ground class (HF only)</label>
           <select className="border rounded p-1 w-full" disabled={!isHF} value={env.groundClass} onChange={e=>setEnv({ ...env, groundClass: e.target.value as GroundClass })}>
             {(['sea','wet','dry'] as GroundClass[]).map(g => <option key={g} value={g}>{g}</option>)}
           </select>
         </div>
       </div>

      {/* V/UHF controls */}
      <div className={`grid grid-cols-2 gap-2 ${!isHF ? '' : 'opacity-50 pointer-events-none'}`}>
        <div className="col-span-2">
          <label className="text-xs text-gray-600">Environment (V/UHF only)</label>
          <select className="border rounded p-1 w-full" disabled={isHF} value={env.environment} onChange={e=>setEnv({ ...env, environment: e.target.value as EnvironmentClass })}>
            {(['open','rural','urban','forest','water','mountain'] as EnvironmentClass[]).map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <Num label="k-factor" value={env.kFactor} onChange={v=>setEnv({ ...env, kFactor: v })} />
        <Num label="Foliage depth (m)" value={env.foliageDepth_m ?? 0} onChange={v=>setEnv({ ...env, foliageDepth_m: v })} disabled={env.environment !== 'forest' || isHF} />
      </div>
    </div>
  );
}

function Num({ label, value, onChange, disabled }: { label: string; value: number; onChange: (v:number)=>void; disabled?: boolean }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-gray-600">{label}</span>
      <input className="border rounded p-1" type="number" value={value} onChange={e=>onChange(Number(e.target.value))} disabled={disabled} />
    </label>
  );
}
function Toggle({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v:boolean)=>void; disabled?: boolean }) {
  return (
    <label className={`inline-flex items-center gap-2 ${disabled ? 'opacity-50' : ''}`}>
      <input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)} disabled={disabled} />
      <span className="text-sm">{label}</span>
    </label>
  );
}
