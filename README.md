# VYUHAK // Orbital Intelligence & Regional Surveillance Platform

VYUHAK (*Virtual Yield Uplink & Heuristic Aerospace Kinematics*) is an open-source, browser-based 3D/2D Earth Observation Platform that tracks live global events and extracts comprehensive real-time Ground Data for any region covered by the satellite's scanning footprint.

## v14 Upgrades (Smart Night-Only Illumination & Guaranteed Multi-Tier Regional Data):
1. **Smart Day/Night Adaptive Illumination:** Removed the additive white surface disc that caused whitewash glare on the sunlit side. The satellite's spotlight now computes the solar terminator angle (`satNormal.dot(sunDirVector)`) every frame—staying at `0` intensity on the sunlit day side and smoothly powering up only when the satellite crosses into the dark night side.
2. **Guaranteed Population, Area & Density (`REST Countries` + `Scan Token`):** Fixed the race condition where the initial `(0,0)` ocean scan overwrote land demographics with `"Uninhabited"`. Added Country Population, Capital City, Currency, Surface Area (`km²`), and Population Density (`/km²`).
3. **3-Tier Real-Time Regional News (`Google News RSS` -> `Country RSS` -> `GDELT Project API`):** If a remote desert province (e.g., *Tibesti, Chad*) has no local headlines, VYUHAK automatically falls back to national breaking news (*Chad*) and the **GDELT Global Knowledge Graph API** so real-time news is always displayed.
4. **Dedicated Public Interest & Strategic Dossier (`Wikipedia Search API` + `BigDataCloud Locality Info`):** Added Section 5 showing ecological zones, administrative divisions, and top regional public interest topics for the exact focus area.
5. **Expanded Landmarks & Regional Places:** Automatically expands from a 10 km radius to regional landmarks and natural features when scanning remote terrain.

## Deployment
Upload `index.html`, `styles.css`, `app.js`, and `README.md` directly to your GitHub Pages repository.
