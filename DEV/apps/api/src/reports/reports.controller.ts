import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
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

  /** Screen 1 — Hoa hồng tổng quan: gom theo Công ty, không có filter công ty. */
  @Get('commission/overview')
  commissionOverview(@Query() query: CommissionOverviewQueryDto) {
    return this.reportsService.commissionOverview(query);
  }
}
