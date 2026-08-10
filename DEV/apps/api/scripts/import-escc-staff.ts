/**
 * Import 94 ESCC staff từ docs/ESCC Staff list for VIBE Testing.xlsx
 *
 * Strategy:
 *  - Lookup Staff theo `employeeId` (kể cả đã soft-delete)
 *  - Nếu tồn tại → RESTORE (un-delete) + UPDATE (client/team/position/note) + reset password
 *  - Nếu không tồn tại → CREATE mới
 *  - SKIP nếu username/email trùng với ACTIVE record (isDeleted=false) thuộc employeeId khác
 *
 * Modes:
 *   ts-node --transpile-only scripts/import-escc-staff.ts                 # discovery
 *   ts-node --transpile-only scripts/import-escc-staff.ts --dry-run       # dry-run
 *   ts-node --transpile-only scripts/import-escc-staff.ts --apply         # apply (1 transaction)
 */
import { PrismaClient } from '@prisma/client';
import { uuidv7 } from 'uuidv7';
import * as bcrypt from 'bcrypt';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

const prisma = new PrismaClient();
const MODE = process.argv.includes('--apply')
  ? 'apply'
  : process.argv.includes('--dry-run')
    ? 'dry-run'
    : 'discovery';

const ACTOR = 'script:import-escc-staff';
const PASSWORD_PLAIN = 'Welcome@123';
const EMAIL_PLACEHOLDER_DOMAIN = 'noemail.local';
const EXCEL_PATH = path.resolve(
  __dirname,
  '../../../../docs/ESCC Staff list for VIBE Testing.xlsx',
);
const DISCOVERY_OUT = path.resolve(__dirname, '../../../../docs/import-escc-discovery.json');
const RESULT_OUT = path.resolve(__dirname, '../../../../docs/import-escc-result.csv');

type Row = {
  employeeId: string;
  firstName: string;
  middleName: string | null;
  surname: string;
  clientName: string;
  jobTitle: string;
  teamName: string;
  managerName: string;
  dateStartedRaw: any;
  email: string | null;
  username: string;
};

function normSpace(v: any): string {
  return (v ?? '').toString().replace(/\s+/g, ' ').trim();
}

function readRows(): Row[] {
  const wb = XLSX.readFile(EXCEL_PATH);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const all = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: null });
  const rows: Row[] = [];
  for (let i = 3; i < all.length; i++) {
    const r = all[i];
    if (!r || !r[0]) continue;
    const emailRaw = normSpace(r[9]);
    rows.push({
      employeeId: normSpace(r[0]),
      firstName: normSpace(r[1]),
      middleName: normSpace(r[2]) || null,
      surname: normSpace(r[3]),
      clientName: normSpace(r[4]),
      jobTitle: normSpace(r[5]),
      teamName: normSpace(r[6]),
      managerName: normSpace(r[7]),
      dateStartedRaw: r[8],
      email: emailRaw && emailRaw !== '-' ? emailRaw : null,
      username: normSpace(r[10]),
    });
  }
  return rows;
}

function slug(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
}

