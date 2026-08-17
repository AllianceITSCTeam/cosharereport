import ExcelJS from 'exceljs';
import { buildCommissionDetailWorkbook } from './commission-detail-export.util';
import type { CommissionDetailRow, CommissionDetailSummary } from './reports.service';

describe('buildCommissionDetailWorkbook', () => {
  const rows: CommissionDetailRow[] = [
    {
      billId: '501',
      orderCode: 'ORD-501',
      orderDate: '2026-04-10T03:00:00.000Z',
      buyerName: 'Nguyễn Văn A',
      msnv: 'NV001',
      referrerName: 'Trần Thị B',
      beneficiaryName: 'Trần Thị B, Lê Văn C',
      orderTotal: '1000000',
      commissionAmount: '150000',
      orderStatus: 2,
    },
    {
      billId: '502',
      orderCode: 'ORD-502',
      orderDate: '2026-04-11T03:00:00.000Z',
      buyerName: 'Phạm Văn D',
      msnv: null,
      referrerName: null,
      beneficiaryName: null,
      orderTotal: '500000',
      commissionAmount: '0',
      orderStatus: 3,
    },
  ];

  const summary: CommissionDetailSummary = {
    totalOrders: 2,
    successOrders: 1,
    cancelledOrders: 1,
    sumOrderTotal: '1500000',
    sumCommission: '150000',
  };

  it('produces a workbook with a header row, one row per order, and a bold totals row — in the same column order as the on-screen table', async () => {
    const buffer = await buildCommissionDetailWorkbook({ rows, summary, truncated: false });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    const sheet = workbook.worksheets[0];

    expect(sheet.rowCount).toBe(1 + rows.length + 1); // header + data + totals

    const header = sheet.getRow(1).values as unknown[];
    expect(header.slice(1)).toEqual([
      'Mã đơn',
      'Ngày đặt',
      'Người mua',
      'MSNV',
      'Người hưởng h.h',
      'Tổng tiền đơn',
      'Tổng tiền hoa hồng',
      'Trạng thái',
    ]);

    const firstDataRow = sheet.getRow(2).values as unknown[];
    expect(firstDataRow[1]).toBe('ORD-501');
    expect(firstDataRow[4]).toBe('NV001');
    expect(firstDataRow[6]).toBe(1000000); // number, not a formatted string
    expect(firstDataRow[7]).toBe(150000);
    expect(firstDataRow[8]).toBe('Thành công');

    const secondDataRow = sheet.getRow(3).values as unknown[];
    expect(secondDataRow[4]).toBe('—'); // null msnv rendered as em-dash, matching the UI
    expect(secondDataRow[8]).toBe('Huỷ');

    const totalsRow = sheet.getRow(sheet.rowCount);
    expect(String(totalsRow.getCell(1).value)).toMatch(/Tổng cộng/);
    expect(totalsRow.getCell(6).value).toBe(1500000);
    expect(totalsRow.getCell(7).value).toBe(150000);
    expect(totalsRow.font?.bold).toBe(true);
  });

  it('produces just a header + zeroed totals row when there are no matching orders', async () => {
    const buffer = await buildCommissionDetailWorkbook({
      rows: [],
      summary: { totalOrders: 0, successOrders: 0, cancelledOrders: 0, sumOrderTotal: '0', sumCommission: '0' },
      truncated: false,
    });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    const sheet = workbook.worksheets[0];

    expect(sheet.rowCount).toBe(2); // header + totals only
  });
});
