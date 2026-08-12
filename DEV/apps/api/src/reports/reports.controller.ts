import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CommissionByCompanyQueryDto } from './dto/commission-by-company-query.dto';
import {
  CommissionBeneficiariesQueryDto,
  CommissionDetailQueryDto,
} from './dto/commission-detail-query.dto';
import { CommissionOverviewQueryDto } from './dto/commission-overview-query.dto';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /** Sample endpoint proving the readonly DB connection works end-to-end. */
  @Get('ping')
  ping() {
    return this.reportsService.ping();
  }

  @Get('latest-users')
  latestUsers() {
    return this.reportsService.latestUsers();
  }

  /** Danh sách công ty cho selector Screen 2 (loại soft-deleted). */
  @Get('companies')
  companies() {
    return this.reportsService.companies();
  }

  /** Screen 1 — Hoa hồng tổng quan: gom theo Công ty, không có filter công ty. */
  @Get('commission/overview')
  commissionOverview(@Query() query: CommissionOverviewQueryDto) {
    return this.reportsService.commissionOverview(query);
  }

  /** Screen 2A — Hoa hồng theo công ty: drill-down theo người bán. Bắt buộc companyId. */
  @Get('commission/by-person')
  commissionByPerson(@Query() query: CommissionByCompanyQueryDto) {
    return this.reportsService.commissionByPerson(query);
  }

  /** Screen 2B — biểu đồ tròn hoa hồng theo cấp hệ, trong 1 công ty. Bắt buộc companyId. */
  @Get('commission/by-level')
  commissionByLevel(@Query() query: CommissionByCompanyQueryDto) {
    return this.reportsService.commissionByLevel(query);
  }

  /** Screen 3 — Báo cáo đơn hàng: danh sách chi tiết đơn, phân trang, có dòng summary. */
  @Get('commission/detail')
  commissionDetail(@Query() query: CommissionDetailQueryDto) {
    return this.reportsService.commissionDetail(query);
  }

  /** Screen 3 — expander "▸": mặt hàng của 1 đơn. */
  @Get('commission/detail/:billId/items')
  commissionDetailItems(@Param('billId') billId: string) {
    return this.reportsService.commissionDetailItems(billId);
  }

  /** Danh sách cấp hệ hoa hồng cho filter "Cấp hệ hoa hồng" ở Screen 3. */
  @Get('commission/levels')
  commissionLevels() {
    return this.reportsService.commissionLevels();
  }

  /** Danh sách người hưởng hoa hồng cho filter "Người hưởng hoa hồng" ở Screen 3. */
  @Get('commission/beneficiaries')
  commissionBeneficiaries(@Query() query: CommissionBeneficiariesQueryDto) {
    return this.reportsService.commissionBeneficiaries(query);
  }
}
