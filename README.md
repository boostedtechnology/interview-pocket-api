# Boosted Pocket API

A bookmark management service API built with Fastify and Prisma.

## Context

This codebase was developed by a small team (2 engineers) to power a bookmarking app, Pocket.
The service currently handles approximately 1,000 daily active users and is being considered for acquisition by a larger company with potential expansion to 100k+ users.

## Your Task

**Time:** 30-60 minutes (review only - no need to build or run the project, unless you want)

Please review this codebase and prepare to discuss the following in our conversation:

**Identified Problems**
- Dockerization is almost natural nowadays, it wouldn't hurt to be able to build a container for this api. Eventually we could also use docker compose on local environments, to help with a postgres db, or a redis memory cache service once we reach that point.
- Using `prisma db push` instead of migrations.
- Schema is not using a strong relation between User and Tag, but there's clearly an intent to have unqiue tags per user, in that sense and also to follow regular prisma relations, I would make it an explicit relation at the generated ORM.
- Tests are not idempotent, they run only the first time on the development database.
- app.log.error calls only for development environment seems wrong, they are even more useful on production.
- Ideally we should complete the testing efforts to cover all the endpoints.
- If this API is generraly accesible or on a public network, it would be important to rate-limit our endpoints on our production environments.
- CORS config may require a double check, particularly if this API will be public.
- Creating a service instance globally to the controller (or within the controller) may not scale well, at some points services need to interact with other services, and we endup creating multiple instances of the same services.
- middleware creates userService instances on every request call.
- optionalAuthMiddleware, is this just to provide req.user if available, but not fail if missing?
- Using generic types without a schema do not automatically coerce types, so at runtime Querytring or Params types will be strings.
- Auth Route & Service
  - jwt secret has a default value, this could be useful for development or test environments, but I would use it only when config.isDevelopment is set, otherwise, it should fail, that would work as a reminder to set this secret properly in production environments.
  - jwt tokens will be valid for 7 days, no way to terminate that session sooner.
  - email regex may be too loose (any char expect space or @)
