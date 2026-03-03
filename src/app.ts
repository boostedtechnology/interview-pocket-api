import Fastify, { FastifyInstance, FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
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
  }).withTypeProvider<TypeBoxTypeProvider>();

  // Register CORS
  // In development, allow all origins. In production, use the configured origin allowlist.
  await app.register(cors, {
    origin: config.corsOrigin,
    credentials: true,
  });

   // Global error handler (good pattern)
   app.setErrorHandler(
     (error: FastifyError | AppError, _request: FastifyRequest, reply: FastifyReply) => {
       const statusCode = 'statusCode' in error ? error.statusCode ?? 500 : 500;
       const code = 'code' in error && typeof error.code === 'string' ? error.code : 'INTERNAL_ERROR';

       // Always log errors, but include stack trace only in development
       app.log.error({
         message: error.message,
         code,
         ...(config.isDevelopment && { stack: error.stack }),
       });

       reply.status(statusCode).send({
         error: {
           message: error.message,
           code,
           ...(config.isDevelopment && { stack: error.stack }),
         },
       });
     }
    );

   // Capture request start time in preHandler hook
   app.addHook('preHandler', async (request: FastifyRequest) => {
     (request as any)._startTime = Date.now();
   });

   // Log request completion with response time in onResponse hook
   app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
     const startTime = (request as any)._startTime as number;
     const responseTime = Date.now() - startTime;
     
     app.log.info({
       method: request.method,
       route: request.url,
       statusCode: reply.statusCode,
       responseTime: `${responseTime.toFixed(2)}ms`,
     });
   });

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
