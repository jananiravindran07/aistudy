import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.DEMO_EMAIL ?? 'demo@capybarastudy.local').toLowerCase();
  const password = process.env.DEMO_PASSWORD ?? 'study-with-capybara';
  const hashedPassword = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: 'Study Pal',
      password: hashedPassword,
      carrots: 12,
      happiness: 60,
      capybaraState: { create: { carrots: 12, happiness: 60 } },
    },
  });

  console.log(`Demo account ready: ${email}`);
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());