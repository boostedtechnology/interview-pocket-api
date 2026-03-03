import { PrismaClient } from '@prisma/client';
import { TagService } from './tag.service.js';
import { fetchUrlMetadata } from '../utils/url-parser.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';
import type {
  CreateBookmarkInput,
  UpdateBookmarkInput,
  BookmarkFilters,
  PaginationParams,
  BookmarkWithTags,
  BookmarkListResponse,
} from '../types/index.js';

export class BookmarkService {
  private prisma: PrismaClient;
  private tagService: TagService;

  constructor(prisma: PrismaClient, tagService: TagService) {
    this.prisma = prisma;
    this.tagService = tagService;
  }

  /**
   * Create a new bookmark
   */
  async create(userId: string, input: CreateBookmarkInput): Promise<BookmarkWithTags> {
    const { url, title, description, tags } = input;

    let finalTitle = title;
    let finalDescription = description;

    if (!title) {
      const metadata = await fetchUrlMetadata(url);
      finalTitle = metadata.title;
      finalDescription = description || metadata.description;
    }

     // Create bookmark
     const bookmark = await this.prisma.bookmark.create({
      data: {
        url,
        title: finalTitle,
        description: finalDescription,
        userId,
      },
    });

    // Handle tags if provided
    if (tags && tags.length > 0) {
      const tagIds = await this.tagService.getOrCreateTags(userId, tags);
      await this.tagService.syncBookmarkTags(bookmark.id, tagIds);
    }

    return this.getById(userId, bookmark.id);
  }

  /**
   * Get bookmark by ID
   */
   async getById(userId: string, bookmarkId: string): Promise<BookmarkWithTags> {
     const bookmark = await this.prisma.bookmark.findUnique({
      where: { id: bookmarkId },
      include: {
        tags: {
          include: { tag: true },
        },
      },
    });

    if (!bookmark || bookmark.userId !== userId) {
      throw new NotFoundError('Bookmark not found');
    }

    return {
      ...bookmark,
      tags: bookmark.tags.map((bt) => ({
        id: bt.tag.id,
        name: bt.tag.name,
      })),
    };
  }

  /**
   * List bookmarks with optional filters
   */
  async list(
    userId: string,
    pagination: PaginationParams = {},
    filters: BookmarkFilters = {}
  ): Promise<BookmarkListResponse> {
    const { limit = 20, offset = 0 } = pagination;
    const { isArchived, tagId, search } = filters;

    // Build where clause
    const where: Record<string, unknown> = { userId };

    if (isArchived !== undefined) {
      where.isArchived = isArchived;
    }

    if (tagId) {
      where.tags = {
        some: { tagId },
      };
    }

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
        { url: { contains: search } },
      ];
    }

     // Fetch bookmarks with tags in a single query and get total count
     const [bookmarks, total] = await Promise.all([
       this.prisma.bookmark.findMany({
         where,
         include: {
           tags: {
             include: { tag: true },
           },
         },
         orderBy: { createdAt: 'desc' },
         take: limit,
         skip: offset,
       }),
       this.prisma.bookmark.count({ where }),
     ]);

    // Map to the expected format
    const data = bookmarks.map((bookmark) => ({
      ...bookmark,
      tags: bookmark.tags.map((bt) => ({
        id: bt.tag.id,
        name: bt.tag.name,
      })),
    }));

    return { data, total, limit, offset };
  }

  /**
   * Update a bookmark
   */
  async update(
    userId: string,
    bookmarkId: string,
    input: UpdateBookmarkInput
  ): Promise<BookmarkWithTags> {
     // Verify ownership by combining checks - return not found if either is false
     const existing = await this.prisma.bookmark.findUnique({
      where: { id: bookmarkId },
    });

    if (!existing || existing.userId !== userId) {
      throw new NotFoundError('Bookmark not found');
    }

    const { tags, ...updateData } = input;

     // Update bookmark
     await this.prisma.bookmark.update({
      where: { id: bookmarkId },
      data: updateData,
    });

    // Update tags if provided
    if (tags !== undefined) {
      const tagIds = await this.tagService.getOrCreateTags(userId, tags);
      await this.tagService.syncBookmarkTags(bookmarkId, tagIds);
    }

    return this.getById(userId, bookmarkId);
  }

  /**
   * Delete a bookmark
   */
   async delete(userId: string, bookmarkId: string): Promise<void> {
     const bookmark = await this.prisma.bookmark.findUnique({
      where: { id: bookmarkId },
    });

    if (!bookmark || bookmark.userId !== userId) {
      throw new NotFoundError('Bookmark not found');
    }

     await this.prisma.bookmark.delete({
       where: { id: bookmarkId },
     });
   }

  /**
   * Archive or unarchive a bookmark
   */
  async setArchived(
    userId: string,
    bookmarkId: string,
    isArchived: boolean
  ): Promise<BookmarkWithTags> {
    return this.update(userId, bookmarkId, { isArchived });
  }
}
