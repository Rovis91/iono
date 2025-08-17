Here’s a clean **Markdown spec file** you can drop into your repo (`docs/hf_model.md`).
It’s written to be **LLM-friendly**: short headers, bullet points, consistent naming, explicit equations, no ambiguity.

---

```markdown
# HF Propagation Model (Ground & Sky Waves)

This document defines the **variables**, **equations**, and **cases** for modeling **HF propagation** (3–30 MHz).  
It focuses on **ground waves** and **sky waves** (single / multiple hops).  
Optimized for later use by LLMs (parsing, reasoning, code generation).

---

## 1. Variables

### Transmitter (TX)
- `P_tx_dBm` : Transmit power in dBm
- `G_tx_dBi` : Antenna gain in dBi
- `h_tx_m` : Antenna height (meters)
- `freq_MHz` : Frequency (MHz)
- `λ_m` : Wavelength (m) = `c / (freq_MHz * 1e6)`

### Receiver (RX)
- `G_rx_dBi` : Antenna gain in dBi
- `h_rx_m` : Antenna height (meters)
- `sensitivity_dBm` : Receiver sensitivity (dBm threshold)

### Environment
- `σ_ground` : Ground conductivity (S/m)
- `εr_ground` : Relative permittivity
- `ionosphere_layers` : {E, F1, F2} with height ranges
- `MUF_MHz` : Maximum Usable Frequency for given path
- `time_utc` : Time of day (affects ionosphere)

---

## 2. Ground Wave Propagation

### Applicability
- Dominant at **lower HF (<10 MHz)**
- Short range (up to ~300 km depending on ground conductivity)
- Used for maritime and coastal comms

### Equations

#### Free Space Path Loss (reference)
```

FSPL\_dB = 32.44 + 20 \* log10(d\_km) + 20 \* log10(freq\_MHz)

```

#### Ground Wave Attenuation
ITU ground-wave model (approximation):
```

L\_ground\_dB = FSPL\_dB + A(d\_km, freq\_MHz, σ\_ground, εr\_ground)

```

Where:
- `A(...)` is an **excess loss term** (depends strongly on conductivity and frequency).
- Lower conductivity (dry land) → higher loss.
- Sea water (σ ≈ 5 S/m) → very low attenuation.

#### Received Power
```

P\_rx\_dBm = P\_tx\_dBm + G\_tx\_dBi + G\_rx\_dBi - L\_ground\_dB

```

---

## 3. Sky Wave Propagation (Ionosphere)

### Applicability
- Dominant at **3–30 MHz**
- Enables long distance beyond horizon
- Reflection by ionospheric layers (mainly F2 at night, F1/E by day)

### Key Factors
- `MUF_MHz` : Max frequency that can be reflected
- `Critical_Freq` : Max freq returned vertically
- `Takeoff_Angle` : Depends on antenna height and radiation pattern
- `Hop_Distance` : Function of reflection height and angle

### Equations

#### Maximum Usable Frequency (MUF)
For given path length `d` and ionospheric critical frequency `foF2`:
```

MUF\_MHz = foF2 \* sec(θ)

```
- `θ` = angle of incidence relative to vertical.

#### Hop Distance (single hop)
For ionospheric height `h_iono_m`:
```

d\_hop\_km = 2 \* h\_iono\_m \* tan(θ)

```

#### Multi-hop Paths
- Path length = `n * d_hop_km`
- Each hop adds extra **loss** due to absorption + focusing:
```

L\_sky\_dB = FSPL\_dB + L\_iono\_dB + n \* L\_hop\_dB

```

#### Absorption Loss
Approximation (D-layer absorption, daytime):
```

L\_iono\_dB ≈ K \* (freq\_MHz)^(-2) \* sec(θ)

```
- K depends on solar activity, time of day.

#### Received Power (Sky Wave)
```

P\_rx\_dBm = P\_tx\_dBm + G\_tx\_dBi + G\_rx\_dBi - L\_sky\_dB

```

---

## 4. Cases Summary

| Case        | Frequency | Mechanism    | Range     | Main Variables                          | Notes |
|-------------|-----------|--------------|----------|-----------------------------------------|-------|
| Groundwave  | 3–10 MHz  | Diffraction + ground conductivity | 50–300 km | `σ_ground`, `εr_ground`, `freq_MHz`, `h_tx`, `h_rx` | Strong over sea |
| Skywave (1 hop) | 3–30 MHz | Ionosphere (E/F layer) | 300–3500 km | `MUF_MHz`, `h_iono`, `θ`, `time_utc` | Day/night dependent |
| Skywave (multi-hop) | 3–30 MHz | Multiple reflections | 1000–>10000 km | same as 1-hop + `n` | Cumulative absorption |

---

## 5. Output Rules

- **Margin (dB)** = `P_rx_dBm - sensitivity_dBm`
- Coverage shown if `margin >= 0 dB`
- Colors:
  - High margin (≥ +20 dB): Yellow/bright
  - Moderate (+5 dB): Green
  - Low (0 dB): Teal
  - Below threshold: Transparent

---

## 6. Edge Cases

- **Below ~2 MHz**: Ground-wave dominates, skywave unreliable.
- **Above MUF**: Skywave fails (signal lost).
- **Near vertical incidence**: NVIS mode (coverage radius ~100–500 km).
- **Seawater path**: Ground-wave extended up to 500 km.

---

# ✅ Use in Simulation (V1)
- Implement **groundwave** for sea vs land.
- Implement **1-hop skywave** with MUF cutoff.
- Ignore multi-hop for now (V2).
- Default ionosphere height = 300 km (F2 layer).
