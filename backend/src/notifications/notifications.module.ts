import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SentNotification } from './sent-notification.entity';
import { User } from '../users/user.entity';
import { NotificationsService } from './notifications.service';
import { MailModule } from '../mail/mail.module';
import { BudgetsModule } from '../budgets/budgets.module';
import { ImportModule } from '../import/import.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SentNotification, User]),
    MailModule,
    BudgetsModule,
    ImportModule,
  ],
  providers: [NotificationsService],
})
export class NotificationsModule {}
