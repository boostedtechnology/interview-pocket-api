const nodeEnv = process.env.NODE_ENV || 'development';
const isDevelopment = nodeEnv !== 'production';
const isTest = nodeEnv === 'test';

// Validate JWT secret
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret && !isDevelopment && !isTest) {
  throw new Error(
    'JWT_SECRET environment variable is required in production environments'
  );
}

export const config = {
  // Server configuration
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',

  // JWT configuration
  jwtSecret: jwtSecret || 'development-secret-do-not-use-in-prod',
  jwtExpiresIn: '7d',

  // Database
  databaseUrl: process.env.DATABASE_URL || 'file:./dev.db',

  // Environment
  nodeEnv,
  isDevelopment,
  isTest,
} as const;

export type Config = typeof config;
