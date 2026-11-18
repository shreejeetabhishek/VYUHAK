# VYUHAK // Orbital Intelligence & Regional Surveillance Platform

VYUHAK (*Virtual Yield Uplink & Heuristic Aerospace Kinematics*) is an open-source, browser-based 3D/2D Earth Observation Platform that tracks live global events and extracts comprehensive real-time Ground Data for any region covered by the satellite's scanning footprint.

## Live Regional & Global Data Streams (100% Free & Keyless APIs):
1. **Territory, Population & Economy:** Uses **BigDataCloud Reverse Geocoding** and the **REST Countries API** to display the sovereign nation, state/city, population count, capital city, currency, and local timezone.
2. **Live Weather in Footprint:** Uses the **Open-Meteo API** to pull real-time temperature, wind speed, relative humidity, and sky conditions directly beneath the satellite.
3. **Wars, Conflicts & Disasters in Swath:** Cross-references the satellite's scanning radius with live **USGS Earthquakes**, **NASA EONET Wildfires/Storms**, and queries the **UN ReliefWeb API** for active humanitarian and conflict reports in that country.
4. **Regional News & Public Interest:** Dynamically queries live regional news feeds (via Google News RSS-to-JSON) and **Wikipedia REST Summaries** for the specific state, city, or country being scanned.
5. **Top Places & Landmarks:** Queries the **Wikipedia Geosearch API** to list notable landmarks, monuments, and infrastructure below the satellite with exact distance measurements.

## Deployment
Upload `index.html`, `styles.css`, `app.js`, and `README.md` directly to your GitHub Pages repository.
