import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { Category } from '../categories/category.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { RatesModule } from '../rates/rates.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, Category]), RatesModule],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
