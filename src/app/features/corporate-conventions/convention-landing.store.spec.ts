import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CcvPublicConvention, CorporateConventionsApiService } from '@core';
import { pass, wrap } from './corporate-conventions.testing';
import { ConventionLandingStore } from './convention-landing.store';

const publicConvention: CcvPublicConvention = {
  slug: 'acme',
  name: 'Acme employees',
  partner_company_name: 'Acme Srl',
  country_code: 'IT',
  valid_to: '2028-12-31',
  primary_color: '#aa0000',
  welcome_message_key: null,
  has_logo: true,
  allow_family_members: true,
  max_family_members: 2,
  verification: {
    work_email_otp: true,
    identifier: true,
    card: true,
    hashed_list: false,
    promo_code: false,
    email_domains: ['@acme.it'],
  },
};

describe('ConventionLandingStore', () => {
  const api = {
    getPublicConvention: vi.fn(),
    publicLogoUrl: vi.fn((slug: string) => `/api/v1/public/conventions/${slug}/logo`),
    requestOtp: vi.fn(),
    verifyOtp: vi.fn(),
    verifyPublicIdentifier: vi.fn(),
    addPublicFamilyMember: vi.fn(),
  };
  let store: InstanceType<typeof ConventionLandingStore>;

  beforeEach(() => {
    api.getPublicConvention.mockReset().mockReturnValue(of(wrap(publicConvention)));
    api.requestOtp.mockReset();
    api.verifyOtp.mockReset();
    api.verifyPublicIdentifier.mockReset();
    api.addPublicFamilyMember.mockReset();
    TestBed.configureTestingModule({
      providers: [
        ConventionLandingStore,
        { provide: CorporateConventionsApiService, useValue: api },
      ],
    });
    store = TestBed.inject(ConventionLandingStore);
  });

  it('opens on the choice of the verification with the branding and the logo', async () => {
    await store.load('acme');

    expect(store.step()).toBe('choose');
    expect(store.convention()?.name).toBe('Acme employees');
    expect(store.verification()?.email_domains).toEqual(['@acme.it']);
    expect(store.logoUrl()).toBe('/api/v1/public/conventions/acme/logo');
  });

  it('shows the unavailable step for a convention that is not in force', async () => {
    api.getPublicConvention.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 404 })),
    );

    await store.load('old');

    expect(store.step()).toBe('unavailable');
    expect(store.convention()).toBeNull();
  });

  it('asks for the code after the e-mail is accepted and activates the pass when the code is right', async () => {
    api.requestOtp.mockReturnValue(
      of(wrap({ expires_at: '2028-01-01T10:10:00Z', ttl_minutes: 10 })),
    );
    api.verifyOtp.mockReturnValue(of(wrap(pass())));
    await store.load('acme');

    expect((await store.requestOtp('mario@acme.it')).ok).toBe(true);
    expect(store.step()).toBe('otp');
    expect(store.email()).toBe('mario@acme.it');

    expect((await store.verifyOtp('123456', 'Mario Rossi')).ok).toBe(true);
    expect(api.verifyOtp).toHaveBeenCalledWith('acme', 'mario@acme.it', '123456', 'Mario Rossi');
    expect(store.step()).toBe('pass');
    expect(store.pass()?.full_name).toBe('Mario Rossi');
    expect(store.canAddFamily()).toBe(true);
  });

  it('stays on the choice when the e-mail domain is refused, with the translation key', async () => {
    api.requestOtp.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 422, error: { code: 'email_domain_not_allowed' } }),
      ),
    );
    await store.load('acme');

    const outcome = await store.requestOtp('mario@other.it');

    expect(outcome.ok).toBe(false);
    expect(outcome.errorKey).toBe('corporateConventions.error.email_domain_not_allowed');
    expect(store.step()).toBe('choose');
    expect(store.busy()).toBe(false);
  });

  it('keeps the code step after a wrong code and lets the employee go back', async () => {
    api.requestOtp.mockReturnValue(of(wrap({ expires_at: '', ttl_minutes: 10 })));
    api.verifyOtp.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 422, error: { code: 'otp_invalid' } })),
    );
    await store.load('acme');
    await store.requestOtp('mario@acme.it');

    const outcome = await store.verifyOtp('000000', 'Mario Rossi');

    expect(outcome.code).toBe('otp_invalid');
    expect(store.step()).toBe('otp');
    store.backToChoice();
    expect(store.step()).toBe('choose');
    expect(store.email()).toBe('');
  });

  it('verifies a card, matricola or promo code instead of the e-mail', async () => {
    api.verifyPublicIdentifier.mockReturnValue(of(wrap(pass())));
    await store.load('acme');

    const outcome = await store.verifyIdentifier('AC123456', 'Mario Rossi');

    expect(outcome.ok).toBe(true);
    expect(api.verifyPublicIdentifier).toHaveBeenCalledWith(
      'acme',
      'AC123456',
      'Mario Rossi',
      undefined,
    );
    expect(store.step()).toBe('pass');
  });

  it('adds a family member from the pass and refuses once the limit is reached', async () => {
    api.verifyPublicIdentifier.mockReturnValue(of(wrap(pass())));
    await store.load('acme');
    await store.verifyIdentifier('AC123456', 'Mario Rossi');

    api.addPublicFamilyMember.mockReturnValue(
      of(
        wrap(
          pass({
            family_members: [
              {
                wallet_pass_id: 'f-1',
                full_name: 'Anna',
                relationship: 'SPOUSE',
                status: 'ACTIVE',
              },
            ],
            can_add_family_member: false,
          }),
        ),
      ),
    );
    expect((await store.addFamilyMember('Anna', 'SPOUSE')).ok).toBe(true);
    expect(store.pass()?.family_members).toHaveLength(1);
    expect(store.canAddFamily()).toBe(false);

    api.addPublicFamilyMember.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { code: 'family_limit_reached', params: { max: 1 } },
          }),
      ),
    );
    const refused = await store.addFamilyMember('Luca', 'CHILD');
    expect(refused.errorKey).toBe('corporateConventions.error.family_limit_reached');
    expect(refused.params).toEqual({ max: 1 });
  });
});
