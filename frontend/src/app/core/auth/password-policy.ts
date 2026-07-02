import { AbstractControl, ValidationErrors } from '@angular/forms';

export interface PasswordRule {
  key: string;
  labelKey: string;
  test: (value: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  { key: 'minLength', labelKey: 'auth.ruleMinLength', test: (v) => v.length >= 8 },
  { key: 'uppercase', labelKey: 'auth.ruleUppercase', test: (v) => /[A-Z]/.test(v) },
  { key: 'lowercase', labelKey: 'auth.ruleLowercase', test: (v) => /[a-z]/.test(v) },
  { key: 'number', labelKey: 'auth.ruleNumber', test: (v) => /\d/.test(v) },
  { key: 'special', labelKey: 'auth.ruleSpecial', test: (v) => /[^A-Za-z0-9]/.test(v) },
];

export function isStrongPassword(value: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(value));
}

export function strongPasswordValidator(control: AbstractControl): ValidationErrors | null {
  const value: string = control.value ?? '';
  if (!value) return null;
  return isStrongPassword(value) ? null : { weakPassword: true };
}
