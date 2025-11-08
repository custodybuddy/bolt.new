export type DebugLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

type LoggerFunction = (...messages: any[]) => void;

interface Logger {
  trace: LoggerFunction;
  debug: LoggerFunction;
  info: LoggerFunction;
  warn: LoggerFunction;
  error: LoggerFunction;
  setLevel: (level: DebugLevel) => void;
}

const LOG_LEVELS: DebugLevel[] = ['trace', 'debug', 'info', 'warn', 'error'];
const LEVEL_ORDER: Record<DebugLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
};
const defaultLevel: DebugLevel = import.meta.env.DEV ? 'debug' : 'info';

const maybeConfiguredLevel = import.meta.env.VITE_LOG_LEVEL as string | undefined;
const configuredLevel = LOG_LEVELS.includes(maybeConfiguredLevel as DebugLevel)
  ? (maybeConfiguredLevel as DebugLevel)
  : undefined;

let currentLevel: DebugLevel = configuredLevel ?? defaultLevel;

const isWorker = 'HTMLRewriter' in globalThis;
const supportsColor = !isWorker;

export const logger: Logger = {
  trace: (...messages: any[]) => log('trace', undefined, messages),
  debug: (...messages: any[]) => log('debug', undefined, messages),
  info: (...messages: any[]) => log('info', undefined, messages),
  warn: (...messages: any[]) => log('warn', undefined, messages),
  error: (...messages: any[]) => log('error', undefined, messages),
  setLevel,
};

export function createScopedLogger(scope: string): Logger {
  return {
    trace: (...messages: any[]) => log('trace', scope, messages),
    debug: (...messages: any[]) => log('debug', scope, messages),
    info: (...messages: any[]) => log('info', scope, messages),
    warn: (...messages: any[]) => log('warn', scope, messages),
    error: (...messages: any[]) => log('error', scope, messages),
    setLevel,
  };
}

function setLevel(level: DebugLevel) {
  if ((level === 'trace' || level === 'debug') && import.meta.env.PROD) {
    return;
  }

  currentLevel = level;
}

function log(level: DebugLevel, scope: string | undefined, messages: any[]) {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[currentLevel]) {
    return;
  }

  const allMessages = normalizeMessages(messages).reduce((acc, current) => {
    if (acc === '' || acc.endsWith('\n')) {
      return acc + current;
    }

    return `${acc} ${current}`;
  }, '');

  if (!supportsColor) {
    console.log(`[${level.toUpperCase()}]`, allMessages);

    return;
  }

  const labelBackgroundColor = getColorForLevel(level);
  const labelTextColor = level === 'warn' ? 'black' : 'white';

  const labelStyles = getLabelStyles(labelBackgroundColor, labelTextColor);
  const scopeStyles = getLabelStyles('#77828D', 'white');

  const styles = [labelStyles];

  if (typeof scope === 'string') {
    styles.push('', scopeStyles);
  }

  console.log(`%c${level.toUpperCase()}${scope ? `%c %c${scope}` : ''}`, ...styles, allMessages);
}

function getLabelStyles(color: string, textColor: string) {
  return `background-color: ${color}; color: white; border: 4px solid ${color}; color: ${textColor};`;
}

function normalizeMessages(messages: any[]) {
  return messages.map((message) => {
    if (typeof message === 'string') {
      return message;
    }

    if (message instanceof Error) {
      return message.stack ?? message.message;
    }

    if (typeof message === 'object') {
      try {
        return JSON.stringify(message);
      } catch {
        return String(message);
      }
    }

    return String(message);
  });
}

function getColorForLevel(level: DebugLevel): string {
  switch (level) {
    case 'trace':
    case 'debug': {
      return '#77828D';
    }
    case 'info': {
      return '#1389FD';
    }
    case 'warn': {
      return '#FFDB6C';
    }
    case 'error': {
      return '#EE4744';
    }
    default: {
      return 'black';
    }
  }
}

export const renderLogger = createScopedLogger('Render');
