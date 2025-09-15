import { ReactNode, useState, useEffect } from 'react';
import { I18nContext, Language, createTranslator, getDefaultLanguage, saveLanguage } from '@/i18n';
import { config } from '@/config/env';

const isI18nEnabled = config.i18n.enabled;

interface I18nProviderProps {
  children: ReactNode;
}

export function I18nProvider({ children }: I18nProviderProps) {
  // If i18n is disabled, just render children without provider context
  if (!isI18nEnabled) {
    return <>{children}</>;
  }

  const [language, setLanguageState] = useState<Language>(getDefaultLanguage);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    saveLanguage(lang);
  };

  const t = createTranslator(language);

  // Listen for storage changes to sync across tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'lang' && e.newValue && (e.newValue === 'it' || e.newValue === 'en')) {
        setLanguageState(e.newValue as Language);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}