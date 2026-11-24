import { TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExportsApiService, PermissionsService } from '@core';
import { icons } from '../../icons-provider';
import { ExportHistoryComponent } from './export-history.component';
import { ImportMapperComponent } from './import-mapper.component';
import { ExportsComponent } from './exports.component';

interface Submittable { submit(p: object): { subscribe(o?: object): void } }

describe('ExportsComponent', () => {
  const api = {
    downloadAccountantArchive: vi.fn(),
    downloadDatasetCsv: vi.fn(),
    listJobs: vi.fn(),
    listSchedules: vi.fn(),
    createJob: vi.fn(),
    retryJob: vi.fn(),
    getJobLink: vi.fn(),
  };
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
    api.listJobs.mockReturnValue(of({ success: true, message: '', data: [] }));
    api.listSchedules.mockReturnValue(of({ success: true, message: '', data: [] }));
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
    expect(buttons.length).toBe(4);
    expect(buttons.every((b) => b.disabled)).toBe(true);
  });
});

describe('ExportHistoryComponent', () => {
  const job = {
    id: 'j1', dataset: 'invoices', status: 'failed', period_from: null, period_to: null, file_name: null,
    size_bytes: null, row_count: null, error: 'boom', schedule_id: null, is_downloadable: false,
    started_at: null, completed_at: null, expires_at: null, created_at: '2027-03-15T10:00:00Z',
  };
  const api = {
    listJobs: vi.fn(), listSchedules: vi.fn(), createJob: vi.fn(), retryJob: vi.fn(), getJobLink: vi.fn(),
    createSchedule: vi.fn(), updateSchedule: vi.fn(), deleteSchedule: vi.fn(),
  };

  function setup() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideNzIcons(icons),
        { provide: ExportsApiService, useValue: api },
        { provide: NzMessageService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(ExportHistoryComponent);
    fixture.componentRef.setInput('canWrite', true);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    api.listJobs.mockReturnValue(of({ success: true, message: '', data: [job] }));
    api.listSchedules.mockReturnValue(of({ success: true, message: '', data: [] }));
  });

  it('lists the history with the error of a failed export and retries it', () => {
    api.retryJob.mockReturnValue(of({ success: true, message: '', data: job }));
    const fixture = setup();
    expect(fixture.nativeElement.textContent).toContain('boom');
    (fixture.componentInstance as unknown as { retry(j: object): void }).retry(job);
    expect(api.retryJob).toHaveBeenCalledWith('j1');
    expect(api.listJobs).toHaveBeenCalledTimes(2);
  });

  it('opens the signed link of a completed export', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    api.getJobLink.mockReturnValue(of({ success: true, message: '', data: { url: 'https://x/y', expires_in_minutes: 60 } }));
    const fixture = setup();
    (fixture.componentInstance as unknown as { download(j: object): void }).download({ ...job, status: 'completed', is_downloadable: true });
    expect(open).toHaveBeenCalledWith('https://x/y', '_blank', 'noopener');
  });

  it('queues an export from the form', () => {
    api.createJob.mockReturnValue(of({ success: true, message: '', data: job }));
    const page = setup().componentInstance as unknown as { queueConfig: Submittable };
    page.queueConfig.submit({ dataset: 'accountant_archive', from: '2026-01-01', to: '2026-12-31' }).subscribe();
    expect(api.createJob).toHaveBeenCalledWith({ dataset: 'accountant_archive', from: '2026-01-01', to: '2026-12-31' });
  });
});

describe('ImportMapperComponent', () => {
  const api = { previewImport: vi.fn(), importFile: vi.fn() };
  const preview = { headers: ['Company', 'Mail'], sample: [], row_count: 3, fields: ['company_name', 'email'], suggested_mapping: { email: 'Mail' } };

  function setup() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideNzIcons(icons),
        { provide: ExportsApiService, useValue: api },
        { provide: NzMessageService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(ImportMapperComponent);
    fixture.componentRef.setInput('canWrite', true);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    api.previewImport.mockReturnValue(of({ success: true, message: '', data: preview }));
    api.importFile.mockReturnValue(of({ success: true, message: '', data: { dry_run: true, total: 3, created: 2, skipped: 0, failed: 1, duplicates: [], errors: [{ line: 4, messages: ['bad'] }] } }));
  });

  it('suggests the mapping from the preview, lets the user change it and runs a dry run first', () => {
    const fixture = setup();
    const page = fixture.componentInstance as unknown as {
      choose(event: Event): void;
      setMapping(field: string, header: string | null): void;
      run(): void;
      mapping(): Record<string, string>;
      result(): { failed: number } | null;
    };
    const file = new File(['a'], 'contacts.csv');
    page.choose({ target: { files: { item: () => file } } } as unknown as Event);
    expect(api.previewImport).toHaveBeenCalledWith('contacts', file);
    expect(page.mapping()).toEqual({ email: 'Mail' });

    page.setMapping('company_name', 'Company');
    page.run();
    expect(api.importFile).toHaveBeenCalledWith('contacts', file, { email: 'Mail', company_name: 'Company' }, true);
    expect(page.result()?.failed).toBe(1);

    page.setMapping('email', null);
    expect(page.mapping()).toEqual({ company_name: 'Company' });
  });
});
