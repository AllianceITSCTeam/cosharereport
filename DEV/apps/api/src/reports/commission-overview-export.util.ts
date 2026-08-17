import ExcelJS from 'exceljs';
import type { CommissionOverviewRow } from './reports.service';

/** Mirrors UNKNOWN_COMPANY_LABEL in apps/web/src/pages/CommissionOverviewPage.tsx. */
const UNKNOWN_COMPANY_LABEL = 'Không xác định';

const HEADERS = ['Cty', 'Doanh thu', 'Tổng đơn', 'Thành công', 'Huỷ', 'Hoa hồng'];

const MONEY_FORMAT = '#,##0';

export async function buildCommissionOverviewWorkbook(rows: CommissionOverviewRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Hoa hồng tổng quan');

  sheet.addRow(HEADERS).font = { bold: true };

  let totalRevenue = 0;
  let totalOrders = 0;
  let successOrders = 0;
  let cancelledOrders = 0;
  let totalCommission = 0;

  for (const row of rows) {
    sheet.addRow([
      row.companyName ?? UNKNOWN_COMPANY_LABEL,
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

  const totalsRow = sheet.addRow([
    'Tổng cộng',
    totalRevenue,
    totalOrders,
    successOrders,
    cancelledOrders,
    totalCommission,
  ]);
  totalsRow.font = { bold: true };

  sheet.getColumn(2).numFmt = MONEY_FORMAT;
  sheet.getColumn(6).numFmt = MONEY_FORMAT;
  sheet.columns.forEach((col) => {
    col.width = 22;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
