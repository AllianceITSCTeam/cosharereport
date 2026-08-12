import { IsDateString, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Screen 3 (Báo cáo đơn hàng) — companyId/affiliateLevelId/affiliateUserId are all OPTIONAL
 * (unlike Screen 2's companyId): the screen shows all orders by default, filters only narrow.
 * page/pageSize have no default here — the service defaults them (1/50) so validation and
 * defaulting don't drift apart.
 */
export class CommissionDetailQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  @IsOptional()
  @IsString()
  companyId?: string;

  @IsOptional()
  @IsString()
  affiliateLevelId?: string;

  @IsOptional()
  @IsString()
  affiliateUserId?: string;

  @IsOptional()
  @IsString()
  msnv?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  statusBill?: number;

  @IsOptional()
  @IsIn(['PHYSICAL', 'NON_PHYSICAL'])
  productType?: 'PHYSICAL' | 'NON_PHYSICAL';

  @IsOptional()
  @IsString()
  keyword?: string;

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
  @IsString()
  timezone?: string;
}

export class CommissionBeneficiariesQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  @IsOptional()
  @IsString()
  companyId?: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}