- Bookmarks Route & Service
  - POST /bookmarks
    - check on ValidUrl (when does `new URL()` throws an error?)
    - tagService instance within BookmarkService, not necessarily wrong, but given that service instances live through the app lifecycle, this may lead multiple instances of services as the app grows. not urgent at this proint, but we should keep an eye on it.
    - prisma.bookmark.create returned values should be enough, no need to getById the same bookmark. (getById is used to fetch bookmark with it's newly created tags, maybe we can create them first?)
    - fetchUrlMetadata uses an In-memory cache which is never cleared, it could grow quickly with 100k+ users, a better caching strategy should be used at scale, one with an expiration policy.
    - getOrCreateTags
      - logic to get unique tags seems unnecessarily complex, one normalized, we should be able to just create a set, no filter after it, and the check for the length of uniqueNames feels unnecessary at this point as well, we could've check for this before.
      - Using N upsert queries may be replaced with a fetch, some logic to check for new tags, and a single createMany operation.
    - syncBookmarkTags
      - looks right, we may want to revisit if we simplify the tagging logic, otherwise seems reasonable considering create and update bookmarks scenarios, where we just want to replace all tags using just their names.
  - GET /bookmarks
    - Type coercion problems on querystring params
    - Pagination usually expect a total count or some sort of pointer that tell the clients how to fetch the next page of data.
    - bookmarks.service
      - list ends up in 1 query to fetch bookmarks, then N queries to fetch tags for each bookmark. firts query could join tags and then we can run a local map over them to re-shape the tags format as expected.
  - GET /bookmarks/:id
    - bookmarks.service
      - getById doesn't not have the previous mentioned problem, it does include tags in the reponse, and maps over them without additional db queries.
  - PATCH /bookmarks/:id
    - bookmarks.service
      - update() we could look for a unique bookmakr by id and userId, returning just not found if the bookmark does not belong to the user, Access denied, in a way reveals the existence of such bookmark.
      - re-sync tags still fells off, there's must be a better way.
      - update returns getById which includes tags and maps over them without additional db queries, but we could improve this after solving the tags syncing, and reduce query count.
  - DELETE /bookmarks/:id
    - bookmarks.service: delete()
      - also reveals the existence of the bookmark when returning 'Access denied'
      - Cascade delete should handle bookmarTags deletion.
  - POST /bookmarks/:id/archive & /bookmarks/:id/unarchive
    - bookmarks.service: setArchived()
      - Just a note that this endpoint returns a bookmark without tags, not a problem, in fact may be just fine.
- Tags Routes & Service
  - Has a separate tagService instance than the one used by bookmarks.
  - GET /tags
    - tags.service: getUserTags()
      - tags with mapped count of bookmarks using each tag.
  - PATCH /tags/:id
    - tags.service: renameTag()
      - would use findUnique for consistency
      - using just the prisma update call with the where statement might have the same result. 1 vs 2 queries
  - DELETE /tags/:id
    - tags.service: deleteTag()
      - using just the prisma delete call with a userId in the where statement would works as well.

1. **What would you improve first, and why?**
   Consider: impact, effort, risk
- [PC] Tests run only the first time on top of the same db the app consumes, and they are not idempotent.
  - impact: high - tests are our best indicator for the app status, and will be invaluable for any refactor efforts going forward.
  - effort: medium to high: depends on how we address it, separata db, auto cleanup or reset on every run, etc.
  - risk: low - AI tools are good with test generation.
- [PC] Review endpoints with unnecessary queries, particularly GET /bookmarks as it's the most problematic one.
  - impact: high - these queries on a big scale could easily be a bottlenect and exhaust the database connections and resources.
  - effort: medium - we would need to refactor the queries and update the tests to ensure they are working as expected.
  - risk: low - the problem is easy to spot and fix.
- [PC] Provide a temporary limit or expiration to the In-memory cache to prevent it from growing indefinitely.
  - impact: high - the cache could grow without bound and consume all available memory.
  - effort: low - we would just need to configure the cache with a limit or expiration, and start research on a better tool.
  - risk: low - proved we find a simple solution, maybe just a fixed size limit.
- [PC] Use schemas and a type provider on fastify endpoints, using simply TS generics does not guaranty the types.
  - impact: medium, if we know and understand what we're doing, we could keep using Generics, but would be more error prone.
  - effort: medium, all endpoints would need to be properly updated with schemas
  - risk: low we're keeping the same types that we're currently assuming.
- [PC] Add db migrations and use that instead of db:push, Migrations should allow for more careful schema changes, and avoid data loss on schema changes, this would also be a preparation step for a migration to a different database.
  - impact: high, migrations should allow for safer schema changes, and reproducible migration scenarios.
  - effort: lot-medium: we would to start with an initial migration as it is, then then move forward.
  - risk: low: first migration should be safe as it would just output the current schema state.
- [PC] Adding more logs and observability to the application, to better understand the traffic we're dealing with (reads vs write operations, most demanded requests, most timeconsuming operations)
  - impact: Getting this metric should allow us to make better decisions in order to scalale accordignly.
  - effort: Not a high effort tasks, adding logs should not be complicated and there are many tools that would help with observability and are easy to integrate.
  - risk: Low risk.
- [PC] Assuming a worst case scenario, with 100k+ users how are actively reading, and particularly writing bookmarks and tags, sqlite could become the first bottleneck, so I would start by a migration to postgresql or a managed database service based on it or similar.
  - impact: PostgreSQL should allow the app to scale far beyond sqlite limits.
  - effort: Prisma does a very good job abstracting the database layer, and the data migration should also be straightforward.
  - risk: Data migration always come with some risk, so thoughtful planning and backup should be followed.

2. **What trade-offs do you think were made?**
   Consider: speed vs quality, simplicity vs extensibility
- [PC] `db:push` was likely a desicion made to simplify the database operations, managing migrations does have some cases where we need to be careful, particularly when working on a team, but I would say that the pros of using migrations largely outwight its cons.
- [PC] Lately I've been hearing a lot a good things about sqlite, particularly with the speed of modern solid state drives, so I would say simplicity was indeed a tradeoff over higher data volumes, one that today, may give us an ample marging and time to improve if we notice that we're going to need it. Perhaps having multiple prisma instances is already related to this choice, as it's not as problematic as it would be with PostgreSQL, where each prisma client with have it's own connection pool, thus multiple instances can exhaust server connections faster.
- [PC] Creating multiple service instances when needed, is certainly a simple approach, but as the project grows and service-to-service communication grows, this can become a problem.
- [PC] A loose type check on the endpoints may have also be favored for development speed, however, some of this typing as actually hiding errors, so this tradeoff is clearly a bad one.

3. **Where might this break at scale or in production?**
   Consider: 100k users, high write volume, edge cases
   - [PC] Write operations could become a bottleneck, sqlite may be able to handle 100k users under some circumstances, but this would be my first concern. The API itself is stateless, so horizontal scaling should be easy to achieve, particularly when using services that autoscale under certain threasholds, like GCP's Cloud Run. In any case, without fixing the identified issues I would say that:
   - In-memory could consume a lot of memory on a high write volume of bookmarks.
   - fetching and filtering bookmarks is likely the most used endpoint, and executing N+1 queries for each call would also be a problem sooner rather than later.

4. **What questions would you ask before making changes?**
   Consider: product context, team constraints, priorities
   - [PC] I'd like to understand if we have any metrics that could help us extrapolate a higher volume of users, even just to have an idea of what we may expect (p90, p95, p99 or similar). Regarding priorities, I would like to understand what are we planning next, increasing user volume is certainly nice, but I'm sure the product will try to explore new features, sharing bookmarks, promoting bookmarks, etc. Understanding both previously mentioned considerations, We may need to adjust the team, Grow in number, or perhaps just grow in skillsets.

## Project Structure

```
src/     # Most application logic
prisma/  # Database schema
tests/   # Test suite
```

## Tech Stack

- Node.js + TypeScript
- Fastify (HTTP framework)
- Prisma (Database ORM)
- SQLite (no setup required)
- JWT authentication (jose library)

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login and receive JWT token

### Bookmarks
- `POST /api/bookmarks` - Create a bookmark
- `GET /api/bookmarks` - List bookmarks (supports filtering and pagination)
- `GET /api/bookmarks/:id` - Get a single bookmark
- `PATCH /api/bookmarks/:id` - Update a bookmark
- `DELETE /api/bookmarks/:id` - Delete a bookmark
- `POST /api/bookmarks/:id/archive` - Archive a bookmark
- `POST /api/bookmarks/:id/unarchive` - Unarchive a bookmark

### Tags
- `GET /api/tags` - List all tags
- `PATCH /api/tags/:id` - Rename a tag
- `DELETE /api/tags/:id` - Delete a tag

## Running Locally (Optional)

```bash
# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Generate Prisma client
npm run db:generate

# Push database schema
npm run db:push

# Start development server
npm run dev
```

## Running Tests (Optional)

```bash
# Run tests once
npm test

# Run tests in watch mode
npm run test:watch
```
