import ExcelJS from 'exceljs';
import { buildCommissionByCompanyWorkbook } from './commission-by-company-export.util';
import type { CommissionByPersonRow, CommissionByLevelRow } from './reports.service';

describe('buildCommissionByCompanyWorkbook', () => {
  const personRows: CommissionByPersonRow[] = [
    {
      sellerId: '10',
      personName: 'Nguyễn Văn A',
      revenue: '1000000',
      totalOrders: 10,
      successOrders: 8,
      cancelledOrders: 2,
      totalCommission: '150000',
    },
    {
      sellerId: '11',
      personName: null,
      revenue: '200000',
      totalOrders: 2,
      successOrders: 2,
      cancelledOrders: 0,
      totalCommission: '0',
    },
  ];

  const levelRows: CommissionByLevelRow[] = [
    { levelNo: 1, levelName: 'Đại sứ', totalCommission: '100000' },
    { levelNo: 2, levelName: null, totalCommission: '50000' },
  ];

  it('produces a workbook with a "Theo người bán" sheet (rows + bold totals row) and a "Theo cấp hệ" sheet', async () => {
    const buffer = await buildCommissionByCompanyWorkbook({ personRows, levelRows });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

    const personSheet = workbook.getWorksheet('Theo người bán')!;
    expect(personSheet.rowCount).toBe(1 + personRows.length + 1);

    const header = personSheet.getRow(1).values as unknown[];
    expect(header.slice(1)).toEqual(['Tên', 'Tổng doanh thu', 'Tổng đơn', 'Thành công', 'Huỷ', 'Hoa hồng']);

    const firstDataRow = personSheet.getRow(2).values as unknown[];
    expect(firstDataRow[1]).toBe('Nguyễn Văn A');
    expect(firstDataRow[2]).toBe(1000000);

    const secondDataRow = personSheet.getRow(3).values as unknown[];
    expect(secondDataRow[1]).toBe('11'); // null personName falls back to sellerId, matches UI

    const totalsRow = personSheet.getRow(personSheet.rowCount);
    expect(totalsRow.getCell(1).value).toBe('Tổng cộng');
    expect(totalsRow.getCell(2).value).toBe(1200000);
    expect(totalsRow.getCell(6).value).toBe(150000);
    expect(totalsRow.font?.bold).toBe(true);

    const levelSheet = workbook.getWorksheet('Theo cấp hệ')!;
    expect(levelSheet.rowCount).toBe(1 + levelRows.length);
    const levelHeader = levelSheet.getRow(1).values as unknown[];
    expect(levelHeader.slice(1)).toEqual(['Cấp hệ', 'Hoa hồng']);
    expect(levelSheet.getRow(2).getCell(1).value).toBe('Đại sứ');
    expect(levelSheet.getRow(2).getCell(2).value).toBe(100000);
    expect(levelSheet.getRow(3).getCell(1).value).toBe('Cấp 2'); // null levelName fallback, matches UI
  });

  it('produces just header + zeroed totals when there is no data', async () => {
    const buffer = await buildCommissionByCompanyWorkbook({ personRows: [], levelRows: [] });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

    const personSheet = workbook.getWorksheet('Theo người bán')!;
    expect(personSheet.rowCount).toBe(2);
    expect(personSheet.getRow(2).getCell(2).value).toBe(0);

    const levelSheet = workbook.getWorksheet('Theo cấp hệ')!;
    expect(levelSheet.rowCount).toBe(1);
  });
});
