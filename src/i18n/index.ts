import en from '../locales/en.json';
import ru from '../locales/ru.json';
import az from '../locales/az.json';
import { usePreferences } from '../state/preferences';

const dictionaries: Record<string, any> = { en, ru, az };

export const useI18n = () => {
  const { language } = usePreferences();
  return {
    lang: language,
    t: (key: string, paramsOrFallback?: Record<string, string | number> | string, fallback?: string) => {
      // Handle backward compatibility: if second param is a string, it's the old fallback signature
      if (typeof paramsOrFallback === 'string') {
        return t(key, language, undefined, paramsOrFallback);
      }
      return t(key, language, paramsOrFallback as Record<string, string | number> | undefined, fallback);
    },
  };
};

export const t = (key: string, lang: string, params?: Record<string, string | number>, fallback?: string): string => {
  const dict = dictionaries[lang] || dictionaries.en;
  const val = key.split('.').reduce<any>((acc, k) => (acc && acc[k] != null ? acc[k] : undefined), dict);
  let result = typeof val === 'string' ? val : (fallback || key);
  
  // Interpolate parameters (replace {{param}} with actual values)
  if (params) {
    Object.keys(params).forEach(param => {
      const regex = new RegExp(`\\{\\{${param}\\}\\}`, 'g');
      result = result.replace(regex, String(params[param]));
    });
  }
  
  return result;
};


