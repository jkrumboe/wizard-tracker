const LOG_LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 50,
};

const LOG_METHODS = {
  debug: 'debug',
  info: 'info',
  warn: 'warn',
  error: 'error',
};

const DEFAULT_LEVEL = import.meta.env.DEV ? 'debug' : 'warn';
const STORAGE_KEY = 'keepwiz_log_level';

function normalizeLevel(level) {
  if (!level || typeof level !== 'string') {
    return null;
  }

  const normalized = level.toLowerCase().trim();
  return Object.hasOwn(LOG_LEVELS, normalized) ? normalized : null;
}

function resolveConfiguredLevel() {
  const envLevel = normalizeLevel(import.meta.env.VITE_LOG_LEVEL);
  if (envLevel) {
    return envLevel;
  }

  try {
    const storedLevel = normalizeLevel(globalThis?.localStorage?.getItem(STORAGE_KEY));
    if (storedLevel) {
      return storedLevel;
    }
  } catch {
    // Ignore storage access errors (private mode, SSR, blocked storage)
  }

  return DEFAULT_LEVEL;
}

let activeLevel = resolveConfiguredLevel();

function isEnabled(level) {
  return LOG_LEVELS[level] >= LOG_LEVELS[activeLevel];
}

function formatPrefix(scope) {
  return scope ? `[KeepWiz][${scope}]` : '[KeepWiz]';
}

function emit(level, scope, message, meta) {
  if (!isEnabled(level)) {
    return;
  }

  const method = LOG_METHODS[level] || 'log';
  const prefix = formatPrefix(scope);

  if (meta !== undefined) {
    console[method](`${prefix} ${message}`, meta);
    return;
  }

  console[method](`${prefix} ${message}`);
}

export function getLogLevel() {
  return activeLevel;
}

export function setLogLevel(level, options = {}) {
  const normalized = normalizeLevel(level);
  if (!normalized) {
    return false;
  }

  activeLevel = normalized;

  if (options.persist) {
    try {
      globalThis?.localStorage?.setItem(STORAGE_KEY, normalized);
    } catch {
      // Ignore storage failures; runtime level is still applied.
    }
  }

  return true;
}

export function createLogger(scope) {
  return {
    debug(message, meta) {
      emit('debug', scope, message, meta);
    },
    info(message, meta) {
      emit('info', scope, message, meta);
    },
    warn(message, meta) {
      emit('warn', scope, message, meta);
    },
    error(message, meta) {
      emit('error', scope, message, meta);
    },
    child(childScope) {
      const nextScope = scope ? `${scope}:${childScope}` : childScope;
      return createLogger(nextScope);
    },
  };
}

export const appLogger = createLogger('app');
