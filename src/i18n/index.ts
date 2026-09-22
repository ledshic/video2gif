import { en, type Messages } from './en';
import { zhCN } from './zh-CN';

export type Locale = 'en' | 'zh-CN';
export type { Messages };

export const LOCALES: readonly Locale[] = ['en', 'zh-CN'] as const;
export const STORAGE_KEY = 'video2gif.locale';

export const dictionaries: Record<Locale, Messages> = {
  en,
  'zh-CN': zhCN,
};

type Join<K, P> = K extends string
  ? P extends string
    ? `${K}.${P}`
    : never
  : never;

export type MessageKey = {
  [K in keyof Messages & string]: Messages[K] extends string
    ? K
    : Messages[K] extends Record<string, unknown>
      ? Join<K, NestedStringKeys<Messages[K]>>
      : never;
}[keyof Messages & string];

type NestedStringKeys<T> = {
  [K in keyof T & string]: T[K] extends string
    ? K
    : T[K] extends Record<string, unknown>
      ? Join<K, NestedStringKeys<T[K]>>
      : never;
}[keyof T & string];

export type Vars = Record<string, string | number>;

export function isLocale(value: string | null | undefined): value is Locale {
  return value === 'en' || value === 'zh-CN';
}

export function detectLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLocale(saved)) return saved;
  } catch {
    // ignore (SSR / private mode)
  }
  const nav =
    typeof navigator !== 'undefined' ? navigator.language.toLowerCase() : '';
  return nav.startsWith('zh') ? 'zh-CN' : 'en';
}

export function htmlLang(locale: Locale): string {
  return locale === 'zh-CN' ? 'zh-CN' : 'en';
}

function lookup(messages: Messages, key: MessageKey): string {
  const parts = key.split('.');
  let cur: unknown = messages;
  for (const part of parts) {
    if (cur && typeof cur === 'object' && part in cur) {
      cur = (cur as Record<string, unknown>)[part];
    } else {
      return key;
    }
  }
  return typeof cur === 'string' ? cur : key;
}

export function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    vars[name] !== undefined ? String(vars[name]) : `{${name}}`,
  );
}

export function translate(locale: Locale, key: MessageKey, vars?: Vars): string {
  return interpolate(lookup(dictionaries[locale], key), vars);
}

export type TFunction = (key: MessageKey, vars?: Vars) => string;
