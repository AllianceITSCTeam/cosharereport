import { IsDateString, IsOptional, IsString } from 'class-validator';

/** Dashboard — Tỷ lệ đơn thành công/huỷ trong 1 tháng. */
export class OrderStatusBreakdownQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}
