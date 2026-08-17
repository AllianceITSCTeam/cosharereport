import ExcelJS from 'exceljs';
import { buildCommissionOverviewWorkbook } from './commission-overview-export.util';
import type { CommissionOverviewRow } from './reports.service';

describe('buildCommissionOverviewWorkbook', () => {
  const rows: CommissionOverviewRow[] = [
    {
      companyId: '1',
      companyName: 'Công ty A',
      revenue: '1000000',
      totalOrders: 10,
      successOrders: 8,
      cancelledOrders: 2,
      totalCommission: '150000',
    },
    {
      companyId: null,
      companyName: null,
      revenue: '500000',
      totalOrders: 5,
      successOrders: 5,
      cancelledOrders: 0,
      totalCommission: '0',
    },
  ];

  it('produces a workbook with header, one row per company, and a bold totals row summed across all rows', async () => {
    const buffer = await buildCommissionOverviewWorkbook(rows);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    const sheet = workbook.worksheets[0];

    expect(sheet.rowCount).toBe(1 + rows.length + 1); // header + data + totals

    const header = sheet.getRow(1).values as unknown[];
    expect(header.slice(1)).toEqual(['Cty', 'Doanh thu', 'Tổng đơn', 'Thành công', 'Huỷ', 'Hoa hồng']);

    const firstDataRow = sheet.getRow(2).values as unknown[];
    expect(firstDataRow[1]).toBe('Công ty A');
    expect(firstDataRow[2]).toBe(1000000); // number, not formatted string

    const secondDataRow = sheet.getRow(3).values as unknown[];
    expect(secondDataRow[1]).toBe('Không xác định'); // null company name fallback, matches UI

    const totalsRow = sheet.getRow(sheet.rowCount);
    expect(totalsRow.getCell(1).value).toBe('Tổng cộng');
    expect(totalsRow.getCell(2).value).toBe(1500000);
    expect(totalsRow.getCell(3).value).toBe(15);
    expect(totalsRow.getCell(4).value).toBe(13);
    expect(totalsRow.getCell(5).value).toBe(2);
    expect(totalsRow.getCell(6).value).toBe(150000);
    expect(totalsRow.font?.bold).toBe(true);
  });

  it('produces just a header + zeroed totals row when there is no data', async () => {
    const buffer = await buildCommissionOverviewWorkbook([]);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    const sheet = workbook.worksheets[0];

    expect(sheet.rowCount).toBe(2); // header + totals only
    expect(sheet.getRow(2).getCell(2).value).toBe(0);
  });
});
