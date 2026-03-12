import { describe, expect, it } from 'vitest';
import { buildProcessedData, parseCsv } from '../src/pipeline';

const stopsCsv = `stop_id,stop_name,stop_lat,stop_lon,wheelchair_boarding\nA,Stop A,37.7749,-122.4194,1\nB,Stop B,37.7759,-122.4184,0`;
const routesCsv = `route_id,route_short_name,route_long_name,route_color,route_text_color\nR1,1,Route 1,FF0000,FFFFFF`;
const tripsCsv = `route_id,service_id,trip_id,shape_id\nR1,WEEKDAY,T1,S1\nR1,WEEKDAY,T2,S1`;
const stopTimesCsv = `trip_id,arrival_time,departure_time,stop_id,stop_sequence\nT1,08:00:00,08:00:00,A,1\nT1,08:05:00,08:05:00,B,2\nT2,09:00:00,09:00:00,A,1\nT2,09:05:00,09:05:00,B,2`;
const shapesCsv = `shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence\nS1,37.7749,-122.4194,1\nS1,37.7759,-122.4184,2`;

describe('pipeline', () => {
  it('parses csv including headers', () => {
    const rows = parseCsv(stopsCsv);
    expect(rows).toHaveLength(2);
    expect(rows[0].stop_id).toBe('A');
  });

  it('builds processed data contracts', () => {
    const processed = buildProcessedData({
      stops: parseCsv(stopsCsv),
      routes: parseCsv(routesCsv),
      trips: parseCsv(tripsCsv),
      stopTimes: parseCsv(stopTimesCsv),
      shapes: parseCsv(shapesCsv),
      transfers: [],
    });

    expect(processed.stops[0]).toHaveProperty('routeIds');
    expect(processed.routes[0].tripsPerDay).toBe(2);
    expect(processed.routes[0].freqMultiplier).toBeGreaterThanOrEqual(0.65);
    expect(processed.graph.edges.length).toBeGreaterThan(0);
    expect(processed.shapes.S1.length).toBe(4);
  });
});
