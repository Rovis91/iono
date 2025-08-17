// Minimal viridis (5-stop) - same as MapView.tsx
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

export default function Legend() {
  const MARGIN_MIN_DB = -10;
  const MARGIN_MAX_DB = 30;
  
  // Generate gradient using same viridis function as map
  const gradientStops = [];
  for (let i = 0; i <= 100; i += 25) {
    const t = i / 100;
    const margin = MARGIN_MIN_DB + t * (MARGIN_MAX_DB - MARGIN_MIN_DB);
    const [r, g, b] = viridis(t);
    gradientStops.push(`rgb(${r},${g},${b}) ${i}%`);
  }
  
  return (
    <div className="p-2 bg-white/80 rounded shadow text-xs w-full">
      <div className="font-semibold mb-1">Margin (dB)</div>
      <div className="w-full h-3 rounded overflow-hidden">
        <div className="w-full h-full" style={{
          background: `linear-gradient(90deg, ${gradientStops.join(', ')})`
        }} />
      </div>
      <div className="mt-1 flex w-full justify-between">
        <span>−10</span>
        <span>+10</span>
        <span>+30</span>
      </div>
      <div className="mt-1 text-[11px] text-gray-600">Coverage ≈ margin ≥ 0 dB</div>
    </div>
  );
}
