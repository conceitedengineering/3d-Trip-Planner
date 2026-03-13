#!/usr/bin/env node
import path from 'node:path';

import {
  buildBuildingsData,
  buildProcessedData,
  loadBuildingsGeoJson,
  loadGtfsDirectory,
  writeProcessedArtifacts,
} from './pipeline.js';

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'build';
  const rawDir = process.argv[3] ?? path.resolve(process.cwd(), 'data/raw/gtfs');
  const outputDir = process.argv[4] ?? path.resolve(process.cwd(), 'apps/web/public/transit');
  const buildingsGeoJsonPath =
    process.argv[5] ?? path.resolve(process.cwd(), 'data/raw/buildings/sf_buildings.geojson');

  if (command === 'fetch') {
    console.log('fetch command is intentionally thin in V1; place GTFS files in', rawDir);
    return;
  }

  if (command !== 'build' && command !== 'stats' && command !== 'validate') {
    throw new Error(`Unknown command: ${command}`);
  }

  const gtfs = await loadGtfsDirectory(rawDir);
  const processed = buildProcessedData(gtfs);
  let buildings = null;
  try {
    const rawBuildings = await loadBuildingsGeoJson(buildingsGeoJsonPath);
    buildings = buildBuildingsData(rawBuildings);
  } catch {
    buildings = null;
  }

  if (command === 'stats') {
    console.log(
      JSON.stringify(
        {
          stops: processed.stops.length,
          routes: processed.routes.length,
          edges: processed.graph.edges.length,
          shapes: Object.keys(processed.shapes).length,
          buildings: buildings?.totalCount ?? 0,
          landmarks: buildings?.landmarkCount ?? 0,
          bbox: processed.bbox,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (command === 'validate') {
    if (processed.stops.length === 0 || processed.routes.length === 0 || processed.graph.edges.length === 0) {
      throw new Error('Validation failed: one or more critical outputs are empty');
    }

    console.log('Validation passed');
    return;
  }

  const manifest = await writeProcessedArtifacts(
    outputDir,
    processed,
    buildings ? { buildings } : {},
  );
  console.log(`Wrote processed transit assets to ${outputDir}`);
  console.log(JSON.stringify(manifest, null, 2));
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
