import { PrismaClient } from "@prisma/client";

// Repeated local runs come from one IP and would trip the (correct) signup/login rate limits.
// Clear the counters so each run starts fresh. Never point E2E tests at a production database.
export default async function globalSetup() {
  const db = new PrismaClient();
  try {
    await db.rateLimit.deleteMany();
  } finally {
    await db.$disconnect();
  }
}
