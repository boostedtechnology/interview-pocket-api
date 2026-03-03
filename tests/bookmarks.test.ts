import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
let authToken: string;

// Helper function to get a fresh auth token
async function getAuthToken(email: string = 'test@example.com'): Promise<string> {
  const registerRes = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      email,
      password: 'password123',
    },
  });

  // If user already exists, login instead
  if (registerRes.statusCode === 409) {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email,
        password: 'password123',
      },
    });
    return JSON.parse(loginRes.payload).token;
  }

  const registerData = JSON.parse(registerRes.payload);
  return registerData.token;
}

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  // Get initial auth token
  authToken = await getAuthToken('test@example.com');
});

afterAll(async () => {
  await app.close();
});

describe('Auth API', () => {
  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: `newuser${Date.now()}@example.com`,
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(201);
      const data = JSON.parse(response.payload);
      expect(data.token).toBeDefined();
      expect(data.user.email).toBeDefined();
    });

    it('should reject duplicate email', async () => {
      const email = `duplicate${Date.now()}@example.com`;
      
      // Register first user
      const firstRes = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email,
          password: 'password123',
        },
      });
      expect(firstRes.statusCode).toBe(201);

      // Try to register with same email
      const secondRes = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email,
          password: 'password123',
        },
      });
      expect(secondRes.statusCode).toBe(409);
    });

    it('should reject password shorter than 8 characters', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: `short${Date.now()}@example.com`,
          password: 'short',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject invalid email format', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'not-an-email',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.token).toBeDefined();
      expect(data.user.email).toBe('test@example.com');
    });

    it('should reject wrong password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'wrongpassword',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject non-existent user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'nonexistent@example.com',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });
});

describe('Bookmarks API', () => {
  describe('POST /api/bookmarks', () => {
    it('should create a bookmark with title and description', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/bookmarks',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          url: `https://example${Date.now()}.com`,
          title: 'Example Site',
          description: 'A test site',
          tags: ['test', 'example'],
        },
      });

      expect(response.statusCode).toBe(201);
      const data = JSON.parse(response.payload);
      expect(data.title).toBe('Example Site');
      expect(data.description).toBe('A test site');
      expect(data.tags).toHaveLength(2);
    });

    it('should create a bookmark without optional fields', async () => {
      const url = `https://another${Date.now()}.com`;
      const response = await app.inject({
        method: 'POST',
        url: '/api/bookmarks',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          url,
        },
      });

      expect(response.statusCode).toBe(201);
      const data = JSON.parse(response.payload);
      expect(data.url).toBe(url);
    });

    it('should reject invalid URL', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/bookmarks',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          url: 'not-a-valid-url',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/bookmarks',
        payload: {
          url: 'https://example.com',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/bookmarks', () => {
    it('should list bookmarks with pagination', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/bookmarks',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.total).toBeDefined();
      expect(data.limit).toBeDefined();
      expect(data.offset).toBeDefined();
    });

    it('should respect limit parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/bookmarks?limit=1',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.data.length).toBeLessThanOrEqual(1);
      expect(data.limit).toBe(1);
    });

    it('should respect offset parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/bookmarks?offset=0',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.offset).toBe(0);
    });

    it('should filter by isArchived', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/bookmarks?isArchived=false',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/bookmarks',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/bookmarks/:id', () => {
    it('should get a bookmark by id', async () => {
      // Create a bookmark first
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/bookmarks',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          url: 'https://getbookmark.com',
        },
      });

      const bookmarkId = JSON.parse(createRes.payload).id;

      const response = await app.inject({
        method: 'GET',
        url: `/api/bookmarks/${bookmarkId}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.id).toBe(bookmarkId);
    });

    it('should return 404 for non-existent bookmark', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/bookmarks/nonexistentid',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/bookmarks/someid',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('PATCH /api/bookmarks/:id', () => {
    it('should update bookmark title', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/bookmarks',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          url: 'https://updatetest.com',
          title: 'Original Title',
        },
      });

      const bookmarkId = JSON.parse(createRes.payload).id;

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/bookmarks/${bookmarkId}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          title: 'Updated Title',
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.title).toBe('Updated Title');
    });

    it('should update bookmark tags', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/bookmarks',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          url: 'https://tagtest.com',
        },
      });

      const bookmarkId = JSON.parse(createRes.payload).id;

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/bookmarks/${bookmarkId}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          tags: ['newtag', 'updated'],
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.tags).toHaveLength(2);
    });

    it('should return 404 for non-existent bookmark', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/bookmarks/nonexistentid',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          title: 'Updated',
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/bookmarks/someid',
        payload: {
          title: 'Updated',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /api/bookmarks/:id/archive', () => {
    it('should archive a bookmark', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/bookmarks',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          url: 'https://archive1.com',
        },
      });

      const bookmarkId = JSON.parse(createRes.payload).id;

      const response = await app.inject({
        method: 'POST',
        url: `/api/bookmarks/${bookmarkId}/archive`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.isArchived).toBe(true);
    });

    it('should return 404 for non-existent bookmark', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/bookmarks/nonexistentid/archive',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/bookmarks/someid/archive',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /api/bookmarks/:id/unarchive', () => {
    it('should unarchive a bookmark', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/bookmarks',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          url: 'https://unarchive1.com',
        },
      });

      const bookmarkId = JSON.parse(createRes.payload).id;

      // Archive first
      await app.inject({
        method: 'POST',
        url: `/api/bookmarks/${bookmarkId}/archive`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      // Unarchive
      const response = await app.inject({
        method: 'POST',
        url: `/api/bookmarks/${bookmarkId}/unarchive`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.isArchived).toBe(false);
    });

    it('should return 404 for non-existent bookmark', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/bookmarks/nonexistentid/unarchive',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/bookmarks/someid/unarchive',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('DELETE /api/bookmarks/:id', () => {
    it('should delete a bookmark', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/bookmarks',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          url: 'https://delete1.com',
        },
      });

      const bookmarkId = JSON.parse(createRes.payload).id;

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/bookmarks/${bookmarkId}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(204);

      // Verify deleted
      const getRes = await app.inject({
        method: 'GET',
        url: `/api/bookmarks/${bookmarkId}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(getRes.statusCode).toBe(404);
    });

    it('should return 404 for non-existent bookmark', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/bookmarks/nonexistentid',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/bookmarks/someid',
      });

      expect(response.statusCode).toBe(401);
    });
  });
});

