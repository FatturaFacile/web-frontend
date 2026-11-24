import { TestBed } from '@angular/core/testing';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ClientApiService,
  Lead,
  LeadApiService,
  LeadConvertResult,
  SettingsApiService,
} from '@core';
import { LeadConvertWizardComponent } from './lead-convert-wizard.component';
import { httpError, i18nStub, messageStub } from './lead-test.utils';

const LEAD: Lead = {
  id: 'lead-1',
  first_name: 'Anna',
  last_name: 'Rossi',
  company_name: 'Rossi Impianti',
  email: 'anna@rossi.it',
  phone: null,
  status: 'qualified',
  score: 80,
  rating: 'hot',
  vat_number: 'IT01234567890',
};

const RESULT: LeadConvertResult = {
  account: { id: 'acc-1', name: 'Rossi Impianti' },
  contact_id: 'contact-1',
  opportunity: { id: 'opp-1', name: 'Rossi Impianti' },
};

describe('LeadConvertWizardComponent', () => {
  let leadApi: { convert: ReturnType<typeof vi.fn> };
  let contactsApi: { list: ReturnType<typeof vi.fn> };
  let message: ReturnType<typeof messageStub>;

  beforeEach(() => {
    leadApi = { convert: vi.fn() };
    contactsApi = {
      list: vi.fn().mockImplementation(({ search }: { search: string }) =>
        of({
          data:
            search === LEAD.vat_number
              ? [{ id: 'contact-9', company_name: 'Rossi Impianti', vat_number: search }]
              : [],
          meta: { total: 0 },
        }),
      ),
    };
    message = messageStub();
    TestBed.configureTestingModule({
      providers: [
        i18nStub(),
        { provide: LeadApiService, useValue: leadApi },
        { provide: ClientApiService, useValue: contactsApi },
        { provide: SettingsApiService, useValue: { getTenantUsers: () => of({ data: [] }) } },
        { provide: NzMessageService, useValue: message },
      ],
    });
  });

  function create() {
    const fixture = TestBed.createComponent(LeadConvertWizardComponent);
    fixture.componentRef.setInput('lead', LEAD);
    const cmp = fixture.componentInstance;
    cmp.open.set(true);
    cmp.reset();
    return cmp;
  }

  it('prefills an existing contact matched by VAT and sends existing_contact_id once', () => {
    const cmp = create();
    expect(contactsApi.list).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'IT01234567890' }),
    );
    expect(contactsApi.list).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'anna@rossi.it' }),
    );
    expect(cmp.contactMode()).toBe('existing');
    expect(cmp.contactId()).toBe('contact-9');

    const pending = new Subject<LeadConvertResult>();
    leadApi.convert.mockReturnValue(pending);
    const changed = vi.fn();
    cmp.changed.subscribe(changed);

    cmp.submit();
    cmp.submit(); // double submit is ignored while the request is in flight
    expect(leadApi.convert).toHaveBeenCalledTimes(1);
    const [id, payload] = leadApi.convert.mock.calls[0];
    expect(id).toBe('lead-1');
    expect(payload).toMatchObject({
      existing_contact_id: 'contact-9',
      new_account_name: 'Rossi Impianti',
      create_opportunity: true,
    });

    pending.next(RESULT);
    pending.complete();
    expect(cmp.result()).toEqual(RESULT);
    expect(changed).toHaveBeenCalledTimes(1);

    cmp.submit(); // already converted in this session: no new request
    expect(leadApi.convert).toHaveBeenCalledTimes(1);
  });

  it('omits existing_contact_id when creating a new contact', () => {
    const cmp = create();
    cmp['setContactMode']('new');
    expect(cmp.buildPayload().existing_contact_id).toBeUndefined();
  });

  it('omits opportunity fields when no opportunity is requested', () => {
    const cmp = create();
    cmp.form.controls.create_opportunity.setValue(false);
    const payload = cmp.buildPayload();
    expect(payload.create_opportunity).toBe(false);
    expect(payload.opportunity_name).toBeUndefined();
  });

  it('on 409 shows the already-converted message, closes and asks for a refresh', () => {
    const cmp = create();
    leadApi.convert.mockReturnValue(throwError(() => httpError(409)));
    const changed = vi.fn();
    cmp.changed.subscribe(changed);

    cmp.submit();

    expect(message.warning).toHaveBeenCalledWith('CRM.LEADS.CONVERT.ALREADY_CONVERTED');
    expect(cmp.open()).toBe(false);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(cmp.submitting()).toBe(false);
  });

  it('on 422 maps field errors to controls and jumps to the step holding them', () => {
    const cmp = create();
    cmp.next();
    cmp.next();
    cmp.next();
    expect(cmp.step()).toBe(3);
    leadApi.convert.mockReturnValue(
      throwError(() =>
        httpError(422, {
          message: 'The given data was invalid.',
          errors: {
            new_account_name: ['The account name is too long.'],
            foo: ['Unmapped problem.'],
          },
        }),
      ),
    );

    cmp.submit();

    expect(cmp.form.controls.new_account_name.errors).toEqual({
      serverError: 'The account name is too long.',
    });
    expect(cmp.step()).toBe(1);
    expect(cmp.formError()).toBe('Unmapped problem.');
    expect(cmp.open()).toBe(true);
    expect(cmp.submitting()).toBe(false);
  });

  it('blocks the contact step until an existing contact is chosen', () => {
    contactsApi.list.mockReturnValue(of({ data: [], meta: { total: 0 } }));
    const cmp = create();
    cmp['setContactMode']('existing');
    expect(cmp.canContinue()).toBe(false);
    cmp.next();
    expect(cmp.step()).toBe(0);
    cmp.setContact('contact-2');
    expect(cmp.canContinue()).toBe(true);
  });
});
