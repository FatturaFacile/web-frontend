import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../icons-provider';
import { CommunicationApiService, CommunicationContactPreference, ContactResource, CrmApiService, TranslateService } from '@core';
import { CommunicationPreferencesComponent } from './communication-preferences.component';

describe('CommunicationPreferencesComponent', () => {
  let component: CommunicationPreferencesComponent;
  let fixture: ComponentFixture<CommunicationPreferencesComponent>;

  const preference: CommunicationContactPreference = {
    channel: 'email',
    is_opted_out: false,
    reason: null,
    changed_at: null,
    marketing_consent: 'granted',
    can_receive_marketing: true,
  };
  const contact = { id: 'c-1', company_name: null, first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.com' } as ContactResource;

  const apiSpy = { getContactPreferences: vi.fn(), setContactPreference: vi.fn() };
  const crmSpy = { getContacts: vi.fn() };
  const messageSpy = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
  const translateSpy = { instant: vi.fn().mockImplementation((key: string) => key), translate: vi.fn().mockImplementation((key: string) => key) };

  beforeEach(async () => {
    vi.clearAllMocks();
    apiSpy.getContactPreferences.mockReturnValue(of({ data: [preference] }));
    apiSpy.setContactPreference.mockReturnValue(of({ data: [{ ...preference, is_opted_out: true, can_receive_marketing: false }] }));
    crmSpy.getContacts.mockReturnValue(of({ data: [contact] }));

    await TestBed.configureTestingModule({
      imports: [CommunicationPreferencesComponent],
      providers: [
        { provide: CommunicationApiService, useValue: apiSpy },
        { provide: CrmApiService, useValue: crmSpy },
        { provide: NzMessageService, useValue: messageSpy },
        { provide: TranslateService, useValue: translateSpy },
        provideNzIcons(icons),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CommunicationPreferencesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('searches contacts only for terms of two characters or more', () => {
    component.searchContacts('a');
    expect(crmSpy.getContacts).not.toHaveBeenCalled();

    component.searchContacts(' Ada ');
    expect(crmSpy.getContacts).toHaveBeenCalledWith({ search: 'Ada', per_page: 20 });
    expect(component.contacts()).toHaveLength(1);
    expect(component.contactLabel(contact)).toBe('Ada Lovelace (ada@example.com)');
  });

  it('loads the preferences of the selected contact and saves an opt-out', () => {
    component.selectContact('c-1');
    expect(apiSpy.getContactPreferences).toHaveBeenCalledWith('c-1');
    expect(component.preferences()).toHaveLength(1);
    expect(component.consentKey(preference)).toBe('COMMUNICATION.CONSENT_GRANTED');

    component.setOptOut(preference, true);
    expect(apiSpy.setContactPreference).toHaveBeenCalledWith('c-1', { channel: 'email', is_opted_out: true });
    expect(component.preferences()[0].is_opted_out).toBe(true);
    expect(messageSpy.success).toHaveBeenCalledWith('COMMUNICATION.PREFERENCE_SAVED');
  });

  it('reloads the preferences and reports the error when saving fails', () => {
    component.selectContact('c-1');
    apiSpy.setContactPreference.mockReturnValue(throwError(() => new Error('boom')));
    component.setOptOut(preference, true);

    expect(messageSpy.error).toHaveBeenCalledWith('COMMUNICATION.ACTION_ERROR');
    expect(apiSpy.getContactPreferences).toHaveBeenCalledTimes(2);
  });
});
