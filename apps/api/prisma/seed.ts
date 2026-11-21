// Run with `pnpm db:seed` (tsx). Keep decorators out of this import graph.
import path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { seedPlans } from '../src/plans/seed-plans';

loadDotenv({ path: path.resolve(__dirname, '../../../.env'), quiet: true });

const url = process.env['DATABASE_URL'];
if (!url) throw new Error('DATABASE_URL is not set');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
seedPlans(prisma)
  .then((count) => console.log(`seeded ${count} plans`))
  .finally(() => prisma.$disconnect());
