import { useMemo } from 'react';
import en from '../locales/en.json';
import ru from '../locales/ru.json';
import az from '../locales/az.json';
import { usePreferences } from '../state/preferences';

const dictionaries: Record<string, any> = { en, ru, az };

export const useI18n = () => {
  // Use selector to ensure component re-renders when language changes
  const language = usePreferences((state) => state.language);
  
  const t = useMemo(() => {
    return (key: string, paramsOrFallback?: Record<string, string | number> | string, fallback?: string) => {
      // Handle backward compatibility: if second param is a string, it's the old fallback signature
      if (typeof paramsOrFallback === 'string') {
        return translate(key, language, undefined, paramsOrFallback);
      }
      return translate(key, language, paramsOrFallback as Record<string, string | number> | undefined, fallback);
    };
  }, [language]);
  
  return {
    lang: language,
    t,
  };
};

export const translate = (key: string, lang: string, params?: Record<string, string | number>, fallback?: string): string => {
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

// Legacy export for backward compatibility
export const t = translate;


