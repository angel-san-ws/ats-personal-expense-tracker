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

  async sendVerificationEmail(
    to: string,
    name: string,
    rawToken: string,
    language: AppLanguage,
  ): Promise<boolean> {
    if (!this.resend) {
      this.logger.warn(
        `RESEND_API_KEY not set — skipping verification email to ${to}`,
      );
      return false;
    }
    const link = `${this.appBaseUrl}/verify-email?token=${rawToken}`;
    const { subject, html } = verificationTemplate(name, link, language);
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
          `Resend rejected verification email to ${to}: ${error.message}`,
        );
        return false;
      }
      return true;
    } catch (err) {
      this.logger.warn(`Failed to send verification email to ${to}`, err);
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
  const html = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1f2937;">
      <h2 style="margin: 0 0 16px;">${t.greeting}</h2>
      <p style="margin: 0 0 24px; line-height: 1.5;">${t.body}</p>
      <p style="margin: 0 0 24px;">
        <a href="${link}" style="display: inline-block; background: #10b981; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600;">${t.button}</a>
      </p>
      <p style="margin: 0 0 8px; font-size: 13px; color: #6b7280;">${t.expiry}</p>
      <p style="margin: 0; font-size: 13px; color: #6b7280;">${t.ignore}</p>
    </div>`;
  return { subject: t.subject, html };
}
