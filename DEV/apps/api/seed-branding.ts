import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.systemSetting.upsert({
    where: { key: 'APP_LOGO_BASE64' },
    update: {},
    create: {
      key: 'APP_LOGO_BASE64',
      value: '',
      category: 'branding',
      description: 'Base64 encoded string for the application logo. Leave blank for default.',
    },
  });

  await prisma.systemSetting.upsert({
    where: { key: 'APP_FAVICON_BASE64' },
    update: {},
    create: {
      key: 'APP_FAVICON_BASE64',
      value: '',
      category: 'branding',
      description: 'Base64 encoded string for the application favicon. Leave blank for default.',
    },
  });

  console.log('Seeded branding settings setup.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
