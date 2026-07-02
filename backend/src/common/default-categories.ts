import { AppLanguage } from '../users/user.entity';

/**
 * Default category catalog seeded on registration, with the display name in
 * each supported language. The keyword rules in `category-suggester.ts`
 * return the English (`en`) name; `categoryNameCandidates` maps it onto
 * catalogs seeded in another language.
 */
export interface DefaultCategory {
  en: string;
  es: string;
  color: string;
}

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { en: 'Food & Dining', es: 'Comida y Restaurantes', color: '#ef4444' },
  { en: 'Groceries', es: 'Supermercado', color: '#22c55e' },
  { en: 'Transport', es: 'Transporte', color: '#3b82f6' },
  { en: 'Fuel', es: 'Combustible', color: '#f59e0b' },
  { en: 'Shopping', es: 'Compras', color: '#a855f7' },
  { en: 'Entertainment', es: 'Entretenimiento', color: '#ec4899' },
  { en: 'Health', es: 'Salud', color: '#14b8a6' },
  { en: 'Services', es: 'Servicios', color: '#64748b' },
  { en: 'Travel', es: 'Viajes', color: '#0ea5e9' },
  { en: 'Education', es: 'Educación', color: '#8b5cf6' },
  { en: 'Other', es: 'Otros', color: '#9ca3af' },
];

export function defaultCategoriesFor(
  language: AppLanguage,
): { name: string; color: string }[] {
  return DEFAULT_CATEGORIES.map((c) => ({
    name: language === 'es' ? c.es : c.en,
    color: c.color,
  }));
}

const NAME_ALIASES = new Map<string, string[]>();
for (const c of DEFAULT_CATEGORIES) {
  NAME_ALIASES.set(c.en.toLowerCase(), [c.es.toLowerCase()]);
  NAME_ALIASES.set(c.es.toLowerCase(), [c.en.toLowerCase()]);
}

/**
 * All lowercase names a suggested category may appear under in a user's
 * catalog: the suggestion itself plus its translations in the default
 * catalog. Lets English keyword suggestions (and learned stats recorded by
 * users of either language) match categories seeded in Spanish, and vice
 * versa.
 */
export function categoryNameCandidates(suggestion: string): string[] {
  const lower = suggestion.trim().toLowerCase();
  return [lower, ...(NAME_ALIASES.get(lower) ?? [])];
}
