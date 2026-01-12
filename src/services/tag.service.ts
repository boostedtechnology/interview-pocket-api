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
    const normalizedNames = tagNames.map((name) => name.toLowerCase().trim());
    const uniqueNames = [...new Set(normalizedNames)].filter(Boolean);

    if (uniqueNames.length === 0) {
      return [];
    }

    // Use transaction to ensure consistency (good pattern)
    const tagIds = await prisma.$transaction(async (tx) => {
      const ids: string[] = [];

      for (const name of uniqueNames) {
        // Upsert each tag
        const tag = await tx.tag.upsert({
          where: {
            userId_name: { userId, name },
          },
          create: { userId, name },
          update: {},
        });
        ids.push(tag.id);
      }

      return ids;
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
    const tag = await prisma.tag.findFirst({
      where: { id: tagId, userId },
    });

    if (!tag) {
      throw new NotFoundError('Tag not found');
    }

    await prisma.tag.delete({
      where: { id: tagId },
    });
  }

  /**
   * Rename a tag
   */
  async renameTag(userId: string, tagId: string, newName: string): Promise<void> {
    const tag = await prisma.tag.findFirst({
      where: { id: tagId, userId },
    });

    if (!tag) {
      throw new NotFoundError('Tag not found');
    }

    await prisma.tag.update({
      where: { id: tagId },
      data: { name: newName.toLowerCase().trim() },
    });
  }
}
