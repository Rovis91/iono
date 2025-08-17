import { MapContainer, TileLayer, useMapEvents, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import type { Tx, Rx, Env, HFContext } from '../core/contracts';

interface Props {
  tx: Tx; setTx: (v: Tx) => void;
  rx: Rx; env: Env; hf: HFContext;
  pxStep: number;
}

// Color & visibility settings
const MARGIN_MIN_DB = -10; // lower bound of color window
const MARGIN_MAX_DB = 30;  // upper bound of color window
const POWER_CUTOFF_DBM = -110; // do not paint below this Pr (dBm)

export default function MapView({ tx, setTx, rx, env, hf, pxStep }: Props) {
  const [worker] = useState(() => new Worker(new URL('../workers/coverageWorker.ts', import.meta.url), { type: 'module' }));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState({ north: 49, south: 48, east: 3, west: 2 });
  const [zoom, setZoom] = useState(8);

  const [placing, setPlacing] = useState(false);

  const txIcon = useMemo(() => L.divIcon({ className: 'tx-icon', html: '<div class="tx-dot"></div>', iconSize: [18,18], iconAnchor: [9,9] }), []);

  const requestCoverage = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    worker.postMessage({ bounds, zoom, width: canvas.width, height: canvas.height, pxStep, tx, rx, env, ctxBase: { hf } });
  }, [worker, bounds, zoom, pxStep, tx, rx, env, hf]);

  function MapHooks() {
    useMapEvents({
      click(e) {
        if (placing) {
          setTx({ ...tx, lat: e.latlng.lat, lon: e.latlng.lng });
          setPlacing(false);
        }
      },
      moveend(e) {
        const m = e.target as L.Map; const b = m.getBounds();
        setBounds({ north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() });
        setZoom(m.getZoom());
      },
      zoomend(e) {
        const m = e.target as L.Map; const b = m.getBounds();
        setBounds({ north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() });
        setZoom(m.getZoom());
      }
    });
    return null;
  }

  // Resize observer
  useEffect(() => {
    const canvas = canvasRef.current; const host = hostRef.current; if (!canvas || !host) return;
    const ro = new ResizeObserver(() => {
      const r = host.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(r.width));
      canvas.height = Math.max(1, Math.floor(r.height));
      requestCoverage();
    });
    ro.observe(host); requestCoverage();
    return () => ro.disconnect();
  }, [requestCoverage]);

  // Recompute on params or viewport change
  useEffect(() => { requestCoverage(); }, [requestCoverage]);

  // Draw results
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return; const ctx = canvas.getContext('2d'); if (!ctx) return;

    const onMsg = (e: MessageEvent) => {
      const data = e.data as { cells: {x:number;y:number;margin_dB:number;pr_dBm:number;mode:string}[]; width:number;height:number;pxStep:number; error?: string };
      
      if (data.error) {
        console.error('Coverage worker error:', data.error);
        return;
      }
      
      const { cells, width, height, pxStep } = data;
      ctx.clearRect(0, 0, width, height);

      for (const c of cells) {
        // Do not paint below power cutoff
        if (c.pr_dBm < POWER_CUTOFF_DBM) continue;
        
        // Map margin window −10..+30 dB → 0..1
        const t = Math.max(0, Math.min(1, (c.margin_dB - MARGIN_MIN_DB) / (MARGIN_MAX_DB - MARGIN_MIN_DB)));
        const [r,g,b,a] = viridis(t);
        ctx.fillStyle = `rgba(${r},${g},${b},${a/255})`;
        ctx.fillRect(c.x, c.y, pxStep, pxStep);
      }
    };
    worker.addEventListener('message', onMsg);
    return () => worker.removeEventListener('message', onMsg);
  }, [worker]);

  return (
    <div className="relative w-full h-full" ref={hostRef}>
      <MapContainer center={[tx.lat, tx.lon]} zoom={zoom} className="w-full h-full">
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <MapHooks />
        <Marker position={[tx.lat, tx.lon]} icon={txIcon}>
          <Popup>
            <div className="text-sm">
              <div className="font-semibold">Transmitter</div>
              <div>Lat {tx.lat.toFixed(5)}, Lon {tx.lon.toFixed(5)}</div>
              <div>f {tx.frequency_MHz} MHz, P {tx.power_W} W</div>
            </div>
          </Popup>
        </Marker>
      </MapContainer>
      <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
        <button className={`px-2 py-1 rounded bg-white shadow ${placing ? 'ring-2 ring-blue-500' : ''}`} onClick={()=>setPlacing(v=>!v)}> {placing ? 'Place: ON' : 'Place TX'} </button>
      </div>
      {/* Heatmap above tiles, below markers */}
      <canvas 
        ref={canvasRef} 
        className="absolute inset-0 pointer-events-none z-[450]" 
        style={{ 
          width: '100%', 
          height: '100%',
          imageRendering: 'pixelated'
        }} 
      />
    </div>
  );
}

// Minimal viridis (5-stop)
function viridis(t: number): [number,number,number,number] {
  const stops = [
    [68,1,84],[59,82,139],[33,145,140],[94,201,97],[253,231,37]
  ];
  t = Math.min(1, Math.max(0, t));
  const n = stops.length - 1; const x = t * n; const i = Math.min(n - 1, Math.floor(x)); const f = x - i;
  const a = stops[i], b = stops[i+1];
  const r = Math.round(a[0] + (b[0]-a[0])*f);
  const g = Math.round(a[1] + (b[1]-a[1])*f);
  const bl= Math.round(a[2] + (b[2]-a[2])*f);
  return [r,g,bl,200];
}