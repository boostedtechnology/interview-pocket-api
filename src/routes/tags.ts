import { Type, type Static } from '@sinclair/typebox';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../middleware/auth.js';
import { container } from '../container.js';

// TypeBox schemas
const TagParamsSchema = Type.Object({
  id: Type.String(),
});

const TagWithCountSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  bookmarkCount: Type.Number(),
});

const RenameBodySchema = Type.Object({
  name: Type.String({ minLength: 1 }),
});

const TagListResponseSchema = Type.Object({
  data: Type.Array(TagWithCountSchema),
});

type TagParams = Static<typeof TagParamsSchema>;
type RenameBody = Static<typeof RenameBodySchema>;

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
    { schema: { response: { 200: TagListResponseSchema } } },
    async (request: FastifyRequest, _reply: FastifyReply) => {
       const tags = await container.getTagService().getUserTags(request.user!.id);
      return { data: tags };
    }
  );

  /**
   * Rename a tag
   */
  fastify.patch<{ Params: TagParams; Body: RenameBody }>(
    '/:id',
    { schema: { params: TagParamsSchema, body: RenameBodySchema, response: { 200: Type.Object({ success: Type.Boolean() }) } } },
    async (
      request: FastifyRequest<{ Params: TagParams; Body: RenameBody }>,
      reply: FastifyReply
    ) => {
       await container.getTagService().renameTag(request.user!.id, request.params.id, request.body.name);
      return { success: true };
    }
  );

  /**
   * Delete a tag
   */
  fastify.delete<{ Params: TagParams }>(
    '/:id',
    { schema: { params: TagParamsSchema } },
    async (request: FastifyRequest<{ Params: TagParams }>, reply: FastifyReply) => {
       await container.getTagService().deleteTag(request.user!.id, request.params.id);
      return reply.status(204).send();
    }
  );
}
