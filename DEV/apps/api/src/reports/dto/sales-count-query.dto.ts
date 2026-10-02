import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

/**
 * Thống kê lượt bán — toàn bộ sản phẩm trong khoảng ngày lọc, "lượt bán" = SUM(Quantity)
 * của các dòng MerchantBillDetail thuộc đơn StatusBill=2 (Thành công) (chốt với user 2026-10-01).
 * page/pageSize/sortBy/sortDir có default ở service (1/50/salesCount/desc) để tránh lệch với validation.
 */
export class SalesCountQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  groupProductId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;

  @IsOptional()
  @IsIn(['salesCount', 'code', 'name'])
  sortBy?: 'salesCount' | 'code' | 'name';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc';
}
