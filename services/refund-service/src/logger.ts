export type LogLevel = "info" | "warn" | "error";

export interface LogMeta {
  [key: string]: unknown;
}

export function log(service: string, level: LogLevel, message: string, meta: LogMeta = {}): void {
  const entry = {
    timestamp: new Date().toISOString(),
    service,
    level,
    message,
    ...meta
  };

  process.stdout.write(`${JSON.stringify(entry)}\n`);
}
