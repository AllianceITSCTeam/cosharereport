import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
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
}
