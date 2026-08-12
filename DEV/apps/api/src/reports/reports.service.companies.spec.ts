import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReportsService } from './reports.service';

describe('ReportsService.companies (danh sách công ty cho selector Screen 2)', () => {
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

  it('runs a single readonly query against Company, excluding soft-deleted rows', async () => {
    queryRawMock.mockResolvedValue([]);

    await service.companies();

    expect(queryRawMock).toHaveBeenCalledTimes(1);
    const sqlArg = queryRawMock.mock.calls[0][0] as Prisma.Sql;
    expect(sqlArg.sql).not.toMatch(/\b(INSERT INTO|UPDATE\s+\w+\s+SET|DELETE FROM|CREATE TABLE|ALTER TABLE|DROP TABLE)\b/i);
    expect(sqlArg.sql).toMatch(/"Company"/);
    expect(sqlArg.sql).toMatch(/"IsDeleted"\s*=\s*false/i);
  });

  it('maps rows into JSON-safe id/name pairs, falling back ShortName -> Name -> Code', async () => {
    queryRawMock.mockResolvedValue([
      { id: 1n, name: 'CoShare' },
      { id: 5n, name: 'Parkerizing' },
    ]);

    const result = await service.companies();

    expect(result).toEqual([
      { id: '1', name: 'CoShare' },
      { id: '5', name: 'Parkerizing' },
    ]);
  });
});
