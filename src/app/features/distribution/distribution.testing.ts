import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { vi } from 'vitest';
import { DistributionApiService, DstRef, PermissionsService, TranslateService } from '@core';
import { I18nService } from '@core/i18n/i18n.service';
import { icons } from '../../icons-provider';

export const ref = (code: string): DstRef => ({ id: `w-${code}`, code, name: `Warehouse ${code}` });

export const envelope = <T>(data: T, meta: Record<string, unknown> = {}) => ({
  success: true,
  message: '',
  data,
  meta,
});

export const messageSpy = { success: vi.fn(), error: vi.fn() };

/** TestBed providers shared by the distribution screens: a mocked API, a pass-through translation and a writer. */
export function provideDistributionTesting(api: Record<string, unknown>, canWrite = true): void {
  TestBed.configureTestingModule({
    providers: [
      { provide: DistributionApiService, useValue: api },
      { provide: PermissionsService, useValue: { canWrite: () => canWrite } },
      { provide: NzMessageService, useValue: messageSpy },
      {
        provide: TranslateService,
        useValue: {
          instant: vi.fn((key: string) => key),
          translate: vi.fn((key: string) => key),
          currentLanguage: signal('en'),
        },
      },
      { provide: I18nService, useValue: { translate: (key: string) => key } },
      provideNzIcons(icons),
    ],
  });
}

export const bodyRows = (root: HTMLElement): HTMLElement[] =>
  Array.from(root.querySelectorAll<HTMLElement>('tbody tr')).filter((row) =>
    row.querySelector('td'),
  );
