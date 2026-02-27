import React, { createContext, useContext, useState, ReactNode } from 'react';
import { translations } from '../locales/translations';

interface LanguageContextType {
  currentLang: string;
  setLanguage: (lang: string) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  currentLang: 'en',
  setLanguage: () => {},
  t: () => '',
});

export const useLanguage = () => useContext(LanguageContext);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentLang, setCurrentLang] = useState('en');

  const setLanguage = (lang: string) => {
    setCurrentLang(lang);
    localStorage.setItem('language', lang);
  };

  const t = (key: string) => {
    return translations[currentLang as keyof typeof translations]?.[key as keyof typeof translations.en] || key;
  };

  return (
    <LanguageContext.Provider value={{ currentLang, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};
