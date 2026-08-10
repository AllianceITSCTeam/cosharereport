/**
 * Update Office + shift fields cho 94 ESCC staff.
 * Match theo employeeId. Source: docs/ESCC Staff list for VIBE Testing - with shift schedule.xlsx
 *
 * Modes:
 *   ts-node --transpile-only scripts/update-escc-shifts.ts
 *   ts-node --transpile-only scripts/update-escc-shifts.ts --dry-run
 *   ts-node --transpile-only scripts/update-escc-shifts.ts --apply
 */
import { PrismaClient } from '@prisma/client';
import { uuidv7 } from 'uuidv7';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

const prisma = new PrismaClient();
const MODE = process.argv.includes('--apply')
  ? 'apply'
  : process.argv.includes('--dry-run')
    ? 'dry-run'
    : 'discovery';

const ACTOR = 'script:import-escc-shifts';
const TIMEZONE = 'Asia/Manila';
const COUNTRY = 'Philippines';
const EXCEL_PATH = path.resolve(
  __dirname,
  '../../../../docs/ESCC Staff list for VIBE Testing - with shift schedule.xlsx',
);
const RESULT_OUT = path.resolve(__dirname, '../../../../docs/import-escc-shifts-result.csv');

const OFFICE_DEFS: Array<{ name: string; code: string }> = [
  { name: 'Manila, 20F', code: 'MNL_20F' },
  { name: 'Manila, 15F', code: 'MNL_15F' },
  { name: 'Hybrid, 20F', code: 'HYB_20F' },
  { name: 'Hybrid, 15F', code: 'HYB_15F' },
  { name: 'WFH', code: 'WFH' },
];

type Row = {
  employeeId: string;
  officeName: string;
  shiftStart: string | null;
  shiftEnd: string | null;
  latestStart: string | null;
  latestEnd: string | null;
  dayOffset: number;
};

function norm(v: any): string {
  return (v ?? '').toString().replace(/\s+/g, ' ').trim();
}

function pad2(n: number) {
  return n.toString().padStart(2, '0');
}

function fracToHHMM(f: any): string | null {
  if (f == null || f === '') return null;
  const num = Number(f);
  if (!isFinite(num)) return null;
  const mins = Math.round(num * 1440);
  const hh = Math.floor(mins / 60) % 24;
  const mm = mins % 60;
  return `${pad2(hh)}:${pad2(mm)}`;
}

function readRows(): Row[] {
  const wb = XLSX.readFile(EXCEL_PATH);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const all = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: null });
  const out: Row[] = [];
  for (let i = 3; i < all.length; i++) {
    const r = all[i];
    if (!r || !r[0]) continue;
    const start = fracToHHMM(r[12]);
    const end = fracToHHMM(r[13]);
    let dayOffset = 0;
    if (start && end) {
      const [sh, sm] = start.split(':').map(Number);
      const [eh, em] = end.split(':').map(Number);
      if (eh * 60 + em < sh * 60 + sm) dayOffset = 1;
    }
    out.push({
      employeeId: norm(r[0]),
      officeName: norm(r[11]),
      shiftStart: start,
      shiftEnd: end,
      latestStart: fracToHHMM(r[14]),
      latestEnd: fracToHHMM(r[15]),
      dayOffset,
    });
  }
  return out;
}

