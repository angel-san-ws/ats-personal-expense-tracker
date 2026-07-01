import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImportBatch } from './import-batch.entity';
import { Expense } from '../expenses/expense.entity';
import { ImportService } from './import.service';
import { ImportController } from './import.controller';
import { ConceptsModule } from '../concepts/concepts.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ImportBatch, Expense]),
    ConceptsModule,
    UsersModule,
  ],
  providers: [ImportService],
  controllers: [ImportController],
})
export class ImportModule {}
