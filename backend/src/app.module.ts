import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from './users/user.entity';
import { Category } from './categories/category.entity';
import { Concept } from './concepts/concept.entity';
import { Expense } from './expenses/expense.entity';
import { ImportBatch } from './import/import-batch.entity';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CategoriesModule } from './categories/categories.module';
import { ConceptsModule } from './concepts/concepts.module';
import { ExpensesModule } from './expenses/expenses.module';
import { ImportModule } from './import/import.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: parseInt(config.get<string>('DB_PORT', '5432'), 10),
        username: config.get<string>('DB_USER', 'ats'),
        password: config.get<string>('DB_PASSWORD', 'ats_password'),
        database: config.get<string>('DB_NAME', 'ats_expenses'),
        entities: [User, Category, Concept, Expense, ImportBatch],
        // Auto-create schema for local dev. Use migrations in production.
        synchronize: true,
        logging: config.get('DB_LOGGING') === 'true' ? ['query', 'error'] : ['error'],
      }),
    }),
    AuthModule,
    UsersModule,
    CategoriesModule,
    ConceptsModule,
    ExpensesModule,
    ImportModule,
  ],
})
export class AppModule {}
