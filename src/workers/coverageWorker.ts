/// <reference lib="webworker" />

import { predictLink, Tx, Rx, Env, Context } from '../index';

// Force rebuild - HF debugging enabled
import { haversine_km } from '../core/geometry';

// Types for messages between UI and worker
export interface ViewBounds { north: number; south: number; east: number; west: number; }
export interface CoverageRequest {
  bounds: ViewBounds;
  zoom: number;
  width: number;
  height: number;
  pxStep: number; // grid sampling step in pixels
  tx: Tx;
  rx: Rx;
  env: Env;
  ctxBase?: Omit<Context, 'distance_km'>; // hf options etc., distance filled per-pixel
}

export interface CoverageCell { x: number; y: number; margin_dB: number; pr_dBm: number; mode: string }
export interface CoverageResponse { cells: CoverageCell[]; width: number; height: number; pxStep: number }

// WebMercator helpers (tile space ↔ lat/lng)
function worldSize(zoom: number) { return 256 * Math.pow(2, zoom); }
function latToY(lat: number, z: number) {
  const s = Math.sin((lat * Math.PI) / 180);
  return worldSize(z) * (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI));
}
function lngToX(lng: number, z: number) { return worldSize(z) * (0.5 + lng / 360); }
function pointToLatLng(x: number, y: number, z: number) {
  const n = Math.PI - (2 * Math.PI * y) / worldSize(z);
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  const lng = (x / worldSize(z)) * 360 - 180;
  return { lat, lng };
}

self.onmessage = (e: MessageEvent<CoverageRequest>) => {
  try {
    const req = e.data;
    const { bounds, zoom, width, height, pxStep, tx, rx, env, ctxBase } = req;

    // Precompute bound corners in world coords
    const xWest = lngToX(bounds.west, zoom);
    const xEast = lngToX(bounds.east, zoom);
    const yNorth = latToY(bounds.north, zoom);
    const ySouth = latToY(bounds.south, zoom);

    const cells: CoverageCell[] = [];

    for (let py = 0; py < height; py += pxStep) {
      for (let px = 0; px < width; px += pxStep) {
        try {
          const x = xWest + (px / width) * (xEast - xWest);
          const y = yNorth + (py / height) * (ySouth - yNorth);
          const { lat, lng } = pointToLatLng(x, y, zoom);
          const d_km = Math.max(haversine_km(tx.lat, tx.lon, lat, lng), 0.001);
    
          const ctx: Context = { distance_km: d_km, ...(ctxBase || {}) };
          const link = predictLink(tx, rx, env, ctx);
    
          const pr = Number.isFinite(link.pr_dBm) ? link.pr_dBm : -Infinity;
          const m  = Number.isFinite(link.margin_dB) ? link.margin_dB : -Infinity;
    
          cells.push({ x: px, y: py, margin_dB: m, pr_dBm: pr, mode: link.mode });
        } catch (err) {
          // If anything explodes, just skip this pixel
          // (optionally collect a counter for diagnostics)
        }
      }
    }
    

    self.postMessage({ cells, width, height, pxStep } as CoverageResponse);
  } catch (error) {
    console.error('Worker error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    self.postMessage({ error: errorMessage, cells: [], width: 0, height: 0, pxStep: 0 });
  }
};
