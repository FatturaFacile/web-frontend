import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { baseProviders, page, revaluation, settle, wrap } from './currency-fx.testing';
import { FxRevaluationWizardComponent } from './fx-revaluation-wizard.component';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

describe('FxRevaluationWizardComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let message: {
    success: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    warning: ReturnType<typeof vi.fn>;
  };
  const draft = revaluation('r-1');
  const posted = revaluation('r-1', {
    status: 'posted',
    journal_entry_id: 'je-1',
    posted_at: '2026-11-26T09:00:00Z',
  });

  beforeEach(() => {
    message = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };
    api = {
      listRevaluations: vi.fn(() =>
        of(page([revaluation('r-0', { status: 'posted', period_end: '2026-09-30' })])),
      ),
      simulateRevaluation: vi.fn(() => of(wrap(draft))),
      getRevaluation: vi.fn(() => of(wrap(posted))),
      postRevaluation: vi.fn(() => of(wrap(posted))),
      reverseRevaluation: vi.fn(() =>
        of(wrap(revaluation('r-1', { status: 'reversed', reversal_journal_entry_id: 'je-2' }))),
      ),
    };
    TestBed.configureTestingModule({ providers: baseProviders(api, message) });
  });

  async function render() {
    const fixture = TestBed.createComponent(FxRevaluationWizardComponent);
    await settle(fixture);
    return {
      fixture,
      component: fixture.componentInstance,
      root: fixture.nativeElement as HTMLElement,
    };
  }

  async function simulate(
    fixture: Awaited<ReturnType<typeof render>>['fixture'],
    component: FxRevaluationWizardComponent,
  ) {
    component.form.patchValue({ period_end: '2026-10-31', period_type: 'monthly' });
    await component.simulate();
    await settle(fixture);
  }

  it('starts at the period step with the list of past revaluations', async () => {
    const { component, root } = await render();

    expect(component.step()).toBe(0);
    expect(root.querySelector('form.period-form')).not.toBeNull();
    expect(root.querySelectorAll('nz-step')).toHaveLength(3);
    expect(root.querySelectorAll('tbody tr.ant-table-row')).toHaveLength(1);
    expect(root.textContent).toContain('2026-09-30');
  });

  it('simulates the chosen period and shows the lines and the totals (step 2)', async () => {
    const { fixture, component, root } = await render();

    component.form.patchValue({
      period_end: '2026-10-31',
      period_type: 'quarterly',
      currencies: ['eur', 'xx', ' usd '],
    });
    await component.simulate();
    await settle(fixture);

    expect(api['simulateRevaluation']).toHaveBeenCalledWith({
      period_end: '2026-10-31',
      period_type: 'quarterly',
      currencies: ['EUR', 'USD'],
    });
    expect(component.step()).toBe(1);
    expect(root.querySelectorAll('nz-table tbody tr.ant-table-row').length).toBeGreaterThanOrEqual(
      2,
    );
    expect(root.textContent).toContain('INV-1');
    expect(root.querySelector('.total-gain')?.textContent).toContain('120.00 CHF');
    expect(root.querySelector('.total-loss')?.textContent).toContain('20.00 CHF');
    expect(root.querySelector('.total-net')?.textContent).toContain('100.00 CHF');
    expect(root.textContent).toContain('FINANCE.FX_REVALUATION.RESULT.gain');
    expect(root.textContent).toContain('FINANCE.FX_REVALUATION.RESULT.loss');
  });

  it('does not send the optional currencies filter when it is empty', async () => {
    const { fixture, component } = await render();

    await simulate(fixture, component);

    expect(api['simulateRevaluation']).toHaveBeenCalledWith({
      period_end: '2026-10-31',
      period_type: 'monthly',
    });
  });

  it('does not simulate without a period end', async () => {
    const { component } = await render();
    component.form.patchValue({ period_end: '' });

    await component.simulate();

    expect(api['simulateRevaluation']).not.toHaveBeenCalled();
    expect(component.step()).toBe(0);
  });

  it('posts with an Idempotency-Key (a UUID) and shows the posted state with the reverse action', async () => {
    const { fixture, component, root } = await render();
    await simulate(fixture, component);
    component.step.set(2);
    await settle(fixture);

    await component.post();
    await settle(fixture);

    expect(api['postRevaluation']).toHaveBeenCalledTimes(1);
    const [id, key] = api['postRevaluation'].mock.calls[0];
    expect(id).toBe('r-1');
    expect(key).toMatch(UUID);
    expect(component.run()?.status).toBe('posted');
    expect(root.querySelector('.posted')).not.toBeNull();
    expect(root.querySelector('.reverse')).not.toBeNull();
    expect(root.querySelector('.post')).toBeNull();
  });

  it('keeps the same Idempotency-Key when the posting is retried', async () => {
    api['postRevaluation']
      .mockReturnValueOnce(
        throwError(() => new HttpErrorResponse({ status: 500, error: { message: 'Boom' } })),
      )
      .mockReturnValueOnce(of(wrap(posted)));
    const { fixture, component } = await render();
    await simulate(fixture, component);

    await component.post();
    expect(component.error()).toBe('FINANCE.FX_REVALUATION.ERROR.POST_FAILED');
    await component.post();

    const keys = api['postRevaluation'].mock.calls.map((call) => call[1]);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
    expect(component.run()?.status).toBe('posted');
    expect(component.error()).toBeNull();
  });

  it('uses a new key for a new run of the wizard', async () => {
    const { fixture, component } = await render();
    await simulate(fixture, component);
    await component.post();
    component.restart();
    await simulate(fixture, component);
    await component.post();

    const keys = api['postRevaluation'].mock.calls.map((call) => call[1]);
    expect(keys).toHaveLength(2);
    expect(keys[0]).not.toBe(keys[1]);
  });

  it('shows the already posted state on a 409 and reloads the revaluation', async () => {
    api['postRevaluation'].mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 409, error: { message: 'Already posted' } }),
      ),
    );
    const { fixture, component, root } = await render();
    await simulate(fixture, component);
    component.step.set(2);

    await component.post();
    await settle(fixture);

    expect(component.alreadyPosted()).toBe(true);
    expect(api['getRevaluation']).toHaveBeenCalledWith('r-1');
    expect(component.run()?.status).toBe('posted');
    expect(root.querySelector('.already-posted')?.textContent).toContain(
      'FINANCE.FX_REVALUATION.MESSAGE.ALREADY_POSTED',
    );
    expect(component.error()).toBeNull();
  });

  it('reverses a posted revaluation', async () => {
    const { fixture, component, root } = await render();
    await simulate(fixture, component);
    await component.post();
    await settle(fixture);

    await component.reverse();
    await settle(fixture);

    expect(api['reverseRevaluation']).toHaveBeenCalledWith('r-1');
    expect(component.run()?.status).toBe('reversed');
    expect(root.querySelector('.reversed')).not.toBeNull();
    expect(root.querySelector('.reverse')).toBeNull();
  });

  it('warns when the revaluation to reverse is not posted (409)', async () => {
    api['reverseRevaluation'].mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409, error: { message: 'Not posted' } })),
    );
    const { fixture, component } = await render();
    await simulate(fixture, component);
    await component.post();

    await component.reverse();

    expect(message.warning).toHaveBeenCalledWith('FINANCE.FX_REVALUATION.MESSAGE.NOT_POSTED');
    expect(component.error()).toBeNull();
  });

  it('opens a past draft at the preview and a posted one at the result', async () => {
    const { component } = await render();
    api['getRevaluation']
      .mockReturnValueOnce(of(wrap(draft)))
      .mockReturnValueOnce(of(wrap(posted)));

    await component.open(draft);
    expect(component.step()).toBe(1);

    await component.open(posted);
    expect(component.step()).toBe(2);
  });
});
