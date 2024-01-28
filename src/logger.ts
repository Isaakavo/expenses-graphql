import { createLogger, format, transports } from 'winston';

export const logger = createLogger({
  level: 'info',
  format: format.splat(),
  defaultMeta: { service: 'expenses-graphl' },
  transports: [
    new transports.File({ filename: 'error.log', level: 'error' }),
    new transports.File({ filename: 'combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'prod') {
  const { printf, combine, colorize, timestamp, splat } = format;
  const customFormat = printf(({ level, message, timestamp }) => {
    return `[${timestamp}] ${level}: ${message}`;
  });
  logger.add(
    new transports.Console({
      format: combine(colorize(), timestamp(), splat(), customFormat),
    })
  );
}
