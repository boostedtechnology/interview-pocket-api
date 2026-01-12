import Fastify, { FastifyInstance, FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import { config } from './config.js';
import { authRoutes } from './routes/auth.js';
import { bookmarkRoutes } from './routes/bookmarks.js';
import { tagRoutes } from './routes/tags.js';
import { AppError } from './utils/errors.js';

/**
 * Build and configure the Fastify application
 */
export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: config.isDevelopment
      ? {
          transport: {
            target: 'pino-pretty',
            options: { colorize: true },
          },
        }
      : true,
  });

  // Register CORS
  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  // Global error handler (good pattern)
  app.setErrorHandler(
    (error: FastifyError | AppError, _request: FastifyRequest, reply: FastifyReply) => {
      const statusCode = 'statusCode' in error ? error.statusCode ?? 500 : 500;
      const code = 'code' in error && typeof error.code === 'string' ? error.code : 'INTERNAL_ERROR';

      // Log error in development
      if (config.isDevelopment) {
        app.log.error(error);
      }

      reply.status(statusCode).send({
        error: {
          message: error.message,
          code,
          ...(config.isDevelopment && { stack: error.stack }),
        },
      });
    }
  );

  // Health check endpoint
  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Register routes
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(bookmarkRoutes, { prefix: '/api/bookmarks' });
  await app.register(tagRoutes, { prefix: '/api/tags' });

  return app;
}
