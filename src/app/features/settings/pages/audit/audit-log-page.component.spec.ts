import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditEntry, AuditLedgerApiService, TranslateService } from '@core';
import { AuditLogPageComponent } from './audit-log-page.component';

const entry = (sequence: number, overrides: Partial<AuditEntry> = {}): AuditEntry => ({
  id: `e${sequence}`,
  sequence,
  occurred_at: '2026-11-01T10:00:00.000000Z',
  tenant_id: 't1',
  company_id: 't1',
  category: 'crud',
  module: 'CRM',
  action: 'UPDATED',
  resource_type: 'App\\Models\\Contact',
  resource_id: 'c1',
  actor_type: 'user',
  actor_ref: '~pk:abc',
  display_actor: 'Mario Rossi',
  impersonator_ref: null,
  display_impersonator: null,
  changes: { name: { old: 'Before', new: 'After' } },
  context: null,
  previous_hash: 'p',
  hash: 'h',
  key_version: 1,
  hash_version: 2,
  ...overrides,
});

const integrity = {
  status: 'valid',
  tail: { sequence: 3, hash: 'abc' },
  running_run_id: null,
  last_run: null,
  last_checkpoint: null,
};

describe('AuditLogPageComponent', () => {
  const api = {
    search: vi.fn(),
    integrity: vi.fn(),
    verify: vi.fn(),
    requestExport: vi.fn(),
    getExport: vi.fn(),
    downloadExport: vi.fn(),
  };

  async function render(): Promise<ComponentFixture<AuditLogPageComponent>> {
    const fixture = TestBed.createComponent(AuditLogPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  const text = (fixture: ComponentFixture<unknown>) =>
    (fixture.nativeElement as HTMLElement).textContent ?? '';

  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    api.integrity.mockReturnValue(of({ success: true, message: '', data: integrity }));
    TestBed.configureTestingModule({
      providers: [
        provideNzI18n(en_US),
        provideNzDateFnsAdapter(),
        { provide: AuditLedgerApiService, useValue: api },
        {
          provide: TranslateService,
          useValue: {
            currentLanguage: signal('en'),
            translate: (key: string) => (key.startsWith('audit.actions.') ? `t:${key}` : key),
            instant: (key: string) => key,
          },
        },
      ],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('lists the entries of the API with the translated action and the actor', async () => {
    api.search.mockReturnValue(
      of({
        success: true,
        message: '',
        data: [entry(2), entry(1, { display_actor: '[erased subject]', action: 'CREATED' })],
        meta: { next_cursor: null, limit: 50 },
      }),
    );

    const fixture = await render();

    expect(api.search).toHaveBeenCalledWith({}, null, 50);
    const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('tr.row');
    expect(rows).toHaveLength(2);
    expect(text(fixture)).toContain('audit.actions.UPDATED');
    expect(text(fixture)).toContain('Mario Rossi');
    // The erased subject shows the translated label, never the raw marker of the API.
    expect(text(fixture)).toContain('settings.audit.erased');
    expect(text(fixture)).not.toContain('[erased subject]');
    expect(text(fixture)).toContain('settings.audit.end_of_list');
  });

  it('shows the empty state when no entry matches', async () => {
    api.search.mockReturnValue(
      of({ success: true, message: '', data: [], meta: { next_cursor: null, limit: 50 } }),
    );

    const fixture = await render();

    expect(text(fixture)).toContain('settings.audit.empty');
    expect((fixture.nativeElement as HTMLElement).querySelector('nz-result')).toBeNull();
  });

  it('shows an error result and no rows when the API fails: never mock data', async () => {
    api.search.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));

    const fixture = await render();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('nz-result')).not.toBeNull();
    expect(element.querySelectorAll('tr.row')).toHaveLength(0);
    expect(text(fixture)).toContain('settings.audit.error.title');
    expect(text(fixture)).toContain('settings.audit.error.retry');
  });

  it('tells a member without the auditor role that the ledger is forbidden', async () => {
    api.search.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 })));

    const fixture = await render();

    expect(text(fixture)).toContain('settings.audit.error.forbidden');
  });

  it('applies the filters to the API and starts over from the first page', async () => {
    api.search.mockReturnValue(
      of({ success: true, message: '', data: [entry(1)], meta: { next_cursor: null, limit: 50 } }),
    );
    const fixture = await render();
    const page = fixture.componentInstance as unknown as {
      actor: string;
      category: string | null;
      apply(): void;
      reset(): void;
    };

    page.actor = ' Mario ';
    page.category = 'security';
    page.apply();
    await fixture.whenStable();

    expect(api.search).toHaveBeenLastCalledWith(
      expect.objectContaining({ actor: 'Mario', category: 'security' }),
      null,
      50,
    );

    page.reset();
    await fixture.whenStable();
    expect(api.search).toHaveBeenLastCalledWith({}, null, 50);
  });

  it('does not query the API for a window longer than 366 days', async () => {
    api.search.mockReturnValue(
      of({ success: true, message: '', data: [], meta: { next_cursor: null, limit: 50 } }),
    );
    const fixture = await render();
    const page = fixture.componentInstance as unknown as { range: Date[]; apply(): void };
    const calls = api.search.mock.calls.length;

    page.range = [new Date(2024, 0, 1), new Date(2026, 0, 1)];
    page.apply();

    expect(api.search.mock.calls.length).toBe(calls);
  });

  it('offers the next page with a button when the list continues', async () => {
    api.search.mockReturnValue(
      of({ success: true, message: '', data: [entry(2)], meta: { next_cursor: 'c2', limit: 50 } }),
    );

    const fixture = await render();

    expect(text(fixture)).toContain('settings.audit.load_more');
    expect(text(fixture)).not.toContain('settings.audit.end_of_list');
  });
});
