export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  level: LogLevel
  msg: string
  context?: Record<string, unknown>
}

export function log(entry: LogEntry) {
  const line = {
    ts: new Date().toISOString(),
    level: entry.level,
    msg: entry.msg,
    context: entry.context || {},
  }
  console.log('[app]', JSON.stringify(line))
}

