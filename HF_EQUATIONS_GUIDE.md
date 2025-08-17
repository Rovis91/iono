# HF Propagation Equations & Applications Guide

## 📡 **ANTENNA-RELATED EQUATIONS**

### **1. Effective Antenna Height**
**Equation:** `h_eff = h_actual + h²/(2R_earth)`
**Application:** All HF modes
**Conditions:** 
- Accounts for Earth curvature
- Important for antennas > 10m height
- Affects takeoff angle calculation

### **2. Takeoff Angle by Antenna Type**
**Equation:** `θ = f(antenna_type, height/λ)`
**Applications:**
- **Dipole:** `θ = max(15°, 45° - 10*log10(h/λ))` - Lower angle for higher antennas
- **Vertical:** `θ = min(80°, 60° + 5*log10(h/λ))` - Higher angle, good for NVIS
- **Yagi:** `θ = max(10°, 30° - 8*log10(h/λ))` - Directional, low angle
- **Loop:** `θ = min(85°, 70° + 3*log10(h/λ))` - Good for NVIS
- **Random Wire:** `θ = 30°` - Default

### **3. Ground Reflection Factor**
**Equation:** `R = f(h/λ, ground_type)`
**Application:** Ground-wave and low-height antennas
**Conditions:**
- `h/λ < 0.1`: Poor reflection (0.1)
- `h/λ < 0.5`: Moderate reflection (0.3)
- `h/λ ≥ 0.5`: Good reflection (0.6)

---

## 🌊 **GROUND WAVE EQUATIONS**

### **4. ITU-R P.368-9 Ground Wave Model**
**Equation:** `L_ground = FSPL + 20*log10(1 + (d/λ)² * ground_factor * curvature_factor)`

**Components:**
- **FSPL:** `32.44 + 20*log10(d_km) + 20*log10(f_MHz)`
- **Ground Factor:** `√(σ / (2πfεε₀))`
- **Curvature Factor:** `√(1 + (d/(2R_earth))²)`
- **Height Gain:** `20*log10(h/10)` (reference 10m)

**Application:** 
- Frequencies ≤ 10 MHz
- Distances ≤ 300 km
- Surface wave propagation

**Ground Types:**
- **Sea:** σ = 5.0 S/m, ε = 80.0
- **Wet:** σ = 0.01 S/m, ε = 15.0  
- **Dry:** σ = 0.001 S/m, ε = 4.0

---

## 🌌 **SKY WAVE EQUATIONS**

### **5. Ionospheric Layer Selection**
**Application:** Frequency-dependent layer selection
- **E-layer:** f ≤ 7 MHz, NVIS mode, h = 110 km
- **F1-layer:** 7 < f ≤ 10 MHz, h = 200 km
- **F2-layer:** f > 10 MHz, h = 300 km

### **6. Maximum Usable Frequency (MUF)**
**Equation:** `MUF = foF2 * sec(θ)`
**Application:** All sky-wave modes
**Conditions:**
- `foF2` = F2 layer critical frequency
- `θ` = takeoff angle
- `f_operating ≤ MUF` for propagation

### **7. Hop Distance Calculation**
**Equation:** `d_hop = 2 * h_iono * tan(θ)`
**Application:** Multi-hop sky-wave
**Conditions:**
- Single hop: d ≤ d_hop
- Multi-hop: d > d_hop (max 2 hops in V1)

### **8. Slant Distance**
**Equation:** `d_slant = d_ground / cos(θ)`
**Application:** Ionospheric path calculation
**Conditions:** Proper ionospheric reflection geometry

### **9. Ionospheric Absorption**
**Equation:** `L_iono = K * f^(-2) * sec(θ) * solar_factor * geomagnetic_factor`

**Components:**
- **K:** Layer-specific coefficient (E: 12, F1: 8, F2: 6)
- **Solar Factor:** `solar_flux / 100`
- **Geomagnetic Factor:** `1 + Kp_index * 0.1`

**Application:** All sky-wave modes
**Conditions:** D-layer absorption, daytime effects

### **10. Polarization Coupling Loss**
**Application:** Antenna-ionosphere coupling
- **Vertical:** 0 dB (best coupling)
- **Dipole:** 3 dB (horizontal polarization loss)
- **Yagi:** 2 dB (moderate coupling)
- **Loop:** 1 dB (good coupling)

---

## 🎯 **NVIS EQUATIONS**

