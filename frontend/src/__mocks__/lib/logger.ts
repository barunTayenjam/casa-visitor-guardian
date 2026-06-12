type LogFn = (...args: unknown[]) => void;

export const logger: Record<string, LogFn> = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};