async function main() {
  console.log(`Mode: ${MODE.toUpperCase()}\n`);
  const rows = readRows();
  console.log(`Read ${rows.length} rows from Excel\n`);

  // ── 1. Company
  const company = await prisma.company.findFirst({
    where: { isDeleted: false, code: 'ESC' },
    select: { id: true, name: true },
  });
  if (!company) {
    console.error('Không tìm thấy ESCC company.');
    process.exit(1);
  }
  console.log(`ESCC: ${company.id} ${company.name}\n`);

  // ── 2. Office lookup
  const existingOffices = await prisma.office.findMany({
    where: { companyId: company.id, isDeleted: false },
    select: { id: true, name: true },
  });
  const officeByLower = new Map(existingOffices.map((o) => [o.name.toLowerCase(), o.id]));
  const officesToCreate = OFFICE_DEFS.filter((d) => !officeByLower.has(d.name.toLowerCase()));
  console.log(`Office: ${existingOffices.length} existing, ${officesToCreate.length} to create`);
  for (const o of officesToCreate) console.log(`  + ${o.name} (${o.code})`);
  console.log('');

  // ── 3. Match staff
  const employeeIds = rows.map((r) => r.employeeId);
  const staffList = await prisma.staff.findMany({
    where: { isDeleted: false, employeeId: { in: employeeIds }, companyId: company.id },
    select: { id: true, employeeId: true },
  });
  const staffByEmpId = new Map(staffList.map((s) => [s.employeeId, s.id]));

  const matched = rows.filter((r) => staffByEmpId.has(r.employeeId));
  const unmatched = rows.filter((r) => !staffByEmpId.has(r.employeeId));
  const skipShift = rows.filter((r) => !r.shiftStart || !r.shiftEnd);

  console.log(`Staff match: ${matched.length}/${rows.length}`);
  if (unmatched.length) {
    console.log('Unmatched:');
    for (const u of unmatched) console.log(`  - ${u.employeeId}`);
  }
  console.log(`Rows skip shift (thiếu data, vẫn update office): ${skipShift.length}`);
  for (const r of skipShift) console.log(`  - ${r.employeeId} office="${r.officeName}"`);
  console.log('');

  if (MODE === 'discovery') {
    console.log('Sample 3 row sẽ update:');
    for (const r of matched.slice(0, 3)) {
      console.log(`  ${r.employeeId} office="${r.officeName}" ${r.shiftStart}-${r.shiftEnd} latest=${r.latestStart}-${r.latestEnd} offset=${r.dayOffset}`);
    }
    console.log('\nNext: --dry-run hoặc --apply');
    return;
  }

  if (MODE === 'dry-run') {
    console.log('Sample 5 actions:');
    for (const r of matched.slice(0, 5)) {
      console.log(`  ${r.employeeId} → office="${r.officeName}" ${r.shiftStart}-${r.shiftEnd} latest=${r.latestStart}-${r.latestEnd} offset=${r.dayOffset}`);
    }
    console.log(`\nTotal updates: ${matched.length} staff, ${officesToCreate.length} office mới`);
    console.log('Chạy lại với --apply để thực thi.');
    return;
  }

  // ── APPLY
  console.log('APPLYING...\n');
  const now = new Date();
  const resultRows = ['employeeId,office,shiftStart,shiftEnd,latestStart,latestEnd,dayOffset,status'];

  await prisma.$transaction(
    async (tx) => {
      // Create offices
      for (const o of officesToCreate) {
        const id = uuidv7();
        await tx.office.create({
          data: {
            id,
            companyId: company.id,
            name: o.name,
            code: o.code,
            timezone: TIMEZONE,
            country: COUNTRY,
            logCreatedBy: ACTOR,
            logUpdatedAt: now,
          },
        });
        officeByLower.set(o.name.toLowerCase(), id);
      }

      let updated = 0;
      for (const r of rows) {
        const staffId = staffByEmpId.get(r.employeeId);
        if (!staffId) {
          resultRows.push([r.employeeId, r.officeName, '', '', '', '', '', 'SKIP: staff not found'].join(','));
          continue;
        }
        const officeId = officeByLower.get(r.officeName.toLowerCase()) ?? null;
        const data: any = {
          officeId,
          timezone: TIMEZONE,
          logUpdatedAt: now,
          logUpdatedBy: ACTOR,
        };
        const hasShift = r.shiftStart && r.shiftEnd;
        if (hasShift) {
          data.shiftStartTime = r.shiftStart;
          data.shiftEndTime = r.shiftEnd;
          data.latestStartTime = r.latestStart;
          data.latestEndShiftTime = r.latestEnd;
          data.shiftEndDayOffset = r.dayOffset;
        }
        await tx.staff.update({ where: { id: staffId }, data });
        updated++;
        resultRows.push(
          [
            r.employeeId,
            r.officeName,
            r.shiftStart ?? '',
            r.shiftEnd ?? '',
            r.latestStart ?? '',
            r.latestEnd ?? '',
            r.dayOffset.toString(),
            hasShift ? 'UPDATE_ALL' : 'UPDATE_OFFICE_ONLY',
          ].join(','),
        );
      }
      console.log(`Updated ${updated} staff, created ${officesToCreate.length} offices`);
    },
    { timeout: 120_000 },
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
