import { TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExportsApiService, PermissionsService } from '@core';
import { icons } from '../../icons-provider';
import { ExportsComponent } from './exports.component';

interface Submittable { submit(p: object): { subscribe(o?: object): void } }

describe('ExportsComponent', () => {
  const api = { downloadAccountantArchive: vi.fn(), downloadDatasetCsv: vi.fn() };
  const createObjectURL = vi.fn().mockReturnValue('blob:x');

  function setup(canWrite = true) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideNzIcons(icons),
        { provide: ExportsApiService, useValue: api },
        {
          provide: PermissionsService,
          useValue: { canWrite: () => canWrite, canRead: () => true },
        },
        { provide: NzMessageService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(ExportsComponent);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    HTMLAnchorElement.prototype.click = vi.fn();
  });

  it('downloads the archive of a period', () => {
    api.downloadAccountantArchive.mockReturnValue(of(new Blob(['zip'])));
    const page = setup().componentInstance as unknown as { archiveConfig: Submittable };
    page.archiveConfig.submit({ from: '2026-01-01', to: '2026-03-31' }).subscribe();
    expect(api.downloadAccountantArchive).toHaveBeenCalledWith('2026-01-01', '2026-03-31');
    expect(createObjectURL).toHaveBeenCalled();
  });

  it('downloads a dataset with an optional period', () => {
    api.downloadDatasetCsv.mockReturnValue(of(new Blob(['a;b'])));
    const page = setup().componentInstance as unknown as { csvConfig: Submittable };
    page.csvConfig.submit({ dataset: 'payments' }).subscribe();
    expect(api.downloadDatasetCsv).toHaveBeenCalledWith('payments', {
      from: undefined,
      to: undefined,
    });
    page.csvConfig
      .submit({ dataset: 'invoices', from: '2026-01-01', to: '2026-01-31' })
      .subscribe();
    expect(api.downloadDatasetCsv).toHaveBeenLastCalledWith('invoices', {
      from: '2026-01-01',
      to: '2026-01-31',
    });
  });

  it('disables the downloads for a read-only role', () => {
    const fixture = setup(false);
    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button[type="submit"]'),
    ) as HTMLButtonElement[];
    expect(buttons.length).toBe(2);
    expect(buttons.every((b) => b.disabled)).toBe(true);
  });
});
