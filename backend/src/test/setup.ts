// Test setup file
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Global test teardown
afterAll(async () => {
  await prisma.$disconnect();
});

// Suppress console logs in tests unless DEBUG is set
if (!process.env.DEBUG) {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}


