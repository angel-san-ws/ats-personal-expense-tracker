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
import {
  BatchDeleteExpensesDto,
  CreateExpenseDto,
  QueryExpensesDto,
  SetExcludedDto,
  UpdateExpenseDto,
} from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: QueryExpensesDto) {
    return this.expenses.findAll(user.userId, query);
  }

  @Get('summary')
  summary(@CurrentUser() user: AuthUser, @Query() query: QueryExpensesDto) {
    return this.expenses.summary(user.userId, query);
  }

  @Get('cards')
  cards(@CurrentUser() user: AuthUser) {
    return this.expenses.distinctCards(user.userId);
  }

  @Get('currencies')
  currencies(@CurrentUser() user: AuthUser) {
    return this.expenses.distinctCurrencies(user.userId);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateExpenseDto) {
    return this.expenses.create(user.userId, dto);
  }

  @Post('batch-delete')
  @HttpCode(200)
  batchDelete(
    @CurrentUser() user: AuthUser,
    @Body() dto: BatchDeleteExpensesDto,
  ) {
    return this.expenses.batchDelete(user.userId, dto.ids);
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
