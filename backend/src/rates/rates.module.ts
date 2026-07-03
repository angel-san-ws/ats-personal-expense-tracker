import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExchangeRate } from './exchange-rate.entity';
import { Expense } from '../expenses/expense.entity';
import { BanguatProvider } from './providers/banguat.provider';
import { FrankfurterProvider } from './providers/frankfurter.provider';
import { RatesService } from './rates.service';
import { RateStampingService } from './rate-stamping.service';

@Module({
  imports: [TypeOrmModule.forFeature([ExchangeRate, Expense])],
  providers: [
    BanguatProvider,
    FrankfurterProvider,
    RatesService,
    RateStampingService,
  ],
  exports: [RatesService, RateStampingService],
})
export class RatesModule {}
