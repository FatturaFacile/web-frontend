import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WithholdingRecipientsApiService } from '@core';
import { RecipientsStore } from './recipients.store';
import { certificate, inlNotice, recipient, wrap } from './withholding-recipients.testing';

const problem = (code: string, status = 422) =>
  throwError(() => new HttpErrorResponse({ status, error: { code, detail: code } }));

describe('RecipientsStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let store: InstanceType<typeof RecipientsStore>;

  beforeEach(() => {
    api = {
      getRecipient: vi.fn(() =>
        of(
          wrap(
            recipient('r-1', {
              regime: 'agent_25bis',
              certificates: [certificate('c-1')],
              inl_notifications: [inlNotice('n-1')],
            }),
          ),
        ),
      ),
      getThresholds: vi.fn(() =>
        of(wrap([{ key: 'enasarco_ceiling', current: '100.00', limit: '28000.00', percent: 0 }])),
      ),
      createRecipient: vi.fn(() => of(wrap(recipient('r-9')))),
      updateRecipient: vi.fn(() => of(wrap(recipient('r-1')))),
      deleteRecipient: vi.fn(() => of(wrap(null))),
      createCertificate: vi.fn(() => of(wrap(certificate('c-2')))),
      deleteCertificate: vi.fn(() => of(wrap(null))),
      createInlNotification: vi.fn(() => of(wrap(inlNotice('n-2')))),
      markInlSent: vi.fn(() => of(wrap(inlNotice('n-1', { status: 'sent' })))),
      cancelInl: vi.fn(() => of(wrap(inlNotice('n-1', { status: 'cancelled' })))),
      downloadInl: vi.fn(() => of(new Blob(['pdf']))),
    };
    TestBed.configureTestingModule({
      providers: [RecipientsStore, { provide: WithholdingRecipientsApiService, useValue: api }],
    });
    store = TestBed.inject(RecipientsStore);
  });

  it('opens a recipient with its declarations, INL communications and thresholds', async () => {
    await store.open('r-1');

    expect(store.recipient()?.id).toBe('r-1');
    expect(store.certificates().map((entry) => entry.id)).toEqual(['c-1']);
    expect(store.inlNotifications().map((entry) => entry.id)).toEqual(['n-1']);
    expect(store.thresholds()[0].key).toBe('enasarco_ceiling');
    expect(store.loading()).toBe(false);
  });

  it('reports a failed open with the key of the problem code', async () => {
    api['getRecipient'].mockReturnValue(problem('generic', 404));

    await store.open('r-1');

    expect(store.error()).toBe('withholdingRecipients.error.generic');
    expect(store.recipient()).toBeNull();
  });

  it('creates a recipient and opens the saved one', async () => {
    api['getRecipient'].mockReturnValue(of(wrap(recipient('r-9'))));

    const outcome = await store.save(null, { display_name: 'New', regime: 'occasional_worker' });

    expect(outcome.ok).toBe(true);
    expect(api['createRecipient']).toHaveBeenCalledWith({
      display_name: 'New',
      regime: 'occasional_worker',
    });
    expect(api['updateRecipient']).not.toHaveBeenCalled();
    expect(store.recipient()?.id).toBe('r-9');
    expect(store.saving()).toBe(false);
  });

  it('updates a recipient and returns the field errors of a refusal', async () => {
    expect((await store.save('r-1', { notes: 'x' })).ok).toBe(true);
    expect(api['updateRecipient']).toHaveBeenCalledWith('r-1', { notes: 'x' });

    api['updateRecipient'].mockReturnValue(problem('regime_locked'));
    const refused = await store.save('r-1', { regime: 'amateur_sports' });
    expect(refused.ok).toBe(false);
    expect(refused.errorKey).toBe('withholdingRecipients.error.regime_locked');
    expect(store.saving()).toBe(false);
  });

  it('deletes a recipient, or reports that it has settlements', async () => {
    await store.open('r-1');
    expect((await store.remove('r-1')).ok).toBe(true);
    expect(store.recipient()).toBeNull();

    await store.open('r-1');
    api['deleteRecipient'].mockReturnValue(problem('recipient_has_settlements', 409));
    const refused = await store.remove('r-1');
    expect(refused.errorKey).toBe('withholdingRecipients.error.recipient_has_settlements');
    expect(store.recipient()).not.toBeNull();
  });

  it('adds and removes a declaration and reads the recipient again', async () => {
    await store.open('r-1');
    api['getRecipient'].mockClear();
    const payload = {
      fiscal_year: 2027,
      received_on: '2026-12-01',
      valid_from: '2027-01-01',
      valid_to: '2027-12-31',
      pec_message_id: null,
      pec_archive_reference: null,
      notes: null,
    };

    expect((await store.addCertificate('r-1', payload)).ok).toBe(true);
    expect(api['createCertificate']).toHaveBeenCalledWith('r-1', payload);
    expect((await store.removeCertificate('r-1', 'c-1')).ok).toBe(true);
    expect(api['deleteCertificate']).toHaveBeenCalledWith('c-1');
    expect(api['getRecipient']).toHaveBeenCalledTimes(2);

    api['createCertificate'].mockReturnValue(problem('certificate_not_applicable'));
    expect((await store.addCertificate('r-1', payload)).errorKey).toBe(
      'withholdingRecipients.error.certificate_not_applicable',
    );
  });

  it('generates, sends and cancels an INL communication', async () => {
    const payload = {
      work_start_date: '2026-05-01',
      work_end_date: '2026-05-03',
      activity_description: 'Talk',
      work_place: null,
      estimated_compensation: 300,
    };

    expect((await store.addInl('r-1', payload)).ok).toBe(true);
    expect(api['createInlNotification']).toHaveBeenCalledWith('r-1', payload);

    expect((await store.markInlSent('r-1', 'n-1', { protocol_reference: 'P-1' })).ok).toBe(true);
    expect(api['markInlSent']).toHaveBeenCalledWith('n-1', { protocol_reference: 'P-1' });

    api['cancelInl'].mockReturnValue(problem('inl_cancelled'));
    expect((await store.cancelInl('r-1', 'n-1')).errorKey).toBe(
      'withholdingRecipients.error.inl_cancelled',
    );
  });

  it('downloads a communication as a file, or answers the refusal of the API', async () => {
    const file = await store.downloadInl('n-1', 'pdf');
    expect(file.ok).toBe(true);
    expect(file.filename).toBe('inl-n-1.pdf');
    expect(file.blob).toBeInstanceOf(Blob);

    api['downloadInl'].mockReturnValue(problem('inl_not_applicable'));
    const refused = await store.downloadInl('n-1', 'xml');
    expect(refused.ok).toBe(false);
    expect(refused.blob).toBeNull();
    expect(refused.errorKey).toBe('withholdingRecipients.error.inl_not_applicable');
  });

  it('forgets the recipient on reset', async () => {
    await store.open('r-1');
    store.reset();

    expect(store.recipient()).toBeNull();
    expect(store.thresholds()).toEqual([]);
  });
});
