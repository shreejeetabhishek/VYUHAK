# VYUHAK // Orbital Intelligence & Regional Surveillance Platform

VYUHAK (*Virtual Yield Uplink & Heuristic Aerospace Kinematics*) is an open-source, browser-based 3D/2D Earth Observation Platform that tracks live global events and extracts comprehensive real-time Ground Data for the entire region covered by the satellite's scanning footprint.

## v16 Upgrades (5-Point Full Swath Scanner & Namibia/Southern Africa Fix):
1. **5-Point Full Satellite Swath Aggregation (`getSwathSamplePoints`):** Instead of only querying the single center coordinate, VYUHAK now samples a 5-point array across the satellite's scanning ring (**Center, North Sector, South Sector, East Sector, and West Sector** at 55% of the swath radius). It aggregates all countries, states/provinces, populations, capitals, currencies, landmarks, and news covered inside the entire circular footprint.
2. **Fixed `"0 (Oceanic)"` Bug on Namibia & Southern Africa:** Added Namibia (`NA`: `2.60 Million`, `Windhoek`, `Namibian Dollar N$`), Botswana (`BW`), Angola (`AO`), South Africa (`ZA`), Zambia (`ZM`), Zimbabwe (`ZW`), and 50+ nations to `SOVEREIGN_DB`, and explicitly reset metric cards before each scan so stale oceanic values never persist on land.
3. **4-Tier Guaranteed Regional News:** Queries Google News RSS, GDELT Project API, UN ReliefWeb Country Dispatches, and World Desk fallbacks concurrently across the covered states and countries so Section 4 always renders live clickable articles.
4. **Filtered Metadata from Landmarks & Strictly Night-Only Spotlight:** Filtered out timezone/continent metadata strings (like `"Africa/Windhoek"` and `"Africa continent"`) from Section 6 landmarks, and shifted the spotlight threshold (`sunAlignment < -0.05`) so daytime/twilight regions like Namibia have zero artificial glare.

## Deployment
Upload `index.html`, `styles.css`, `app.js`, and `README.md` directly to your GitHub Pages repository.
