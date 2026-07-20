import { z } from 'zod';
import type { Weather } from '../shared/contracts.js';
import { SourceNormalizer, withTimeout, type Clock } from './normalization.js';

const ConditionsResponseSchema = z.object({
  current: z.object({ time: z.number().int(), temperature_2m: z.number(), weather_code: z.number().int() }),
  daily: z.object({ sunrise: z.array(z.number().int()).min(1), sunset: z.array(z.number().int()).min(1) }),
});
const AirQualityResponseSchema = z.object({ current: z.object({ time: z.number().int(), us_aqi: z.number().nonnegative(), pm2_5: z.number().nonnegative(), pm10: z.number().nonnegative() }) });

export interface FetchResponse { ok: boolean; json(): Promise<unknown>; }
export type SafeFetch = (input: string, init?: { signal?: AbortSignal }) => Promise<FetchResponse>;

export interface OpenMeteoOptions {
  fetch: SafeFetch;
  latitude: number;
  longitude: number;
  enabled: boolean;
  timeoutMs?: number;
  clock?: Clock;
}

function isoFromUnix(seconds: number) { return new Date(seconds * 1_000).toISOString(); }

function conditionFromCode(code: number) {
  if (code === 0) return 'Clear sky';
  if ([1, 2].includes(code)) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if ([45, 48].includes(code)) return 'Fog';
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Snow';
  if ([95, 96, 99].includes(code)) return 'Thunderstorm';
  return 'Unknown conditions';
}

async function requestJson(fetcher: SafeFetch, url: URL, timeoutMs: number): Promise<unknown> {
  const response = await withTimeout(fetcher(url.toString()), timeoutMs);
  if (!response.ok) throw new Error('Open-Meteo request failed.');
  return response.json();
}

export class OpenMeteoAdapter {
  private readonly conditions;
  private readonly air;
  private readonly fetcher: SafeFetch;
  private readonly latitude: number;
  private readonly longitude: number;
  private readonly timeoutMs: number;

  constructor(options: OpenMeteoOptions) {
    const inactive = !options.enabled;
    this.conditions = new SourceNormalizer<z.infer<typeof ConditionsResponseSchema>>({ source: 'open-meteo-conditions', staleAfterMs: 900_000, unsupported: inactive, ...(options.clock ? { clock: options.clock } : {}) });
    this.air = new SourceNormalizer<z.infer<typeof AirQualityResponseSchema>>({ source: 'open-meteo-air-quality', staleAfterMs: 900_000, unsupported: inactive, ...(options.clock ? { clock: options.clock } : {}) });
    this.fetcher = options.fetch;
    this.latitude = options.latitude;
    this.longitude = options.longitude;
    this.timeoutMs = options.timeoutMs ?? 5_000;
  }

  async read(): Promise<Weather> {
    await Promise.all([this.refreshConditions(), this.refreshAirQuality()]);
    const conditions = this.conditions.snapshot();
    const air = this.air.snapshot();
    const conditionValue = conditions.value;
    const airValue = air.value;
    const severity = conditions.metadata.severity === 'CRIT' || air.metadata.severity === 'CRIT' ? 'CRIT' : conditions.metadata.severity === 'WARN' || air.metadata.severity === 'WARN' ? 'WARN' : conditions.metadata.severity === 'INFO' || air.metadata.severity === 'INFO' ? 'INFO' : 'OK';
    return {
      location: 'Portland, OR 97209',
      temperatureFahrenheit: conditionValue?.current.temperature_2m ?? null,
      condition: conditionValue ? conditionFromCode(conditionValue.current.weather_code) : null,
      sunrise: conditionValue ? isoFromUnix(conditionValue.daily.sunrise[0]!) : null,
      sunset: conditionValue ? isoFromUnix(conditionValue.daily.sunset[0]!) : null,
      usAqi: airValue?.current.us_aqi ?? null,
      pm25: airValue?.current.pm2_5 ?? null,
      pm10: airValue?.current.pm10 ?? null,
      conditionsMetadata: conditions.metadata,
      airQualityMetadata: air.metadata,
      metadata: { ...conditions.metadata, severity },
    };
  }

  private async refreshConditions() {
    if (!this.conditions.canAttempt()) return;
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.search = new URLSearchParams({ latitude: String(this.latitude), longitude: String(this.longitude), current: 'temperature_2m,weather_code', daily: 'sunrise,sunset', temperature_unit: 'fahrenheit', timezone: 'America/Los_Angeles', timeformat: 'unixtime' }).toString();
    try { this.conditions.recordSuccess(ConditionsResponseSchema.parse(await requestJson(this.fetcher, url, this.timeoutMs))); } catch { this.conditions.recordFailure(); }
  }

  private async refreshAirQuality() {
    if (!this.air.canAttempt()) return;
    const url = new URL('https://air-quality-api.open-meteo.com/v1/air-quality');
    url.search = new URLSearchParams({ latitude: String(this.latitude), longitude: String(this.longitude), current: 'us_aqi,pm2_5,pm10', timezone: 'America/Los_Angeles', timeformat: 'unixtime' }).toString();
    try { this.air.recordSuccess(AirQualityResponseSchema.parse(await requestJson(this.fetcher, url, this.timeoutMs))); } catch { this.air.recordFailure(); }
  }
}