describe('Tags API', () => {
  describe('GET /api/tags', () => {
    it('should list all tags', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/tags',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/tags',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('PATCH /api/tags/:id', () => {
    it('should rename a tag', async () => {
      // Create a bookmark with a tag
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/bookmarks',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          url: 'https://renametag.com',
          tags: ['renameme'],
        },
      });

      // Get tags
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/tags',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      const tags = JSON.parse(listRes.payload).data;
      const tagToRename = tags.find((t: any) => t.name === 'renameme');

      if (tagToRename) {
        const response = await app.inject({
          method: 'PATCH',
          url: `/api/tags/${tagToRename.id}`,
          headers: {
            authorization: `Bearer ${authToken}`,
          },
          payload: {
            name: 'renamed',
          },
        });

        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.payload);
        expect(data.success).toBe(true);
      }
    });

    it('should return 404 for non-existent tag', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/tags/nonexistentid',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          name: 'newname',
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/tags/someid',
        payload: {
          name: 'newname',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('DELETE /api/tags/:id', () => {
    it('should delete a tag', async () => {
      // Create a bookmark with a tag
      await app.inject({
        method: 'POST',
        url: '/api/bookmarks',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          url: 'https://deletetag.com',
          tags: ['todelete'],
        },
      });

      // Get tags
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/tags',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      const tags = JSON.parse(listRes.payload).data;
      const tagToDelete = tags.find((t: any) => t.name === 'todelete');

      if (tagToDelete) {
        const response = await app.inject({
          method: 'DELETE',
          url: `/api/tags/${tagToDelete.id}`,
          headers: {
            authorization: `Bearer ${authToken}`,
          },
        });

        expect(response.statusCode).toBe(204);
      }
    });

    it('should return 404 for non-existent tag', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/tags/nonexistentid',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/tags/someid',
      });

      expect(response.statusCode).toBe(401);
    });
  });
});

describe('Health Check', () => {
  it('should return ok status', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.payload);
    expect(data.status).toBe('ok');
  });
});
