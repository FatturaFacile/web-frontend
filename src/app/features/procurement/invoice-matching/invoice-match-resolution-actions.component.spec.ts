import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { I18nService } from '@core/i18n';
import { InvoiceMatchingApiService } from '@data-access/procurement/invoice-matching-api.service';
import { provideNzI18n, en_US } from 'ng-zorro-antd/i18n';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InvoiceMatchResolutionActionsComponent } from './invoice-match-resolution-actions.component';
import { matchRun } from './invoice-matching.fixtures';
import { InvoiceMatchingStore } from './invoice-matching.store';

/** The forms are protected: the spec fills them the way the dialogs do. */
interface Harness {
  creditForm: { patchValue(value: unknown): void };
  partialForm: { patchValue(value: unknown): void };
  overrideForm: { patchValue(value: unknown): void; invalid: boolean };
  forbidden(): boolean;
}

describe('InvoiceMatchResolutionActionsComponent', () => {
  const api = {
    requestCreditNote: vi.fn(),
    rematch: vi.fn(),
    partialResolution: vi.fn(),
    override: vi.fn(),
  };
  const message = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };

  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.configureTestingModule({
      providers: [
        InvoiceMatchingStore,
        provideNzI18n(en_US),
        { provide: InvoiceMatchingApiService, useValue: api },
        { provide: NzMessageService, useValue: message },
        {
          provide: I18nService,
          useValue: { currentLanguage: signal<'en'>('en'), translate: vi.fn((key: string) => key) },
        },
      ],
    });
  });

  function create(run = matchRun()) {
    const fixture = TestBed.createComponent(InvoiceMatchResolutionActionsComponent);
    fixture.componentRef.setInput('run', run);
    const resolved = vi.fn();
    fixture.componentInstance.resolved.subscribe(resolved);
    fixture.detectChanges();
    return {
      fixture,
      component: fixture.componentInstance,
      harness: fixture.componentInstance as unknown as Harness,
      resolved,
      root: fixture.nativeElement as HTMLElement,
    };
  }

  it('offers the four actions while the run blocks the payment', () => {
    const { root } = create();
    for (const id of [
      'action-credit-note',
      'action-rematch',
      'action-partial',
      'action-override',
    ]) {
      expect(root.querySelector(`[data-testid="${id}"]`), id).not.toBeNull();
    }
  });

  it('shows no control when the run is not blocking', () => {
    const { root } = create(matchRun({ is_blocking: false, status: 'matched' }));
    expect(root.querySelector('[data-testid="resolution-actions"]')).toBeNull();
  });

  it('sends the reason of the override and emits the released run', async () => {
    const released = matchRun({ status: 'override_approved', is_blocking: false });
    api.override.mockReturnValue(of(released));
    const { component, harness, resolved } = create();

    component.open('override');
    harness.overrideForm.patchValue({ reason: '  Approved by the CFO  ' });
    await component.submitOverride();

    expect(api.override).toHaveBeenCalledWith('run-1', { reason: 'Approved by the CFO' });
    expect(resolved).toHaveBeenCalledWith(released);
    expect(message.success).toHaveBeenCalledWith('invoiceMatching.message.overridden');
  });

  it('refuses an override reason shorter than five characters', async () => {
    const { component, harness } = create();

    component.open('override');
    harness.overrideForm.patchValue({ reason: 'ok' });
    expect(harness.overrideForm.invalid).toBe(true);
    await component.submitOverride();

    expect(api.override).not.toHaveBeenCalled();
  });

  it('shows the translated permission message when the override is forbidden', async () => {
    api.override.mockReturnValue(
      throwError(() => ({ status: 403, error: { message: 'Forbidden' } })),
    );
    const { component, harness, resolved } = create();

    component.open('override');
    harness.overrideForm.patchValue({ reason: 'Approved by the CFO' });
    await component.submitOverride();

    expect(harness.forbidden()).toBe(true);
    expect(message.error).toHaveBeenCalledWith('invoiceMatching.message.overrideForbidden');
    expect(resolved).not.toHaveBeenCalled();
  });

  it('sends the selected blocking lines of a partial resolution', async () => {
    api.partialResolution.mockReturnValue(of(matchRun({ status: 'resolved', is_blocking: false })));
    const { component, harness, resolved } = create();

    component.open('partial');
    component.toggleLine('l-blocking', true);
    component.toggleLine('l-qty', true);
    component.toggleLine('l-qty', false);
    harness.partialForm.patchValue({ reason: 'Accepted price rise' });
    await component.submitPartial();

    expect(api.partialResolution).toHaveBeenCalledWith('run-1', {
      reason: 'Accepted price rise',
      line_ids: ['l-blocking'],
    });
    expect(resolved).toHaveBeenCalledTimes(1);
  });

  it('does not submit a partial resolution without any selected line', async () => {
    const { component, harness } = create();

    component.open('partial');
    harness.partialForm.patchValue({ reason: 'Accepted price rise' });
    await component.submitPartial();

    expect(api.partialResolution).not.toHaveBeenCalled();
    expect(message.warning).toHaveBeenCalledWith('invoiceMatching.message.partialNeedsLines');
  });

  it('requests a credit note with the optional expected amount', async () => {
    api.requestCreditNote.mockReturnValue(of(matchRun({ status: 'pending_credit_note' })));
    const { component, harness } = create();

    component.open('credit_note');
    harness.creditForm.patchValue({ reason: 'Overbilled', expected_credit_amount: 120 });
    await component.submitCreditNote();

    expect(api.requestCreditNote).toHaveBeenCalledWith('run-1', {
      reason: 'Overbilled',
      expected_credit_amount: 120,
    });
  });

  it('re-matches without a reason and emits the new current run', async () => {
    const next = matchRun({
      id: 'run-2',
      trigger: 'rematch',
      status: 'matched',
      is_blocking: false,
    });
    api.rematch.mockReturnValue(of(next));
    const { component, resolved } = create();

    component.open('rematch');
    await component.submitRematch();

    expect(api.rematch).toHaveBeenCalledWith('run-1', {});
    expect(resolved).toHaveBeenCalledWith(next);
  });
});
