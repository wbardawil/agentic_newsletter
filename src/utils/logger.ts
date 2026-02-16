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

function createChildLogger(
  minLevel: number,
  parentContext: LogContext,
): Logger {
  function log(
    level: LogLevel,
    message: string,
    context?: LogContext,
  ): void {
    if (LOG_LEVELS[level] < minLevel) return;

    const entry = {
      level,
      timestamp: new Date().toISOString(),
      message,
      ...parentContext,
      ...context,
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
