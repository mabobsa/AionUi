import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import common from '../../services/i18n/locales/ko-KR/common.json';
import login from '../../services/i18n/locales/ko-KR/login.json';

export type { I18nKey, I18nModule } from '../../services/i18n/i18n-keys';
export type { SupportedLanguage } from '@/common/config/i18n';

export const supportedLanguages = ['ko-KR'];
export const normalizeLanguageCode = (_language?: string): 'ko-KR' => 'ko-KR';

void i18n.use(initReactI18next).init({
  resources: { 'ko-KR': { translation: { common, login } } },
  lng: 'ko-KR',
  fallbackLng: 'ko-KR',
  interpolation: { escapeValue: false },
});

document.documentElement.lang = 'ko-KR';
document.documentElement.dir = 'ltr';

let applicationLocale: Promise<void> | undefined;

/** Load conversation translations only after authentication; never fetch user settings for login. */
export function loadApplicationLocale(): Promise<void> {
  applicationLocale ??= import('../../services/i18n/locales/ko-KR').then(({ default: resources }) => {
    i18n.addResourceBundle('ko-KR', 'translation', resources, true, true);
  });
  return applicationLocale;
}

/** This WebUI build is Korean-only; leave the desktop account's language preference untouched. */
export async function changeLanguage(_language: string): Promise<void> {
  await i18n.changeLanguage('ko-KR');
}

export function clearTranslationCache(): void {
  applicationLocale = undefined;
}

export function getLoadedLanguages(): string[] {
  return ['ko-KR'];
}

export default i18n;
