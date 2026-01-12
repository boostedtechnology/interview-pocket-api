import type { FastifyRequest } from 'fastify';

// User types
export interface AuthUser {
  id: string;
  email: string;
}

export interface RegisterInput {
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
  };
}

// Bookmark types
export interface CreateBookmarkInput {
  url: string;
  title?: string;
  description?: string;
  tags?: string[];
}

export interface UpdateBookmarkInput {
  title?: string;
  description?: string;
  isArchived?: boolean;
  tags?: string[];
}

export interface BookmarkFilters {
  isArchived?: boolean;
  tagId?: string;
  search?: string;
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export interface BookmarkWithTags {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  tags: Array<{
    id: string;
    name: string;
  }>;
}

// URL metadata types
export interface UrlMetadata {
  title: string;
  description: string;
}

// Fastify augmentation for authenticated requests
export interface AuthenticatedRequest extends FastifyRequest {
  user: AuthUser;
}

// Tag types
export interface TagWithCount {
  id: string;
  name: string;
  bookmarkCount: number;
}
