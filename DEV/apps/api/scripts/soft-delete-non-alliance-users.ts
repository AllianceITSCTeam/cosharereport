/**
 * Soft-delete tất cả user, chỉ giữ:
 *   - superadmin (UserLogin.username = 'superadmin' hoặc Staff có role SUPER_ADMIN)
 *   - Staff thuộc Department có name = 'Alliance Vietnam' (case-insensitive)
 *
 * Phạm vi: Staff, StaffRole, UserLogin.
 *
 * Usage:
 *   pnpm tsx apps/api/scripts/soft-delete-non-alliance-users.ts            # dry-run
 *   pnpm tsx apps/api/scripts/soft-delete-non-alliance-users.ts --apply    # thực thi
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY (sẽ ghi DB)' : 'DRY-RUN (chỉ in)'}\n`);

  // 1. Departments tên "Alliance Vietnam" (case-insensitive), chưa bị xóa
  const allianceDepts = await prisma.department.findMany({
    where: {
      name: { equals: 'Alliance Vietnam', mode: 'insensitive' },
      isDeleted: false,
    },
    select: { id: true, name: true, companyId: true },
  });

  console.log(`Alliance Vietnam departments (${allianceDepts.length}):`);
  for (const d of allianceDepts) {
    console.log(`  - ${d.id}  company=${d.companyId}  name="${d.name}"`);
  }
  console.log('');

  const allianceDeptIds = allianceDepts.map((d) => d.id);

  // 2. Staff giữ lại = thuộc Alliance Vietnam OR có role SUPER_ADMIN OR userLogin.username='superadmin'
  const keepStaff = await prisma.staff.findMany({
    where: {
      isDeleted: false,
      OR: [
        { departmentId: { in: allianceDeptIds } },
        { staffRoles: { some: { role: { name: 'SUPER_ADMIN' }, isDeleted: false } } },
        { userLogin: { username: 'superadmin' } },
      ],
    },
    select: {
      id: true,
      employeeId: true,
      firstName: true,
      surname: true,
      departmentId: true,
      userLoginId: true,
      userLogin: { select: { username: true } },
    },
  });

  const keepStaffIds = new Set(keepStaff.map((s) => s.id));
  const keepUserLoginIds = new Set(
    keepStaff.map((s) => s.userLoginId).filter((x): x is string => !!x),
  );

  console.log(`Staff GIỮ LẠI (${keepStaff.length}):`);
  for (const s of keepStaff) {
    const tag = s.departmentId && allianceDeptIds.includes(s.departmentId)
      ? '[Alliance]'
      : s.userLogin?.username === 'superadmin'
        ? '[superadmin]'
        : '[SUPER_ADMIN role]';
    console.log(`  ${tag} ${s.employeeId}  ${s.firstName} ${s.surname}  user=${s.userLogin?.username ?? '-'}`);
  }
  console.log('');

  // 3. Tìm UserLogin cần giữ thêm: username='superadmin' (phòng trường hợp không link staff)
  const superadminLogin = await prisma.userLogin.findFirst({
    where: { username: 'superadmin', isDeleted: false },
    select: { id: true, username: true },
  });
  if (superadminLogin) keepUserLoginIds.add(superadminLogin.id);

  // 4. Đếm những bản ghi sẽ bị soft-delete
  const staffToDelete = await prisma.staff.findMany({
    where: { isDeleted: false, id: { notIn: [...keepStaffIds] } },
    select: { id: true, userLoginId: true, employeeId: true, firstName: true, surname: true },
  });

  const userLoginsToDelete = await prisma.userLogin.findMany({
    where: {
      isDeleted: false,
      id: { notIn: [...keepUserLoginIds] },
    },
    select: { id: true, username: true },
  });

  const staffRoleCount = await prisma.staffRole.count({
    where: {
      isDeleted: false,
      staffId: { in: staffToDelete.map((s) => s.id) },
    },
  });

  console.log(`SẼ SOFT-DELETE:`);
  console.log(`  Staff:     ${staffToDelete.length}`);
  console.log(`  StaffRole: ${staffRoleCount}`);
  console.log(`  UserLogin: ${userLoginsToDelete.length}\n`);

  if (staffToDelete.length <= 50) {
    console.log('Staff sẽ xóa:');
    for (const s of staffToDelete) {
      console.log(`  - ${s.employeeId}  ${s.firstName} ${s.surname}`);
    }
    console.log('');
  }
  if (userLoginsToDelete.length <= 50) {
    console.log('UserLogin sẽ xóa:');
    for (const u of userLoginsToDelete) {
      console.log(`  - ${u.username}`);
    }
    console.log('');
  }

  if (!APPLY) {
    console.log('Dry-run xong. Chạy lại với --apply để thực thi.');
    return;
  }

  // 5. Apply trong transaction
  console.log('APPLYING...');
  const now = new Date();
  const actor = 'script:soft-delete-non-alliance-users';

  const result = await prisma.$transaction(async (tx) => {
    const staffRoleRes = await tx.staffRole.updateMany({
      where: {
        isDeleted: false,
        staffId: { in: staffToDelete.map((s) => s.id) },
      },
      data: { isDeleted: true, logUpdatedAt: now, logUpdatedBy: actor },
    });

    const staffRes = await tx.staff.updateMany({
      where: { id: { in: staffToDelete.map((s) => s.id) } },
      data: { isDeleted: true, logUpdatedAt: now, logUpdatedBy: actor },
    });

    const userLoginRes = await tx.userLogin.updateMany({
      where: { id: { in: userLoginsToDelete.map((u) => u.id) } },
      data: { isDeleted: true, logUpdatedAt: now, logUpdatedBy: actor },
    });

    return { staffRoleRes, staffRes, userLoginRes };
  });

  console.log(`Soft-deleted:`);
  console.log(`  StaffRole: ${result.staffRoleRes.count}`);
  console.log(`  Staff:     ${result.staffRes.count}`);
  console.log(`  UserLogin: ${result.userLoginRes.count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
