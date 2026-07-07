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
