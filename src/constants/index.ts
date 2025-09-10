/**
 * Application constants
 */

export const APP_CONFIG = {
  name: 'Amico Segreto',
  description: 'Organizza il tuo scambio di regali perfetto',
  version: '1.0.0',
} as const;

export const ROUTES = {
  HOME: '/',
  AUTH: '/auth',
  EVENTS: '/events',
  EVENT_NEW: '/events/new',
  EVENT_DETAIL: '/events/:id',
  IDEAS: '/ideas',
  WISHLIST: '/wishlist',
  PROFILE: '/profile',
  PRIVACY: '/privacy',
  COOKIES: '/cookies',
  TERMS: '/terms',
} as const;

export const EVENT_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
} as const;

export const MEMBER_STATUS = {
  INVITED: 'invited',
  JOINED: 'joined',
  DECLINED: 'declined',
  LEFT: 'left',
} as const;

export const MEMBER_ROLES = {
  ADMIN: 'admin',
  MEMBER: 'member',
} as const;

export const CHAT_CHANNELS = {
  EVENT: 'event',
  PAIR: 'pair',
} as const;

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 25,
  MAX_PAGE_SIZE: 100,
} as const;

export const VALIDATION = {
  MIN_PASSWORD_LENGTH: 6,
  MAX_NAME_LENGTH: 100,
  MAX_EMAIL_LENGTH: 320,
  MAX_MESSAGE_LENGTH: 1000,
} as const;

export const STORAGE_KEYS = {
  THEME: 'theme',
  LANGUAGE: 'language',
  CONSENT: 'ads_consent',
  DEBUG: 'debug',
} as const;