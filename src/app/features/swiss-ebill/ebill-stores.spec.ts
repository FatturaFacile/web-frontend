import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SwissEbillApiService } from '@core';
import { CustomerEbillStore } from './customer-ebill.store';
import { EbillDashboardStore } from './ebill-dashboard.store';
import { EbillSettingsStore } from './ebill-settings.store';
import { InvoiceEbillStore } from './invoice-ebill.store';

const envelope = <T>(data: T, meta?: unknown) => of({ success: true, message: '', data, meta });
const refusal = (code: string, extra: Record<string, unknown> = {}) =>
  throwError(() => new HttpErrorResponse({ status: 422, error: { code, ...extra } }));

describe('swiss eBill stores', () => {
  const api = {
    getSettings: vi.fn(),
    saveSettings: vi.fn(),
    testConnection: vi.fn(),
    rotateWebhookSecret: vi.fn(),
    lookupParticipant: vi.fn(),
    syncCustomer: vi.fn(),
    linkCustomer: vi.fn(),
    getDashboard: vi.fn(),
    listTransmissions: vi.fn(),
    getTransmission: vi.fn(),
    downloadPayload: vi.fn(),
    getInvoiceLifecycle: vi.fn(),
    sendInvoice: vi.fn(),
    reviseTransmission: vi.fn(),
    retryTransmission: vi.fn(),
    cancelTransmission: vi.fn(),
  };

  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    TestBed.configureTestingModule({
      providers: [
        EbillSettingsStore,
        EbillDashboardStore,
        InvoiceEbillStore,
        CustomerEbillStore,
        { provide: SwissEbillApiService, useValue: api },
      ],
    });
  });

  describe('settings', () => {
    it('loads, saves and tests the connection', async () => {
      const store = TestBed.inject(EbillSettingsStore);
      api.getSettings.mockReturnValue(envelope({ id: 's1', biller_id: '41000000000000001' }));
      await store.load();
      expect(store.settings()?.id).toBe('s1');

      api.saveSettings.mockReturnValue(envelope({ id: 's1', biller_id: '41000000000000002' }));
      const saved = await store.save({ biller_id: '41000000000000002' } as never);
      expect(saved.ok).toBe(true);
      expect(store.settings()?.biller_id).toBe('41000000000000002');

      api.testConnection.mockReturnValue(
        envelope({
          result: { reachable: true, authenticated: true, latency_ms: 42, message: 'ok' },
          settings: { id: 's1', connection_status: 'connected' },
        }),
      );
      expect((await store.testConnection()).ok).toBe(true);
      expect(store.connection()?.latency_ms).toBe(42);
      expect(store.testing()).toBe(false);
    });

    it('reports the refusal of a save and of the rotation', async () => {
      const store = TestBed.inject(EbillSettingsStore);
      api.saveSettings.mockReturnValue(refusal('invalid_biller_id'));
      const saved = await store.save({} as never);
      expect(saved.errorKey).toBe('swissEbill.error.invalid_biller_id');
      expect(store.saving()).toBe(false);

      api.rotateWebhookSecret.mockReturnValue(refusal('not_configured'));
      expect((await store.rotateSecret()).ok).toBe(false);

      api.getSettings.mockReturnValue(refusal('ebill_disabled'));
      await store.load();
      expect(store.error()).toBe('swissEbill.error.ebill_disabled');
    });

    it('keeps the plain webhook secret that the rotation returns', async () => {
      const store = TestBed.inject(EbillSettingsStore);
      api.rotateWebhookSecret.mockReturnValue(envelope({ id: 's1', webhook_secret: 'whsec_123' }));

      await store.rotateSecret();

      expect(store.settings()?.webhook_secret).toBe('whsec_123');
    });
  });

  describe('dashboard', () => {
    it('loads the KPIs and the log with the filters', async () => {
      const store = TestBed.inject(EbillDashboardStore);
      api.getDashboard.mockReturnValue(envelope({ total_transmitted: { count: 3, amounts: {} } }));
      api.listTransmissions.mockReturnValue(envelope([{ id: 't1' }], { total: 1 }));

      await store.load({
        ebill_status: 'approved_by_debtor',
        from: '2026-01-01',
        to: '2026-01-31',
      });

      expect(api.getDashboard).toHaveBeenCalledWith('2026-01-01', '2026-01-31');
      expect(api.listTransmissions).toHaveBeenCalledWith({
        ebill_status: 'approved_by_debtor',
        from: '2026-01-01',
        to: '2026-01-31',
      });
      expect(store.kpis()?.total_transmitted.count).toBe(3);
      expect(store.transmissions()).toHaveLength(1);
      expect(store.meta()?.total).toBe(1);
    });

    it('keeps the translated error when the load fails', async () => {
      const store = TestBed.inject(EbillDashboardStore);
      api.getDashboard.mockReturnValue(refusal('ebill_disabled'));
      api.listTransmissions.mockReturnValue(envelope([]));

      await store.load();

      expect(store.error()).toBe('swissEbill.error.ebill_disabled');
      expect(store.loading()).toBe(false);
    });

    it('retries, cancels and downloads', async () => {
      const store = TestBed.inject(EbillDashboardStore);
      api.retryTransmission.mockReturnValue(envelope({ id: 't1' }));
      api.cancelTransmission.mockReturnValue(refusal('cannot_cancel'));
      api.downloadPayload.mockReturnValue(of(new Blob(['<xml/>'])));
      api.getTransmission.mockReturnValue(envelope({ id: 't1', events: [] }));

      expect((await store.retry('t1')).ok).toBe(true);
      expect((await store.cancel('t1')).errorKey).toBe('swissEbill.error.cannot_cancel');
      expect(await store.download('t1')).toBeInstanceOf(Blob);
      expect((await store.detail('t1'))?.id).toBe('t1');
    });
  });

  describe('invoice lifecycle', () => {
    it('loads the lifecycle, then reloads it after a send', async () => {
      const store = TestBed.inject(InvoiceEbillStore);
      api.getInvoiceLifecycle.mockReturnValue(
        envelope({ transmissions: [], violations: [], can_send: true }),
      );
      api.sendInvoice.mockReturnValue(envelope({ id: 't1' }));

      await store.load('inv-1');
      expect(store.lifecycle()?.can_send).toBe(true);

      const outcome = await store.send();
      expect(outcome.ok).toBe(true);
      expect(api.sendInvoice).toHaveBeenCalledWith('inv-1');
      expect(api.getInvoiceLifecycle).toHaveBeenCalledTimes(2);
      expect(store.working()).toBe(false);
    });

    it('keeps the pre-flight violations of a refused send', async () => {
      const store = TestBed.inject(InvoiceEbillStore);
      api.getInvoiceLifecycle.mockReturnValue(
        envelope({ transmissions: [], violations: [], can_send: true }),
      );
      api.sendInvoice.mockReturnValue(
        refusal('payload_invalid', {
          violations: [{ code: 'recipient_not_enrolled', field: 'contact' }],
        }),
      );
      await store.load('inv-1');

      const outcome = await store.send();

      expect(outcome.ok).toBe(false);
      expect(store.violations()).toEqual([{ code: 'recipient_not_enrolled', field: 'contact' }]);
    });

    it('revises, retries and cancels a transmission', async () => {
      const store = TestBed.inject(InvoiceEbillStore);
      api.getInvoiceLifecycle.mockReturnValue(
        envelope({ transmissions: [], violations: [], can_send: false }),
      );
      api.reviseTransmission.mockReturnValue(envelope({ id: 't2' }));
      api.retryTransmission.mockReturnValue(envelope({ id: 't1' }));
      api.cancelTransmission.mockReturnValue(envelope({ id: 't1' }));
      await store.load('inv-1');

      expect((await store.revise('t1')).ok).toBe(true);
      expect((await store.retry('t1')).ok).toBe(true);
      expect((await store.cancel('t1')).ok).toBe(true);
      expect(api.reviseTransmission).toHaveBeenCalledWith('t1');
    });
  });

  describe('customer card', () => {
    it('syncs the customer with the directory', async () => {
      const store = TestBed.inject(CustomerEbillStore);
      api.syncCustomer.mockReturnValue(
        envelope({
          customer: { id: 'c1', ebill_status: 'enrolled' },
          participant: { participant_id: 'P1', status: 'enrolled' },
        }),
      );

      const outcome = await store.sync('c1', true);

      expect(outcome.ok).toBe(true);
      expect(api.syncCustomer).toHaveBeenCalledWith('c1', true);
      expect(store.customer()?.ebill_status).toBe('enrolled');
      expect(store.participant()?.participant_id).toBe('P1');
      expect(store.looked()).toBe(true);
    });

    it('tells a lookup without a match from a lookup not asked yet', async () => {
      const store = TestBed.inject(CustomerEbillStore);
      expect(store.looked()).toBe(false);
      api.lookupParticipant.mockReturnValue(envelope(null));

      await store.lookup({ lookup_type: 'email', lookup_value: 'nobody@example.com' });

      expect(store.participant()).toBeNull();
      expect(store.looked()).toBe(true);
    });

    it('links the matched participant and reports a refusal', async () => {
      const store = TestBed.inject(CustomerEbillStore);
      api.linkCustomer.mockReturnValueOnce(
        envelope({ customer: { id: 'c1', ebill_recipient_id: 'P1', ebill_status: 'enrolled' } }),
      );
      expect((await store.link('c1', 'P1')).ok).toBe(true);
      expect(store.customer()?.ebill_recipient_id).toBe('P1');

      api.linkCustomer.mockReturnValueOnce(refusal('participant_not_found'));
      expect((await store.link('c1', 'X')).errorKey).toBe('swissEbill.error.participant_not_found');
      expect(store.working()).toBe(false);
    });

    it('keeps the lookup result when the customer data is refreshed', () => {
      const store = TestBed.inject(CustomerEbillStore);
      api.lookupParticipant.mockReturnValue(envelope({ participant_id: 'P1', status: 'enrolled' }));

      return store.lookup({ lookup_type: 'participant_id', lookup_value: 'P1' }).then(() => {
        store.init({ id: 'c1' } as never);
        expect(store.participant()?.participant_id).toBe('P1');
      });
    });
  });
});
