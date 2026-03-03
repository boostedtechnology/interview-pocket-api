import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";
import type { FastifyInstance } from "fastify";

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("Health Check", () => {
  it("should return ok status", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.payload);
    expect(data.status).toBe("ok");
  });
});

describe("Auth API", () => {
  describe("POST /api/auth/register", () => {
    it("should register a new user", async () => {
      const email = `user${Date.now()}@example.com`;
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: {
          email,
          password: "password123",
        },
      });

      expect(response.statusCode).toBe(201);
      const data = JSON.parse(response.payload);
      expect(data.token).toBeDefined();
      expect(data.user.email).toBe(email);
    });

    it("should reject duplicate email", async () => {
      const email = `dup${Date.now()}@example.com`;

      // Register first user
      const firstRes = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { email, password: "password123" },
      });
      expect(firstRes.statusCode).toBe(201);

      // Try to register same email
      const secondRes = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { email, password: "password123" },
      });
      expect(secondRes.statusCode).toBe(409);
    });

    it("should reject short password", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: {
          email: `test${Date.now()}@example.com`,
          password: "short",
        },
      });
      expect(response.statusCode).toBe(400);
    });

    it("should reject invalid email", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: {
          email: "not-an-email",
          password: "password123",
        },
      });
      expect(response.statusCode).toBe(400);
    });
  });

  describe("POST /api/auth/login", () => {
    it("should login with valid credentials", async () => {
      const email = `login${Date.now()}@example.com`;

      // Register user first
      await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { email, password: "password123" },
      });

      // Now login
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email, password: "password123" },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.token).toBeDefined();
    });

    it("should reject wrong password", async () => {
      const email = `wrong${Date.now()}@example.com`;

      // Register user first
      await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { email, password: "password123" },
      });

      // Try wrong password
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email, password: "wrongpassword" },
      });

      expect(response.statusCode).toBe(401);
    });

    it("should reject non-existent user", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: `nonexist${Date.now()}@example.com`, password: "password123" },
      });

      expect(response.statusCode).toBe(401);
    });
  });
});

describe("Bookmarks API", () => {
  describe("POST /api/bookmarks", () => {
    it("should create a bookmark", async () => {
      // Register user
      const registerRes = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { email: `bm${Date.now()}@example.com`, password: "password123" },
      });
      const token = JSON.parse(registerRes.payload).token;

      // Create bookmark
      const response = await app.inject({
        method: "POST",
        url: "/api/bookmarks",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          url: `https://example${Date.now()}.com`,
          title: "Test Site",
        },
      });

      expect(response.statusCode).toBe(201);
      const data = JSON.parse(response.payload);
      expect(data.title).toBe("Test Site");
      expect(data.tags).toBeInstanceOf(Array);
    });

    it("should reject invalid URL", async () => {
      // Register user
      const registerRes = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { email: `bad${Date.now()}@example.com`, password: "password123" },
      });
      const token = JSON.parse(registerRes.payload).token;

      const response = await app.inject({
        method: "POST",
        url: "/api/bookmarks",
        headers: { authorization: `Bearer ${token}` },
        payload: { url: "not-a-url" },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should require authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/bookmarks",
        payload: { url: "https://example.com" },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("GET /api/bookmarks", () => {
    it("should list bookmarks", async () => {
      // Register user
      const registerRes = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { email: `list${Date.now()}@example.com`, password: "password123" },
      });
      const token = JSON.parse(registerRes.payload).token;

      const response = await app.inject({
        method: "GET",
        url: "/api/bookmarks",
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.data).toBeInstanceOf(Array);
      expect(data.total).toBeDefined();
      expect(data.limit).toBeDefined();
      expect(data.offset).toBeDefined();
    });

    it("should require authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/bookmarks",
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("GET /api/bookmarks/:id", () => {
    it("should return 404 for non-existent bookmark", async () => {
      // Register user
      const registerRes = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { email: `get${Date.now()}@example.com`, password: "password123" },
      });
      const token = JSON.parse(registerRes.payload).token;

      const response = await app.inject({
        method: "GET",
        url: "/api/bookmarks/nonexistent",
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it("should require authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/bookmarks/someid",
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("PATCH /api/bookmarks/:id", () => {
    it("should return 404 for non-existent bookmark", async () => {
      // Register user
      const registerRes = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { email: `patch${Date.now()}@example.com`, password: "password123" },
      });
      const token = JSON.parse(registerRes.payload).token;

      const response = await app.inject({
        method: "PATCH",
        url: "/api/bookmarks/nonexistent",
        headers: { authorization: `Bearer ${token}` },
        payload: { title: "New" },
      });

      expect(response.statusCode).toBe(404);
    });

    it("should require authentication", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: "/api/bookmarks/someid",
        payload: { title: "New" },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("DELETE /api/bookmarks/:id", () => {
    it("should return 404 for non-existent bookmark", async () => {
      // Register user
      const registerRes = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { email: `del${Date.now()}@example.com`, password: "password123" },
      });
      const token = JSON.parse(registerRes.payload).token;

      const response = await app.inject({
        method: "DELETE",
        url: "/api/bookmarks/nonexistent",
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it("should require authentication", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: "/api/bookmarks/someid",
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("POST /api/bookmarks/:id/archive", () => {
    it("should return 404 for non-existent bookmark", async () => {
      // Register user
      const registerRes = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { email: `arch${Date.now()}@example.com`, password: "password123" },
      });
      const token = JSON.parse(registerRes.payload).token;

      const response = await app.inject({
        method: "POST",
        url: "/api/bookmarks/nonexistent/archive",
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it("should require authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/bookmarks/someid/archive",
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("POST /api/bookmarks/:id/unarchive", () => {
    it("should return 404 for non-existent bookmark", async () => {
      // Register user
      const registerRes = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { email: `unarch${Date.now()}@example.com`, password: "password123" },
      });
      const token = JSON.parse(registerRes.payload).token;

      const response = await app.inject({
        method: "POST",
        url: "/api/bookmarks/nonexistent/unarchive",
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it("should require authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/bookmarks/someid/unarchive",
      });

      expect(response.statusCode).toBe(401);
    });
  });
});

describe("Tags API", () => {
  describe("GET /api/tags", () => {
    it("should list tags", async () => {
      // Register user
      const registerRes = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { email: `tag${Date.now()}@example.com`, password: "password123" },
      });
      const token = JSON.parse(registerRes.payload).token;

      const response = await app.inject({
        method: "GET",
        url: "/api/tags",
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.data).toBeInstanceOf(Array);
    });

    it("should require authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/tags",
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("PATCH /api/tags/:id", () => {
    it("should return 404 for non-existent tag", async () => {
      // Register user
      const registerRes = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { email: `ptag${Date.now()}@example.com`, password: "password123" },
      });
      const token = JSON.parse(registerRes.payload).token;

      const response = await app.inject({
        method: "PATCH",
        url: "/api/tags/nonexistent",
        headers: { authorization: `Bearer ${token}` },
        payload: { name: "newname" },
      });

      expect(response.statusCode).toBe(404);
    });

    it("should require authentication", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: "/api/tags/someid",
        payload: { name: "newname" },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("DELETE /api/tags/:id", () => {
    it("should return 404 for non-existent tag", async () => {
      // Register user
      const registerRes = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { email: `dtag${Date.now()}@example.com`, password: "password123" },
      });
      const token = JSON.parse(registerRes.payload).token;

      const response = await app.inject({
        method: "DELETE",
        url: "/api/tags/nonexistent",
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it("should require authentication", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: "/api/tags/someid",
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
