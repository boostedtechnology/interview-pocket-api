import { Type, type Static } from '@sinclair/typebox';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../middleware/auth.js';
import { isValidUrl } from '../utils/url-parser.js';
import { container } from '../container.js';

// TypeBox schemas
const BookmarkParamsSchema = Type.Object({
  id: Type.String(),
});

const TagSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
});

const BookmarkSchema = Type.Object({
  id: Type.String(),
  url: Type.String(),
  title: Type.Union([Type.String(), Type.Null()]),
  description: Type.Union([Type.String(), Type.Null()]),
  isArchived: Type.Boolean(),
  createdAt: Type.String(),
  updatedAt: Type.String(),
  userId: Type.String(),
  tags: Type.Array(TagSchema),
});

const CreateBookmarkRequestSchema = Type.Object({
  url: Type.String(),
  title: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  tags: Type.Optional(Type.Array(Type.String())),
});

const UpdateBookmarkRequestSchema = Type.Object({
  title: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  isArchived: Type.Optional(Type.Boolean()),
  tags: Type.Optional(Type.Array(Type.String())),
});

const ListQuerystringSchema = Type.Object({
  limit: Type.Optional(Type.String()),
  offset: Type.Optional(Type.String()),
  isArchived: Type.Optional(Type.String()),
  tagId: Type.Optional(Type.String()),
  search: Type.Optional(Type.String()),
});

const BookmarkListResponseSchema = Type.Object({
  data: Type.Array(BookmarkSchema),
  total: Type.Number(),
  limit: Type.Number(),
  offset: Type.Number(),
});

type BookmarkParams = Static<typeof BookmarkParamsSchema>;
type CreateBookmarkRequest = Static<typeof CreateBookmarkRequestSchema>;
type UpdateBookmarkRequest = Static<typeof UpdateBookmarkRequestSchema>;
type ListQuerystring = Static<typeof ListQuerystringSchema>;

/**
 * Bookmark routes plugin
 */
export async function bookmarkRoutes(fastify: FastifyInstance): Promise<void> {
  // Apply auth middleware to all routes
  fastify.addHook('preHandler', authMiddleware);

  /**
   * Create a new bookmark
   */
  fastify.post<{ Body: CreateBookmarkRequest }>(
    '/',
    { schema: { body: CreateBookmarkRequestSchema, response: { 201: BookmarkSchema } } },
    async (request: FastifyRequest<{ Body: CreateBookmarkRequest }>, reply: FastifyReply) => {
      const { url } = request.body;

      if (!isValidUrl(url)) {
        return reply.status(400).send({ error: 'Invalid URL format' });
      }

      const bookmark = await container.getBookmarkService().create(request.user!.id, request.body);
      return reply.status(201).send(bookmark);
    }
  );

  /**
   * List bookmarks
   */
  fastify.get<{ Querystring: ListQuerystring }>(
    '/',
    { schema: { querystring: ListQuerystringSchema, response: { 200: BookmarkListResponseSchema } } },
    async (request: FastifyRequest<{ Querystring: ListQuerystring }>, _reply: FastifyReply) => {
      const { limit, offset, isArchived, tagId, search } = request.query;

      const pagination = {
        limit: limit ? parseInt(String(limit), 10) : 20,
        offset: offset ? parseInt(String(offset), 10) : 0,
      };

      const filters: Record<string, unknown> = {};
      if (isArchived !== undefined) {
        filters.isArchived = isArchived === 'true';
      }
      if (tagId) filters.tagId = tagId;
      if (search) filters.search = search;

       const result = await container.getBookmarkService().list(request.user!.id, pagination, filters as any);

      return result;
    }
  );

  /**
   * Get a single bookmark
   */
  fastify.get<{ Params: BookmarkParams }>(
    '/:id',
    { schema: { params: BookmarkParamsSchema, response: { 200: BookmarkSchema } } },
    async (request: FastifyRequest<{ Params: BookmarkParams }>, _reply: FastifyReply) => {
       const bookmark = await container.getBookmarkService().getById(
         request.user!.id,
         request.params.id
       );
      return bookmark;
    }
  );

  /**
   * Update a bookmark
   */
  fastify.patch<{ Params: BookmarkParams; Body: UpdateBookmarkRequest }>(
    '/:id',
    { schema: { params: BookmarkParamsSchema, body: UpdateBookmarkRequestSchema, response: { 200: BookmarkSchema } } },
    async (
      request: FastifyRequest<{ Params: BookmarkParams; Body: UpdateBookmarkRequest }>,
      _reply: FastifyReply
    ) => {
       const bookmark = await container.getBookmarkService().update(
         request.user!.id,
         request.params.id,
         request.body
       );
      return bookmark;
    }
  );

  /**
   * Delete a bookmark
   */
  fastify.delete<{ Params: BookmarkParams }>(
    '/:id',
    { schema: { params: BookmarkParamsSchema } },
    async (request: FastifyRequest<{ Params: BookmarkParams }>, reply: FastifyReply) => {
       await container.getBookmarkService().delete(request.user!.id, request.params.id);
      return reply.status(204).send();
    }
  );

  /**
   * Archive a bookmark
   */
  fastify.post<{ Params: BookmarkParams }>(
    '/:id/archive',
    { schema: { params: BookmarkParamsSchema, response: { 200: BookmarkSchema } } },
    async (request: FastifyRequest<{ Params: BookmarkParams }>, _reply: FastifyReply) => {
       const bookmark = await container.getBookmarkService().setArchived(
         request.user!.id,
         request.params.id,
         true
       );
      return bookmark;
    }
  );

  /**
   * Unarchive a bookmark
   */
  fastify.post<{ Params: BookmarkParams }>(
    '/:id/unarchive',
    { schema: { params: BookmarkParamsSchema, response: { 200: BookmarkSchema } } },
    async (request: FastifyRequest<{ Params: BookmarkParams }>, _reply: FastifyReply) => {
       const bookmark = await container.getBookmarkService().setArchived(
         request.user!.id,
         request.params.id,
         false
       );
      return bookmark;
    }
  );
}
