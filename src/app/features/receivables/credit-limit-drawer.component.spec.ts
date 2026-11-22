import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ArCreditLimit, TranslateService } from '@core';
import { icons } from '../../icons-provider';
import { CreditLimitDrawerComponent, LimitSubmit } from './credit-limit-drawer.component';
import { limit } from './receivables.fixtures';

const translateSpy = {
  instant: vi.fn((key: string) => key),
  translate: vi.fn((key: string) => key),
  currentLanguage: signal('en'),
};

describe('CreditLimitDrawerComponent', () => {
  let fixture: ComponentFixture<CreditLimitDrawerComponent>;
  let submitted: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: TranslateService, useValue: translateSpy }, provideNzIcons(icons)],
    });
  });

  afterEach(() => fixture?.destroy());

  async function open(existing: ArCreditLimit | null = null, inputs: Record<string, unknown> = {}) {
    fixture = TestBed.createComponent(CreditLimitDrawerComponent);
    submitted = vi.fn();
    fixture.componentInstance.submitted.subscribe(submitted);
    fixture.componentRef.setInput('customerId', 'c-1');
    fixture.componentRef.setInput('limit', existing);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('opens an empty form for a new limit in the given currency, valid from today', async () => {
    const component = await open(null, { currency: 'CHF' });

    expect(component.draft().currency).toBe('CHF');
    expect(component.draft().granted_limit).toBe('');
    expect(component.draft().valid_from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(document.body.textContent).toContain('AR.NEW_LIMIT');
  });

  it('opens an edit form with the values of the limit', async () => {
    const component = await open(limit());

    expect(component.draft().granted_limit).toBe('2000.00');
    expect(component.draft().insurer_name).toBe('Allianz Trade');
    expect(document.body.textContent).toContain('AR.EDIT_LIMIT');
  });

  it('does not submit an invalid form and shows what is wrong only after the attempt', async () => {
    const component = await open(null);
    expect(component.error('granted_limit')).toBeNull();

    component.submit();
    fixture.detectChanges();

    expect(submitted).not.toHaveBeenCalled();
    expect(component.error('granted_limit')).toBe('AR.ERR_REQUIRED');
    expect(document.body.textContent).toContain('AR.ERR_REQUIRED');
  });

  it('submits a new limit with the customer', async () => {
    const component = await open(null);

    component.set('granted_limit', '5000.00');
    component.set('reaction_policy', 'credit_hold');
    component.set('max_overdue_days', '30');
    component.submit();

    expect(submitted).toHaveBeenCalledTimes(1);
    const event = submitted.mock.calls[0][0] as LimitSubmit;
    expect(event.id).toBeNull();
    expect(event.payload).toMatchObject({
      customer_id: 'c-1',
      granted_limit: '5000.00',
      reaction_policy: 'credit_hold',
      max_overdue_days: 30,
    });
  });

  it('submits an edit as an update of the limit without the customer', async () => {
    const component = await open(limit());

    component.set('granted_limit', '2500.00');
    component.set('is_active', false);
    component.submit();

    const event = submitted.mock.calls[0][0] as LimitSubmit;
    expect(event.id).toBe('lim-1');
    expect('customer_id' in event.payload).toBe(false);
    expect(event.payload).toMatchObject({ granted_limit: '2500.00', is_active: false });
  });

  it('turns a cleared date or a cleared input into an empty value', async () => {
    const component = await open(limit({ valid_to: '2026-12-31' }));

    component.set('valid_to', component.iso(null));
    component.set('notes', null);

    expect(component.draft().valid_to).toBe('');
    expect(component.draft().notes).toBe('');
  });

  it('shows the errors the API refused the save with', async () => {
    const component = await open(limit(), {
      serverErrors: { valid_to: ['The end cannot precede the start.'] },
      serverMessage: 'The limit could not be saved',
    });

    expect(component.error('valid_to')).toBe('The end cannot precede the start.');
    expect(document.body.textContent).toContain('The limit could not be saved');
    expect(document.body.textContent).toContain('The end cannot precede the start.');
  });
});
