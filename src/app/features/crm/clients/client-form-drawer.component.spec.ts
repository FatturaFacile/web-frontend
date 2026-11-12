import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../../icons-provider';
import { ClientApiService, ContactResource, I18nService } from '@core';
import { ClientFormDrawerComponent } from './client-form-drawer.component';

describe('ClientFormDrawerComponent validation', () => {
  const api = {
    create: vi.fn().mockReturnValue(of({ success: true, data: {} })),
    update: vi.fn().mockReturnValue(of({ success: true, data: {} })),
  };

  function createDrawer(contact: ContactResource | null = null) {
    const fixture = TestBed.createComponent(ClientFormDrawerComponent);
    fixture.componentRef.setInput('contact', contact);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  beforeEach(() => {
    api.create.mockClear();
    api.update.mockClear();
    TestBed.configureTestingModule({
      imports: [ClientFormDrawerComponent],
      providers: [
        provideNzIcons(icons),
        { provide: ClientApiService, useValue: api },
        { provide: NzMessageService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: I18nService, useValue: { translate: (key: string) => key, instant: (key: string) => key } },
      ],
    });
  });

  it('does not save an empty form: a company needs the company name', () => {
    const drawer = createDrawer();

    drawer.submit();

    expect(api.create).not.toHaveBeenCalled();
    expect(drawer.form.controls.legal_type.value).toBe('company');
    expect(drawer.form.controls.company_name.hasError('required')).toBe(true);
    expect(drawer.isRequiredField('company_name')).toBe(true);
    expect(drawer.isRequiredField('last_name')).toBe(false);
  });

  it('saves a company when the company name is given', () => {
    const drawer = createDrawer();
    drawer.form.patchValue({ company_name: 'Alpha SA' });

    drawer.submit();

    expect(api.create).toHaveBeenCalledTimes(1);
    expect(api.create.mock.calls[0][0]).toMatchObject({ legal_type: 'company', company_name: 'Alpha SA' });
  });

  it('does not require the company name for a person, but requires the last name', () => {
    const drawer = createDrawer();
    drawer.form.controls.legal_type.setValue('person');

    expect(drawer.isRequiredField('company_name')).toBe(false);
    expect(drawer.isRequiredField('last_name')).toBe(true);
    expect(drawer.visibleTextFields().some((f) => f.key === 'company_name')).toBe(false);

    drawer.submit();
    expect(api.create).not.toHaveBeenCalled();
    expect(drawer.form.controls.company_name.hasError('required')).toBe(false);
    expect(drawer.form.controls.last_name.hasError('required')).toBe(true);

    drawer.form.patchValue({ last_name: 'Rossi' });
    drawer.submit();

    expect(api.create).toHaveBeenCalledTimes(1);
    expect(api.create.mock.calls[0][0]).toMatchObject({ legal_type: 'person', company_name: null, last_name: 'Rossi' });
  });

  it('does not send a company name typed before switching to person', () => {
    const drawer = createDrawer();
    drawer.form.patchValue({ company_name: 'Typed first' });
    drawer.form.controls.legal_type.setValue('person');
    drawer.form.patchValue({ last_name: 'Rossi' });

    drawer.submit();

    expect(api.create.mock.calls[0][0]).toMatchObject({ company_name: null });
  });

  it('requires street, postal code and city as soon as one address field is filled', () => {
    const drawer = createDrawer();
    drawer.form.patchValue({ company_name: 'Alpha SA' });
    drawer.form.controls.address.patchValue({ city: 'Lugano' });

    drawer.submit();

    expect(drawer.addressStarted()).toBe(true);
    expect(api.create).not.toHaveBeenCalled();
    expect(drawer.form.controls.address.controls.street.hasError('required')).toBe(true);
    expect(drawer.form.controls.address.controls.postal_code.hasError('required')).toBe(true);

    drawer.form.controls.address.patchValue({ street: 'Via Nassa', postal_code: '6900' });
    drawer.submit();

    expect(api.create).toHaveBeenCalledTimes(1);
  });

  it('rejects an SDI code that is not 7 characters and an invalid country', () => {
    const drawer = createDrawer();
    drawer.form.patchValue({ company_name: 'Alpha SA', sdi_code: 'ABC', country: 'CHE' });

    expect(drawer.form.controls.sdi_code.hasError('exactLength')).toBe(true);
    expect(drawer.form.controls.country.hasError('pattern')).toBe(true);
  });

  it('shows the billing address the API returns in `addresses` when editing a contact', () => {
    const contact = {
      id: 'c-1',
      type: 'client',
      legal_type: 'company',
      country: 'CH',
      company_name: 'Alpha SA',
      first_name: null,
      last_name: null,
      email: null,
      phone: null,
      vat_number: null,
      fiscal_code: null,
      uid_number: null,
      sdi_code: null,
      pec: null,
      iban: null,
      qr_iban: null,
      payment_terms_days: 30,
      addresses: [{ type: 'billing', street: 'Via Nassa', postal_code: '6900', city: 'Lugano', country: 'CH' }],
    } as ContactResource;

    const drawer = createDrawer(contact);

    expect(drawer.form.controls.address.controls.city.value).toBe('Lugano');
    expect(drawer.addressStarted()).toBe(true);
  });

  it('classifies a contact of the old data without a kind by its company name', () => {
    const drawer = createDrawer({ id: 'c-2', type: 'client', country: 'CH', company_name: null, first_name: 'Anna', last_name: 'Rossi' } as ContactResource);

    expect(drawer.form.controls.legal_type.value).toBe('person');
  });
});
