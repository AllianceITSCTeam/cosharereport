import { IsOptional, IsString, Matches } from 'class-validator';

/**
 * Top 5 CTV theo hoa hồng trong 1 tháng — mặc định tháng hiện tại (server tự xác định)
 * nếu không truyền `month`, cho phép FE chọn tháng khác để xem lại.
 */
export class DashboardTopCtvQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'month must be in YYYY-MM format' })
  month?: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}
