import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { I18nService } from '@core';
import { vi } from 'vitest';

/** I18nService stand-in: echoes keys back like the real service does for unknown keys. */
export function i18nStub(): { provide: typeof I18nService; useValue: Partial<I18nService> } {
  return {
    provide: I18nService,
    useValue: {
      currentLanguage: signal('en') as unknown as I18nService['currentLanguage'],
      translate: (key: string) => key,
      instant: (key: string) => key,
    },
  };
}

export function messageStub() {
  return { success: vi.fn(), warning: vi.fn(), error: vi.fn(), info: vi.fn() };
}

export function httpError(status: number, body: unknown = { message: `HTTP ${status}` }): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: body, statusText: String(status) });
}
