/**
 * Re-sync Shift End + shiftEndDayOffset cho ESCC staff từ Excel sau khi user sửa data.
 * Chỉ update những staff có Shift End (hoặc dayOffset suy ra) KHÁC với DB hiện tại.
 *
 * Modes:
 *   ts-node --transpile-only scripts/fix-escc-shift-end.ts            # dry-run (default)
 *   ts-node --transpile-only scripts/fix-escc-shift-end.ts --apply
 */
import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const ACTOR = 'script:fix-escc-shift-end';
const EXCEL_PATH = path.resolve(
  __dirname,
  '../../../../docs/ESCC Staff list for VIBE Testing - with shift schedule.xlsx',
);
const RESULT_OUT = path.resolve(__dirname, '../../../../docs/fix-escc-shift-end-result.csv');

type Row = {
  employeeId: string;
  shiftStart: string | null;
  shiftEnd: string | null;
  dayOffset: number;
};

function pad2(n: number) {
  return n.toString().padStart(2, '0');
}

function norm(v: any): string {
  return (v ?? '').toString().replace(/\s+/g, ' ').trim();
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
      shiftStart: start,
      shiftEnd: end,
      dayOffset,
    });
  }
  return out;
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}\n`);
  const rows = readRows();
  console.log(`Read ${rows.length} rows from Excel\n`);

  const company = await prisma.company.findFirst({
    where: { isDeleted: false, code: 'ESC' },
    select: { id: true, name: true },
  });
  if (!company) {
    console.error('Không tìm thấy ESCC company.');
    process.exit(1);
  }

  const employeeIds = rows.map((r) => r.employeeId);
  const staffList = await prisma.staff.findMany({
    where: { isDeleted: false, employeeId: { in: employeeIds }, companyId: company.id },
    select: {
      id: true,
      employeeId: true,
      firstName: true,
      surname: true,
      shiftStartTime: true,
      shiftEndTime: true,
      shiftEndDayOffset: true,
    },
  });
  const staffByEmpId = new Map(staffList.map((s) => [s.employeeId, s]));

  type Diff = {
    employeeId: string;
    name: string;
    staffId: string;
    oldEnd: string | null;
    newEnd: string;
    oldOffset: number;
    newOffset: number;
  };
  const diffs: Diff[] = [];
  const skipNoShift: string[] = [];
  const notFound: string[] = [];

  for (const r of rows) {
    const s = staffByEmpId.get(r.employeeId);
    if (!s) {
      notFound.push(r.employeeId);
      continue;
    }
    if (!r.shiftEnd) {
      skipNoShift.push(r.employeeId);
      continue;
    }
    const oldEnd = s.shiftEndTime ?? null;
    const oldOffset = s.shiftEndDayOffset ?? 0;
    if (oldEnd !== r.shiftEnd || oldOffset !== r.dayOffset) {
      diffs.push({
        employeeId: r.employeeId,
        name: `${s.firstName} ${s.surname}`,
        staffId: s.id,
        oldEnd,
        newEnd: r.shiftEnd,
        oldOffset,
        newOffset: r.dayOffset,
      });
    }
  }

  console.log(`Staff matched: ${staffList.length}/${rows.length}`);
  if (notFound.length) console.log(`Not found: ${notFound.join(', ')}`);
  if (skipNoShift.length) console.log(`Skip (no shift end in Excel): ${skipNoShift.join(', ')}`);
  console.log(`\nDifferences: ${diffs.length}\n`);

  for (const d of diffs) {
    console.log(
      `  ${d.employeeId} ${d.name}: end ${d.oldEnd ?? '-'} → ${d.newEnd}, offset ${d.oldOffset} → ${d.newOffset}`,
    );
  }

  if (!diffs.length) {
    console.log('\nKhông có thay đổi. Done.');
    return;
  }

  if (!APPLY) {
    console.log('\nChạy lại với --apply để thực thi.');
    return;
  }

  console.log('\nAPPLYING...\n');
  const now = new Date();
  const resultRows = ['employeeId,name,oldEnd,newEnd,oldOffset,newOffset'];

  await prisma.$transaction(
    async (tx) => {
      for (const d of diffs) {
        await tx.staff.update({
          where: { id: d.staffId },
          data: {
            shiftEndTime: d.newEnd,
            shiftEndDayOffset: d.newOffset,
            logUpdatedAt: now,
            logUpdatedBy: ACTOR,
          },
        });
        resultRows.push(
          [d.employeeId, d.name, d.oldEnd ?? '', d.newEnd, d.oldOffset, d.newOffset].join(','),
        );
      }
      console.log(`Updated ${diffs.length} staff`);
    },
    { timeout: 60_000 },
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
