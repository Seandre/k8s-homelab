import { describe, expect, it } from 'vitest';
import { OpenMeteoAdapter, type FetchResponse, type SafeFetch } from './open-meteo.js';
import type { Clock } from './normalization.js';

function clock(): Clock { return { now: () => new Date('2026-07-19T12:00:00.000Z') }; }
function response(value: unknown, ok = true): FetchResponse { return { ok, json: async () => value }; }
const conditions = { current: { time: 1_784_464_800, temperature_2m: 68, weather_code: 2 }, daily: { sunrise: [1_784_442_780], sunset: [1_784_497_020] } };
const air = { current: { time: 1_784_464_800, us_aqi: 24, pm2_5: 4.1, pm10: 12.3 } };

describe('Open-Meteo adapter', () => {
  it('normalizes Portland conditions and air quality with the pinned query coordinates', async () => {
    const urls: string[] = [];
    const fetcher: SafeFetch = async (url) => { urls.push(url); return url.includes('air-quality') ? response(air) : response(conditions); };
    const weather = await new OpenMeteoAdapter({ fetch: fetcher, latitude: 45.527412, longitude: -122.686270, enabled: true, clock: clock() }).read();
    expect(weather).toMatchObject({ location: 'Portland, OR 97209', temperatureFahrenheit: 68, condition: 'Partly cloudy', usAqi: 24, pm25: 4.1, pm10: 12.3 });
    expect(urls.join('\n')).toContain('latitude=45.527412');
    expect(urls.join('\n')).toContain('longitude=-122.68627');
  });

  it('keeps successful conditions when the independent AQI source is malformed or rate-limited', async () => {
    const fetcher: SafeFetch = async (url) => url.includes('air-quality') ? response({ error: 'rate limited' }, false) : response(conditions);
    const weather = await new OpenMeteoAdapter({ fetch: fetcher, latitude: 45.527412, longitude: -122.686270, enabled: true, clock: clock() }).read();
    expect(weather.temperatureFahrenheit).toBe(68);
    expect(weather.airQualityMetadata.freshness).toBe('NO_DATA');
    expect(weather.usAqi).toBeNull();
  });

  it('does not call upstream when the feature is disabled', async () => {
    const fetcher: SafeFetch = async () => { throw new Error('must not be called'); };
    const weather = await new OpenMeteoAdapter({ fetch: fetcher, latitude: 45.527412, longitude: -122.686270, enabled: false, clock: clock() }).read();
    expect(weather.conditionsMetadata.freshness).toBe('NOT_SUPPORTED');
    expect(weather.airQualityMetadata.freshness).toBe('NOT_SUPPORTED');
  });
});
