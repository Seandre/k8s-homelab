import { PublicConfigSchema, type PublicConfig } from '../shared/contracts.js';

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): PublicConfig {
  const parsed = PublicConfigSchema.safeParse({
    environment: env.NODE_ENV ?? 'development',
    host: env.HOST ?? '0.0.0.0',
    port: env.PORT === undefined ? 3000 : Number(env.PORT),
    shutdownGraceMs: env.SHUTDOWN_GRACE_MS === undefined ? 10_000 : Number(env.SHUTDOWN_GRACE_MS),
  });

  if (!parsed.success) {
    throw new ConfigurationError(
      parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '),
    );
  }

  return parsed.data;
}
