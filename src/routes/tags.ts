import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { TagService } from '../services/tag.service.js';
import { authMiddleware } from '../middleware/auth.js';

const tagService = new TagService();

interface TagParams {
  id: string;
}

interface RenameBody {
  name: string;
}

/**
 * Tag routes plugin
 */
export async function tagRoutes(fastify: FastifyInstance): Promise<void> {
  // Apply auth middleware to all routes
  fastify.addHook('preHandler', authMiddleware);

  /**
   * List all tags for the current user
   */
  fastify.get(
    '/',
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const tags = await tagService.getUserTags(request.user!.id);
      return { data: tags };
    }
  );

  /**
   * Rename a tag
   */
  fastify.patch<{ Params: TagParams; Body: RenameBody }>(
    '/:id',
    async (
      request: FastifyRequest<{ Params: TagParams; Body: RenameBody }>,
      reply: FastifyReply
    ) => {
      const { name } = request.body;

      if (!name || name.trim().length === 0) {
        return reply.status(400).send({ message: 'Name is required', code: 'INVALID_INPUT' });
      }

      await tagService.renameTag(request.user!.id, request.params.id, name);
      return { success: true };
    }
  );

  /**
   * Delete a tag
   */
  fastify.delete<{ Params: TagParams }>(
    '/:id',
    async (request: FastifyRequest<{ Params: TagParams }>, reply: FastifyReply) => {
      await tagService.deleteTag(request.user!.id, request.params.id);
      return reply.status(204).send();
    }
  );
}
