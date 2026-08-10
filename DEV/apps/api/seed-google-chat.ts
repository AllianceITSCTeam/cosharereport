import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const webhookUrl = process.env.GOOGLE_CHAT_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error('✗ GOOGLE_CHAT_WEBHOOK_URL env variable is not set. Aborting.');
    process.exit(1);
  }

  await prisma.systemSetting.upsert({
    where: { key: 'notification.google_chat_webhook' },
    update: {
      value: webhookUrl,
      description: 'Google Chat incoming webhook URL for system alerts',
      logUpdatedBy: 'seed',
    },
    create: {
      key: 'notification.google_chat_webhook',
      value: webhookUrl,
      description: 'Google Chat incoming webhook URL for system alerts',
      category: 'notifications',
      logUpdatedBy: 'seed',
    },
  });
  console.log('✓ Google Chat webhook URL saved to SystemSetting');
}

main()
  .catch((e) => { console.error('✗ Error:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
