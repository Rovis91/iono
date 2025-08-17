# RF V1 Spec — Cases • Conditions • Equations • Use‑Cases

This file is the non-code source of truth for the **HF** and **V/UHF** simulation V1. It defines the **cases**, **conditions**, **equations**, **rendering rules**, **UI gating**, and **usage scenarios**.

---

## 1) Scope & Core Assumptions

* Bands in scope: **HF (3–30 MHz)** and **V/UHF (30–3000 MHz)**.
* Terrain: **no DEM** in V1. LOS uses radio-horizon + Fresnel assumption.
* HF ionosphere: **manual foF2 slider** (proxy for ionospheric support). No geospatial iono model in V1.
* Metric to render: **Link margin (dB)**.
* Grid: **low-resolution** sampling (e.g., 6–8 px step) for responsiveness.

---

## 2) Units (authoritative)

* Heights **m**; Distances **km**; Frequencies **MHz**.
* Gains **dBi**; Losses **dB**; Power **W**; Noise **dBm**.

---

## 3) Inputs & Outputs

### 3.1 Inputs

* **Tx**: `lat (°), lon (°), power_W, gain_dBi, cable_dB, height_m, frequency_MHz`
* **Rx**: `gain_dBi, cable_dB, height_m, bandwidth_Hz, noiseFigure_dB, requiredSNR_dB`
* **Env**: `environment ∈ {open, rural, urban, forest, water, mountain}, kFactor, groundClass ∈ {sea, wet, dry}, foliageDepth_m?`
* **Context**: `distance_km` (per pixel), `hf.foF2_MHz` (slider), `hf.NVIS_enabled (bool)`

### 3.2 Outputs

* **PathResult**: `{ loss_dB, mode ∈ {'IONO','NVIS','GROUND','LOS','NLOS','DIFFRACTION','BLOCKED'} }`
* **LinkResult**: `{ pr_dBm, sensitivity_dBm, margin_dB, mode }`

---

## 4) Case Selection — Decision Trees (no DEM)

### 4.1 HF (f < 30 MHz)

1. If `hf.foF2_MHz` **provided and > 0** → evaluate **sky‑wave/NVIS** feasibility.

   * Compute take‑off angle α: **NVIS** if `NVIS_enabled && f ≤ 7 MHz` ⇒ α≈80°. Else **sky‑wave** α≈30°.
   * **MUF gate:** require `f ≤ foF2 · sec(α)`. If **true** → use **sky‑wave/NVIS** model.
2. Else (or MUF gate fails): if `f ≤ 5 MHz` **and** `distance_km ≤ 100` → **ground‑wave**.
3. Else → **BLOCKED** (no HF support in V1 for that case).

**Modes produced:** `IONO` or `NVIS` or `GROUND` or `BLOCKED`.

### 4.2 V/UHF (f ≥ 30 MHz)

1. Compute **radio horizon** `d_H = 3.57·(√h_t + √h_r)` with k‑factor (heights in m).
2. Build two candidate losses:

   * **LOS candidate** `L_LOS(d)` = two‑slope (FSPL then 2‑ray beyond breakpoint).
   * **NLOS candidate** `L_NLOS(d)` = **Hata/COST‑231** when 150–2000 MHz (with **f clamped** to \[150,2000] for e.g. 146 MHz); otherwise **log‑distance** with `n` from environment.
   * Optional **foliage** is **added** to `L_NLOS` if `environment='forest'` and `foliageDepth_m>0`.
3. **Handover (seam removal):**

   * Evaluate both at `d_H`: `L_LOS(d_H)` and `L_NLOS(d_H)`.
   * Offset `L_NLOS` by `Δ = L_LOS(d_H) − L_NLOS(d_H)` so curves meet at `d_H`.
   * Blend smoothly across `[0.95·d_H, 1.05·d_H]`: `L(d) = (1−b)·L_LOS + b·(L_NLOS+Δ)`, with `b = clamp((d − 0.95 d_H)/(0.10 d_H), 0, 1)`.
4. **Mode labeling:** `LOS` if `b < 0.5`, else `NLOS`.

**Modes produced:** `LOS` or `NLOS` (DIFFRACTION reserved for V2 with DEM).

---

## 5) Equation Library (exact forms used)

### 5.1 Shared Link Budget

* **EIRP (dBm):** `EIRP = 10·log10(P_W·1000) + G_tx_dBi − L_tx_cable_dB`
* **Thermal noise (dBm):** `N = −174 + 10·log10(B_Hz) + NF_dB`
* **Sensitivity (dBm):** `S = N + SNR_req_dB`
* **Received power (dBm):** `Pr = EIRP + G_rx_dBi − (L_path + L_misc + L_rx_cable)`
* **Margin (dB):** `M = Pr − S`  ← **rendered metric**

