import { Pipe, PipeTransform, inject } from '@angular/core';
import { AuthService } from './auth/auth.service';

@Pipe({ name: 'atsCurrency', pure: false })
export class AtsCurrencyPipe implements PipeTransform {
  private auth = inject(AuthService);

  transform(value: number | null | undefined, currencyOverride?: string | null): string {
    if (value === null || value === undefined || isNaN(value)) return '—';
    const currency = currencyOverride || this.auth.user()?.currency || 'GTQ';
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
    } catch {
      return `${currency} ${value.toFixed(2)}`;
    }
  }
}
