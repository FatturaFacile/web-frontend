import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, vi } from 'vitest';
import { of } from 'rxjs';
import { AuthApiService, I18nService } from '@core';
import { SecuritySettingsComponent } from './security-settings.component';
import * as fs from 'node:fs';
import * as path from 'node:path';

const dictionary = (language: string): Record<string, string> =>
  JSON.parse(fs.readFileSync(path.resolve(process.cwd(), `public/assets/i18n/${language}.json`), 'utf8'));

describe('SecuritySettingsComponent', () => {
  async function render(language: 'it' | 'de', enabled: boolean) {
    TestBed.configureTestingModule({
      imports: [SecuritySettingsComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthApiService,
          useValue: {
            getTwoFactorStatus: vi.fn(() =>
              of({
                success: true,
                data: {
                  enabled,
                  pending_setup: false,
                  confirmed_at: enabled ? '2026-11-01T10:00:00Z' : null,
                  remaining_recovery_codes: 7,
                  required_by_tenant: false,
                },
              }),
            ),
            getSessions: vi.fn(() =>
              of({
                success: true,
                data: [
                  [{ kind: 'token', id: '1', name: 'Phone', ip_address: null, user_agent: null, last_used_at: null, expires_at: null, current: false }],
                  [],
                ],
              }),
            ),
          },
        },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    // The dictionaries are answered from the bundled files; the API mock answers synchronously.
    const answerTranslations = () =>
      http
        .match((req) => req.url.includes('/translations/'))
        .forEach((req) => req.flush({ success: true, translations: dictionary(req.request.url.slice(-2)) }));
    const loading = TestBed.inject(I18nService).setLanguage(language);
    answerTranslations();
    await loading;
    const fixture = TestBed.createComponent(SecuritySettingsComponent);
    fixture.detectChanges();
    answerTranslations();
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('shows the page in the language of the user', async () => {
    const text = await render('de', false);

    expect(text).toContain('Zwei-Faktor-Authentifizierung (2FA)');
    expect(text).toContain('Zwei-Faktor-Authentifizierung aktivieren');
    expect(text).toContain('API-Token (Phone)');
    expect(text).not.toContain('Autenticazione');
  });

  it('fills the date and the recovery codes into the sentences', async () => {
    const text = await render('it', true);

    expect(text).toContain('Codici di recupero rimanenti: 7');
    expect(text).toMatch(/attiva sul tuo account dal \d{2}\/11\/2026/);
  });

  it('has every key of the security pages in the four languages', () => {
    const prefixes = ['SECURITY.', 'TWO_FACTOR.', 'TENANT_SECURITY.', 'PROFILE.'];
    const keysOf = (entries: object) =>
      Object.keys(entries).filter((key) => prefixes.some((prefix) => key.startsWith(prefix))).sort();
    const italian = keysOf(dictionary('it'));

    expect(italian.length).toBeGreaterThan(100);
    for (const language of ['en', 'de', 'fr']) {
      expect(keysOf(dictionary(language))).toEqual(italian);
    }
  });
});
