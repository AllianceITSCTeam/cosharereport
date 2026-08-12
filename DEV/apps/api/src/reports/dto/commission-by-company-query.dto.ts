import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * Screen 2 (Hoa hồng theo công ty) — companyId is REQUIRED: the screen shows
 * no data until a company is picked (Requirement §2.1). Shared by both
 * by-person (S2A) and by-level (S2B pie) endpoints.
 */
export class CommissionByCompanyQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  @IsString()
  @IsNotEmpty()
  companyId!: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}
