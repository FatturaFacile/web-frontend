import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CcvPublicConvention } from '@core';
import { baseProviders, pass, wrap } from './corporate-conventions.testing';
import { ConventionLandingComponent } from './convention-landing.component';

const convention: CcvPublicConvention = {
  slug: 'acme',
  name: 'Acme employees',
  partner_company_name: 'Acme Srl',
  country_code: 'IT',
  valid_to: '2028-12-31',
  primary_color: '#aa0000',
  welcome_message_key: null,
  has_logo: false,
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

describe('ConventionLandingComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    api = {
      getPublicConvention: vi.fn(() => of(wrap(convention))),
      publicLogoUrl: vi.fn(() => '/logo'),
      passAssetUrl: vi.fn(
        (id: string, file: string) => `/api/v1/public/conventions/passes/${id}/${file}`,
      ),
      requestOtp: vi.fn(() => of(wrap({ expires_at: '2028-01-01T10:10:00Z', ttl_minutes: 10 }))),
      verifyOtp: vi.fn(() => of(wrap(pass()))),
      verifyPublicIdentifier: vi.fn(() => of(wrap(pass()))),
      addPublicFamilyMember: vi.fn(),
    };
    TestBed.configureTestingModule({ providers: baseProviders(api) });
  });

  async function render(): Promise<ComponentFixture<ConventionLandingComponent>> {
    const fixture = TestBed.createComponent(ConventionLandingComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  async function type(
    fixture: ComponentFixture<ConventionLandingComponent>,
    selector: string,
    value: string,
  ): Promise<void> {
    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(selector);
    expect(input, selector).not.toBeNull();
    (input as HTMLInputElement).value = value;
    (input as HTMLInputElement).dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function button(
    fixture: ComponentFixture<ConventionLandingComponent>,
    key: string,
  ): HTMLButtonElement {
    const found = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ).find((candidate) => (candidate.textContent ?? '').includes(key));
    expect(found, key).toBeDefined();
    return found as HTMLButtonElement;
  }

  it('loads the convention of the slug and offers the work e-mail and the card', async () => {
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;

    expect(api['getPublicConvention']).toHaveBeenCalledWith('acme');
    expect(root.textContent).toContain('Acme employees');
    expect(root.querySelector('#ccv-l-email')).not.toBeNull();
    expect(root.querySelector('#ccv-l-identifier')).not.toBeNull();
    expect(root.textContent).toContain('corporateConventions.landing.cardNumber');
    expect((root.querySelector('#ccv-l-email') as HTMLInputElement).placeholder).toBe(
      'name@acme.it',
    );
  });

  it('keeps the send button disabled until a name and a valid e-mail are typed', async () => {
    const fixture = await render();

    expect(button(fixture, 'corporateConventions.landing.sendCode').disabled).toBe(true);
    await type(fixture, '#ccv-l-name', 'Mario Rossi');
    await type(fixture, '#ccv-l-email', 'mario@acme.it');

    expect(button(fixture, 'corporateConventions.landing.sendCode').disabled).toBe(false);
  });

  it('walks the OTP flow to the pass with its QR code and the wallet buttons that are configured', async () => {
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;

    await type(fixture, '#ccv-l-name', 'Mario Rossi');
    await type(fixture, '#ccv-l-email', 'mario@acme.it');
    button(fixture, 'corporateConventions.landing.sendCode').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(api['requestOtp']).toHaveBeenCalledWith('acme', 'mario@acme.it');
    expect(root.querySelector('#ccv-l-code')).not.toBeNull();
    expect(button(fixture, 'corporateConventions.landing.activate').disabled).toBe(true);

    await type(fixture, '#ccv-l-code', '123456');
    button(fixture, 'corporateConventions.landing.activate').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(api['verifyOtp']).toHaveBeenCalledWith('acme', 'mario@acme.it', '123456', 'Mario Rossi');
    const qr = root.querySelector<HTMLImageElement>('img.pass-qr');
    expect(qr?.getAttribute('src')).toContain('/qr.svg');
    expect(root.textContent).toContain('Mario Rossi');
    expect(root.textContent).toContain('corporateConventions.landing.addGoogle');
    expect(root.textContent).not.toContain('corporateConventions.landing.addApple');
    expect(root.textContent).toContain('corporateConventions.landing.addFamily');
  });

  it('verifies a card instead of the e-mail and shows the pass', async () => {
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;

    await type(fixture, '#ccv-l-name', 'Mario Rossi');
    await type(fixture, '#ccv-l-identifier', 'AC123456');
    button(fixture, 'corporateConventions.landing.verifyIdentifier').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(api['verifyPublicIdentifier']).toHaveBeenCalledWith(
      'acme',
      'AC123456',
      'Mario Rossi',
      undefined,
    );
    expect(root.querySelector('img.pass-qr')).not.toBeNull();
  });

  it('says the convention is unavailable when the API refuses it', async () => {
    api['getPublicConvention'] = vi.fn(() => {
      throw new Error('404');
    });
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: baseProviders(api) });

    const fixture = await render();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'corporateConventions.landing.unavailableTitle',
    );
  });
});
