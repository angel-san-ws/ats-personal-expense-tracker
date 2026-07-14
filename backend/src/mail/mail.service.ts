import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

import { AppLanguage } from '../users/user.entity';

/**
 * Outbound email via Resend. Sending is best-effort everywhere: a missing API
 * key or provider failure logs a warning and returns false, but never throws —
 * registration and login must not depend on the mail provider being up.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;
  private readonly appBaseUrl: string;
  /** If set, ALL outbound mail goes here instead of the real recipient (dev mode). */
  private readonly redirectTo: string;

  constructor(config: ConfigService) {
    const apiKey = config.get<string>('RESEND_API_KEY', '');
    this.resend = apiKey ? new Resend(apiKey) : null;
    this.from = config.get<string>(
      'MAIL_FROM',
      'Expense Tracker <onboarding@resend.dev>',
    );
    this.redirectTo = config.get<string>('MAIL_REDIRECT_TO', '').trim();
    this.appBaseUrl = config
      .get<string>('APP_BASE_URL', 'http://localhost:4200')
      .replace(/\/+$/, '');
  }

  sendVerificationEmail(
    to: string,
    name: string,
    rawToken: string,
    language: AppLanguage,
  ): Promise<boolean> {
    const link = `${this.appBaseUrl}/verify-email?token=${rawToken}`;
    return this.send(to, verificationTemplate(name, link, language));
  }

  sendPasswordResetEmail(
    to: string,
    name: string,
    rawToken: string,
    language: AppLanguage,
  ): Promise<boolean> {
    const link = `${this.appBaseUrl}/reset-password?token=${rawToken}`;
    return this.send(to, passwordResetTemplate(name, link, language));
  }

  sendPaymentDueEmail(
    to: string,
    name: string,
    data: PaymentDueEmailData,
    language: AppLanguage,
  ): Promise<boolean> {
    return this.send(to, paymentDueTemplate(name, data, language));
  }

  sendBudgetOverspendEmail(
    to: string,
    name: string,
    data: BudgetOverspendEmailData,
    language: AppLanguage,
  ): Promise<boolean> {
    return this.send(to, budgetOverspendTemplate(name, data, language));
  }

  private async send(
    to: string,
    { subject, html }: { subject: string; html: string },
  ): Promise<boolean> {
    if (!this.resend) {
      this.logger.warn(`RESEND_API_KEY not set — skipping email to ${to}`);
      return false;
    }
    // Redirected mail keeps the intended recipient visible in the subject.
    const recipient = this.redirectTo || to;
    const finalSubject = this.redirectTo ? `[to: ${to}] ${subject}` : subject;
    try {
      const { error } = await this.resend.emails.send({
        from: this.from,
        to: recipient,
        subject: finalSubject,
        html,
      });
      if (error) {
        this.logger.warn(
          `Resend rejected email "${subject}" to ${to}: ${error.message}`,
        );
        return false;
      }
      return true;
    } catch (err) {
      this.logger.warn(`Failed to send email "${subject}" to ${to}`, err);
      return false;
    }
  }
}

function verificationTemplate(
  name: string,
  link: string,
  language: AppLanguage,
): { subject: string; html: string } {
  const t =
    language === 'es'
      ? {
          subject: 'Confirma tu correo electrónico',
          greeting: `Hola ${name},`,
          body: 'Gracias por registrarte en ATS - Personal Expense Tracker. Haz clic en el botón para confirmar tu dirección de correo:',
          button: 'Confirmar correo',
          expiry: 'El enlace es válido por 24 horas.',
          ignore: 'Si no creaste esta cuenta, ignora este mensaje.',
        }
      : {
          subject: 'Verify your email address',
          greeting: `Hi ${name},`,
          body: 'Thanks for signing up to ATS - Personal Expense Tracker. Click the button below to confirm your email address:',
          button: 'Verify email',
          expiry: 'The link is valid for 24 hours.',
          ignore:
            "If you didn't create this account, you can ignore this message.",
        };
  return { subject: t.subject, html: actionEmailHtml(t, link) };
}

function passwordResetTemplate(
  name: string,
  link: string,
  language: AppLanguage,
): { subject: string; html: string } {
  const t =
    language === 'es'
      ? {
          subject: 'Restablece tu contraseña',
          greeting: `Hola ${name},`,
          body: 'Recibimos una solicitud para restablecer la contraseña de tu cuenta de ATS - Personal Expense Tracker. Haz clic en el botón para elegir una nueva:',
          button: 'Restablecer contraseña',
          expiry: 'El enlace es válido por 1 hora.',
          ignore:
            'Si no solicitaste este cambio, ignora este mensaje — tu contraseña seguirá siendo la misma.',
        }
      : {
          subject: 'Reset your password',
          greeting: `Hi ${name},`,
          body: 'We received a request to reset the password for your ATS - Personal Expense Tracker account. Click the button below to choose a new one:',
          button: 'Reset password',
          expiry: 'The link is valid for 1 hour.',
          ignore:
            "If you didn't request this, you can ignore this message — your password will stay the same.",
        };
  return { subject: t.subject, html: actionEmailHtml(t, link) };
}

export interface PaymentDueEmailData {
  accountName: string;
  /** Card number last digits, when known. */
  lastFour: string | null;
  /** ISO YYYY-MM-DD. */
  dueDate: string;
  /** 0 = due today. */
  daysUntilDue: number;
  /** In the user's base currency, when the statement carries one. */
  minimumPayment: number | null;
  /** The user's base currency (amounts are already converted to it). */
  currency: string;
}

