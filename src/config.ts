export const config = {
  // Server configuration
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',

  // JWT configuration
  // NOTE: Falls back to development secret if not set (Issue #1 - Security)
  jwtSecret: process.env.JWT_SECRET || 'development-secret-do-not-use-in-prod',
  jwtExpiresIn: '7d',

  // Database
  databaseUrl: process.env.DATABASE_URL || 'file:./dev.db',

  // Environment
  nodeEnv: process.env.NODE_ENV || 'development',
  isDevelopment: process.env.NODE_ENV !== 'production',
} as const;

export type Config = typeof config;
