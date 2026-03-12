# Data Pipeline Contract

These files are strict contracts between `tools/gtfs-pipeline` and `apps/web`. Any schema change is breaking.

## Projection

- Origin point: `[37.7749, -122.4194]`
- Projection: equirectangular approximation
- Output unit: meters

Formula with `R = 6_371_000`:

- `x = (lonRad - lon0Rad) * cos((latRad + lat0Rad) / 2) * R`
- `y = (latRad - lat0Rad) * R`

## Output schemas

### stops.min.json

Array of:

```json
{
  "id": "string",
  "name": "string",
  "lat": 37.0,
  "lon": -122.0,
  "routeIds": ["string"],
  "accessible": true
}
```

### routes.min.json

Array of:

```json
{
  "id": "string",
  "shortName": "string",
  "longName": "string",
  "color": "RRGGBB",
  "textColor": "RRGGBB",
  "tripsPerDay": 0,
  "freqNorm": 0.0,
  "freqMultiplier": 1.0
}
```

### shapes.min.json

Object map:

```json
{
  "shapeId": [0, 0, 10, 10]
}
```

Each value is a flat, Float32Array-serializable coordinate list in projected meters: `[x0, y0, x1, y1, ...]`.

### graph.min.json

```json
{
  "edges": [],
  "stopIndex": {
    "STOP_ID": 0
  }
}
```

`GraphEdge` fields:
- `from`
- `to`
- `routeId`
- `shapeId`
- `shapeStart`
- `shapeEnd`
- `baseWeight`
- `effectiveWeight`
- `isTransfer`

### manifest.json

```json
{
  "version": "string",
  "generatedAt": "iso-date",
  "files": {
    "stops": "/transit/stops.hash.min.json",
    "routes": "/transit/routes.hash.min.json",
    "graph": "/transit/graph.hash.min.json",
    "shapes": "/transit/shapes.hash.min.json"
  },
  "bbox": [-122.5, 37.7, -122.3, 37.8],
  "stopCount": 0,
  "routeCount": 0
}
```

## Frequency weighting

- `tripsPerDay(route)`: trip count from `trips.txt` for representative day/service
- `freqNorm = log1p(tripsPerDay) / log1p(maxTripsPerDay)`
- `freqMultiplier = clamp(1 - 0.35 * freqNorm, 0.65, 1.0)`
- `effectiveEdgeWeight = baseEdgeWeight * freqMultiplier` for non-transfer edges only

## 511.org GTFS licensing and redistribution

Before production release, confirm and document compliance against current 511.org terms and data agreement.

Minimum checklist:
- verify current feed terms and attribution requirements
- include attribution in UI and docs
- keep records of agreement acceptance if required
- confirm whether derived outputs (`stops.min.json`, `graph.min.json`, `shapes.min.json`) may be publicly served

Mitigation if redistribution is restricted:
- avoid public static hosting of derived files
- switch to runtime fetch-and-process in service worker or server-side on-demand generation without publishing derived static artifacts

