const SECRET_KEY = /(authorization|cookie|token|secret|password|kubeconfig|private.?key)/i;
const SECRET_VALUE = /(authorization|bearer|token|secret|password|private.?key)\s*[:=]\s*[^\s,;]+/gi;

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value === 'string') return value.replace(SECRET_VALUE, '$1=[REDACTED]');
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, SECRET_KEY.test(key) ? '[REDACTED]' : redact(child)]),
    );
  }
  return value;
}

export function createLogger() {
  return {
    info(message: string, fields: Record<string, unknown> = {}) {
      console.log(JSON.stringify({ level: 'info', message, ...(redact(fields) as Record<string, unknown>) }));
    },
    error(message: string, fields: Record<string, unknown> = {}) {
      console.error(JSON.stringify({ level: 'error', message, ...(redact(fields) as Record<string, unknown>) }));
    },
  };
}

export { redact };
