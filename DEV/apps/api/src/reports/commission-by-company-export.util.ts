import ExcelJS from 'exceljs';
import type { CommissionByPersonRow, CommissionByLevelRow } from './reports.service';

const PERSON_HEADERS = ['Tên', 'Tổng doanh thu', 'Tổng đơn', 'Thành công', 'Huỷ', 'Hoa hồng'];
const LEVEL_HEADERS = ['Cấp hệ', 'Hoa hồng'];

const MONEY_FORMAT = '#,##0';

export async function buildCommissionByCompanyWorkbook(result: {
  personRows: CommissionByPersonRow[];
  levelRows: CommissionByLevelRow[];
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  const personSheet = workbook.addWorksheet('Theo người bán');
  personSheet.addRow(PERSON_HEADERS).font = { bold: true };

  let totalRevenue = 0;
  let totalOrders = 0;
  let successOrders = 0;
  let cancelledOrders = 0;
  let totalCommission = 0;

  for (const row of result.personRows) {
    personSheet.addRow([
      row.personName ?? row.sellerId,
      Number(row.revenue),
      row.totalOrders,
      row.successOrders,
      row.cancelledOrders,
      Number(row.totalCommission),
    ]);
    totalRevenue += Number(row.revenue);
    totalOrders += row.totalOrders;
    successOrders += row.successOrders;
    cancelledOrders += row.cancelledOrders;
    totalCommission += Number(row.totalCommission);
  }

  const personTotalsRow = personSheet.addRow([
    'Tổng cộng',
    totalRevenue,
    totalOrders,
    successOrders,
    cancelledOrders,
    totalCommission,
  ]);
  personTotalsRow.font = { bold: true };

  personSheet.getColumn(2).numFmt = MONEY_FORMAT;
  personSheet.getColumn(6).numFmt = MONEY_FORMAT;
  personSheet.columns.forEach((col) => {
    col.width = 22;
  });

  const levelSheet = workbook.addWorksheet('Theo cấp hệ');
  levelSheet.addRow(LEVEL_HEADERS).font = { bold: true };

  for (const row of result.levelRows) {
    levelSheet.addRow([row.levelName ?? `Cấp ${row.levelNo}`, Number(row.totalCommission)]);
  }

  levelSheet.getColumn(2).numFmt = MONEY_FORMAT;
  levelSheet.columns.forEach((col) => {
    col.width = 22;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