async function main() {
  console.log(`Mode: ${MODE.toUpperCase()}\n`);

  const rows = readRows();
  console.log(`Read ${rows.length} rows from Excel\n`);

  // ── 1. ESCC company
  const companies = await prisma.company.findMany({
    where: {
      isDeleted: false,
      OR: [
        { name: { contains: 'Ezy', mode: 'insensitive' } },
        { name: { contains: 'ESCC', mode: 'insensitive' } },
        { code: { equals: 'ESCC', mode: 'insensitive' } },
        { code: { equals: 'ESC', mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, code: true },
  });
  if (companies.length !== 1) {
    console.error('Cần đúng 1 ESCC company, found:', companies);
    process.exit(1);
  }
  const company = companies[0];
  console.log(`ESCC company: ${company.id}  name="${company.name}"  code="${company.code}"\n`);

  // ── 2. Role EMPLOYEE
  const employeeRole = await prisma.role.findFirst({
    where: { name: 'EMPLOYEE', isDeleted: false },
    select: { id: true },
  });
  if (!employeeRole) {
    console.error('Không tìm thấy role EMPLOYEE.');
    process.exit(1);
  }

  // ── 3. Lookup tables
  const clientNames = [...new Set(rows.map((r) => r.clientName).filter(Boolean))];
  const teamNames = [...new Set(rows.map((r) => r.teamName).filter(Boolean))];
  const positionNames = [...new Set(rows.map((r) => r.jobTitle).filter(Boolean))];

  const existingClients = await prisma.businessClient.findMany({
    where: { isDeleted: false, name: { in: clientNames, mode: 'insensitive' } },
    select: { id: true, name: true },
  });
  const clientByLower = new Map(existingClients.map((c) => [c.name.toLowerCase(), c.id]));

  const existingTeams = await prisma.team.findMany({
    where: { isDeleted: false, companyId: company.id, name: { in: teamNames, mode: 'insensitive' } },
    select: { id: true, name: true },
  });
  const teamByLower = new Map(existingTeams.map((t) => [t.name.toLowerCase(), t.id]));

  const existingPositions = await prisma.position.findMany({
    where: { isDeleted: false, companyId: company.id, name: { in: positionNames, mode: 'insensitive' } },
    select: { id: true, name: true },
  });
  const positionByLower = new Map(existingPositions.map((p) => [p.name.toLowerCase(), p.id]));

  const clientsToCreate = clientNames.filter((n) => !clientByLower.has(n.toLowerCase()));
  const teamsToCreate = teamNames.filter((n) => !teamByLower.has(n.toLowerCase()));
  const positionsToCreate = positionNames.filter((n) => !positionByLower.has(n.toLowerCase()));

  console.log(`Client Name: ${clientNames.length} distinct → ${existingClients.length} existing, ${clientsToCreate.length} to create`);
  console.log(`Team Name:   ${teamNames.length} distinct → ${existingTeams.length} existing, ${teamsToCreate.length} to create`);
  console.log(`Position:    ${positionNames.length} distinct → ${existingPositions.length} existing, ${positionsToCreate.length} to create\n`);

  // ── 4. Resolve action cho từng row
  const employeeIds = rows.map((r) => r.employeeId);
  const existingStaff = await prisma.staff.findMany({
    where: { employeeId: { in: employeeIds } },
    select: {
      id: true,
      employeeId: true,
      isDeleted: true,
      userLoginId: true,
      userLogin: { select: { id: true, username: true, isDeleted: true } },
    },
  });
  const staffByEmpId = new Map(existingStaff.map((s) => [s.employeeId, s]));

  type Action =
    | { kind: 'RESTORE'; row: Row; staffId: string; userLoginId: string | null; finalEmail: string }
    | { kind: 'CREATE'; row: Row; finalEmail: string }
    | { kind: 'SKIP'; row: Row; reason: string; finalEmail: string };

  const actions: Action[] = [];

  // Lấy active UserLogin & Staff conflict (loại trừ những employeeId trong list)
  const usernames = rows.map((r) => r.username);
  const emails = rows.map((r) => r.email).filter((e): e is string => !!e);

  const conflictUsers = await prisma.userLogin.findMany({
    where: { isDeleted: false, username: { in: usernames } },
    select: { id: true, username: true, staff: { select: { employeeId: true } } },
  });
  const conflictEmails = await prisma.staff.findMany({
    where: { isDeleted: false, companyEmailAddress: { in: emails } },
    select: { companyEmailAddress: true, employeeId: true },
  });
  const activeUsernameOwner = new Map(
    conflictUsers.map((u) => [u.username.toLowerCase(), u.staff?.employeeId ?? null]),
  );
  const activeEmailOwner = new Map(
    conflictEmails.map((s) => [s.companyEmailAddress!.toLowerCase(), s.employeeId]),
  );

  for (const r of rows) {
    const finalEmail = r.email ?? `${r.username}@${EMAIL_PLACEHOLDER_DOMAIN}`;
    const existing = staffByEmpId.get(r.employeeId);

    if (existing) {
      actions.push({
        kind: 'RESTORE',
        row: r,
        staffId: existing.id,
        userLoginId: existing.userLoginId,
        finalEmail,
      });
      continue;
    }

    // Check username/email collision với staff khác (active)
    const ownerU = activeUsernameOwner.get(r.username.toLowerCase());
    if (ownerU && ownerU !== r.employeeId) {
      actions.push({
        kind: 'SKIP',
        row: r,
        reason: `username ${r.username} đang active ở staff ${ownerU}`,
        finalEmail,
      });
      continue;
    }
    const ownerE = activeEmailOwner.get(finalEmail.toLowerCase());
    if (ownerE && ownerE !== r.employeeId) {
      actions.push({
        kind: 'SKIP',
        row: r,
        reason: `email ${finalEmail} đang active ở staff ${ownerE}`,
        finalEmail,
      });
      continue;
    }
    actions.push({ kind: 'CREATE', row: r, finalEmail });
  }

  const restores = actions.filter((a) => a.kind === 'RESTORE');
  const creates = actions.filter((a) => a.kind === 'CREATE');
  const skips = actions.filter((a) => a.kind === 'SKIP');
  const placeholders = actions.filter((a) => a.kind !== 'SKIP' && !a.row.email);

  console.log(`Action: ${restores.length} RESTORE, ${creates.length} CREATE, ${skips.length} SKIP`);
  console.log(`(${placeholders.length} dùng email placeholder)\n`);

  if (skips.length) {
    console.log('SKIP:');
    for (const s of skips as Extract<Action, { kind: 'SKIP' }>[]) {
      console.log(`  - ${s.row.employeeId} ${s.row.firstName} ${s.row.surname} — ${s.reason}`);
    }
    console.log('');
  }

  if (MODE === 'discovery') {
    fs.writeFileSync(
      DISCOVERY_OUT,
      JSON.stringify(
        {
          company,
          employeeRole,
          clientsToCreate,
          teamsToCreate,
          positionsToCreate,
          restoreCount: restores.length,
          createCount: creates.length,
          skipCount: skips.length,
          skips: (skips as Extract<Action, { kind: 'SKIP' }>[]).map((s) => ({ employeeId: s.row.employeeId, reason: s.reason })),
        },
        null,
        2,
      ),
    );
    console.log(`Discovery → ${DISCOVERY_OUT}`);
    return;
  }

  if (MODE === 'dry-run') {
    console.log('Sample 3 RESTORE:');
    for (const a of restores.slice(0, 3) as Extract<Action, { kind: 'RESTORE' }>[]) {
      console.log(`  ${a.row.employeeId} ${a.row.firstName} ${a.row.surname} → staffId=${a.staffId} userLoginId=${a.userLoginId}`);
    }
    console.log('\nSample 5 CREATE:');
    for (const a of creates.slice(0, 5) as Extract<Action, { kind: 'CREATE' }>[]) {
      console.log(`  ${a.row.employeeId} ${a.row.firstName} ${a.row.surname} username=${a.row.username} email=${a.finalEmail}`);
    }
    console.log('\nChạy lại với --apply để thực thi.');
    return;
  }

  // ── APPLY
  console.log('APPLYING...\n');
  const passwordHash = await bcrypt.hash(PASSWORD_PLAIN, 10);
  const now = new Date();
  const resultRows: string[] = ['employeeId,username,email,password,action'];

  await prisma.$transaction(
    async (tx) => {
      // Create lookups
      for (const name of clientsToCreate) {
        const id = uuidv7();
        await tx.businessClient.create({
          data: { id, name, code: slug(name), logCreatedBy: ACTOR, logUpdatedAt: now },
        });
        clientByLower.set(name.toLowerCase(), id);
      }
      for (const name of teamsToCreate) {
        const id = uuidv7();
        await tx.team.create({
          data: { id, companyId: company.id, name, logCreatedBy: ACTOR, logUpdatedAt: now },
        });
        teamByLower.set(name.toLowerCase(), id);
      }
      for (const name of positionsToCreate) {
        const id = uuidv7();
        await tx.position.create({
          data: { id, companyId: company.id, name, logCreatedBy: ACTOR, logUpdatedAt: now },
        });
        positionByLower.set(name.toLowerCase(), id);
      }

      let restoredCnt = 0;
      let createdCnt = 0;

      for (const a of actions) {
        if (a.kind === 'SKIP') {
          resultRows.push([a.row.employeeId, a.row.username, a.row.email ?? '-', '-', `SKIP: ${a.reason}`].join(','));
          continue;
        }
        const r = a.row;
        const clientId = clientByLower.get(r.clientName.toLowerCase()) ?? null;
        const teamId = teamByLower.get(r.teamName.toLowerCase()) ?? null;
        const positionId = positionByLower.get(r.jobTitle.toLowerCase()) ?? null;
        const note = `Manager: ${r.managerName || '-'}; DateStarted (Excel): ${r.dateStartedRaw ?? '-'}`;

        if (a.kind === 'RESTORE') {
          // Update + un-delete Staff
          await tx.staff.update({
            where: { id: a.staffId },
            data: {
              isDeleted: false,
              firstName: r.firstName,
              middleName: r.middleName,
              surname: r.surname,
              companyEmailAddress: a.finalEmail,
              companyId: company.id,
              clientId,
              teamId,
              positionId,
              note,
              logUpdatedAt: now,
              logUpdatedBy: ACTOR,
            },
          });

          // Restore/create UserLogin
          let userLoginId = a.userLoginId;
          if (userLoginId) {
            await tx.userLogin.update({
              where: { id: userLoginId },
              data: {
                isDeleted: false,
                username: r.username,
                email: a.finalEmail,
                passwordHash,
                isFirstLogin: true,
                isActive: true,
                logUpdatedAt: now,
                logUpdatedBy: ACTOR,
              },
            });
          } else {
            userLoginId = uuidv7();
            await tx.userLogin.create({
              data: {
                id: userLoginId,
                username: r.username,
                email: a.finalEmail,
                passwordHash,
                isFirstLogin: true,
                isActive: true,
                logCreatedBy: ACTOR,
                logUpdatedAt: now,
              },
            });
            await tx.staff.update({
              where: { id: a.staffId },
              data: { userLoginId, logUpdatedAt: now, logUpdatedBy: ACTOR },
            });
          }

          // Restore/create StaffRole = EMPLOYEE
          const existingRole = await tx.staffRole.findFirst({
            where: { staffId: a.staffId, roleId: employeeRole.id },
            select: { id: true, isDeleted: true },
          });
          if (existingRole) {
            if (existingRole.isDeleted) {
              await tx.staffRole.update({
                where: { id: existingRole.id },
                data: { isDeleted: false, logUpdatedAt: now, logUpdatedBy: ACTOR },
              });
            }
          } else {
            await tx.staffRole.create({
              data: {
                id: uuidv7(),
                staffId: a.staffId,
                roleId: employeeRole.id,
                logCreatedBy: ACTOR,
                logUpdatedAt: now,
              },
            });
          }

          restoredCnt++;
          resultRows.push([r.employeeId, r.username, a.finalEmail, PASSWORD_PLAIN, 'RESTORE'].join(','));
        } else {
          // CREATE
          const userLoginId = uuidv7();
          const staffId = uuidv7();
          await tx.userLogin.create({
            data: {
              id: userLoginId,
              username: r.username,
              email: a.finalEmail,
              passwordHash,
              isFirstLogin: true,
              isActive: true,
              logCreatedBy: ACTOR,
              logUpdatedAt: now,
            },
          });
          await tx.staff.create({
            data: {
              id: staffId,
              userLoginId,
              employeeId: r.employeeId,
              companyId: company.id,
              clientId,
              teamId,
              positionId,
              firstName: r.firstName,
              middleName: r.middleName,
              surname: r.surname,
              companyEmailAddress: a.finalEmail,
              note,
              logCreatedBy: ACTOR,
              logUpdatedAt: now,
            },
          });
          await tx.staffRole.create({
            data: {
              id: uuidv7(),
              staffId,
              roleId: employeeRole.id,
              logCreatedBy: ACTOR,
              logUpdatedAt: now,
            },
          });
          createdCnt++;
          resultRows.push([r.employeeId, r.username, a.finalEmail, PASSWORD_PLAIN, 'CREATE'].join(','));
        }
      }

      console.log(`Restored: ${restoredCnt}, Created: ${createdCnt}, Skipped: ${skips.length}`);
    },
    { timeout: 180_000 },
  );

  fs.writeFileSync(RESULT_OUT, resultRows.join('\n'));
  console.log(`\nResult CSV: ${RESULT_OUT}`);
  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
