import en from '../locales/en.json';
import ru from '../locales/ru.json';
import az from '../locales/az.json';
import { usePreferences } from '../state/preferences';

const dictionaries: Record<string, any> = { en, ru, az };

export const useI18n = () => {
  const { language } = usePreferences();
  return {
    lang: language,
    t: (key: string, fallback?: string) => t(key, language, fallback),
  };
};

export const t = (key: string, lang: string, fallback?: string): string => {
  const dict = dictionaries[lang] || dictionaries.en;
  const val = key.split('.').reduce<any>((acc, k) => (acc && acc[k] != null ? acc[k] : undefined), dict);
  return typeof val === 'string' ? val : (fallback || key);
};


