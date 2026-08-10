import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Today in UTC+7 (Vietnam) — covers a client-local "today"
  // Use a 36h window starting from yesterday 17:00 UTC to catch all of 2026-04-18 local
  const nowUtc = new Date();
  const from = new Date(nowUtc);
  from.setUTCHours(from.getUTCHours() - 24);
  const to = new Date(nowUtc);
  to.setUTCHours(to.getUTCHours() + 1);

  const staffRoles = await prisma.staffRole.findMany({
    where: { role: { name: 'SUPER_ADMIN' }, isDeleted: false },
    select: {
      staffId: true,
      staff: {
        select: {
          firstName: true,
          surname: true,
          userLogin: { select: { username: true } },
        },
      },
    },
  });

  console.log(`SUPER_ADMIN count: ${staffRoles.length}`);
  console.log(`Window: ${from.toISOString()}  →  ${to.toISOString()}`);

  for (const sr of staffRoles) {
    const name = sr.staff?.userLogin?.username ?? sr.staffId;

    // Counts summary
    const [total, loginRows, supersededLogin, nonSuperLogin, openRows, nonLoginOpen] = await Promise.all([
      prisma.timeTracking.count({
        where: { staffId: sr.staffId, startTime: { gte: from, lt: to } },
      }),
      prisma.timeTracking.count({
        where: { staffId: sr.staffId, isLoginStatus: true, startTime: { gte: from, lt: to } },
      }),
      prisma.timeTracking.count({
        where: {
          staffId: sr.staffId,
          isLoginStatus: true,
          isSuperseded: true,
          startTime: { gte: from, lt: to },
        },
      }),
      prisma.timeTracking.count({
        where: {
          staffId: sr.staffId,
          isLoginStatus: true,
          isSuperseded: false,
          startTime: { gte: from, lt: to },
        },
      }),
      prisma.timeTracking.count({
        where: { staffId: sr.staffId, endTime: null, isDeleted: false },
      }),
      prisma.timeTracking.count({
        where: {
          staffId: sr.staffId,
          endTime: null,
          isDeleted: false,
          isLoginStatus: false,
          isSuperseded: false,
        },
      }),
    ]);

    console.log(`\n==== ${name} ====`);
    console.log(`  Rows in window: ${total}`);
    console.log(`  Login rows:          ${loginRows}`);
    console.log(`    - superseded=true:   ${supersededLogin}`);
    console.log(`    - superseded=false:  ${nonSuperLogin}`);
    console.log(`  Open rows (all-time, not deleted): ${openRows}`);
    console.log(`    - non-login open (blocks new login from being fresh): ${nonLoginOpen}`);

    // Show earliest row OVERALL in the window (to see what the very first activity was)
    const firstRows = await prisma.timeTracking.findMany({
      where: { staffId: sr.staffId, startTime: { gte: from, lt: to } },
      orderBy: { startTime: 'asc' },
      take: 5,
      select: {
        id: true,
        startTime: true,
        endTime: true,
        isLoginStatus: true,
        isSuperseded: true,
        isDeleted: true,
        notes: true,
        logCreatedBy: true,
        status: { select: { name: true } },
      },
    });

    console.log(`\n  FIRST 5 rows in window (any type):`);
    for (const r of firstRows) {
      const start = r.startTime.toISOString();
      const end = r.endTime ? r.endTime.toISOString() : 'OPEN';
      console.log(
        `    ${start} → ${end}  status="${r.status.name}"  login=${r.isLoginStatus}  superseded=${r.isSuperseded}  deleted=${r.isDeleted}  notes="${r.notes ?? ''}"`,
      );
    }

    // Show the absolute FIRST LOGIN of the window (what user asks about)
    const firstLogin = await prisma.timeTracking.findFirst({
      where: {
        staffId: sr.staffId,
        isLoginStatus: true,
        startTime: { gte: from, lt: to },
      },
      orderBy: { startTime: 'asc' },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        isSuperseded: true,
        isDeleted: true,
        notes: true,
        logCreatedBy: true,
      },
    });

    console.log(`\n  FIRST login row in window:`);
    if (!firstLogin) {
      console.log(`    (none)`);
    } else {
      console.log(
        `    ${firstLogin.startTime.toISOString()} → ${firstLogin.endTime?.toISOString() ?? 'OPEN'}  superseded=${firstLogin.isSuperseded}  deleted=${firstLogin.isDeleted}  notes="${firstLogin.notes}"`,
      );

      // What rows existed BEFORE this first login, still open, not-superseded, not-deleted?
      const blockers = await prisma.timeTracking.findMany({
        where: {
          staffId: sr.staffId,
          isSuperseded: false,
          endTime: null,
          isDeleted: false,
          startTime: { lt: firstLogin.startTime },
        },
        orderBy: { startTime: 'asc' },
        select: {
          id: true,
          startTime: true,
          isLoginStatus: true,
          notes: true,
          status: { select: { name: true } },
        },
      });

      console.log(`\n  Open/non-superseded rows BEFORE first login (these caused superseded=true):`);
      if (blockers.length === 0) {
        console.log(`    (none — so superseded=true would be a BUG)`);
      } else {
        for (const b of blockers) {
          console.log(
            `    ${b.startTime.toISOString()}  status="${b.status.name}"  login=${b.isLoginStatus}  notes="${b.notes ?? ''}"  id=${b.id}`,
          );
        }
      }
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
