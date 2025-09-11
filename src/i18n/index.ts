import { createContext, useContext } from 'react';
import itTranslations from './it.json';
import enTranslations from './en.json';

export type Language = 'it' | 'en';

export interface Translations {
  [key: string]: string | Translations;
}

const translations: Record<Language, Translations> = {
  it: itTranslations,
  en: enTranslations,
};

export interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

export const I18nContext = createContext<I18nContextType | null>(null);

const isI18nEnabled = import.meta.env.VITE_I18N_ENABLED !== 'false';

export const useI18n = () => {
  if (!isI18nEnabled) {
    // Return Italian-only context when disabled
    return {
      language: 'it' as Language,
      setLanguage: () => {},
      t: (key: string) => getTranslation(translations.it, key)
    };
  }
  
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
};

// Get nested translation value by key path (e.g., 'navbar.events')
const getTranslation = (translations: Translations, key: string): string => {
  const keys = key.split('.');
  let value: any = translations;
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      return key; // Return key as fallback if translation not found
    }
  }
  
  return typeof value === 'string' ? value : key;
};

export const createTranslator = (language: Language) => {
  return (key: string): string => {
    return getTranslation(translations[language], key);
  };
};

// Detect default language from browser
export const getDefaultLanguage = (): Language => {
  const stored = localStorage.getItem('lang') as Language;
  if (stored && (stored === 'it' || stored === 'en')) {
    return stored;
  }
  
  const browserLang = navigator.language.toLowerCase();
  return browserLang.startsWith('it') ? 'it' : 'en';
};

// Save language preference
export const saveLanguage = (language: Language) => {
  localStorage.setItem('lang', language);
};