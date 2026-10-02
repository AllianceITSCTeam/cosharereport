import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

/**
 * Xu hướng hoa hồng N tháng gần nhất, kết thúc tại `toMonth` (mặc định tháng hiện tại).
 * `months` mặc định 6 ở service, tối đa 12 (chốt với user 2026-10-02).
 */
export class CommissionTrendQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'toMonth must be in YYYY-MM format' })
  toMonth?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  months?: number;

  @IsOptional()
  @IsString()
  timezone?: string;
}
