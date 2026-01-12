import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { UserService } from '../services/user.service.js';
import type { RegisterInput, LoginInput } from '../types/index.js';

const userService = new UserService();

// Request body schemas for validation (good pattern)
const registerSchema = {
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string', minLength: 8 },
    },
  },
} as const;

const loginSchema = {
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string' },
      password: { type: 'string' },
    },
  },
} as const;

/**
 * Auth routes plugin
 */
export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * Register a new user
   */
  fastify.post<{ Body: RegisterInput }>(
    '/register',
    { schema: registerSchema },
    async (request: FastifyRequest<{ Body: RegisterInput }>, reply: FastifyReply) => {
      const result = await userService.register(request.body);
      return reply.status(201).send(result);
    }
  );

  /**
   * Login user
   */
  fastify.post<{ Body: LoginInput }>(
    '/login',
    { schema: loginSchema },
    async (request: FastifyRequest<{ Body: LoginInput }>, _reply: FastifyReply) => {
      const result = await userService.login(request.body);
      return result;
    }
  );
}
