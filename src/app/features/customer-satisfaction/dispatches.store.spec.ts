import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CustomerSatisfactionApiService } from '@core';
import { DispatchesStore } from './dispatches.store';

const list = (data: unknown[]) =>
  of({ success: true, message: '', data, meta: { total: data.length } });

describe('DispatchesStore', () => {
  const api = {
    listDispatches: vi.fn(),
    listResponses: vi.fn(),
    processDispatches: vi.fn(),
    getLookups: vi.fn(),
    getVoice: vi.fn(),
  };
  let store: InstanceType<typeof DispatchesStore>;

  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    api.listDispatches.mockReturnValue(
      list([{ id: 'd1', status: 'throttled', throttle_reason: 'cooldown_active' }]),
    );
    api.listResponses.mockReturnValue(list([{ id: 'r1', score: 3, has_voice: true }]));
    TestBed.configureTestingModule({
      providers: [DispatchesStore, { provide: CustomerSatisfactionApiService, useValue: api }],
    });
    store = TestBed.inject(DispatchesStore);
  });

  it('lists the dispatches with their throttle reason', async () => {
    await store.loadDispatches({ dispatch_status: 'throttled' });

    expect(api.listDispatches).toHaveBeenCalledWith({ dispatch_status: 'throttled' });
    expect(store.dispatches()[0].throttle_reason).toBe('cooldown_active');
    expect(store.dispatchMeta()?.total).toBe(1);
  });

  it('lists the answers with their comments', async () => {
    await store.loadResponses({ is_detractor: true });

    expect(api.listResponses).toHaveBeenCalledWith({ is_detractor: true });
    expect(store.responses()[0].has_voice).toBe(true);
  });

  it('runs the due invitations and tells how many went out', async () => {
    api.processDispatches.mockReturnValue(
      of({ success: true, message: '', data: { sent: 4, failed: 1, suppressed: 0 } }),
    );

    const outcome = await store.processDue();

    expect(outcome).toMatchObject({ ok: true, sent: 4, failed: 1 });
    expect(store.processing()).toBe(false);
  });

  it('fetches a voice comment through the session, or reports the failure', async () => {
    const audio = new Blob(['voice'], { type: 'audio/webm' });
    api.getVoice.mockReturnValueOnce(of(audio));

    expect(await store.loadVoice('r1')).toBe(audio);
    expect(api.getVoice).toHaveBeenCalledWith('r1');

    api.getVoice.mockReturnValueOnce(throwError(() => new Error('gone')));

    expect(await store.loadVoice('r2')).toBeNull();
    expect(store.error()).toBe('customerSatisfaction.error.generic');
  });
});