### 5.2 Geometry & Helpers

* **Wavelength (m):** `λ = c / (f_MHz·1e6)`
* **FSPL (dB):** `L_fs = 20 log10(d_km) + 20 log10(f_MHz) + 32.44`
* **Radio horizon (km):** `d_H ≈ 3.57·(√h_t + √h_r)` (heights in m, includes k‑factor)
* **First Fresnel radius (m):** `r1 = √(λ d1 d2 / (d1 + d2))` *(informational in V1)*

### 5.3 V/UHF — LOS (two‑slope)

* **Breakpoint (m):** `d_bp = 4 h_t h_r / λ`
* **Loss:**

  * `d ≤ d_bp`: `L = L_fs(d)`
  * `d > d_bp`: `L = L_fs(d_bp) + 40 log10(d/d_bp)`

### 5.4 V/UHF — NLOS (median)

* **Hata/COST‑231** (150–2000 MHz; use `f = clamp(f,150,2000)`):

  * `a(h_r) =`

    * for **urban** & `300≤f≤1500`: `8.29 [log10(1.54 h_r)]² − 1.1`
    * else: `(1.1 log10 f − 0.7) h_r − (1.56 log10 f − 0.8)`
  * `L50 = 69.55 + 26.16 log10 f − 13.82 log10 h_t − a(h_r) + (44.9 − 6.55 log10 h_t) log10 d + C_m`
  * `C_m = 3 dB` for **urban**, else `0 dB`
  * **Open/rural/water/mountain** correction: add `−(4.78 (log10 f)² − 18.33 log10 f + 40.94)`
* **Log‑distance fallback** (any f): `L = L0 + 10 n log10(d/d0)`, with `L0 = L_fs(d0)`, `d0=0.1 km`, `n` from environment: `{open:2.1, rural:2.4, urban:3.5, forest:3.8, water:2.0, mountain:2.6}`
* **Foliage (optional):** Weissberger

  * `L_fol = 0.45 f^0.284 d` for `d ≤ 14 m`; else `1.33 f^0.284 d^0.588` (limit `d≤400 m`)

### 5.5 HF — Sky‑wave & NVIS (hop model)

* **Virtual F2 height:** `h_F2 = 300 km` (V1 constant)
* **Take‑off angle:** α≈**80°** (NVIS) or **30°** (sky‑wave)
* **MUF gate:** `f ≤ foF2 · sec(α)` (with `foF2` from slider)
* **Hop ground range:** `s ≈ 2 h_F2 tan α`
* **Hops:** `N = ceil(d / s)` with **cap N ≤ 2**
* **Slant distance per hop:** `d_slant ≈ 2 h_F2 / sin α`
* **Per‑hop loss:** `L_hop ≈ L_fs(d_slant, f) + A_absorb`

  * Absorption surrogate: `A_absorb = a0 + a1 · sec α · f^(−1.5)` with **a0=10 dB**, **a1=20 dB**
* **Total loss:** `L = N·L_hop + (N−1)·L_ground_reflect`, **L\_ground\_reflect ≈ 2 dB**/bounce

### 5.6 HF — Ground‑wave (short, ≤ 5 MHz)

* `L ≈ L_fs(d,f) + k_g · d_km · f_MHz^0.5`, with `k_g` by ground: **sea 0.02**, **wet 0.05**, **dry 0.08**

---

## 6) Rendering Rules

* **Metric:** **Margin M (dB)**.
* **Color window:** map `M ∈ [−10, +30]` → Viridis gradient; **clip** outside.
* **Power cutoff:** **do not paint** cells with `Pr < −110 dBm` (remove low‑level purple wash). Optional future UI to adjust.
* **Canvas:** CSS pixels; `z-index` above tiles, below markers. Repaint on `moveend/zoomend` and parameter change.

---

## 7) UI Gating (enable/disable logic — no code)

* **Band detection:** `isHF = (f < 30 MHz)`.
* If **HF**: enable `foF2 (slider)`, `NVIS toggle (only if f ≤ 7 MHz)`, `groundClass` dropdown. Disable environment/foliage.
* If **V/UHF**: enable `environment`, `kFactor`, `foliageDepth` (only when `environment='forest'`). Disable HF controls.
* Presets set: **frequency** and **RX defaults** (BW, NF, SNR, RX height, RX gain). Users may override.

---

## 8) Worker/Compute Rules

