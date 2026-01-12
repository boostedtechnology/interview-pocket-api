import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
let authToken: string;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  // Register a test user
  const registerRes = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      email: 'test@example.com',
      password: 'password123',
    },
  });

  const registerData = JSON.parse(registerRes.payload);
  authToken = registerData.token;
});

afterAll(async () => {
  await app.close();
});

describe('Bookmarks API', () => {
  describe('POST /api/bookmarks', () => {
    it('should create a bookmark', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/bookmarks',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          url: 'https://example.com',
          title: 'Example Site',
        },
      });

      expect(response.statusCode).toBe(201);
      const data = JSON.parse(response.payload);
      expect(data.url).toBe('https://example.com');
      expect(data.title).toBe('Example Site');
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
    it('should list bookmarks', async () => {
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
    });

    // NOTE: Missing tests for pagination edge cases
    // NOTE: Missing tests for filter combinations
    // NOTE: Missing tests for large limit values (Issue #5)
  });

  // NOTE: Missing tests for:
  // - GET /api/bookmarks/:id
  // - PATCH /api/bookmarks/:id
  // - DELETE /api/bookmarks/:id
  // - Archive/unarchive functionality
  // - Tag operations
  // - Error scenarios
  // - Edge cases
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
