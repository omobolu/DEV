/**
 * Structured logger for the idvize API.
 * Outputs JSON-formatted log lines with level, timestamp, and context.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const MIN_LEVEL = (process.env.LOG_LEVEL as LogLevel) ?? 'info'

interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  service: string
  [key: string]: unknown
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[MIN_LEVEL]
}

function log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  if (!shouldLog(level)) return

  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    service: 'idvize-api',
    ...context,
  }

  const output = JSON.stringify(entry)

  if (level === 'error') {
    console.error(output)
  } else if (level === 'warn') {
    console.warn(output)
  } else {
    console.log(output)
  }
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => log('debug', message, context),
  info:  (message: string, context?: Record<string, unknown>) => log('info', message, context),
  warn:  (message: string, context?: Record<string, unknown>) => log('warn', message, context),
  error: (message: string, context?: Record<string, unknown>) => log('error', message, context),
}
