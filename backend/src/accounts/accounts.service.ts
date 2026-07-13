import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { Account, AccountType, accountMatchKey } from './account.entity';
import { Expense } from '../expenses/expense.entity';
import { CreateAccountDto, UpdateAccountDto } from './dto';

/**
 * SQL twin of {@link accountMatchKey}: card last digits when present, else
 * the card label, trimmed and uppercased. `prefix` qualifies the columns
 * (e.g. 'e.') and must be '' in UPDATE statements.
 */
const keyExpr = (prefix: string) =>
  `UPPER(COALESCE(NULLIF(TRIM(${prefix}no_tarjeta), ''), NULLIF(TRIM(${prefix}tarjeta), '')))`;

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(Account)
    private readonly accounts: Repository<Account>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /** All accounts for the user, adopting legacy card-column expenses first. */
  async list(userId: string): Promise<Account[]> {
    await this.ensureBackfilled(userId);
    return this.accounts.find({
      where: { userId },
      order: { archived: 'ASC', name: 'ASC' },
    });
  }

  async create(userId: string, dto: CreateAccountDto): Promise<Account> {
    const name = dto.name.trim();
    // Prefer the card digits as the import identity so statements uploaded
    // later attach to this account automatically.
    const matchKey = accountMatchKey(dto.lastFour, name);
    if (!matchKey) throw new BadRequestException('Name is required');
    const existing = await this.accounts.findOne({
      where: { userId, matchKey },
    });
    if (existing) {
      throw new BadRequestException(
        `An account matching the same card already exists ("${existing.name}").`,
      );
    }
    return this.accounts.save(
      this.accounts.create({
        userId,
        name,
        matchKey,
        type: (dto.type as AccountType) ?? 'credit_card',
        lastFour: dto.lastFour?.trim() || null,
        institution: dto.institution?.trim() || null,
        color: dto.color?.trim() || null,
        creditLimit: dto.creditLimit ?? null,
        paymentDueDay: dto.paymentDueDay ?? null,
        paymentAmount: dto.paymentAmount ?? null,
      }),
    );
  }

  /**
   * Update user-facing metadata. `matchKey` is intentionally immutable: it is
   * the import identity, and changing it would detach past/future statements.
   */
  async update(
    userId: string,
    id: string,
    dto: UpdateAccountDto,
  ): Promise<Account> {
    const account = await this.findOwned(userId, id);
    if (dto.name !== undefined) account.name = dto.name.trim() || account.name;
    if (dto.type !== undefined) account.type = dto.type as AccountType;
    if (dto.lastFour !== undefined) {
      account.lastFour = dto.lastFour.trim() || null;
    }
    if (dto.institution !== undefined) {
      account.institution = dto.institution.trim() || null;
    }
    if (dto.color !== undefined) account.color = dto.color.trim() || null;
    if (dto.archived !== undefined) account.archived = dto.archived;
    if (dto.creditLimit !== undefined) account.creditLimit = dto.creditLimit;
    if (dto.paymentDueDay !== undefined) {
      account.paymentDueDay = dto.paymentDueDay;
    }
    if (dto.paymentAmount !== undefined) {
      account.paymentAmount = dto.paymentAmount;
    }
    return this.accounts.save(account);
  }

  /**
   * Only accounts without expenses can be deleted — the backfill would
   * recreate an account for orphaned card rows anyway. Archive instead.
   */
  async remove(userId: string, id: string): Promise<void> {
    const account = await this.findOwned(userId, id);
    const used = await this.dataSource
      .getRepository(Expense)
      .exists({ where: { userId, accountId: id } });
    if (used) {
      throw new BadRequestException(
        'This account has transactions. Archive it instead of deleting.',
      );
    }
    await this.accounts.delete(account.id);
  }

  async findOwned(userId: string, id: string): Promise<Account> {
    const account = await this.accounts.findOne({ where: { id, userId } });
    if (!account) throw new NotFoundException('Account not found');
    return account;
  }

  /**
   * Resolve (or create) an account per distinct match key found in the given
   * card fields. Runs inside the caller's transaction. Returns matchKey →
   * accountId; rows without card data have no key and stay account-less.
   */
  async getOrCreateByKeys(
    manager: EntityManager,
    userId: string,
    rows: { tarjeta: string | null; noTarjeta: string | null }[],
  ): Promise<Map<string, string>> {
    const sampleByKey = new Map<
      string,
      { tarjeta: string | null; noTarjeta: string | null }
    >();
    for (const r of rows) {
      const key = accountMatchKey(r.noTarjeta, r.tarjeta);
      if (key && !sampleByKey.has(key)) sampleByKey.set(key, r);
    }
    if (sampleByKey.size === 0) return new Map();

    const repo = manager.getRepository(Account);
    const found = await repo.find({
      where: { userId, matchKey: In([...sampleByKey.keys()]) },
    });
    const idByKey = new Map(found.map((a) => [a.matchKey, a.id]));

    const missing = [...sampleByKey].filter(([key]) => !idByKey.has(key));
    if (missing.length > 0) {
      await repo
        .createQueryBuilder()
        .insert()
        .values(
          missing.map(([key, sample]) => {
            const digits = (sample.noTarjeta ?? '').replace(/\D/g, '');
            return {
              userId,
              matchKey: key,
              name: sample.noTarjeta?.trim() || sample.tarjeta?.trim() || key,
              type: 'credit_card',
              lastFour: digits ? digits.slice(-4) : null,
            };
          }),
        )
        // A concurrent import may have inserted the same key; the re-select
        // below picks up whichever row won.
        .orIgnore()
        .execute();
      const all = await repo.find({
        where: { userId, matchKey: In([...sampleByKey.keys()]) },
      });
      idByKey.clear();
      for (const a of all) idByKey.set(a.matchKey, a.id);
    }
    return idByKey;
  }

  /**
   * Adopt expenses imported before accounts existed (or inserted without
   * one): group their card columns by match key, create the missing accounts
   * and stamp `account_id`. Idempotent and cheap when there is nothing to do,
   * so it is safe to call on every list/summary request.
   */
  async ensureBackfilled(userId: string): Promise<void> {
    const pending = await this.dataSource
      .getRepository(Expense)
      .createQueryBuilder('e')
      .where('e.user_id = :userId', { userId })
      .andWhere('e.account_id IS NULL')
      .andWhere(`${keyExpr('e.')} IS NOT NULL`)
      .getExists();
    if (!pending) return;

    await this.dataSource.transaction(async (manager) => {
      const samples: { tarjeta: string | null; noTarjeta: string | null }[] =
        await manager
          .getRepository(Expense)
          .createQueryBuilder('e')
          .select("MIN(NULLIF(TRIM(e.no_tarjeta), ''))", 'noTarjeta')
          .addSelect("MIN(NULLIF(TRIM(e.tarjeta), ''))", 'tarjeta')
          .where('e.user_id = :userId', { userId })
          .andWhere('e.account_id IS NULL')
          .andWhere(`${keyExpr('e.')} IS NOT NULL`)
          .groupBy(keyExpr('e.'))
          .getRawMany();

      const idByKey = await this.getOrCreateByKeys(manager, userId, samples);
      for (const [key, accountId] of idByKey) {
        await manager
          .createQueryBuilder()
          .update(Expense)
          .set({ accountId })
          .where('user_id = :userId', { userId })
          .andWhere('account_id IS NULL')
          .andWhere(`${keyExpr('')} = :key`, { key })
          .execute();
      }
    });
  }
}
