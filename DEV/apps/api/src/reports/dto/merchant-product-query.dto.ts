import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

/**
 * Hàng hóa trên website — không có khoảng ngày, chỉ lọc theo mã/tên/nhóm/trạng thái.
 * page/pageSize có default ở service (1/50) để tránh lệch với validation.
 */
export class MerchantProductQueryDto {
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
  @IsIn(['SELLING', 'OUT_OF_STOCK', 'HIDDEN'])
  status?: 'SELLING' | 'OUT_OF_STOCK' | 'HIDDEN';

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
}