### **11. NVIS Mode Detection**
**Criteria:**
- Frequency ≤ 7 MHz
- Takeoff angle ≥ 75°
- Distance ≤ 500 km

### **12. NVIS Path Loss**
**Equation:** `L_NVIS = FSPL(d_slant) + 15*f^(-2)*sec(θ) - height_gain`
**Application:** Regional coverage
**Conditions:** E-layer reflection, high takeoff angle

---

## ☀️ **SOLAR ACTIVITY EQUATIONS**

### **13. Solar Flux Effect**
**Equation:** `solar_factor = solar_flux / 100`
**Range:** 60-300 sfu
**Application:** D-layer absorption
**Conditions:** Daytime propagation

### **14. Geomagnetic Activity**
**Equation:** `geomagnetic_factor = 1 + Kp_index * 0.1`
**Range:** Kp = 0-9
**Application:** Ionospheric disturbances
**Conditions:** Geomagnetic storms

---

## 🏔️ **TERRAIN EFFECTS**

### **15. Terrain Roughness**
**Equation:** `roughness_factor = min(1, roughness_m / λ)`
**Application:** Mixed terrain paths
**Conditions:** ITU-R P.1546 model

### **16. Mixed Ground Loss**
**Equation:** `L_mixed = Σ(L_segment * roughness_factor)`
**Application:** Paths with different ground types
**Conditions:** Segment-by-segment calculation

---

## 📊 **LINK BUDGET EQUATIONS**

### **17. Received Power**
**Equation:** `P_rx = EIRP + G_rx - L_path - L_misc`
**Components:**
- **EIRP:** `P_tx + G_tx - L_cable`
- **L_path:** Propagation loss (ground/sky/NVIS)
- **L_misc:** Polarization, terrain, fading

### **18. Link Margin**
**Equation:** `Margin = P_rx - Sensitivity`
**Application:** Coverage determination
**Conditions:** Margin ≥ 0 for reliable communication

---

## 🔧 **IMPLEMENTATION CONDITIONS**

### **Antenna Height Effects**
- **Low Height (< λ/4):** Poor ground reflection, high takeoff angle
- **Medium Height (λ/4 - λ/2):** Moderate performance
- **High Height (> λ/2):** Good ground reflection, low takeoff angle

### **Frequency Bands**
- **3-7 MHz:** Ground-wave dominant, NVIS possible
- **7-10 MHz:** Mixed ground/sky-wave
- **10-30 MHz:** Sky-wave dominant

### **Distance Ranges**
- **0-50 km:** Ground-wave only
- **50-300 km:** Ground-wave or NVIS
- **300-2000 km:** Sky-wave (1-2 hops)
- **>2000 km:** Multi-hop sky-wave

### **Time of Day Effects**
- **Daytime:** High D-layer absorption, lower MUF
- **Nighttime:** Low absorption, higher MUF
- **Sunrise/Sunset:** Transition periods

### **Seasonal Effects**
- **Summer:** Higher foF2, better sky-wave
- **Winter:** Lower foF2, reduced sky-wave
- **Equinox:** Moderate conditions

---

## 🎯 **APPLICATION GUIDELINES**

### **Ground-Wave Applications**
- Maritime communications
- Coastal stations
- Short-range HF
- Emergency communications

### **Sky-Wave Applications**
- Long-distance communications
- International broadcasting
- Amateur radio DX
- Military communications

### **NVIS Applications**
- Regional coverage
- Emergency communications
- Military tactical communications
- Disaster relief

### **Antenna Selection**
- **Vertical:** NVIS, omnidirectional
- **Dipole:** General purpose, horizontal polarization
- **Yagi:** Directional, long-distance
- **Loop:** NVIS, compact installations
- **Random Wire:** Emergency, portable

---

## 📈 **VALIDATION CRITERIA**

### **Ground-Wave Validation**
- Compare with ITU-R P.368-9 curves
- Sea water: ±5 dB accuracy
- Land paths: ±10 dB accuracy

### **Sky-Wave Validation**
- MUF prediction accuracy: ±15%
- Absorption model: ±20% accuracy
- Multi-hop: ±25% accuracy

### **NVIS Validation**
- Regional coverage: ±10 dB accuracy
- Frequency limits: ±1 MHz accuracy
- Distance limits: ±50 km accuracy

This comprehensive guide provides the foundation for accurate HF propagation modeling with real-world antenna and environmental conditions.
