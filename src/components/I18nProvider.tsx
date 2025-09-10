import { ReactNode, useState, useEffect } from 'react';
import { I18nContext, Language, createTranslator, getDefaultLanguage, saveLanguage } from '@/i18n';

interface I18nProviderProps {
  children: ReactNode;
}

export function I18nProvider({ children }: I18nProviderProps) {
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