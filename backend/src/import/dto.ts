import { IsUUID, Matches } from 'class-validator';

export class DismissReminderDto {
  @IsUUID()
  accountId: string;

  /** The dismissed reminder's due date (YYYY-MM-DD). */
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'dueDate must look like 2026-07-15',
  })
  dueDate: string;
}