function paymentDueTemplate(
  name: string,
  data: PaymentDueEmailData,
  language: AppLanguage,
): { subject: string; html: string } {
  const account = data.lastFour
    ? `${data.accountName} (•••• ${data.lastFour})`
    : data.accountName;
  const date = formatDate(data.dueDate, language);
  const when =
    language === 'es'
      ? data.daysUntilDue <= 0
        ? 'hoy'
        : data.daysUntilDue === 1
          ? 'mañana'
          : `en ${data.daysUntilDue} días`
      : data.daysUntilDue <= 0
        ? 'today'
        : data.daysUntilDue === 1
          ? 'tomorrow'
          : `in ${data.daysUntilDue} days`;
  const t =
    language === 'es'
      ? {
          subject: `El pago de ${data.accountName} vence ${when}`,
          greeting: `Hola ${name},`,
          body: `El pago de tu tarjeta <strong>${account}</strong> vence <strong>${when}</strong>, el ${date}.`,
          rows:
            data.minimumPayment !== null
              ? [
                  `Pago mínimo: <strong>${formatMoney(data.minimumPayment, data.currency, language)}</strong>`,
                ]
              : [],
          footer:
            'Recibes este recordatorio porque activaste los avisos de pago en la configuración de ATS - Personal Expense Tracker.',
        }
      : {
          subject: `${data.accountName} payment due ${when}`,
          greeting: `Hi ${name},`,
          body: `The payment for your card <strong>${account}</strong> is due <strong>${when}</strong>, on ${date}.`,
          rows:
            data.minimumPayment !== null
              ? [
                  `Minimum payment: <strong>${formatMoney(data.minimumPayment, data.currency, language)}</strong>`,
                ]
              : [],
          footer:
            'You are receiving this reminder because payment notifications are enabled in your ATS - Personal Expense Tracker settings.',
        };
  return { subject: t.subject, html: infoEmailHtml(t) };
}

export interface BudgetOverspendEmailData {
  /** YYYY-MM being reported. */
  month: string;
  /** The user's base currency (spent/limit amounts are converted to it). */
  currency: string;
  /** Newly overspent targets; `categoryName: null` is the overall budget. */
  items: { categoryName: string | null; spent: number; limit: number }[];
}

function budgetOverspendTemplate(
  name: string,
  data: BudgetOverspendEmailData,
  language: AppLanguage,
): { subject: string; html: string } {
  const month = formatMonth(data.month, language);
  const rows = data.items.map((item) => {
    const label =
      item.categoryName ??
      (language === 'es' ? 'Presupuesto general' : 'Overall budget');
    const spent = formatMoney(item.spent, data.currency, language);
    const limit = formatMoney(item.limit, data.currency, language);
    return language === 'es'
      ? `<strong>${label}</strong>: gastaste ${spent} de un límite de ${limit}`
      : `<strong>${label}</strong>: spent ${spent} of a ${limit} limit`;
  });
  const t =
    language === 'es'
      ? {
          subject: `Presupuesto excedido — ${month}`,
          greeting: `Hola ${name},`,
          body: `Superaste estos límites de presupuesto en ${month}:`,
          rows,
          footer:
            'Recibes este aviso porque activaste las alertas de presupuesto en la configuración de ATS - Personal Expense Tracker.',
        }
      : {
          subject: `Budget exceeded — ${month}`,
          greeting: `Hi ${name},`,
          body: `You went over these budget limits in ${month}:`,
          rows,
          footer:
            'You are receiving this alert because budget notifications are enabled in your ATS - Personal Expense Tracker settings.',
        };
  return { subject: t.subject, html: infoEmailHtml(t) };
}

function localeFor(language: AppLanguage): string {
  return language === 'es' ? 'es-GT' : 'en-US';
}

function formatMoney(
  value: number,
  currency: string,
  language: AppLanguage,
): string {
  try {
    return new Intl.NumberFormat(localeFor(language), {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

/** ISO YYYY-MM-DD → long date in the recipient's language. */
function formatDate(iso: string, language: AppLanguage): string {
  return new Intl.DateTimeFormat(localeFor(language), {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T00:00:00Z`));
}

/** YYYY-MM → "July 2026" / "julio de 2026". */
function formatMonth(month: string, language: AppLanguage): string {
  return new Intl.DateTimeFormat(localeFor(language), {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${month}-01T00:00:00Z`));
}

/** Informational email: no call-to-action button, optional detail rows. */
function infoEmailHtml(t: {
  greeting: string;
  body: string;
  rows: string[];
  footer: string;
}): string {
  const rows = t.rows
    .map((row) => `<li style="margin: 0 0 8px; line-height: 1.5;">${row}</li>`)
    .join('');
  return `
    <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1f2937;">
      <h2 style="margin: 0 0 16px;">${t.greeting}</h2>
      <p style="margin: 0 0 16px; line-height: 1.5;">${t.body}</p>
      ${rows ? `<ul style="margin: 0 0 24px; padding-left: 20px;">${rows}</ul>` : ''}
      <p style="margin: 0; font-size: 13px; color: #6b7280;">${t.footer}</p>
    </div>`;
}

function actionEmailHtml(
  t: {
    greeting: string;
    body: string;
    button: string;
    expiry: string;
    ignore: string;
  },
  link: string,
): string {
  return `
    <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1f2937;">
      <h2 style="margin: 0 0 16px;">${t.greeting}</h2>
      <p style="margin: 0 0 24px; line-height: 1.5;">${t.body}</p>
      <p style="margin: 0 0 24px;">
        <a href="${link}" style="display: inline-block; background: #10b981; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600;">${t.button}</a>
      </p>
      <p style="margin: 0 0 8px; font-size: 13px; color: #6b7280;">${t.expiry}</p>
      <p style="margin: 0; font-size: 13px; color: #6b7280;">${t.ignore}</p>
    </div>`;
}
