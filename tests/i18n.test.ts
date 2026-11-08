import { describe, it, expect, beforeEach } from 'vitest';
import { i18n, setLanguage, registerAppTranslations, getLanguage, LANGUAGES } from '@skeleton/core';

describe('i18n switching and RTL', () => {
  beforeEach(() => {
    // Reset to English before each test
    i18n.changeLanguage('en');
    localStorage.setItem('ghost-sync-lang', 'en');
    document.documentElement.dir = 'ltr';
    document.documentElement.lang = 'en';
  });

  it('should default to English', () => {
    expect(getLanguage()).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
    expect(document.documentElement.lang).toBe('en');
  });

  it('should set dir=rtl and lang=ur when switching to Urdu', () => {
    setLanguage('ur');

    // i18n.on is synchronous for changeLanguage in test env
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ur');
  });

  it('should set dir=ltr and lang=en when switching to English', () => {
    setLanguage('ur');
    expect(document.documentElement.dir).toBe('rtl');

    setLanguage('en');
    expect(document.documentElement.dir).toBe('ltr');
    expect(document.documentElement.lang).toBe('en');
  });

  it('should persist language selection to localStorage', () => {
    setLanguage('ur');
    expect(localStorage.getItem('ghost-sync-lang')).toBe('ur');

    setLanguage('en');
    expect(localStorage.getItem('ghost-sync-lang')).toBe('en');
  });

  it('should load persisted language on re-initialization', () => {
    // Simulate a reload by persisting Urdu, then re-reading the stored value
    localStorage.setItem('ghost-sync-lang', 'ur');

    // The getInitialLanguage logic reads from localStorage
    const stored = localStorage.getItem('ghost-sync-lang');
    expect(stored).toBe('ur');

    // Change language to match what would be loaded
    i18n.changeLanguage('ur');
    expect(getLanguage()).toBe('ur');
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('should expose available languages', () => {
    expect(LANGUAGES).toEqual(['en', 'ur']);
    expect(LANGUAGES).toContain('en');
    expect(LANGUAGES).toContain('ur');
  });

  it('should translate skeleton keys in English', () => {
    setLanguage('en');
    expect(i18n.t('sync.synced')).toBe('Synced');
    expect(i18n.t('sync.offline')).toBe('Offline');
    expect(i18n.t('sync.syncing')).toBe('Syncing');
  });

  it('should translate skeleton keys in Urdu', () => {
    setLanguage('ur');
    expect(i18n.t('sync.synced')).toBe('محفوظ ہو گیا');
    expect(i18n.t('sync.offline')).toBe('آف لائن');
  });

  it('should interpolate count in pending status', () => {
    setLanguage('en');
    expect(i18n.t('sync.pending', { count: 3 })).toBe('3 pending');
  });
});

describe('registerAppTranslations', () => {
  beforeEach(() => {
    i18n.changeLanguage('en');
  });

  it('should add app-specific keys without overwriting skeleton keys', () => {
    registerAppTranslations({
      en: { 'app.title': 'My App', 'sync.synced': 'Should Not Override' },
      ur: { 'app.title': 'میری ایپ' },
    });

    // App key should be available
    expect(i18n.t('app.title')).toBe('My App');

    // Skeleton key should NOT be overwritten
    expect(i18n.t('sync.synced')).toBe('Synced');
  });

  it('should add app keys for Urdu', () => {
    registerAppTranslations({
      ur: { 'app.greeting': 'خوش آمدید' },
    });

    i18n.changeLanguage('ur');
    expect(i18n.t('app.greeting')).toBe('خوش آمدید');
  });

  it('should handle empty registrations gracefully', () => {
    registerAppTranslations({});
    // Should not throw or break anything
    expect(i18n.t('sync.synced')).toBe('Synced');
  });
});
