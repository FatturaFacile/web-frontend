import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ClientApiService,
  PermissionsService,
  ReceivablesApiService,
  TranslateService,
} from '@core';
import { icons } from '../../icons-provider';
import { CreditPositionComponent } from './credit-position.component';
import { credit, limit, provision, risk } from './receivables.fixtures';

const translateSpy = {
  instant: vi.fn((key: string) => key),
  translate: vi.fn((key: string) => key),
  currentLanguage: signal('en'),
};
const messageSpy = { success: vi.fn(), error: vi.fn() };

describe('CreditPositionComponent', () => {
  let api: Record<
    | 'getCredit'
    | 'getRisk'
    | 'getCreditLimits'
    | 'getProvision'
    | 'getDso'
    | 'createCreditLimit'
    | 'updateCreditLimit'
    | 'deleteCreditLimit'
    | 'grantOverride'
    | 'revokeOverride'
    | 'saveProvisionRates',
    ReturnType<typeof vi.fn>
  >;
  let canWrite: boolean;

  beforeEach(() => {
    vi.clearAllMocks();
    canWrite = true;
    api = {
      getCredit: vi.fn(() => of({ data: credit })),
      getRisk: vi.fn(() => of({ data: risk })),
      getCreditLimits: vi.fn(() =>
        of({ data: [limit(), limit({ id: 'lim-0', valid_to: '2025-12-31', is_active: false })] }),
      ),
      getProvision: vi.fn(() => of({ data: provision })),
      getDso: vi.fn(() =>
        of({
          data: {
            as_of: '2026-03-31',
            period_days: 90,
            currency: 'EUR',
            receivables: '1.00',
            credit_sales: '2.00',
            dso: 54,
          },
        }),
      ),
      createCreditLimit: vi.fn(() => of({ data: limit() })),
      updateCreditLimit: vi.fn(() => of({ data: limit() })),
      deleteCreditLimit: vi.fn(() => of(undefined)),
      grantOverride: vi.fn(() => of({ data: {} })),
      revokeOverride: vi.fn(() => of({ data: {} })),
      saveProvisionRates: vi.fn(() => of({ data: {} })),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'credit', component: CreditPositionComponent },
          { path: 'credit/:customerId', component: CreditPositionComponent },
        ]),
        { provide: ReceivablesApiService, useValue: api },
        {
          provide: ClientApiService,
          useValue: {
            get: vi.fn((id: string) => of({ data: { id, company_name: 'Rossi SRL' } })),
            list: vi.fn(() => of({ data: [], meta: {} })),
          },
        },
        { provide: PermissionsService, useValue: { canWrite: () => canWrite } },
        { provide: NzMessageService, useValue: messageSpy },
        { provide: TranslateService, useValue: translateSpy },
        provideNzIcons(icons),
        provideNzI18n(en_US),
        provideNzDateFnsAdapter(),
      ],
    });
  });

  async function open(url: string) {
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl(url, CreditPositionComponent);
    await harness.fixture.whenStable();
    harness.detectChanges();
    return { harness, component, root: harness.fixture.nativeElement as HTMLElement };
  }

  it('asks for a customer and loads nothing without one', async () => {
    const { root } = await open('/credit');

    expect(root.textContent).toContain('AR.PICK_CUSTOMER_HINT');
    expect(api.getCredit).not.toHaveBeenCalled();
  });

  it('shows the block with its reasons, the exposure components and the risk with its factors', async () => {
    const { root } = await open('/credit/c-1');
    const text = root.textContent as string;

    expect(api.getCredit).toHaveBeenCalledWith('c-1');
    expect(text).toContain('AR.CUSTOMER_BLOCKED');
    expect(text).toContain('AR.BREACH_OVER_LIMIT');
    expect(text).toContain('AR.OPEN_INVOICES');
    expect(text).toContain('AR.UNBILLED_DELIVERY_NOTES');
    expect(text).toContain('AR.CONFIRMED_ORDERS');
    expect(text).toContain('AR.UNRECONCILED_PAYMENTS');
    expect(text).toContain('AR.RATING_HIGH');
    expect(text).toContain('AR.FACTOR_OVERDUE_DAYS');
    expect(text).toContain('125%');
    expect(root.querySelector('nz-progress')).not.toBeNull();
  });

  it('lists the overrides in force and the limit history with the one in force marked', async () => {
    const { root } = await open('/credit/c-1');
    const text = root.textContent as string;

    expect(text).toContain('Strategic account');
    expect(text).toContain('AR.SCOPE_ORDER');
    expect(text).toContain('AR.IN_FORCE');
    expect(text).toContain('AR.INACTIVE');
    expect(text).toContain('AR.POLICY_BLOCK_ORDER');
  });

  it('renders the provision by bucket with the rates', async () => {
    const { root } = await open('/credit/c-1');
    const text = root.textContent as string;

    expect(text).toContain('AR.BUCKET_CURRENT');
    expect(text).toContain('AR.BUCKET_RANGE');
    expect(text).toContain('2.00%');
    expect(text).toContain('AR.DEFAULT_RATE');
    expect(text).toContain('AR.NET_REALIZABLE_VALUE');
  });

  it('shows no limit and no utilisation for a customer without a credit limit', async () => {
    api.getCredit.mockReturnValueOnce(
      of({
        data: {
          ...credit,
          limit: null,
          utilization_percent: null,
          available_credit: null,
          is_blocked: false,
          decision: { ...credit.decision, outcome: 'ok', breaches: [], reason: null },
        },
      }),
    );

    const { root } = await open('/credit/c-1');

    expect(root.textContent).toContain('AR.NO_LIMIT');
    expect(root.querySelector('nz-progress')).toBeNull();
    expect(root.textContent).not.toContain('AR.CUSTOMER_BLOCKED');
  });

  it('hides every write action from a member without write access', async () => {
    canWrite = false;

    const { root } = await open('/credit/c-1');
    const text = root.textContent as string;

    expect(text).not.toContain('AR.NEW_LIMIT');
    expect(text).not.toContain('AR.GRANT_OVERRIDE');
    expect(text).not.toContain('AR.REVOKE');
    expect(text).not.toContain('AR.EDIT_RATES');
    expect(text).not.toContain('AR.DELETE');
  });

  it('creates a limit, then closes the form', async () => {
    const { component } = await open('/credit/c-1');
    component.openNewLimit();
    const payload = {
      customer_id: 'c-1',
      currency: 'EUR',
      granted_limit: '3000.00',
      reaction_policy: 'warning' as const,
      valid_from: '2026-04-01',
    };

    await component.onLimitSubmit({ id: null, payload });

    expect(api.createCreditLimit).toHaveBeenCalledWith(payload);
    expect(component.limitDrawerOpen()).toBe(false);
    expect(messageSpy.success).toHaveBeenCalledWith('AR.LIMIT_SAVED');
  });

  it('keeps the form open with the field errors when the API refuses the limit', async () => {
    const { component } = await open('/credit/c-1');
    component.openEditLimit(limit());
    api.updateCreditLimit.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: {
              message: 'Invalid',
              errors: { valid_to: ['The end cannot precede the start.'] },
            },
          }),
      ),
    );

    await component.onLimitSubmit({ id: 'lim-1', payload: { valid_to: '2020-01-01' } });

    expect(component.limitDrawerOpen()).toBe(true);
    expect(component.limitErrors()).toEqual({ valid_to: ['The end cannot precede the start.'] });
    expect(component.limitMessage()).toBeNull();
  });

  it('deletes a limit', async () => {
    const { component } = await open('/credit/c-1');

    await component.deleteLimit(limit({ id: 'lim-0' }));

    expect(api.deleteCreditLimit).toHaveBeenCalledWith('lim-0');
    expect(messageSpy.success).toHaveBeenCalledWith('AR.LIMIT_DELETED');
  });

  it('needs a reason of at least five characters and a future expiry for an override', async () => {
    const { component } = await open('/credit/c-1');
    component.openOverride();

    expect(component.overrideValid()).toBe(false);
    component.overrideReason.set('Key');
    expect(component.overrideValid()).toBe(false);

    component.overrideReason.set('Key account');
    expect(component.overrideValid()).toBe(true);

    component.overrideExpires.set(new Date(2000, 0, 1));
    expect(component.overrideExpiryInvalid()).toBe(true);
    expect(component.overrideValid()).toBe(false);
  });

  it('grants an override with its scope, reason and expiry', async () => {
    const { component } = await open('/credit/c-1');
    component.openOverride();
    component.overrideScope.set('delivery_note');
    component.overrideReason.set('  Key account  ');
    const expiry = new Date();
    expiry.setFullYear(expiry.getFullYear() + 1);
    component.overrideExpires.set(expiry);

    await component.grantOverride();

    const call = api.grantOverride.mock.calls[0];
    expect(call[0]).toBe('c-1');
    expect(call[1]).toMatchObject({ scope: 'delivery_note', reason: 'Key account' });
    expect(call[1].expires_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(component.overrideOpen()).toBe(false);
    expect(messageSpy.success).toHaveBeenCalledWith('AR.OVERRIDE_GRANTED');
  });

  it('shows the refusal of an override inside the form', async () => {
    const { component } = await open('/credit/c-1');
    component.openOverride();
    component.overrideReason.set('Key account');
    api.grantOverride.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 403, error: { message: 'Forbidden' } })),
    );

    await component.grantOverride();

    expect(component.overrideError()).toBe('Forbidden');
    expect(component.overrideOpen()).toBe(true);
  });

  it('revokes an override with an optional reason', async () => {
    const { component } = await open('/credit/c-1');
    component.startRevoke(credit.overrides[0]);
    component.revokeReason.set(' Paid in full ');

    await component.confirmRevoke();

    expect(api.revokeOverride).toHaveBeenCalledWith('o-1', 'Paid in full');
    expect(component.revokeTarget()).toBeNull();

    component.startRevoke(credit.overrides[0]);
    await component.confirmRevoke();
    expect(api.revokeOverride).toHaveBeenLastCalledWith('o-1', undefined);
  });

  it('edits the provision rates, checks them and saves them as numbers', async () => {
    const { component } = await open('/credit/c-1');

    component.startRates();
    expect(component.ratesDraft()).toEqual({ current: '0.50', '1_30': '2.00' });
    expect(component.ratesValid()).toBe(true);

    component.setRate('1_30', '101');
    expect(component.ratesValid()).toBe(false);
    component.setRate('1_30', '');
    expect(component.ratesValid()).toBe(false);

    component.setRate('1_30', '3.5');
    await component.saveRates();

    expect(api.saveProvisionRates).toHaveBeenCalledWith({ current: 0.5, '1_30': 3.5 });
    expect(component.editingRates()).toBe(false);
    expect(messageSpy.success).toHaveBeenCalledWith('AR.RATES_SAVED');
  });

  it('shows the error of a failed load', async () => {
    api.getCredit.mockReturnValueOnce(
      throwError(
        () => new HttpErrorResponse({ status: 404, error: { message: 'Customer not found' } }),
      ),
    );

    const { root } = await open('/credit/c-9');

    expect(root.textContent).toContain('Customer not found');
  });
});
