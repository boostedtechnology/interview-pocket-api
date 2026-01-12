import type { FastifyRequest, FastifyReply } from 'fastify';
import { UserService } from '../services/user.service.js';
import { UnauthorizedError } from '../utils/errors.js';
import type { AuthUser } from '../types/index.js';

const userService = new UserService();

// Extend FastifyRequest to include user
declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request
 */
export async function authMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader) {
    throw new UnauthorizedError('Missing authorization header');
  }

  const [type, token] = authHeader.split(' ');

  if (type !== 'Bearer' || !token) {
    throw new UnauthorizedError('Invalid authorization format');
  }

  const user = await userService.verifyToken(token);
  request.user = user;
}

/**
 * Optional auth middleware - doesn't throw if no token present
 */
export async function optionalAuthMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader) {
    return;
  }

  const [type, token] = authHeader.split(' ');

  if (type !== 'Bearer' || !token) {
    return;
  }

  try {
    const user = await userService.verifyToken(token);
    request.user = user;
  } catch {
    // Silently ignore invalid tokens for optional auth
  }
}
