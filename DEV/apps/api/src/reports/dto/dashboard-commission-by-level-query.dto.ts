import { IsDateString, IsOptional, IsString } from 'class-validator';

/**
 * Dashboard — Hoa hồng theo cấp hệ TOÀN HỆ THỐNG (không companyId, khác
 * CommissionByCompanyQueryDto của Screen 2B vốn bắt buộc chọn công ty).
 */
export class DashboardCommissionByLevelQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}
