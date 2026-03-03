import { beforeAll, afterEach } from 'vitest';
import { config as dotenvConfig } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import fs from 'fs';

// Load the .env.test file
dotenvConfig({ path: '.env.test' });

const TEST_DB_PATH = './test.db';
const TEST_DB_JOURNAL = './test.db-journal';

async function resetDatabase() {
  const prisma = new PrismaClient();
  
  try {
    // Delete all data in order (respecting foreign key constraints)
    await prisma.$transaction([
      prisma.bookmarkTag.deleteMany(),
      prisma.bookmark.deleteMany(),
      prisma.tag.deleteMany(),
      prisma.user.deleteMany(),
    ]);
  } finally {
    await prisma.$disconnect();
  }
}

async function initializeDatabase() {
  // Remove existing test database files if they exist
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
  if (fs.existsSync(TEST_DB_JOURNAL)) {
    fs.unlinkSync(TEST_DB_JOURNAL);
  }

  // Run migrations on the test database
  try {
    execSync('npm run db:deploy', {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: `file:./${TEST_DB_PATH}` },
      stdio: 'ignore',
    });
  } catch (error) {
    console.error('Failed to run migrations:', error);
    throw error;
  }
}

// Initialize the test database before running any tests
beforeAll(async () => {
  await initializeDatabase();
});

// Clean up the database after each test suite
afterEach(async () => {
  await resetDatabase();
});
