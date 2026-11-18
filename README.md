# VYUHAK // Orbital Intelligence & Regional Surveillance Platform

VYUHAK (*Virtual Yield Uplink & Heuristic Aerospace Kinematics*) is an open-source, browser-based 3D/2D Earth Observation Platform that tracks live global events and extracts comprehensive real-time Ground Data for any region covered by the satellite's scanning footprint.

## v15 Upgrades (Zero-Jump Hover Lock & Parallelized Instant Ground Data):
1. **Zero-Jump Hover Lock (`worldPositionToLatLon` <-> `latLonToWorldPosition`):** Fixed the spherical coordinate mismatch where locking a free-orbiting satellite caused it to jump to the opposite side of the globe. Free Orbit and Stationary Hover now share the exact same mathematical coordinate bijective functions, plus a 1-tap `Hover Lock: ON/OFF` button directly on the top action bar.
2. **Parallelized Sub-Second Ground Data (`Promise.allSettled` + `SOVEREIGN_DB`):** Replaced sequential `await` chains with concurrent parallel requests and an embedded sovereign demographic dictionary (`India: 1.43 Billion`, `New Delhi`, `INR ₹`, `3,287,263 km²`, etc.) so Country Population, Capital City, Currency, Surface Area, and Population Density load in `0 ms` without ever getting stuck on `"Loading..."` or `"Data Protected"`.
3. **Smart Wikipedia Disambiguation Filter:** Automatically skips Wikipedia disambiguation pages (such as *"Dongargaon may refer to..."*) and falls back to the State/Province overview (e.g., *Chhattisgarh*).

## Deployment
Upload `index.html`, `styles.css`, `app.js`, and `README.md` directly to your GitHub Pages repository.
