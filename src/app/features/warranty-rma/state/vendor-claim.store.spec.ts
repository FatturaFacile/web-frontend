import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WarrantyRmaApiService } from '@core';
import { httpError, vendorClaimFixture } from '../testing/rma-fixtures';
import { RmaNotifier } from './action-result';
import { VendorClaimStore } from './vendor-claim.store';

describe('VendorClaimStore', () => {
  let store: InstanceType<typeof VendorClaimStore>;
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let notifier: { success: ReturnType<typeof vi.fn>; conflict: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    api = {
      listVendorClaims: vi.fn().mockReturnValue(of({ data: [vendorClaimFixture()], meta: null })),
      patchVendorClaim: vi.fn(),
      transitionVendorClaim: vi.fn(),
    };
    notifier = { success: vi.fn(), conflict: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        VendorClaimStore,
        { provide: WarrantyRmaApiService, useValue: api },
        { provide: RmaNotifier, useValue: notifier },
      ],
    });
    store = TestBed.inject(VendorClaimStore);
  });

  it('loads claims filtered by RMA', () => {
    store.setFilters({ rma_order_id: 'rma-1' });
    expect(api['listVendorClaims']).toHaveBeenLastCalledWith({
      status: null,
      supplier_id: null,
      rma_order_id: 'rma-1',
      page: 1,
    });
    expect(store.items()).toHaveLength(1);
  });

  it('transitions a claim and reloads the list', async () => {
    api['transitionVendorClaim'].mockReturnValue(
      of({ data: vendorClaimFixture({ status: 'approved_credit_note' }) }),
    );
    api['listVendorClaims'].mockClear();
    const res = await store.transition('vc-1', {
      to: 'approved_credit_note',
      credit_note_reference: 'CN-1',
    });
    expect(res.ok).toBe(true);
    expect(api['transitionVendorClaim']).toHaveBeenCalledWith('vc-1', {
      to: 'approved_credit_note',
      credit_note_reference: 'CN-1',
    });
    expect(api['listVendorClaims']).toHaveBeenCalled();
  });

  it('reloads and informs the user when the transition is illegal (409)', async () => {
    api['transitionVendorClaim'].mockReturnValue(httpError(409, { code: 'invalid_transition' }));
    api['listVendorClaims'].mockClear();
    const res = await store.transition('vc-1', { to: 'closed' });
    expect(res.ok).toBe(false);
    expect(notifier.conflict).toHaveBeenCalledWith('invalid_transition');
    expect(api['listVendorClaims']).toHaveBeenCalled();
  });

  it('patches claim references', async () => {
    api['patchVendorClaim'].mockReturnValue(
      of({ data: vendorClaimFixture({ supplier_rma_reference: 'S-1' }) }),
    );
    const res = await store.patch('vc-1', { supplier_rma_reference: 'S-1' });
    expect(res.ok).toBe(true);
  });
});
