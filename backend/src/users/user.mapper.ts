import { SavedFilter, User } from './user.entity';

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  language: 'en' | 'es';
  currency: string;
  theme: 'light' | 'dark';
  savedFilters: Record<string, SavedFilter>;
  createdAt: Date;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    language: user.language,
    currency: user.currency,
    theme: user.theme,
    savedFilters: user.savedFilters ?? {},
    createdAt: user.createdAt,
  };
}
