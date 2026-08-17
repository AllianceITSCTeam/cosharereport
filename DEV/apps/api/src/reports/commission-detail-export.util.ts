import ExcelJS from 'exceljs';
import type { CommissionDetailRow, CommissionDetailSummary } from './reports.service';

/** Mirrors STATUS_LABEL in apps/web/src/pages/CommissionOrdersPage.tsx — kept in sync manually since FE/BE don't share code. */
const STATUS_LABEL: Record<number, string> = {
  0: 'Phiếu nháp',
  1: 'Đang xử lý',
  2: 'Thành công',
  3: 'Huỷ',
};

function statusLabel(status: number | null): string {
  if (status === null) return '—';
  return STATUS_LABEL[status] ?? String(status);
}

const HEADERS = [
  'Mã đơn',
  'Ngày đặt',
  'Người mua',
  'MSNV',
  'Người hưởng h.h',
  'Tổng tiền đơn',
  'Tổng tiền hoa hồng',
  'Trạng thái',
];

const MONEY_FORMAT = '#,##0';

export async function buildCommissionDetailWorkbook(result: {
  rows: CommissionDetailRow[];
  summary: CommissionDetailSummary;
  truncated: boolean;
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Đơn hàng');

  sheet.addRow(HEADERS).font = { bold: true };

  for (const row of result.rows) {
    sheet.addRow([
      row.orderCode ?? row.billId,
      row.orderDate ? new Date(row.orderDate).toLocaleString('vi-VN') : '—',
      row.buyerName ?? '—',
      row.msnv ?? '—',
      row.beneficiaryName ?? '—',
      Number(row.orderTotal),
      Number(row.commissionAmount),
      statusLabel(row.orderStatus),
    ]);
  }

  const totalsRow = sheet.addRow([
    `Tổng cộng (${result.summary.totalOrders} đơn — ${result.summary.successOrders} thành công, ${result.summary.cancelledOrders} huỷ)`,
    '',
    '',
    '',
    '',
    Number(result.summary.sumOrderTotal),
    Number(result.summary.sumCommission),
    '',
  ]);
  totalsRow.font = { bold: true };

  sheet.getColumn(6).numFmt = MONEY_FORMAT;
  sheet.getColumn(7).numFmt = MONEY_FORMAT;
  sheet.columns.forEach((col) => {
    col.width = 22;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
