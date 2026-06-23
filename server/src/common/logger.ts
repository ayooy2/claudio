type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const envLevel = process.env.LOG_LEVEL ?? 'info';
const currentLevel: Level = envLevel in LEVELS ? (envLevel as Level) : 'info';

function log(level: Level, module: string, message: string, data?: unknown) {
  if (LEVELS[level] < LEVELS[currentLevel]) return;
  const ts = new Date().toISOString().slice(11, 23);
  const prefix = `[${ts}] [${level.toUpperCase()}] [${module}]`;
  if (data !== undefined) {
    console.log(prefix, message, JSON.stringify(data));
  } else {
    console.log(prefix, message);
  }
}

export const logger = {
  debug: (m: string, d?: unknown) => log('debug', 'claudio', m, d),
  info: (m: string, d?: unknown) => log('info', 'claudio', m, d),
  warn: (m: string, d?: unknown) => log('warn', 'claudio', m, d),
  error: (m: string, d?: unknown) => log('error', 'claudio', m, d),
  child: (module: string) => ({
    debug: (m: string, d?: unknown) => log('debug', module, m, d),
    info: (m: string, d?: unknown) => log('info', module, m, d),
    warn: (m: string, d?: unknown) => log('warn', module, m, d),
    error: (m: string, d?: unknown) => log('error', module, m, d),
  }),
};
