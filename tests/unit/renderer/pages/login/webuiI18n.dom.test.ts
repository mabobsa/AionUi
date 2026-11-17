import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('Korean-only WebUI locale', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    localStorage.setItem('i18nextLng', 'en-US');
  });

  it('starts in Korean independently of the desktop language and loads only login/common resources', async () => {
    const { default: i18n, supportedLanguages } = await import('@renderer/pages/login/webuiI18n');
    expect(supportedLanguages).toEqual(['ko-KR']);
    expect(i18n.language).toBe('ko-KR');
    expect(Object.keys(i18n.getResourceBundle('ko-KR', 'translation'))).toEqual(['common', 'login']);
  });

  it('adds conversation translations after authentication without loading other languages', async () => {
    const { default: i18n, loadApplicationLocale } = await import('@renderer/pages/login/webuiI18n');
    await loadApplicationLocale();
    expect(i18n.hasResourceBundle('en-US', 'translation')).toBe(false);
    expect(i18n.getResourceBundle('ko-KR', 'translation')).toHaveProperty('conversation');
  });

  it('ignores unsupported language requests without changing the saved desktop preference', async () => {
    const { default: i18n, changeLanguage } = await import('@renderer/pages/login/webuiI18n');
    await changeLanguage('en-US');
    expect(i18n.language).toBe('ko-KR');
    expect(document.documentElement.lang).toBe('ko-KR');
    expect(localStorage.getItem('i18nextLng')).toBe('en-US');
  });
});
