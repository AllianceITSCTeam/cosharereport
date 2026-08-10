import { PrismaClient } from '@prisma/client';
import { uuidv7 } from 'uuidv7';

const prisma = new PrismaClient();

async function main() {
  const vibes = [
    { name: 'Frown', color: '#FB8D06', svg: `<circle cx="12" cy="12" r="10"/><path d="M16 16s-1.5-2-4-2-4 2-4 2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/>` },
    { name: 'Meh', color: '#EAEC09', svg: `<circle cx="12" cy="12" r="10"/><line x1="8" x2="16" y1="15" y2="15"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/>` },
    { name: 'Smile', color: '#68E836', svg: `<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/>` },
    { name: 'Laugh', color: '#149C00', svg: `<circle cx="12" cy="12" r="10"/><path d="M18 13a6 6 0 0 1-6 5 6 6 0 0 1-6-5h12Z"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/>` },
    { name: 'Angry', color: '#FD0101', svg: `<circle cx="12" cy="12" r="10"/><path d="M16 16s-1.5-2-4-2-4 2-4 2"/><path d="M7.5 8 10 9"/><path d="m14 9 2.5-1"/><line x1="9" x2="9.01" y1="10" y2="10"/><line x1="15" x2="15.01" y1="10" y2="10"/>` }
  ];

  for (let i = 0; i < vibes.length; i++) {
    const v = vibes[i];
    const rawSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${v.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${v.svg}</svg>`;
    const iconUrl = `data:image/svg+xml;base64,${Buffer.from(rawSvg).toString('base64')}`;
    
    // Instead of deleting, just find if a VIBEIcon with this name exists
    const existing = await prisma.vIBEIcons.findFirst({
        where: { name: v.name }
    });

    if (existing) {
        await prisma.vIBEIcons.update({
            where: { id: existing.id },
            data: { iconUrl, orderNo: i + 1 }
        });
    } else {
        await prisma.vIBEIcons.create({
            data: {
              id: uuidv7(),
              name: v.name,
              iconUrl: iconUrl,
              orderNo: i + 1,
            }
        });
    }
  }

  console.log("Successfully seeded/updated VIBEIcons!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
