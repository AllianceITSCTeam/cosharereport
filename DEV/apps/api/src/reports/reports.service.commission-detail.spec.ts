import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReportsService } from './reports.service';

describe('ReportsService — Screen 3 (Báo cáo đơn hàng)', () => {
  let service: ReportsService;
  let queryRawMock: jest.Mock;

  beforeEach(async () => {
    queryRawMock = jest.fn();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: { $queryRaw: queryRawMock } },
      ],
    }).compile();

    service = moduleRef.get(ReportsService);
  });

  describe('commissionDetail', () => {
    it('rejects when from/to are missing', async () => {
      await expect(
        service.commissionDetail({ from: '', to: '' } as never),
      ).rejects.toThrow();
      expect(queryRawMock).not.toHaveBeenCalled();
    });

    it('rejects a non-numeric companyId instead of sending it to Postgres as text', async () => {
      await expect(
        service.commissionDetail({ from: '2026-04-01', to: '2026-04-30', companyId: 'abc' }),
      ).rejects.toThrow();
      expect(queryRawMock).not.toHaveBeenCalled();
    });

    it('rejects a non-numeric affiliateLevelId', async () => {
      await expect(
        service.commissionDetail({ from: '2026-04-01', to: '2026-04-30', affiliateLevelId: 'x' }),
      ).rejects.toThrow();
      expect(queryRawMock).not.toHaveBeenCalled();
    });

    it('rejects a non-numeric affiliateUserId', async () => {
      await expect(
        service.commissionDetail({ from: '2026-04-01', to: '2026-04-30', affiliateUserId: 'x' }),
      ).rejects.toThrow();
      expect(queryRawMock).not.toHaveBeenCalled();
    });

    it('runs a single readonly raw query (no companyId required — Screen 3 shows all companies by default)', async () => {
      queryRawMock.mockResolvedValue([]);

      await service.commissionDetail({ from: '2026-04-01', to: '2026-04-30' });

      expect(queryRawMock).toHaveBeenCalledTimes(1);
      const sqlArg = queryRawMock.mock.calls[0][0] as Prisma.Sql;
      expect(sqlArg.sql).not.toMatch(/\b(INSERT INTO|UPDATE\s+\w+\s+SET|DELETE FROM|CREATE TABLE|ALTER TABLE|DROP TABLE)\b/i);
      expect(sqlArg.sql).toMatch(/"MerchantBill"/);
    });

    it('grain guard — aggregates commission rows per MerchantBill via STRING_AGG + GROUP BY on the bill id (2026-08-12 decision: 1 row = 1 order, not 1 commission row)', async () => {
      const sqlArg = await buildSql(service);
      expect(sqlArg.sql).toMatch(/STRING_AGG/i);
      expect(sqlArg.sql).toMatch(/GROUP BY\s+c\."MerchantBillId"/i);
    });

    it('filters by productType using EXISTS on MerchantProduct.Code ILIKE ZALOOA (§4 chốt)', async () => {
      queryRawMock.mockResolvedValue([]);
      await service.commissionDetail({
        from: '2026-04-01',
        to: '2026-04-30',
        productType: 'NON_PHYSICAL',
      });
      const sqlArg = queryRawMock.mock.calls[0][0] as Prisma.Sql;
      expect(sqlArg.sql).toMatch(/EXISTS/i);
      expect(sqlArg.sql).toMatch(/ZALOOA/i);
    });

    it('filters by msnv via ConfigEmployee.EmployeeCode of the buyer (joined by UserLoginId, per CoShare correction 2026-08-12 — not Staff.StaffCode)', async () => {
      queryRawMock.mockResolvedValue([]);
      await service.commissionDetail({ from: '2026-04-01', to: '2026-04-30', msnv: 'NV001' });
      const sqlArg = queryRawMock.mock.calls[0][0] as Prisma.Sql;
      expect(sqlArg.sql).toMatch(/"ConfigEmployee"/);
      expect(sqlArg.sql).toMatch(/"UserLoginId"/);
      expect(sqlArg.values).toContain('NV001');
    });

    it('order_code comes from Order.OrderNumber via Order_MerchantBill_Mapping (per CoShare correction 2026-08-12 — not MerchantBill.OrderNumber)', async () => {
      const sqlArg = await buildSql(service);
      expect(sqlArg.sql).toMatch(/"Order_MerchantBill_Mapping"/);
      expect(sqlArg.sql).toMatch(/JOIN\s+dbo\."Order"\s+o\b/i);
    });

    it('paginates with LIMIT/OFFSET computed from page/pageSize', async () => {
      queryRawMock.mockResolvedValue([]);
      await service.commissionDetail({ from: '2026-04-01', to: '2026-04-30', page: 3, pageSize: 20 });
      const sqlArg = queryRawMock.mock.calls[0][0] as Prisma.Sql;
      expect(sqlArg.sql).toMatch(/LIMIT/i);
      expect(sqlArg.sql).toMatch(/OFFSET/i);
      expect(sqlArg.values).toContain(20);
      expect(sqlArg.values).toContain(40); // offset = (page-1)*pageSize = (3-1)*20
    });

    it('computes pagination total + summary in the SAME query via window functions (avoids a second round-trip that could apply filters inconsistently)', async () => {
      const sqlArg = await buildSql(service);
      expect(sqlArg.sql).toMatch(/OVER\s*\(/i);
    });

    it('maps BigInt/Decimal raw rows into JSON-safe plain values and derives summary + pagination from the window columns', async () => {
      queryRawMock.mockResolvedValue([
        {
          bill_id: 501n,
          order_code: 'ORD-501',
          order_date: new Date('2026-04-10T03:00:00.000Z'),
          buyer_name: 'Nguyễn Văn A',
          msnv: 'NV001',
          referrer_name: 'Trần Thị B',
          beneficiary_name: 'Trần Thị B, Lê Văn C',
          order_total: new Prisma.Decimal('1000000'),
          commission_amount: new Prisma.Decimal('150000'),
          order_status: 2,
          total_count: 1n,
          sum_order_total: new Prisma.Decimal('1000000'),
          sum_commission: new Prisma.Decimal('150000'),
          success_orders: 1n,
          cancelled_orders: 0n,
        },
      ]);

      const result = await service.commissionDetail({
        from: '2026-04-01',
        to: '2026-04-30',
        page: 1,
        pageSize: 50,
      });

      expect(result.rows).toEqual([
        {
          billId: '501',
          orderCode: 'ORD-501',
          orderDate: new Date('2026-04-10T03:00:00.000Z').toISOString(),
          buyerName: 'Nguyễn Văn A',
          msnv: 'NV001',
          referrerName: 'Trần Thị B',
          beneficiaryName: 'Trần Thị B, Lê Văn C',
          orderTotal: '1000000',
          commissionAmount: '150000',
          orderStatus: 2,
        },
      ]);
      expect(result.summary).toEqual({
        totalOrders: 1,
        successOrders: 1,
        cancelledOrders: 0,
        sumOrderTotal: '1000000',
        sumCommission: '150000',
      });
      expect(result.pagination).toEqual({ page: 1, pageSize: 50, totalCount: 1 });
    });

    it('returns a zeroed summary and empty rows when nothing matches (no window-function row to read from)', async () => {
      queryRawMock.mockResolvedValue([]);

      const result = await service.commissionDetail({
        from: '2026-04-01',
        to: '2026-04-30',
        page: 1,
        pageSize: 50,
      });

      expect(result.rows).toEqual([]);
      expect(result.summary).toEqual({
        totalOrders: 0,
        successOrders: 0,
        cancelledOrders: 0,
        sumOrderTotal: '0',
        sumCommission: '0',
      });
      expect(result.pagination).toEqual({ page: 1, pageSize: 50, totalCount: 0 });
    });

    async function buildSql(svc: ReportsService): Promise<Prisma.Sql> {
      queryRawMock.mockResolvedValue([]);
      await svc.commissionDetail({ from: '2026-04-01', to: '2026-04-30' });
      return queryRawMock.mock.calls[queryRawMock.mock.calls.length - 1][0] as Prisma.Sql;
    }
  });

  describe('commissionDetailExport', () => {
    it('rejects when from/to are missing', async () => {
      await expect(
        service.commissionDetailExport({ from: '', to: '' } as never),
      ).rejects.toThrow();
      expect(queryRawMock).not.toHaveBeenCalled();
    });

    it('runs an unpaginated query capped at 50000 rows — not the page/pageSize LIMIT/OFFSET used by commissionDetail', async () => {
      queryRawMock.mockResolvedValue([]);
      await service.commissionDetailExport({ from: '2026-04-01', to: '2026-04-30' });

      expect(queryRawMock).toHaveBeenCalledTimes(1);
      const sqlArg = queryRawMock.mock.calls[0][0] as Prisma.Sql;
      expect(sqlArg.sql).toMatch(/LIMIT/i);
      expect(sqlArg.sql).not.toMatch(/OFFSET/i);
      expect(sqlArg.values).toContain(50000);
    });

    it('applies the exact same filter conditions as commissionDetail (companyId/productType/msnv/keyword) — the two must never drift', async () => {
      queryRawMock.mockResolvedValue([]);
      await service.commissionDetailExport({
        from: '2026-04-01',
        to: '2026-04-30',
        companyId: '4',
        productType: 'NON_PHYSICAL',
        msnv: 'NV001',
      });
      const exportSql = queryRawMock.mock.calls[0][0] as Prisma.Sql;

      queryRawMock.mockClear();
      queryRawMock.mockResolvedValue([]);
      await service.commissionDetail({
        from: '2026-04-01',
        to: '2026-04-30',
        companyId: '4',
        productType: 'NON_PHYSICAL',
        msnv: 'NV001',
        page: 1,
        pageSize: 50000,
      });
      const detailSql = queryRawMock.mock.calls[0][0] as Prisma.Sql;

      // Both queries build their WHERE clause from the same filter conditions — the CTE bodies
      // (commission_agg/filtered) are identical text; only the outer LIMIT/OFFSET differs.
      const stripLimitOffset = (sql: string) => sql.replace(/LIMIT\s+\S+(\s+OFFSET\s+\S+)?\s*$/i, '');
      expect(stripLimitOffset(exportSql.sql).trim()).toBe(stripLimitOffset(detailSql.sql).trim());
    });

    it('flags truncated:true when the filtered set exceeds the 50000-row export cap', async () => {
      queryRawMock.mockResolvedValue([
        {
          bill_id: 1n,
          order_code: 'ORD-1',
          order_date: new Date('2026-04-10T03:00:00.000Z'),
          buyer_name: 'A',
          msnv: null,
          referrer_name: null,
          beneficiary_name: null,
          order_total: new Prisma.Decimal('100'),
          commission_amount: new Prisma.Decimal('0'),
          order_status: 1,
          total_count: 50001n,
          sum_order_total: new Prisma.Decimal('100'),
          sum_commission: new Prisma.Decimal('0'),
          success_orders: 0n,
          cancelled_orders: 0n,
        },
      ]);

      const result = await service.commissionDetailExport({ from: '2026-04-01', to: '2026-04-30' });
      expect(result.truncated).toBe(true);
    });

    it('flags truncated:false when the filtered set is within the export cap', async () => {
      queryRawMock.mockResolvedValue([]);

      const result = await service.commissionDetailExport({ from: '2026-04-01', to: '2026-04-30' });
      expect(result.truncated).toBe(false);
    });
  });

  describe('commissionDetailItems', () => {
    it('rejects a non-numeric billId', async () => {
      await expect(service.commissionDetailItems('abc')).rejects.toThrow();
      expect(queryRawMock).not.toHaveBeenCalled();
    });

    it('maps Decimal rows into JSON-safe plain values, ordered by OrderNo', async () => {
      queryRawMock.mockResolvedValue([
        {
          item_name: 'Áo thun',
          quantity: new Prisma.Decimal('2'),
          unit_price: new Prisma.Decimal('150000'),
          line_total: new Prisma.Decimal('300000'),
        },
      ]);

      const result = await service.commissionDetailItems('501');

      expect(queryRawMock).toHaveBeenCalledTimes(1);
      const sqlArg = queryRawMock.mock.calls[0][0] as Prisma.Sql;
      expect(sqlArg.sql).toMatch(/"MerchantBillDetail"/);
      expect(sqlArg.sql).toMatch(/OrderNo/);
      expect(result).toEqual([
        { itemName: 'Áo thun', quantity: '2', unitPrice: '150000', lineTotal: '300000' },
      ]);
    });
  });

  describe('commissionLevels', () => {
    it('lists ConfigAffiliateLevel options', async () => {
      queryRawMock.mockResolvedValue([
        { id: 1n, level_no: 1, name: 'Đại sứ' },
        { id: 2n, level_no: 2, name: 'Đồng hành' },
      ]);

      const result = await service.commissionLevels();

      const sqlArg = queryRawMock.mock.calls[0][0] as Prisma.Sql;
      expect(sqlArg.sql).toMatch(/"ConfigAffiliateLevel"/);
      expect(result).toEqual([
        { id: '1', levelNo: 1, name: 'Đại sứ' },
        { id: '2', levelNo: 2, name: 'Đồng hành' },
      ]);
    });
  });

  describe('commissionBeneficiaries', () => {
    it('rejects a non-numeric companyId', async () => {
      await expect(
        service.commissionBeneficiaries({ from: '2026-04-01', to: '2026-04-30', companyId: 'abc' }),
      ).rejects.toThrow();
      expect(queryRawMock).not.toHaveBeenCalled();
    });

    it('lists distinct beneficiaries (AffiliateUserId) within the date range, optionally scoped by company', async () => {
      queryRawMock.mockResolvedValue([{ id: 10n, name: 'Trần Thị B' }]);

      const result = await service.commissionBeneficiaries({
        from: '2026-04-01',
        to: '2026-04-30',
        companyId: '4',
      });

      const sqlArg = queryRawMock.mock.calls[0][0] as Prisma.Sql;
      expect(sqlArg.sql).toMatch(/"MerchantBillCommission"/);
      expect(sqlArg.sql).toMatch(/AffiliateUserId/);
      expect(sqlArg.values).toContain(4n);
      expect(result).toEqual([{ id: '10', name: 'Trần Thị B' }]);
    });
  });
});
