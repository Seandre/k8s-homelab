import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { createLogger } from './logger.js';

const config = loadConfig();
const logger = createLogger();
const app = buildApp({ config, serveClient: config.environment === 'production' });
let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info('server.shutdown.start', { signal });
  const timeout = setTimeout(() => {
    logger.error('server.shutdown.timeout', { graceMs: config.shutdownGraceMs });
    process.exit(1);
  }, config.shutdownGraceMs);
  timeout.unref();
  try {
    await app.close();
    clearTimeout(timeout);
    logger.info('server.shutdown.complete');
    process.exit(0);
  } catch (error) {
    clearTimeout(timeout);
    logger.error('server.shutdown.failed', { error: error instanceof Error ? error.message : 'unknown error' });
    process.exit(1);
  }
}

process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));

try {
  await app.listen({ host: config.host, port: config.port });
  logger.info('server.started', { host: config.host, port: config.port, environment: config.environment });
} catch (error) {
  logger.error('server.start.failed', { error: error instanceof Error ? error.message : 'unknown error' });
  process.exit(1);
}
