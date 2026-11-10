import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChildcareFamilyApiService, I18nService } from '@core';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { icons } from '../../../icons-provider';
import { FamilyPortalComponent } from './family-portal.component';

describe('FamilyPortalComponent', () => {
  let fixture: ComponentFixture<FamilyPortalComponent>;
  let component: FamilyPortalComponent;
  const familyToken = 'family-' + 'token-fixture';

  const children = [{ id: 'c1', reference_code: 'C-001', first_name: 'Luca', last_name: 'Rossi' }];
  const api = {
    getChildren: vi.fn(),
    getAttendance: vi.fn(),
    getDailyReport: vi.fn(),
    getInvoices: vi.fn(),
    getDocuments: vi.fn(),
    downloadDocument: vi.fn(),
    signDocument: vi.fn(),
    getMessages: vi.fn(),
    sendMessage: vi.fn(),
  };
  const message = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };

  interface Internals {
    connected: () => boolean;
    connectError: () => boolean;
    children: () => unknown[];
    attendance: () => unknown[];
    documents: () => { id: string; status: string; signed_at: string | null }[];
    messages: () => unknown[];
    tokenForm: { patchValue: (value: { token: string }) => void };
    signForm: { patchValue: (value: { signed_name: string; accept: boolean }) => void };
    messageForm: { patchValue: (value: { body: string }) => void; getRawValue: () => unknown };
    connect: () => void;
    disconnect: () => void;
    openSign: (document: unknown) => void;
    submitSign: () => void;
    sendMessage: () => void;
    canSign: (document: { has_file: boolean; signed_at: string | null }) => boolean;
  }
  const internals = () => component as unknown as Internals;

  beforeEach(async () => {
    vi.clearAllMocks();
    api.getChildren.mockReturnValue(of({ data: children }));
    api.getAttendance.mockReturnValue(of({ data: [{ date: '2026-05-04', status: 'present', absence_reason: null, check_in_at: null, check_out_at: null }] }));
    api.getDailyReport.mockReturnValue(of({ data: { child_id: 'c1', date: '2026-05-04', status: 'present', check_in_at: null, check_out_at: null, picked_up_by: null, meals: ['lunch'], notes: [] } }));
    api.getInvoices.mockReturnValue(of({ data: [] }));
    api.getDocuments.mockReturnValue(of({ data: [{ id: 'd1', child_id: 'c1', title: 'Contract', status: 'pending', has_file: true, signed_at: null }] }));
    api.getMessages.mockReturnValue(of({ data: [{ id: 'm1', child_id: 'c1', direction: 'to_family', body: 'Hello', created_at: null }] }));
    api.signDocument.mockReturnValue(of({ data: { id: 'd1', status: 'signed', signed_at: '2026-05-05T09:00:00Z' } }));
    api.sendMessage.mockReturnValue(of({ data: { id: 'm2' } }));

    await TestBed.configureTestingModule({
      imports: [FamilyPortalComponent],
      providers: [
        { provide: ChildcareFamilyApiService, useValue: api },
        { provide: NzMessageService, useValue: message },
        { provide: I18nService, useValue: { translate: (key: string) => key, currentLang: () => 'en', lang: () => 'en' } },
        provideNzIcons(icons),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(FamilyPortalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('asks for the personal code first and keeps the data hidden until it is accepted', () => {
    expect(internals().connected()).toBe(false);
    internals().connect();
    expect(api.getChildren).not.toHaveBeenCalled();
  });

  it('signs in with the token, loads the children and the family data', () => {
    internals().tokenForm.patchValue({ token: familyToken });
    internals().connect();

    expect(api.getChildren).toHaveBeenCalledWith(familyToken);
    expect(internals().connected()).toBe(true);
    expect(internals().children().length).toBe(1);
    expect(api.getAttendance).toHaveBeenCalledWith(familyToken, 'c1', expect.stringMatching(/^\d{4}-\d{2}$/));
    expect(api.getDailyReport).toHaveBeenCalledWith(familyToken, 'c1', expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
    expect(internals().attendance().length).toBe(1);
    expect(internals().documents().length).toBe(1);
    expect(internals().messages().length).toBe(1);
  });

  it('shows an error and stays signed out when the token is refused', () => {
    api.getChildren.mockReturnValue(throwError(() => ({ status: 401 })));
    internals().tokenForm.patchValue({ token: familyToken });
    internals().connect();

    expect(internals().connected()).toBe(false);
    expect(internals().connectError()).toBe(true);
  });

  it('forgets everything on sign out', () => {
    internals().tokenForm.patchValue({ token: familyToken });
    internals().connect();
    internals().disconnect();

    expect(internals().connected()).toBe(false);
    expect(internals().children().length).toBe(0);
    expect(internals().documents().length).toBe(0);
  });

  it('signs a document with the typed name and marks it signed', () => {
    internals().tokenForm.patchValue({ token: familyToken });
    internals().connect();
    const document = internals().documents()[0];
    expect(internals().canSign({ has_file: true, signed_at: null })).toBe(true);

    internals().openSign(document);
    internals().submitSign();
    expect(api.signDocument).not.toHaveBeenCalled();

    internals().signForm.patchValue({ signed_name: 'Anna Rossi', accept: true });
    internals().submitSign();

    expect(api.signDocument).toHaveBeenCalledWith(familyToken, 'd1', { signed_name: 'Anna Rossi', accept: true });
    expect(internals().documents()[0].status).toBe('signed');
    expect(message.success).toHaveBeenCalled();
  });

  it('sends a message about the selected child and reloads the thread', () => {
    internals().tokenForm.patchValue({ token: familyToken });
    internals().connect();

    internals().messageForm.patchValue({ body: 'Luca is ill today' });
    internals().sendMessage();

    expect(api.sendMessage).toHaveBeenCalledWith(familyToken, { child_id: 'c1', body: 'Luca is ill today' });
    expect(api.getMessages).toHaveBeenCalledTimes(2);
  });
});
