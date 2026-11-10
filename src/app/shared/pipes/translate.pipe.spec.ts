import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, beforeEach, afterEach, it, expect } from 'vitest';
import { I18nService } from '@core';
import { TranslatePipe } from '@shared/pipes/translate.pipe';

/** What the translations endpoint of the API answers: the strings live only there, the frontend has no copy. */
const API_DICTIONARIES: Record<string, Record<string, string>> = {
  en: {
    'NAV.DASHBOARD': 'Dashboard & Overview',
    'ATTENDANCE.ANNUAL_ENTITLEMENT': 'Annual entitlement: {days} days',
  },
  it: { 'NAV.DASHBOARD': 'Dashboard & Panoramica' },
  de: { 'NAV.DASHBOARD': 'Dashboard & Übersicht' },
  fr: { 'NAV.DASHBOARD': 'Tableau de bord & Aperçu' },
};

describe('TranslatePipe', () => {
  let pipe: TranslatePipe;
  let i18nService: I18nService;
  let http: HttpTestingController;

  /** Answers every pending translations request with the dictionary of its language. */
  const answerApi = (): void =>
    http
      .match((req) => req.url.includes('/translations/'))
      .forEach((req) => {
        const language = req.request.url.split('/').pop()?.split('?')[0] ?? 'en';
        req.flush({ locale: language, translations: API_DICTIONARIES[language] ?? {} });
      });

  const switchTo = async (language: 'en' | 'it' | 'de' | 'fr'): Promise<void> => {
    const loading = i18nService.setLanguage(language);
    answerApi();
    await loading;
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [I18nService, TranslatePipe, provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    i18nService = TestBed.inject(I18nService);
    pipe = TestBed.inject(TranslatePipe);
    answerApi();
    await switchTo('en');
  });

  afterEach(() => {
    http.match(() => true);
  });

  it('should translate key to English by default', () => {
    const translated = pipe.transform('NAV.DASHBOARD');
    expect(translated).toBe('Dashboard & Overview');
  });

  it('should translate key to Italian when language changes', async () => {
    await switchTo('it');
    expect(pipe.transform('NAV.DASHBOARD')).toBe('Dashboard & Panoramica');
  });

  it('should translate key to German', async () => {
    await switchTo('de');
    expect(pipe.transform('NAV.DASHBOARD')).toBe('Dashboard & Übersicht');
  });

  it('should translate key to French', async () => {
    await switchTo('fr');
    expect(pipe.transform('NAV.DASHBOARD')).toBe('Tableau de bord & Aperçu');
  });

  it('should interpolate parameters properly', async () => {
    await switchTo('en');
    expect(pipe.transform('ATTENDANCE.ANNUAL_ENTITLEMENT', { days: 25 })).toBe(
      'Annual entitlement: 25 days'
    );
  });

  it('should return raw key if translation does not exist', () => {
    expect(pipe.transform('NON_EXISTENT_KEY_12345')).toBe('NON_EXISTENT_KEY_12345');
  });
});
