import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecurringExpense } from './recurring-expense.entity';
import { Expense } from '../expenses/expense.entity';
import { RecurringExpensesService } from './recurring-expenses.service';
import { RecurringExpensesController } from './recurring-expenses.controller';
import { AccountsModule } from '../accounts/accounts.module';
import { ConceptsModule } from '../concepts/concepts.module';
import { UsersModule } from '../users/users.module';
import { RatesModule } from '../rates/rates.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([RecurringExpense, Expense]),
    AccountsModule,
    ConceptsModule,
    UsersModule,
    RatesModule,
  ],
  providers: [RecurringExpensesService],
  controllers: [RecurringExpensesController],
  exports: [RecurringExpensesService],
})
export class RecurringExpensesModule {}
