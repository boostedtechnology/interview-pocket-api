import { PrismaClient } from '@prisma/client';
import { NotFoundError } from '../utils/errors.js';
import type { TagWithCount } from '../types/index.js';

const prisma = new PrismaClient();

export class TagService {
  /**
   * Get all tags for a user with bookmark counts
   */
  async getUserTags(userId: string): Promise<TagWithCount[]> {
    const tags = await prisma.tag.findMany({
      where: { userId },
      include: {
        _count: {
          select: { bookmarks: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      bookmarkCount: tag._count.bookmarks,
    }));
  }

  /**
   * Get or create tags by name for a user
   */
  async getOrCreateTags(userId: string, tagNames: string[]): Promise<string[]> {
    // Normalize and deduplicate tag names
    const uniqueNames = [...new Set(tagNames.map((name) => name.toLowerCase().trim()))].filter(Boolean);

    if (uniqueNames.length === 0) {
      return [];
    }

    // Use transaction to ensure consistency
    const tagIds = await prisma.$transaction(async (tx) => {
      // Fetch existing tags
      const existingTags = await tx.tag.findMany({
        where: {
          userId,
          name: { in: uniqueNames },
        },
      });

      const existingNames = new Set(existingTags.map((t) => t.name));
      const newNames = uniqueNames.filter((name) => !existingNames.has(name));

      // Create new tags if any
      const newTags =
        newNames.length > 0
          ? await tx.tag.createMany({
              data: newNames.map((name) => ({ userId, name })),
            })
          : { count: 0 };

      // Fetch all tags (existing + newly created)
      const allTags = await tx.tag.findMany({
        where: {
          userId,
          name: { in: uniqueNames },
        },
      });

      return allTags.map((t) => t.id);
    });

    return tagIds;
  }

  /**
   * Sync tags for a bookmark
   */
  async syncBookmarkTags(bookmarkId: string, tagIds: string[]): Promise<void> {
    // Use transaction for atomicity (good pattern)
    await prisma.$transaction(async (tx) => {
      // Remove existing associations
      await tx.bookmarkTag.deleteMany({
        where: { bookmarkId },
      });

      // Create new associations
      if (tagIds.length > 0) {
        await tx.bookmarkTag.createMany({
          data: tagIds.map((tagId) => ({
            bookmarkId,
            tagId,
          })),
        });
      }
    });
  }

  /**
   * Delete a tag
   */
  async deleteTag(userId: string, tagId: string): Promise<void> {
    const result = await prisma.tag.deleteMany({
      where: { id: tagId, userId },
    });

    if (result.count === 0) {
      throw new NotFoundError('Tag not found');
    }
  }

  /**
   * Rename a tag
   */
  async renameTag(userId: string, tagId: string, newName: string): Promise<void> {
    const result = await prisma.tag.updateMany({
      where: { id: tagId, userId },
      data: { name: newName.toLowerCase().trim() },
    });

    if (result.count === 0) {
      throw new NotFoundError('Tag not found');
    }
  }
}
