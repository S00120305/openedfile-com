import en from './en.json';
import ja from './ja.json';

const translations = { en, ja } as const;

export type Locale = keyof typeof translations;
export const defaultLocale: Locale = 'en';
export const locales: Locale[] = ['en', 'ja'];

type TranslationValue = string | Record<string, unknown>;
type Translations = typeof en;

export function t(locale: Locale, key: string): string {
  const keys = key.split('.');
  let value: TranslationValue = translations[locale] as unknown as TranslationValue;

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = (value as Record<string, TranslationValue>)[k];
    } else {
      // Fallback to English
      value = translations.en as unknown as TranslationValue;
      for (const fk of keys) {
        if (value && typeof value === 'object' && fk in value) {
          value = (value as Record<string, TranslationValue>)[fk];
        } else {
          return key;
        }
      }
      return typeof value === 'string' ? value : key;
    }
  }

  return typeof value === 'string' ? value : key;
}

export function getLocaleFromUrl(url: URL): Locale {
  const [, lang] = url.pathname.split('/');
  if (locales.includes(lang as Locale)) {
    return lang as Locale;
  }
  return defaultLocale;
}

export function getLocalizedPath(path: string, locale: Locale): string {
  if (locale === defaultLocale) {
    return path;
  }
  return `/${locale}${path}`;
}

export function getAlternateLocaleUrl(currentUrl: URL, targetLocale: Locale): string {
  const currentLocale = getLocaleFromUrl(currentUrl);
  let path = currentUrl.pathname;

  // Remove current locale prefix if present
  if (currentLocale !== defaultLocale) {
    path = path.replace(`/${currentLocale}`, '') || '/';
  }

  // Add target locale prefix
  if (targetLocale === defaultLocale) {
    return path;
  }
  return `/${targetLocale}${path}`;
}
