import { User } from './user.entity';

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  language: 'en' | 'es';
  currency: string;
  theme: 'light' | 'dark';
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
    createdAt: user.createdAt,
  };
}
