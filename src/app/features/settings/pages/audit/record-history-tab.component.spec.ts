import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditHistoryItem, AuditLedgerApiService, TranslateService } from '@core';
import { RecordHistoryTabComponent } from './record-history-tab.component';

const item = (sequence: number, overrides: Partial<AuditHistoryItem> = {}): AuditHistoryItem => ({
  id: `h${sequence}`,
  sequence,
  occurred_at: '2026-11-01T10:00:00.000000Z',
  action: 'UPDATED',
  category: 'crud',
  display_actor: 'Mario Rossi',
  display_impersonator: null,
  channel: 'web',
  changed_fields: ['payment_status'],
  changes: null,
  ...overrides,
});

describe('RecordHistoryTabComponent', () => {
  const api = { history: vi.fn() };

  async function render(
    resourceId: string | null = 'inv-1',
  ): Promise<ComponentFixture<RecordHistoryTabComponent>> {
    const fixture = TestBed.createComponent(RecordHistoryTabComponent);
    fixture.componentRef.setInput('resourceType', 'Invoice');
    fixture.componentRef.setInput('resourceId', resourceId);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  const element = (fixture: ComponentFixture<unknown>) => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    api.history.mockReset();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuditLedgerApiService, useValue: api },
        {
          provide: TranslateService,
          useValue: {
            currentLanguage: signal('en'),
            translate: (key: string, params?: Record<string, string | number>) => {
              const base = key.startsWith('audit.actions.') ? `t:${key}` : key;
              return params ? `${base}:${Object.values(params).join(',')}` : base;
            },
            instant: (key: string) => key,
          },
        },
      ],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders the history of the record as a timeline, newest first, with the changed fields', async () => {
    api.history.mockReturnValue(
      of({
        success: true,
        message: '',
        data: [item(2), item(1, { action: 'CREATED', changed_fields: [], display_impersonator: 'Admin Bianchi' })],
      }),
    );

    const fixture = await render();

    expect(api.history).toHaveBeenCalledWith('Invoice', 'inv-1');
    expect(element(fixture).querySelectorAll('nz-timeline-item')).toHaveLength(2);
    expect(element(fixture).textContent).toContain('audit.actions.UPDATED');
    expect(element(fixture).textContent).toContain('payment_status');
    expect(element(fixture).textContent).toContain('audit.history.impersonated_by');
  });

  it('shows the empty message for a record without history', async () => {
    api.history.mockReturnValue(of({ success: true, message: '', data: [] }));

    const fixture = await render();

    expect(element(fixture).textContent).toContain('audit.history.empty');
  });

  it('says the history is not visible on a 403, without a retry button', async () => {
    api.history.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 })));

    const fixture = await render();

    expect(element(fixture).textContent).toContain('audit.history.forbidden');
    expect(element(fixture).textContent).not.toContain('audit.history.retry');
  });

  it('shows an error with a retry on another failure and reloads on retry', async () => {
    api.history.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })));
    api.history.mockReturnValueOnce(of({ success: true, message: '', data: [item(1)] }));

    const fixture = await render();
    expect(element(fixture).textContent).toContain('audit.history.error');

    (element(fixture).querySelector('button') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(api.history).toHaveBeenCalledTimes(2);
    expect(element(fixture).querySelectorAll('nz-timeline-item')).toHaveLength(1);
  });

  it('does not call the API until the record has an id', async () => {
    api.history.mockReturnValue(of({ success: true, message: '', data: [] }));

    await render(null);

    expect(api.history).not.toHaveBeenCalled();
  });

  it('shows the translated label of an erased subject', async () => {
    api.history.mockReturnValue(
      of({ success: true, message: '', data: [item(1, { display_actor: '[erased subject]' })] }),
    );

    const fixture = await render();

    expect(element(fixture).textContent).toContain('settings.audit.erased');
    expect(element(fixture).textContent).not.toContain('[erased subject]');
  });
});
