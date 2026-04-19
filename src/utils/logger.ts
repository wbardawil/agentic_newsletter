export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  runId?: string;
  editionId?: string;
  agentName?: string;
  [key: string]: unknown;
}

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  child(defaultContext: LogContext): Logger;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Keys whose values are always redacted in log output
const SECRET_KEYS = new Set([
  "apikey",
  "api_key",
  "apitoken",
  "api_token",
  "authorization",
  "password",
  "secret",
  "token",
  "beehiivapikey",
  "beehiiv_api_key",
  "anthropicapikey",
  "anthropic_api_key",
  "accesstoken",
  "access_token",
]);

function redactSecrets(obj: Record<string, unknown>, depth = 0): Record<string, unknown> {
  if (depth > 5) return obj; // Guard against deeply nested or circular structures
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SECRET_KEYS.has(key.toLowerCase())) {
      result[key] = "***";
    } else if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      result[key] = redactSecrets(value as Record<string, unknown>, depth + 1);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function createChildLogger(minLevel: number, parentContext: LogContext): Logger {
  function log(level: LogLevel, message: string, context?: LogContext): void {
    if (LOG_LEVELS[level] < minLevel) return;

    const merged = { ...parentContext, ...context };
    const safe = redactSecrets(merged as Record<string, unknown>);

    const entry = {
      level,
      timestamp: new Date().toISOString(),
      message,
      ...safe,
    };

    const output = JSON.stringify(entry);
    if (level === "error") {
      process.stderr.write(output + "\n");
    } else {
      process.stdout.write(output + "\n");
    }
  }

  return {
    debug: (msg, ctx) => log("debug", msg, ctx),
    info: (msg, ctx) => log("info", msg, ctx),
    warn: (msg, ctx) => log("warn", msg, ctx),
    error: (msg, ctx) => log("error", msg, ctx),
    child: (childContext) =>
      createChildLogger(minLevel, { ...parentContext, ...childContext }),
  };
}

export function createLogger(level: LogLevel = "info"): Logger {
  return createChildLogger(LOG_LEVELS[level], {});
}
