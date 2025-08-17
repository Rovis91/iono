# Preset Visual Expectations — V1

**Goal:** side‑by‑side QA guidance so you can tell at a glance if the UI output matches the V1 models and defaults in code.

Defaults assumed (from `App.tsx` / presets):

* **TX:** 10 W, +5 dBi, 1 dB cable, **30 m AGL**
* **ENV:** `urban`, `kFactor=1.33`
* **Render metric:** **Margin (dB)**, color window **−10 → +30 dB** (Viridis: purple→yellow)
* **Paint cutoff:** **do not paint** when **Pr < −110 dBm**
* **Grid:** low‑res (≈8 px step); zoom does **not** change colors

> **Legend reminder** (Viridis): purple (\~−10 dB) → blue/teal (\~0–+10 dB) → green → yellow (≥ +30 dB, saturates).

---

## 1) HF 40 m — **7.1 MHz**

**Preset RX:** 10 m AGL, 0 dBi, BW 2.7 kHz, NF 5 dB, SNR 10 dB.
**HF controls:** `foF2` slider **≥ \~6.2 MHz** (MUF gate w/ α≈30° → MUF≈1.155·foF2; 7.1 ≤ 1.155·foF2 ⇒ foF2 ≥ 6.2). NVIS **off** by default.

### Expected shape

* **Filled disk** around TX with **fairly uniform color** (one‑hop sky‑wave), **radius ≈ 300–350 km**.
* **Hard edge** beyond that disk (two‑hop is heavily attenuated in V1; likely below cutoff → not painted).
* No central “hole” (skip zone) in this simplified V1 sky‑wave.

### Expected colors

* Inside disk: **green → yellow** (high margin, often ≥ +20 dB → near‑yellow).
* Outside disk: **transparent** (power cutoff) rather than purple smear.

### If it looks wrong

* **Nothing at all:** `foF2` too low; increase until `7.1 ≤ 1.155·foF2`.
* **Huge disk > 1000 km:** NVIS accidentally on (α≈80°). Disable `NVIS` to test sky‑wave.

---

## 2) HF 20 m — **14.2 MHz**

**Preset RX:** 10 m AGL, 0 dBi, BW 2.7 kHz, NF 5 dB, SNR 10 dB.
**HF controls:** **default `foF2=10` is too low** for α≈30° (needs MUF ≥ 14.2 ⇒ foF2 ≥ **12.3 MHz**).

### Expected shape/colors at defaults

* With `foF2=10`: **no paint** (MUF gate fails → **BLOCKED**).

### After raising `foF2 ≥ 12.5 MHz`

* **Filled disk**, radius ≈ **300–350 km** (one‑hop), **green → yellow** as in 40 m.
* Beyond that: **transparent**.

---

## 3) VHF 2 m — **146 MHz**

**Preset RX:** 1.5 m AGL, 0 dBi, BW 20 kHz, NF 5 dB, SNR 10 dB.
**Environment:** `urban`.

### Key reference numbers (code defaults)

* **Radio horizon:** `d_H ≈ 3.57(√30 + √1.5) ≈ 24 km` (LOS↔NLOS handover).
* **2‑ray breakpoint:** `d_bp ≈ 4 h_t h_r / λ ≈ 88 m` (not visible at map scale).

### Expected shape

* **Bright core** around TX (LOS), smoothly fading out to **\~20–30 km**.
* **No visible ring** at the horizon: colors change smoothly (we offset & blend LOS/NLOS across \~±5 % of `d_H`).
* **Beyond horizon:** broad **plateau** (NLOS median). In `urban`, it will **continue** but be **darker** than the LOS core.
* No color change with zoom; only spatial extent changes with panning/zooming.

### Expected colors

* Center: **yellow** (margin often ≥ +30 dB → saturates).
* Near horizon: **green → teal** (\~+10 dB).
* Farther out: **blue/teal plateau**, eventually **transparent** where **Pr < −110 dBm** (cutoff).

### If it looks wrong

* **Circular band/halo near \~25 km:** seam not blended; LOS/NLOS alignment missing.
* **Whole map lightly purple:** power‑cutoff not enforced (should be hidden below −110 dBm).

---

## 4) UHF 70 cm — **446 MHz**

**Preset RX:** 1.5 m AGL, 0 dBi, BW 12.5 kHz, NF 5 dB, SNR 10 dB.
**Environment:** `urban`.

### Reference

* `d_H` same geometry as VHF (\~24 km).
* `d_bp ≈ 268 m` (still sub‑km; not visually distinct on the heatmap).

### Expected shape/colors

* Similar to 2 m but **slightly smaller bright core** in dense urban due to higher frequency loss in NLOS.
* **Yellow center → green near horizon → teal/blue beyond**, then **transparent** past cutoff.
* No ring at horizon.

---

## 5) UHF ISM — **868 MHz**

**Preset RX:** 1.5 m AGL, 0 dBi, BW 125 kHz, NF 5 dB, SNR 8 dB.
**Environment:** `urban`.

### Reference

* `d_H` \~24 km.
* `d_bp ≈ 522 m`.

### Expected shape/colors

* **Core slightly smaller yet** vs 446 MHz in urban (higher f → stronger NLOS decay).
* However, **wider useful area** than 446 MHz if you switch ENV to `open`/`water` due to milder decay and lower SNR target (8 dB).
* **Yellow core → green ring → teal/blue**, transparent at far ranges.

---

## 6) UHF ISM — **915 MHz**

**Preset RX:** 1.5 m AGL, 0 dBi, BW 125 kHz, NF 5 dB, SNR 8 dB.
**Environment:** `urban`.

### Reference

* `d_H` \~24 km.
* `d_bp ≈ 549 m`.

### Expected shape/colors

* Nearly identical to **868 MHz**; colors very close at the same environment and power.
* Slightly **smaller** core vs 868 in `urban`; in `open/water` you’ll see **larger** footprints.

---

## Quick Cross‑Checks (per preset)

* **Zoom invariance:** pick a fixed spot; zoom in/out — **color at that spot should not change**.
* **Power cutoff:** pan far away — cells should eventually **disappear** (not purple haze).
* **Environment sensitivity (V/UHF):** switch `urban → open/water` — NLOS area grows (teal/green expand).
* **MUF gate (HF):** 20 m shows **nothing** until `foF2 ≥ ~12.3 MHz`; 40 m shows strong disk once `foF2 ≥ ~6.2 MHz`.
* **NVIS (HF):** turning **on** creates an **unrealistically large filled cap** in V1 (known simplification). For visual QA of sky‑wave, test with NVIS **off**.

---

## Troubleshooting by Symptom

* **Ring/band at one radius (VHF/UHF)** → LOS↔NLOS seam not blending; check horizon alignment/blend.
* **Colors shift with zoom** → grid is redrawn; if colors change, verify fixed color window and that margin is used (not auto rescaled).
* **Faint tint everywhere** → cutoff not applied; enforce `Pr < −110 dBm` hide rule.
* **HF “donut” rings** → not expected in **V1**; expect a **filled disk** for one‑hop sky‑wave.

---

### Notes & Known Simplifications

* **Hata** is clamped to `f ∈ [150, 2000] MHz` internally (e.g., 146 MHz behaves like 150 MHz), and to `d ∈ [1, 20] km` for the formula’s canonical range; we blend with LOS at the horizon to avoid seams.
* **Two‑ray** is implemented as a smooth two‑slope **median** curve (no interference fringes in V1). Over water, the physical ripples are not rendered intentionally.
* **HF hop model** uses a fixed virtual height and a simple absorption surrogate; it produces a **uniform disk** for the first hop and **hard cutoff** beyond in V1.
