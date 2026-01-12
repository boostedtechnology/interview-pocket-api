# Boosted Pocket API

A bookmark management service API built with Fastify and Prisma.

## Context

This codebase was developed by a small team (2 engineers) to power a bookmarking app, Pocket.
The service currently handles approximately 1,000 daily active users and is being considered for acquisition by a larger company with potential expansion to 100k+ users.

## Your Task

**Time:** 30-60 minutes (review only - no need to build or run the project, unless you want)

Please review this codebase and prepare to discuss the following in our conversation:

1. **What would you improve first, and why?**
   Consider: impact, effort, risk

2. **What trade-offs do you think were made?**
   Consider: speed vs quality, simplicity vs extensibility

3. **Where might this break at scale or in production?**
   Consider: 100k users, high write volume, edge cases

4. **What questions would you ask before making changes?**
   Consider: product context, team constraints, priorities

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
