import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WithholdingRecipientsApiService } from '@core';
import { SIMULATION_DEBOUNCE_MS, SimulatorStore } from './simulator.store';
import { lookups, recipient, simulation, wrap } from './withholding-recipients.testing';

describe('SimulatorStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let store: InstanceType<typeof SimulatorStore>;

  beforeEach(() => {
    vi.useFakeTimers();
    api = {
      simulate: vi.fn(() => of(wrap(simulation()))),
      getLookups: vi.fn(() => of(wrap(lookups))),
      listRecipients: vi.fn(() =>
        of(
          wrap([
            recipient('r-1'),
            recipient('r-2', { regime: 'agent_25bis', display_name: 'Agent' }),
            recipient('r-3', { is_active: false }),
          ]),
        ),
      ),
    };
    TestBed.configureTestingModule({
      providers: [SimulatorStore, { provide: WithholdingRecipientsApiService, useValue: api }],
    });
    store = TestBed.inject(SimulatorStore);
  });

  afterEach(() => {
    store.dispose();
    vi.useRealTimers();
  });

  it('loads the lookups and the active recipients', async () => {
    await store.init();

    expect(store.lookups()?.regimes).toHaveLength(6);
    expect(store.recipients().map((entry) => entry.id)).toEqual(['r-1', 'r-2']);
  });

  it('does not simulate until there is an amount', async () => {
    store.patch({ regime: 'amateur_sports' });
    await vi.advanceTimersByTimeAsync(SIMULATION_DEBOUNCE_MS);

    expect(store.ready()).toBe(false);
    expect(api['simulate']).not.toHaveBeenCalled();
    expect(store.result()).toBeNull();
  });

  it('waits for the user to stop typing and then simulates once', async () => {
    store.patch({ gross_amount: 1 });
    await vi.advanceTimersByTimeAsync(SIMULATION_DEBOUNCE_MS - 50);
    store.patch({ gross_amount: 10 });
    await vi.advanceTimersByTimeAsync(SIMULATION_DEBOUNCE_MS - 50);
    expect(api['simulate']).not.toHaveBeenCalled();

    store.patch({ gross_amount: 1000 });
    await vi.advanceTimersByTimeAsync(SIMULATION_DEBOUNCE_MS);

    expect(api['simulate']).toHaveBeenCalledTimes(1);
    expect(api['simulate'].mock.calls[0][0]).toMatchObject({
      regime: 'occasional_worker',
      gross_amount: 1000,
    });
    expect(store.result()?.net_payable).toBe('685.40');
    expect(store.loading()).toBe(false);
  });

  it('simulates for a registered recipient, taking its regime', async () => {
    await store.init();

    store.pickRecipient('r-2');
    store.patch({ gross_amount: 500 });
    await vi.advanceTimersByTimeAsync(SIMULATION_DEBOUNCE_MS);

    expect(store.regime()).toBe('agent_25bis');
    expect(store.recipient()?.display_name).toBe('Agent');
    const payload = api['simulate'].mock.calls[0][0];
    expect(payload.recipient_profile_id).toBe('r-2');
    expect(payload).not.toHaveProperty('regime');

    store.pickRecipient(null);
    expect(store.recipient()).toBeNull();
  });

  it('shows the refusal of the API with its translation key', async () => {
    api['simulate'].mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { code: 'service_after_payment', detail: 'Service after payment' },
          }),
      ),
    );

    store.patch({ gross_amount: 100 });
    await vi.advanceTimersByTimeAsync(SIMULATION_DEBOUNCE_MS);

    expect(store.error()).toBe('withholdingRecipients.error.service_after_payment');
    expect(store.detail()).toBe('Service after payment');
    expect(store.result()).toBeNull();
  });

  it('runs at once on request and clears everything on reset', async () => {
    store.patch({ gross_amount: 100 });
    await store.simulate();
    expect(api['simulate']).toHaveBeenCalledTimes(1);
    expect(store.result()).not.toBeNull();

    store.reset();
    await vi.advanceTimersByTimeAsync(SIMULATION_DEBOUNCE_MS);

    expect(store.result()).toBeNull();
    expect(store.form().gross_amount).toBeNull();
    expect(api['simulate']).toHaveBeenCalledTimes(1);
  });
});
