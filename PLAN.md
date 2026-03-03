# Improvement Plan

Issues are ordered by impact/effort ratio — highest-value, lowest-risk changes first.
Each item is scoped for an atomic commit.

---

## Immediate Tasks

### 1. Isolate tests to a dedicated `test.db` and make the suite idempotent
- Add `.env.test` with `DATABASE_URL="file:./test.db"`
- Add `vitest.config.ts` pointing to a setup file, loading `.env.test`
- Add `tests/setup.ts`: run `prisma migrate deploy` before the suite; truncate all tables between tests
- Update `package.json` test script to load `.env.test`

**Commit:** `Isolate test suite to a dedicated test database and ensure idempotency`

---

### 2. Always log errors regardless of environment
- In `src/app.ts`, remove the `isDevelopment` guard around `app.log.error`
- Optionally omit stack trace in production while keeping the error logged

**Commit:** `Always log errors regardless of environment`

---

### 3. Require `JWT_SECRET` to be explicitly set in production
- In `src/config.ts`, throw a startup error if `JWT_SECRET` is not set when `NODE_ENV` is neither `development` nor `test`

**Commit:** `Require JWT_SECRET to be explicitly set in production environments`

---

### 4. Add explicit `User → Tag` relation in Prisma schema
- Add `user User @relation(fields: [userId], references: [id], onDelete: Cascade)` to the `Tag` model
- Add `tags Tag[]` back-relation to the `User` model
- Create migration with `npm run db:create -- --name "add_user_tag_relation"`
- Update `tag.service.ts` where relevant

**Commit:** `Add explicit User to Tag relation in Prisma schema`

---

### 5. Eliminate N+1 queries in the bookmark list query
- Replace the per-bookmark `bookmarkTag.findMany` loop in `bookmark.service.list()` with a single `bookmark.findMany` using `include: { tags: { include: { tag: true } } }`
- Map the result locally to `BookmarkWithTags`

**Commit:** `Eliminate N+1 queries in the bookmark list service method`

---

### 6. Include total count in the bookmark list response
- Add a `prisma.bookmark.count` call with the same `where` clause in `list()`
- Return `{ data, total, limit, offset }` from route and service

**Commit:** `Include total count in the bookmark list response for pagination`

---

### 7. Do not reveal bookmark existence on unauthorized access
- In `bookmark.service.update()` and `delete()`, use a single `findUnique({ where: { id, userId } })` combining ownership into the lookup
- Return `NotFoundError("Bookmark not found")` uniformly for both not-found and wrong-owner cases

**Commit:** `Return not found instead of access denied to prevent bookmark enumeration`

---

### 8. Reduce tag service writes to a single query per operation
- Replace `findFirst` + `update` in `renameTag` with `updateMany({ where: { id, userId } })`
- Replace `findFirst` + `delete` in `deleteTag` with `deleteMany({ where: { id, userId } })`
- Check `count === 0` to return not-found

**Commit:** `Reduce tag rename and delete to a single database query each`

---

### 9. Simplify tag deduplication and reduce upsert queries in `getOrCreateTags`
- Replace the filter+reduce dedup logic with `new Set(...)`
- Replace N individual upserts with: `findMany` for existing tags → diff for new names → single `createMany`

**Commit:** `Simplify tag deduplication and reduce upsert queries to a single bulk insert`

---

### 10. Bound the URL metadata cache to prevent unbounded memory growth
- Install `lru-cache`
- Replace the unbounded `Map` in `url-parser.ts` with an `LRUCache` (max `500` entries, TTL of 24h)

**Commit:** `Replace unbounded URL metadata cache with a size-limited LRU cache`

---

### 11. Add TypeBox type provider and schemas to all routes
- Install `@fastify/type-provider-typebox` and `@sinclair/typebox`
- Wire up the type provider in `src/app.ts`
- Add `Type.*` schemas (body, querystring, params, response) to all routes — gives runtime coercion + compile-time safety
- Remove manual `parseInt` workarounds in bookmark routes

**Commit:** `Add TypeBox type provider and JSON schemas to all routes for runtime type safety`

---

### 12. Introduce a service container to eliminate duplicate instances
- Create `src/container.ts`: single `PrismaClient`, single `TagService(prisma)`, single `BookmarkService(prisma, tagService)`, single `UserService(prisma)`
- Update service constructors to accept `PrismaClient` as a parameter
- Import from the container in middleware and routes; remove module-level `new PrismaClient()` from each service file

**Commit:** `Introduce a service container with singleton instances for all services`

---

### 13. Tighten the email validation regex
- Replace the loose regex in `user.service.ts` with a stricter pattern (minimum: TLD of 2+ chars, no consecutive dots, standard character constraints)

**Commit:** `Tighten email validation to reject more malformed addresses`

---

### 14. Restrict CORS origin to an explicit allowlist in production
- Add `CORS_ORIGIN` env var to `.env.example` and `src/config.ts`
- In `src/app.ts`, set `origin` to the configured value in production and fall back to `true` in development

**Commit:** `Restrict CORS to a configurable origin allowlist in production`

---

### 15. Add per-request structured logging with response time
- Add a Fastify `onResponse` hook in `src/app.ts` logging method, route, status code, and response time on every request

**Commit:** `Add per-request structured logging hook with response time`

---

### 16. Expand test coverage to all endpoints
- After items 1–15, add tests covering: all bookmark CRUD, archive/unarchive, all tag operations, auth edge cases (duplicate email, wrong password, missing/invalid token)

**Commit:** `Expand test coverage to all API endpoints and key error cases`

---

## Future / Complex Tasks

- **Migrate SQLite → PostgreSQL** — requires data migration planning, connection pool tuning, and environment provisioning
- **Docker + docker-compose** — containerize the API; Compose for local dev with Postgres and (eventually) Redis
- **Rate limiting** — `@fastify/rate-limit`; in-memory for single-node, Redis-backed for horizontal scale
- **JWT session revocation** — short-lived access tokens + refresh tokens, or a DB/Redis token blocklist
- **Replace LRU cache with a Redis-backed cache** — durable and shared once Redis is in the stack
- **Introduce a dependency injection container** — replace the singleton export approach (e.g. `awilix`) as the service graph grows
- **Full observability / APM integration** — OpenTelemetry, Datadog, or similar for distributed traces, metrics, and dashboards
