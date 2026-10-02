import { IsOptional, IsString, Matches } from 'class-validator';

/**
 * Top 5 CTV theo số người giới thiệu trực tiếp (Level=2) trong 1 tháng — lọc theo JoinDate
 * của người được giới thiệu (chốt 2026-09-09, xem docs/requirements/ctv-referral/). Mặc định
 * tháng hiện tại nếu không truyền `month`.
 */
export class DashboardCtvReferralQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'month must be in YYYY-MM format' })
  month?: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}
