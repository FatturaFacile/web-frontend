import { TestBed } from '@angular/core/testing';
import { describe, beforeEach, it, expect } from 'vitest';
import { I18nService } from '@core';
import { TranslatePipe } from './translate.pipe';

describe('TranslatePipe', () => {
  let pipe: TranslatePipe;
  let i18nService: I18nService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [I18nService, TranslatePipe],
    });
    i18nService = TestBed.inject(I18nService);
    pipe = TestBed.inject(TranslatePipe);
    i18nService.setLanguage('en');
  });

  it('should translate key to English by default', () => {
    const translated = pipe.transform('NAV.DASHBOARD');
    expect(translated).toBe('Dashboard & Overview');
  });

  it('should translate key to Italian when language changes', () => {
    i18nService.setLanguage('it');
    expect(pipe.transform('NAV.DASHBOARD')).toBe('Dashboard & Panoramica');
  });

  it('should translate key to German', () => {
    i18nService.setLanguage('de');
    expect(pipe.transform('NAV.DASHBOARD')).toBe('Dashboard & Übersicht');
  });

  it('should translate key to French', () => {
    i18nService.setLanguage('fr');
    expect(pipe.transform('NAV.DASHBOARD')).toBe('Tableau de bord & Aperçu');
  });

  it('should interpolate parameters properly', () => {
    i18nService.setLanguage('en');
    expect(pipe.transform('ATTENDANCE.ANNUAL_ENTITLEMENT', { days: 25 })).toBe(
      'Annual entitlement: 25 days'
    );
  });

  it('should return raw key if translation does not exist', () => {
    expect(pipe.transform('NON_EXISTENT_KEY_12345')).toBe('NON_EXISTENT_KEY_12345');
  });
});
