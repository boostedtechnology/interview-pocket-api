import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { BookmarkService } from '../services/bookmark.service.js';
import { authMiddleware } from '../middleware/auth.js';
import { isValidUrl } from '../utils/url-parser.js';
import type {
  CreateBookmarkInput,
  UpdateBookmarkInput,
  PaginationParams,
  BookmarkFilters,
} from '../types/index.js';

const bookmarkService = new BookmarkService();

interface BookmarkParams {
  id: string;
}

interface ListQuerystring extends PaginationParams, BookmarkFilters {}

/**
 * Bookmark routes plugin
 */
export async function bookmarkRoutes(fastify: FastifyInstance): Promise<void> {
  // Apply auth middleware to all routes
  fastify.addHook('preHandler', authMiddleware);

  /**
   * Create a new bookmark
   */
  fastify.post<{ Body: CreateBookmarkInput }>(
    '/',
    async (request: FastifyRequest<{ Body: CreateBookmarkInput }>, reply: FastifyReply) => {
      const { url } = request.body;

      // Validate URL
      if (!isValidUrl(url)) {
        // Inconsistent error response - returns directly instead of throwing (Issue #8)
        return reply.status(400).send({ error: 'Invalid URL format' });
      }

      const bookmark = await bookmarkService.create(request.user!.id, request.body);
      return reply.status(201).send(bookmark);
    }
  );

  /**
   * List bookmarks
   * NOTE: No max limit on pagination (Issue #5)
   */
  fastify.get<{ Querystring: ListQuerystring }>(
    '/',
    async (request: FastifyRequest<{ Querystring: ListQuerystring }>, _reply: FastifyReply) => {
      const { limit, offset, isArchived, tagId, search } = request.query;

      // No max limit validation - user can request any number of items (Issue #5)
      const pagination: PaginationParams = {
        limit: limit ? parseInt(String(limit), 10) : 20,
        offset: offset ? parseInt(String(offset), 10) : 0,
      };

      const filters: BookmarkFilters = {};
      if (isArchived !== undefined) {
        filters.isArchived = isArchived === 'true' || isArchived === true;
      }
      if (tagId) filters.tagId = tagId;
      if (search) filters.search = search;

      const bookmarks = await bookmarkService.list(
        request.user!.id,
        pagination,
        filters
      );

      return { data: bookmarks };
    }
  );

  /**
   * Get a single bookmark
   */
  fastify.get<{ Params: BookmarkParams }>(
    '/:id',
    async (request: FastifyRequest<{ Params: BookmarkParams }>, _reply: FastifyReply) => {
      const bookmark = await bookmarkService.getById(
        request.user!.id,
        request.params.id
      );
      return bookmark;
    }
  );

  /**
   * Update a bookmark
   */
  fastify.patch<{ Params: BookmarkParams; Body: UpdateBookmarkInput }>(
    '/:id',
    async (
      request: FastifyRequest<{ Params: BookmarkParams; Body: UpdateBookmarkInput }>,
      _reply: FastifyReply
    ) => {
      const bookmark = await bookmarkService.update(
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
    async (request: FastifyRequest<{ Params: BookmarkParams }>, reply: FastifyReply) => {
      await bookmarkService.delete(request.user!.id, request.params.id);
      return reply.status(204).send();
    }
  );

  /**
   * Archive a bookmark
   */
  fastify.post<{ Params: BookmarkParams }>(
    '/:id/archive',
    async (request: FastifyRequest<{ Params: BookmarkParams }>, _reply: FastifyReply) => {
      const bookmark = await bookmarkService.setArchived(
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
    async (request: FastifyRequest<{ Params: BookmarkParams }>, _reply: FastifyReply) => {
      const bookmark = await bookmarkService.setArchived(
        request.user!.id,
        request.params.id,
        false
      );
      return bookmark;
    }
  );
}
