import { Type, type Static } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import { UserService } from '../services/user.service.js';

const userService = new UserService();

// TypeBox schemas for validation and type safety
const RegisterRequestSchema = Type.Object({
  email: Type.String({ format: 'email' }),
  password: Type.String({ minLength: 8 }),
});

const LoginRequestSchema = Type.Object({
  email: Type.String(),
  password: Type.String(),
});

const AuthResponseSchema = Type.Object({
  token: Type.String(),
  user: Type.Object({
    id: Type.String(),
    email: Type.String(),
  }),
});

type RegisterRequest = Static<typeof RegisterRequestSchema>;
type LoginRequest = Static<typeof LoginRequestSchema>;

/**
 * Auth routes plugin
 */
export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * Register a new user
   */
  fastify.post<{ Body: RegisterRequest }>(
    '/register',
    { schema: { body: RegisterRequestSchema, response: { 201: AuthResponseSchema } } },
    async (request, reply) => {
      const result = await userService.register(request.body);
      return reply.status(201).send(result);
    }
  );

  /**
   * Login user
   */
  fastify.post<{ Body: LoginRequest }>(
    '/login',
    { schema: { body: LoginRequestSchema, response: { 200: AuthResponseSchema } } },
    async (request) => {
      const result = await userService.login(request.body);
      return result;
    }
  );
}
