# Route Viewer

A ready-to-use web app to plan routes by adding places on a map, view **walking** and **driving** time and distance, and export the route as a **3D-style fly-through video** or as **JSON** to re-import later.

## Features

- **Add places**: Type an address (geocoded via OpenStreetMap Nominatim) or click on the map to add waypoints.
- **Route**: Switch between **Driving** and **Walking**; the app computes the route via OSRM so the **line always follows roads** (no straight-line segments). Shows **distance** and **estimated duration** for both.
- **3D fly-through video**: After computing a route, click **Record video** to run a dynamic camera fly-through with pitch/bearing and download a WebM video.
- **Custom format**: **Download JSON** saves waypoints and route geometry so you can **Import JSON** on the same or another device to restore the route.

## How to run

No build step or API keys required. Open `index.html` in a modern browser, or serve the folder with any static server:

```bash
# From the route-viewer folder
npx serve .
# or
python3 -m http.server 8080
```

Then open `http://localhost:8080` (or the URL shown).

## Tech

- **Map**: [MapLibre GL JS](https://maplibre.org/) with [OpenStreetMap](https://www.openstreetmap.org/) tiles rendered with the [openstreetmap-carto](https://github.com/openstreetmap-carto/openstreetmap-carto) style (tile.openstreetmap.org).
- **Routing**: [OSRM](https://project-osrm.org/) public API (driving + foot). The drawn route uses OSRM’s returned geometry, so it always follows roads.
- **Geocoding**: [Nominatim](https://nominatim.org/) (OpenStreetMap).

## Export formats

- **Video**: WebM (VP9 when supported). Duration follows the fly-through animation (~15 s).
- **JSON**: `version`, `exportedAt`, `waypoints` (lng, lat, label), and `route` (geometry, mode, distance, duration, plus optional `driving` and `walking` stats for re-import).
