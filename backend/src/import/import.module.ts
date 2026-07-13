import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImportBatch } from './import-batch.entity';
import { Expense } from '../expenses/expense.entity';
import { ImportService } from './import.service';
import { PaymentRemindersService } from './payment-reminders.service';
import { ImportController } from './import.controller';
import { ALERT_IMAGE_PARSER, AlertImageParser } from './alert-image-parser';
import { OcrAlertImageParser } from './ocr-alert-image-parser';
import { AccountsModule } from '../accounts/accounts.module';
import { ConceptsModule } from '../concepts/concepts.module';
import { UsersModule } from '../users/users.module';
import { RatesModule } from '../rates/rates.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ImportBatch, Expense]),
    AccountsModule,
    ConceptsModule,
    UsersModule,
    RatesModule,
  ],
  providers: [
    ImportService,
    PaymentRemindersService,
    OcrAlertImageParser,
    {
      // Screenshot-understanding strategy. Only "ocr" exists today; a future
      // vision-LLM implementation of AlertImageParser plugs in here under a
      // new ALERT_IMAGE_PARSER value without touching the import pipeline.
      provide: ALERT_IMAGE_PARSER,
      inject: [ConfigService, OcrAlertImageParser],
      useFactory: (
        config: ConfigService,
        ocr: OcrAlertImageParser,
      ): AlertImageParser => {
        const kind = config.get<string>('ALERT_IMAGE_PARSER', 'ocr');
        if (kind === 'ocr') return ocr;
        throw new Error(
          `Unsupported ALERT_IMAGE_PARSER "${kind}" — only "ocr" is implemented.`,
        );
      },
    },
  ],
  controllers: [ImportController],
})
export class ImportModule {}
