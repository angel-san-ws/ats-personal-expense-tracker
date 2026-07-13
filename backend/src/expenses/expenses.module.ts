import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Expense } from './expense.entity';
import { ExpensesService } from './expenses.service';
import { ReportService } from './report.service';
import { ExpensesController } from './expenses.controller';
import { AccountsModule } from '../accounts/accounts.module';
import { BudgetsModule } from '../budgets/budgets.module';
import { ConceptsModule } from '../concepts/concepts.module';
import { UsersModule } from '../users/users.module';
import { RatesModule } from '../rates/rates.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Expense]),
    AccountsModule,
    BudgetsModule,
    ConceptsModule,
    UsersModule,
    RatesModule,
  ],
  providers: [ExpensesService, ReportService],
  controllers: [ExpensesController],
  exports: [ExpensesService],
})
export class ExpensesModule {}
