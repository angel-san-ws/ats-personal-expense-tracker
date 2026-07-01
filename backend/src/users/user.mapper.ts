import { User } from './user.entity';

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  language: 'en' | 'es';
  currency: string;
  createdAt: Date;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    language: user.language,
    currency: user.currency,
    createdAt: user.createdAt,
  };
}
