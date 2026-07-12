import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BudgetsService } from './budgets.service';
import { BudgetStatusQueryDto, UpsertBudgetDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('budgets')
export class BudgetsController {
  constructor(private readonly budgets: BudgetsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.budgets.findAll(user.userId);
  }

  /** Budget vs actual for a month (?month=YYYY-MM, default current). */
  @Get('status')
  status(@CurrentUser() user: AuthUser, @Query() query: BudgetStatusQueryDto) {
    return this.budgets.status(user.userId, query);
  }

  /** Set (create or replace) the budget for a category / the overall budget. */
  @Put()
  upsert(@CurrentUser() user: AuthUser, @Body() dto: UpsertBudgetDto) {
    return this.budgets.upsert(user.userId, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.budgets.remove(user.userId, id);
  }
}
