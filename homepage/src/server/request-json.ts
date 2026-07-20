import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

export interface JsonResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

/**
 * Server-side JSON request with optional pinned CA material. This keeps the
 * browser away from infrastructure APIs and lets PBS/k3s use their mounted CA
 * without disabling TLS verification process-wide.
 */
export function requestJson(url: string, options: { headers?: Record<string, string>; caCertificate?: string; timeoutMs?: number } = {}): Promise<JsonResponse> {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const request = (target.protocol === 'https:' ? httpsRequest : httpRequest)(target, {
      method: 'GET',
      headers: options.headers,
      ...(target.protocol === 'https:' && options.caCertificate ? { ca: options.caCertificate } : {}),
      timeout: options.timeoutMs ?? 5_000,
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('error', reject);
      response.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        resolve({
          ok: (response.statusCode ?? 500) >= 200 && (response.statusCode ?? 500) < 300,
          status: response.statusCode ?? 500,
          json: async () => JSON.parse(body) as unknown,
        });
      });
    });
    request.on('timeout', () => request.destroy(new Error('Request timed out.')));
    request.on('error', reject);
    request.end();
  });
}
