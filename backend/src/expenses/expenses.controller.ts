import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { ReportService } from './report.service';
import {
  BatchAssignCategoryDto,
  BatchDeleteExpensesDto,
  BatchUpdateExpensesDto,
  CreateExpenseDto,
  QueryExpensesDto,
  ReportQueryDto,
  SetExcludedDto,
  UpdateExpenseDto,
} from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(
    private readonly expenses: ExpensesService,
    private readonly reports: ReportService,
  ) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: QueryExpensesDto) {
    return this.expenses.findAll(user.userId, query);
  }

  @Get('summary')
  summary(@CurrentUser() user: AuthUser, @Query() query: QueryExpensesDto) {
    return this.expenses.summary(user.userId, query);
  }

  @Get('report')
  report(@CurrentUser() user: AuthUser, @Query() query: ReportQueryDto) {
    return this.reports.yearReport(user.userId, query);
  }

  @Get('field-options')
  fieldOptions(@CurrentUser() user: AuthUser) {
    return this.expenses.fieldOptions(user.userId);
  }

  @Get('currencies')
  currencies(@CurrentUser() user: AuthUser) {
    return this.expenses.distinctCurrencies(user.userId);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateExpenseDto) {
    return this.expenses.create(user.userId, dto);
  }

  @Post('refresh-rates')
  @HttpCode(200)
  refreshRates(@CurrentUser() user: AuthUser) {
    return this.expenses.refreshRates(user.userId);
  }

  @Post('batch-delete')
  @HttpCode(200)
  batchDelete(
    @CurrentUser() user: AuthUser,
    @Body() dto: BatchDeleteExpensesDto,
  ) {
    return this.expenses.batchDelete(user.userId, dto.ids);
  }

  @Post('batch-assign-category')
  @HttpCode(200)
  batchAssignCategory(
    @CurrentUser() user: AuthUser,
    @Body() dto: BatchAssignCategoryDto,
  ) {
    return this.expenses.batchAssignCategory(
      user.userId,
      dto.ids,
      dto.categoryId ?? null,
    );
  }

  @Post('batch-update')
  @HttpCode(200)
  batchUpdate(
    @CurrentUser() user: AuthUser,
    @Body() dto: BatchUpdateExpensesDto,
  ) {
    return this.expenses.batchUpdate(user.userId, dto.ids, dto);
  }

  @Patch(':id/excluded')
  @HttpCode(204)
  setExcluded(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SetExcludedDto,
  ) {
    return this.expenses.setExcluded(user.userId, id, dto.excluded);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    return this.expenses.update(user.userId, id, dto);
  }
}