* Sample grid with `pxStep` (e.g., 6–8 px). For each cell:

  1. Compute `distance_km` (haversine) between cell and TX.
  2. Run **path model** (HF or V/UHF decision) → `loss_dB`, `mode`.
  3. Run **link budget** → `Pr`, `Sensitivity`, `Margin`.
  4. Return `{x, y, pr_dBm, margin_dB, mode}`.
* **Zoom invariance:** always use physical `distance_km`; the color mapping is fixed to the same margin window.

---

## 9) Guard Rails & Edge Cases

* **Min distance:** use `max(d_km, 0.001)`.
* **Hata domain:** if `100 MHz ≤ f ≤ 2000 MHz`, compute with **f clamped** to `[150,2000]` (so 146 MHz behaves sensibly). Outside → log‑distance fallback.
* **Two‑ray near field:** use **FSPL** region for `d ≤ d_bp`, avoid singularities.
* **HF blocked:** if MUF gate fails and not in ground‑wave case, return `BLOCKED` with very high loss.
* **Foliage:** only add when `environment='forest'` and `foliageDepth_m>0`.
* **Seam smoothing:** always perform LOS↔NLOS offset & blend at `d_H` to avoid a ring artifact.

---

## 10) Use‑Cases (ready‑to‑try scenarios)

### UC‑1: VHF 2 m handheld in urban

* **Preset:** 146 MHz; Rx height 1.5 m; BW 20 kHz; NF 5 dB; SNR 10 dB.
* **Env:** `urban`, `kFactor=1.33`.
* **Expected:** smooth lobe to horizon; seamless transition to NLOS beyond horizon; no ring seam; weak areas hidden below −110 dBm.

### UC‑2: UHF 446 MHz over water

* **Env:** `water`; moderate TX/RX heights (30 m / 10 m).
* **Expected:** larger LOS; two‑slope takes over beyond breakpoint; long open over water; still no interference fringes (V1 intentionally median).

### UC‑3: Forest corridor at 868 MHz

* **Env:** `forest`, `foliageDepth_m≈30`.
* **Expected:** additional attenuation; coverage shrinks vs open; cutoff hides very weak power.

### UC‑4: HF 7.1 MHz NVIS (night)

* **HF:** `foF2` high enough, **NVIS enabled**, α≈80°.
* **Expected:** filled “cap” (≈100–500 km); daytime (lower foF2) should reduce/kill it.

### UC‑5: HF 14.2 MHz sky‑wave (day)

* **HF:** `foF2` sufficient for α≈30°.
* **Expected:** ring (first hop) ≈ 1000–3000 km; potential **skip zone** near the TX.

### UC‑6: MF/HF ground‑wave 3.5 MHz coastal

* **HF:** `f ≤ 5 MHz`, `d ≤ 100 km`, `groundClass='sea'`.
* **Expected:** circular blob elongated along coast/sea (lower `k_g`).

---

## 11) Acceptance Criteria (Definition of Done)

1. **Margin heatmap** uses a fixed window \[−10,+30] dB and **Viridis**; legend matches map colors exactly.
2. Cells with **Pr < −110 dBm are not painted**.
3. **No ring seam** at V/UHF horizon: LOS and NLOS meet and blend smoothly.
4. **HF MUF gate** controls whether sky‑wave/NVIS appear; if not, only short ground‑wave is visible.
5. Changing **TX/RX height** shifts horizon and coverage shape as expected.
6. Environment dropdown meaningfully changes decay (Hata / log‑distance `n`).
7. UI enables only relevant inputs (HF vs V/UHF) and enforces units.

---

## 12) Troubleshooting (Symptoms → Likely Cause → Fix)

* **Whole map faintly tinted at far ranges** → painting below cutoff → **raise power cutoff** (e.g., to −105 dBm) or also hide by margin (<−10 dB).
* **Circular band at mid‑range** → LOS/NLOS seam → ensure **offset+blend** at `d_H` is applied.
* **Too‑strong VHF near horizon** → Hata used with wrong domain → **clamp f** into \[150,2000] or use log‑distance fallback.
* **HF shows strong rings at night on 21 MHz** → MUF gate ignored → require `f ≤ foF2·sec α`.
* **Colors change with zoom** → data recomputed in km? Yes → then likely low‑level paint still visible → **increase cutoff** or adjust color window.

---

## 13) Parameter Ranges & Defaults (V1)

* `kFactor=1.33`, adjustable 1.0–1.7.
* `foliageDepth_m` default: 30 m for forest; 0 otherwise.
* `pxStep`: 6–8 px.
* **HF:** `h_F2=300 km`, `a0=10 dB`, `a1=20 dB`, `N≤2` hops.
* **Cutoffs:** `Pr_cut = −110 dBm`; color window `[−10,+30] dB` margin.

