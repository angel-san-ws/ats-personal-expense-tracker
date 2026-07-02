import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecurringExpense } from './recurring-expense.entity';
import { Expense } from '../expenses/expense.entity';
import { RecurringExpensesService } from './recurring-expenses.service';
import { RecurringExpensesController } from './recurring-expenses.controller';
import { ConceptsModule } from '../concepts/concepts.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([RecurringExpense, Expense]),
    ConceptsModule,
  ],
  providers: [RecurringExpensesService],
  controllers: [RecurringExpensesController],
  exports: [RecurringExpensesService],
})
export class RecurringExpensesModule {}
