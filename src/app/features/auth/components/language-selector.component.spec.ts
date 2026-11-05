import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthStore, I18nService } from '@core';
import { LanguageSelectorComponent } from './language-selector.component';

describe('LanguageSelectorComponent', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [LanguageSelectorComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  function create() {
    const fixture = TestBed.createComponent(LanguageSelectorComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('offers the four supported languages', () => {
    const codes = create().componentInstance['languages'].map((language) => language.code);
    expect(codes).toEqual(expect.arrayContaining(['it', 'en', 'de', 'fr']));
    expect(codes).toHaveLength(4);
  });

  it('applies the chosen language immediately and remembers it in the browser', () => {
    const fixture = create();

    fixture.componentInstance['onLocaleChange']('de');

    expect(TestBed.inject(I18nService).currentLanguage()).toBe('de');
    expect(TestBed.inject(AuthStore).activeLocale()).toBe('de');
    expect(localStorage.getItem('lang')).toBe('de');
  });

  it('has an accessible name', () => {
    const select = create().nativeElement.querySelector('nz-select');
    expect(select.getAttribute('aria-label')).toBeTruthy();
  });
});
