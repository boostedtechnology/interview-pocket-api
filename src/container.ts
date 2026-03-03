import { PrismaClient } from '@prisma/client';
import { UserService } from './services/user.service.js';
import { BookmarkService } from './services/bookmark.service.js';
import { TagService } from './services/tag.service.js';

/**
 * Service container for managing singleton instances
 */
class ServiceContainer {
  private prisma: PrismaClient;
  private userService: UserService;
  private bookmarkService: BookmarkService;
  private tagService: TagService;

  constructor() {
    this.prisma = new PrismaClient();
    this.tagService = new TagService(this.prisma);
    this.bookmarkService = new BookmarkService(this.prisma, this.tagService);
    this.userService = new UserService(this.prisma);
  }

  getPrisma(): PrismaClient {
    return this.prisma;
  }

  getUserService(): UserService {
    return this.userService;
  }

  getBookmarkService(): BookmarkService {
    return this.bookmarkService;
  }

  getTagService(): TagService {
    return this.tagService;
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

// Export a single instance
export const container = new ServiceContainer();
