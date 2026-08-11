import { IsDateString, IsOptional, IsString } from 'class-validator';

/**
 * Screen 1 (Hoa hồng tổng quan) has no company filter — only a date range.
 * `from`/`to` are local dates (YYYY-MM-DD) in the given timezone; see toUtcDateRange().
 */
export class CommissionOverviewQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}
