import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { buildCommissionByCompanyWorkbook } from './commission-by-company-export.util';
import { buildCommissionDetailWorkbook } from './commission-detail-export.util';
import { buildCommissionOverviewWorkbook } from './commission-overview-export.util';
import { CommissionByCompanyQueryDto } from './dto/commission-by-company-query.dto';
import {
  CommissionBeneficiariesQueryDto,
  CommissionDetailQueryDto,
} from './dto/commission-detail-query.dto';
import { CommissionOverviewQueryDto } from './dto/commission-overview-query.dto';
import { CommissionTrendQueryDto } from './dto/commission-trend-query.dto';
import { DashboardCommissionByLevelQueryDto } from './dto/dashboard-commission-by-level-query.dto';
import { DashboardCtvReferralQueryDto } from './dto/dashboard-ctv-referral-query.dto';
import { DashboardTopCtvQueryDto } from './dto/dashboard-ctv-query.dto';
import { MerchantProductQueryDto } from './dto/merchant-product-query.dto';
import { OrderStatusBreakdownQueryDto } from './dto/order-status-breakdown-query.dto';
import { SalesCountQueryDto } from './dto/sales-count-query.dto';
import { TopGroupProductsQueryDto } from './dto/top-group-products-query.dto';
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

  /** Screen 1 — Xuất Excel: toàn bộ dòng đang hiển thị (đã gom theo Công ty, không phân trang). */
  @Get('commission/overview/export')
  async commissionOverviewExport(@Query() query: CommissionOverviewQueryDto, @Res() res: Response) {
    const rows = await this.reportsService.commissionOverview(query);
    const buffer = await buildCommissionOverviewWorkbook(rows);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="hoa-hong-tong-quan-${Date.now()}.xlsx"`,
    );
    res.send(buffer);
  }

  /** Dashboard — Xu hướng doanh thu & hoa hồng N tháng gần nhất (mặc định 6, tối đa 12). */
  @Get('commission/trend')
  commissionTrend(@Query() query: CommissionTrendQueryDto) {
    return this.reportsService.commissionTrend(query);
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

  /** Screen 2 — Xuất Excel: 2 sheet "Theo người bán" (2A) + "Theo cấp hệ" (2B), cùng filter đang xem. */
  @Get('commission/by-company/export')
  async commissionByCompanyExport(@Query() query: CommissionByCompanyQueryDto, @Res() res: Response) {
    const [personRows, levelRows] = await Promise.all([
      this.reportsService.commissionByPerson(query),
      this.reportsService.commissionByLevel(query),
    ]);
    const buffer = await buildCommissionByCompanyWorkbook({ personRows, levelRows });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="hoa-hong-theo-cong-ty-${Date.now()}.xlsx"`,
    );
    res.send(buffer);
  }

  /** Screen 3 — Báo cáo đơn hàng: danh sách chi tiết đơn, phân trang, có dòng summary. */
  @Get('commission/detail')
  commissionDetail(@Query() query: CommissionDetailQueryDto) {
    return this.reportsService.commissionDetail(query);
  }

  /**
   * Screen 3 — Xuất Excel: TOÀN BỘ đơn khớp filter (không theo trang). Trả file nhị phân trực
   * tiếp qua `@Res()` để tránh bị `ResponseInterceptor` toàn cục bọc thành `{ success, data }`
   * (interceptor vẫn chạy nhưng kết quả `map()` của nó bị bỏ qua vì response đã được gửi thủ
   * công — passthrough mặc định là false khi dùng `@Res()` không kèm option).
   */
  @Get('commission/detail/export')
  async commissionDetailExport(@Query() query: CommissionDetailQueryDto, @Res() res: Response) {
    const result = await this.reportsService.commissionDetailExport(query);
    const buffer = await buildCommissionDetailWorkbook(result);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="bao-cao-don-hang-${Date.now()}.xlsx"`);
    res.setHeader('X-Export-Truncated', String(result.truncated));
    res.send(buffer);
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

  /** Hàng hóa trên website: danh sách sản phẩm, lọc theo mã/tên/nhóm/trạng thái. */
  @Get('merchant-products')
  merchantProducts(@Query() query: MerchantProductQueryDto) {
    return this.reportsService.merchantProducts(query);
  }

  /** Danh sách nhóm hàng cho filter "Nhóm hàng" của báo cáo Hàng hóa trên website. */
  @Get('merchant-products/groups')
  merchantProductGroups() {
    return this.reportsService.merchantProductGroups();
  }

  /** Thống kê lượt bán: toàn bộ sản phẩm, lượt bán = SUM(Quantity) trong khoảng ngày, lọc theo mã/tên/nhóm. */
  @Get('sales-count')
  salesCount(@Query() query: SalesCountQueryDto) {
    return this.reportsService.salesCount(query);
  }

  /** Dashboard — Top 5 CTV theo hoa hồng (đã duyệt) trong tháng hiện tại. */
  @Get('dashboard/top-ctv')
  dashboardTopCtv(@Query() query: DashboardTopCtvQueryDto) {
    return this.reportsService.dashboardTopCtv(query);
  }

  /** Top nhóm hàng bán chạy — biến thể của sales-count, group theo nhóm hàng. */
  @Get('sales-count/by-group')
  topGroupProducts(@Query() query: TopGroupProductsQueryDto) {
    return this.reportsService.topGroupProducts(query);
  }

  /** Dashboard — Top 5 CTV theo số người giới thiệu trực tiếp trong tháng hiện tại. */
  @Get('dashboard/top-ctv-referral')
  dashboardTopCtvReferral(@Query() query: DashboardCtvReferralQueryDto) {
    return this.reportsService.dashboardTopCtvReferral(query);
  }

  /** Dashboard — Hoa hồng theo cấp hệ TOÀN HỆ THỐNG (không lọc công ty). */
  @Get('dashboard/commission-by-level')
  dashboardCommissionByLevel(@Query() query: DashboardCommissionByLevelQueryDto) {
    return this.reportsService.commissionByLevel(query);
  }

  /** Dashboard — Tỷ lệ đơn thành công/huỷ trong tháng. */
  @Get('dashboard/order-status-breakdown')
  orderStatusBreakdown(@Query() query: OrderStatusBreakdownQueryDto) {
    return this.reportsService.orderStatusBreakdown(query);
  }
}
