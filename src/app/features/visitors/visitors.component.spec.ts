import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../icons-provider';
import {
  TranslateService,
  VisitorsApiService,
  VisitorsKiosk,
  VisitorsKioskVisit,
  VisitorsVisit,
  VisitorsVisitor,
} from '@core';
import { VisitorsComponent } from './visitors.component';

describe('VisitorsComponent', () => {
  let component: VisitorsComponent;
  let fixture: ComponentFixture<VisitorsComponent>;

  const mockVisitor: VisitorsVisitor = {
    id: 'vis-1',
    first_name: 'Paolo',
    last_name: 'Bianchi',
    full_name: 'Paolo Bianchi',
    company_name: 'Acme Corp',
    email: 'paolo@acme.it',
    phone: '+39 333 444555',
    has_document: true,
    last_visit_at: '2026-11-09T09:00:00Z',
    created_at: '2026-11-01T08:00:00Z',
  };

  const mockVisit: VisitorsVisit = {
    id: 'vst-1',
    visitor_id: 'vis-1',
    visitor: mockVisitor,
    host_user_id: 'usr-1',
    host: { id: 'usr-1', name: 'Laura Direzione' },
    expected_at: '2026-11-09T10:00:00Z',
    purpose: 'Riunione commerciale',
    status: 'expected',
    badge_number: 'B-101',
    checked_in_at: '2026-11-09T09:55:00Z',
  };

  const mockKiosk: VisitorsKiosk = {
    id: 'ksk-1',
    name: 'Reception Ingresso',
    device_key: 'dev-key-123',
    is_active: true,
    created_at: '2026-11-01T08:00:00Z',
    secret: 'ksk-sec-secret-abc',
  };

  const mockKioskVisit: VisitorsKioskVisit = {
    id: 'vst-1',
    visitor_name: 'Paolo B.',
    host_name: 'Laura Direzione',
    expected_at: '2026-11-09T10:00:00Z',
    status: 'expected',
  };

  const apiSpy = {
    getOnSiteVisitors: vi.fn().mockReturnValue(of({ data: [{ ...mockVisit, status: 'checked_in' }] })),
    getVisits: vi.fn().mockReturnValue(of({ data: [mockVisit] })),
    getVisit: vi.fn().mockReturnValue(of({ data: mockVisit })),
    announceVisit: vi.fn().mockReturnValue(of({ data: mockVisit })),
    checkInVisit: vi.fn().mockReturnValue(of({ data: { ...mockVisit, status: 'checked_in' } })),
    checkOutVisit: vi.fn().mockReturnValue(of({ data: { ...mockVisit, status: 'checked_out' } })),
    cancelVisit: vi.fn().mockReturnValue(of({ data: { ...mockVisit, status: 'cancelled' } })),
    getVisitors: vi.fn().mockReturnValue(of({ data: [mockVisitor] })),
    getVisitor: vi.fn().mockReturnValue(of({ data: mockVisitor })),
    createVisitor: vi.fn().mockReturnValue(of({ data: mockVisitor })),
    updateVisitor: vi.fn().mockReturnValue(of({ data: mockVisitor })),
    eraseVisitor: vi.fn().mockReturnValue(of({ message: 'Erased' })),
    getKiosks: vi.fn().mockReturnValue(of({ data: [mockKiosk] })),
    registerKiosk: vi.fn().mockReturnValue(of({ data: mockKiosk })),
    rotateKioskSecret: vi.fn().mockReturnValue(of({ data: mockKiosk })),
    retireKiosk: vi.fn().mockReturnValue(of({ message: 'Retired' })),
    getKioskExpected: vi.fn().mockReturnValue(of({ data: [mockKioskVisit] })),
    kioskCheckIn: vi.fn().mockReturnValue(of({ data: { ...mockKioskVisit, status: 'checked_in', badge_number: 'B-001' } })),
    kioskCheckOut: vi.fn().mockReturnValue(of({ data: { ...mockKioskVisit, status: 'checked_out' } })),
  };

  const messageSpy = {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  };

  const translateSpy = {
    instant: vi.fn().mockImplementation((key: string) => key),
    translate: vi.fn().mockImplementation((key: string) => key),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [VisitorsComponent],
      providers: [
        { provide: VisitorsApiService, useValue: apiSpy },
        { provide: NzMessageService, useValue: messageSpy },
        { provide: TranslateService, useValue: translateSpy },
        provideNzIcons(icons),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VisitorsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should initialize and load on-site visits, visits log, visitors registry, kiosks, and kiosk expected', () => {
    expect(component).toBeTruthy();
    expect(apiSpy.getOnSiteVisitors).toHaveBeenCalled();
    expect(apiSpy.getVisits).toHaveBeenCalled();
    expect(apiSpy.getVisitors).toHaveBeenCalled();
    expect(apiSpy.getKiosks).toHaveBeenCalled();
    expect(apiSpy.getKioskExpected).toHaveBeenCalled();

    expect(component.totalOnSite()).toBe(1);
    expect(component.totalExpectedToday()).toBe(1);
    expect(component.activeKiosksCount()).toBe(1);
  });

  it('should open announce modal and save a newly announced visit for a new visitor', () => {
    component.openAnnounceModal();
    expect(component.announceModalVisible()).toBe(true);

    component.announceVisitForm.patchValue({
      mode: 'new',
      first_name: 'Giulia',
      last_name: 'Verdi',
      company_name: 'Solar SpA',
      email: 'giulia@solar.it',
      host_user_id: 'usr-42',
      expected_at: '2026-11-20T14:00:00Z',
      purpose: 'Audit energetico',
    });

    component.saveAnnouncedVisit();
    expect(apiSpy.announceVisit).toHaveBeenCalledWith(
      expect.objectContaining({
        host_user_id: 'usr-42',
        expected_at: '2026-11-20T14:00:00Z',
        purpose: 'Audit energetico',
        visitor: expect.objectContaining({
          first_name: 'Giulia',
          last_name: 'Verdi',
          company_name: 'Solar SpA',
        }),
      }),
    );
    expect(messageSpy.success).toHaveBeenCalledWith('VISITORS.VISIT_ANNOUNCED');
    expect(component.announceModalVisible()).toBe(false);
  });

  it('should announce visit with an existing visitor id', () => {
    component.openAnnounceModal();
    component.announceVisitForm.patchValue({
      mode: 'existing',
      visitor_id: 'vis-1',
      host_user_id: 'usr-1',
      expected_at: '2026-11-20T15:00:00Z',
      purpose: 'Follow-up',
    });

    component.saveAnnouncedVisit();
    expect(apiSpy.announceVisit).toHaveBeenCalledWith(
      expect.objectContaining({
        visitor_id: 'vis-1',
        host_user_id: 'usr-1',
        expected_at: '2026-11-20T15:00:00Z',
        purpose: 'Follow-up',
      }),
    );
    expect(messageSpy.success).toHaveBeenCalledWith('VISITORS.VISIT_ANNOUNCED');
  });

  it('should open check-in modal and check in a visitor with badge', () => {
    component.openCheckInModal(mockVisit);
    expect(component.checkInModalVisible()).toBe(true);
    expect(component.selectedVisit()).toBe(mockVisit);

    component.checkInForm.patchValue({ badge_number: 'B-888' });
    component.confirmCheckIn();

    expect(apiSpy.checkInVisit).toHaveBeenCalledWith('vst-1', {
      badge_number: 'B-888',
    });
    expect(messageSpy.success).toHaveBeenCalledWith('VISITORS.CHECKIN_SUCCESS');
    expect(component.checkInModalVisible()).toBe(false);
  });

  it('should execute check out of a visit and refresh lists', () => {
    component.executeCheckOut('vst-1');
    expect(apiSpy.checkOutVisit).toHaveBeenCalledWith('vst-1');
    expect(messageSpy.success).toHaveBeenCalledWith('VISITORS.CHECKOUT_SUCCESS');
  });

  it('should cancel an announced visit', () => {
    component.executeCancelVisit('vst-1');
    expect(apiSpy.cancelVisit).toHaveBeenCalledWith('vst-1');
    expect(messageSpy.success).toHaveBeenCalledWith('VISITORS.VISIT_CANCELLED');
  });

  it('should open and close visit details drawer', () => {
    component.openVisitDrawer(mockVisit);
    expect(component.drawerVisible()).toBe(true);
    expect(component.selectedVisit()).toBe(mockVisit);

    component.closeVisitDrawer();
    expect(component.drawerVisible()).toBe(false);
    expect(component.selectedVisit()).toBeNull();
  });

  it('should filter visits and search visitors registry', () => {
    component.filterVisitStatus.set('checked_in');
    component.loadVisits();
    expect(apiSpy.getVisits).toHaveBeenCalledWith({ status: 'checked_in' });

    component.searchVisitorQuery.set('Acme');
    component.loadVisitors();
    expect(apiSpy.getVisitors).toHaveBeenCalledWith({ search: 'Acme' });
  });

  it('should create and update a visitor record in registry', () => {
    component.openCreateVisitorModal();
    expect(component.visitorModalVisible()).toBe(true);
    expect(component.selectedVisitor()).toBeNull();

    component.visitorForm.patchValue({
      first_name: 'Marco',
      last_name: 'Neri',
      company_name: 'Tech SRL',
      email: 'marco@tech.it',
    });

    component.saveVisitor();
    expect(apiSpy.createVisitor).toHaveBeenCalledWith({
      first_name: 'Marco',
      last_name: 'Neri',
      company_name: 'Tech SRL',
      email: 'marco@tech.it',
      phone: undefined,
      document_number: undefined,
    });
    expect(messageSpy.success).toHaveBeenCalledWith('VISITORS.VISITOR_SAVED');

    // Edit flow
    component.openEditVisitorModal(mockVisitor);
    expect(component.selectedVisitor()).toBe(mockVisitor);
    component.visitorForm.patchValue({ company_name: 'Updated SpA' });
    component.saveVisitor();
    expect(apiSpy.updateVisitor).toHaveBeenCalledWith('vis-1', expect.objectContaining({
      company_name: 'Updated SpA',
    }));
  });

  it('should erase visitor record (GDPR compliance)', () => {
    component.eraseVisitor('vis-1');
    expect(apiSpy.eraseVisitor).toHaveBeenCalledWith('vis-1');
    expect(messageSpy.success).toHaveBeenCalledWith('VISITORS.VISITOR_ERASED');
  });

  it('should register kiosk, rotate secret, and retire kiosk', () => {
    component.openRegisterKioskModal();
    expect(component.kioskModalVisible()).toBe(true);

    component.kioskForm.patchValue({ name: 'Totem Ingresso Sud' });
    component.registerKiosk();
    expect(apiSpy.registerKiosk).toHaveBeenCalledWith({ name: 'Totem Ingresso Sud' });
    expect(messageSpy.success).toHaveBeenCalledWith('VISITORS.KIOSK_REGISTERED');
    expect(component.newKioskSecret()).toBe('ksk-sec-secret-abc');

    component.rotateKioskSecret('ksk-1');
    expect(apiSpy.rotateKioskSecret).toHaveBeenCalledWith('ksk-1');
    expect(messageSpy.success).toHaveBeenCalledWith('VISITORS.SECRET_ROTATED');

    component.retireKiosk('ksk-1');
    expect(apiSpy.retireKiosk).toHaveBeenCalledWith('ksk-1');
    expect(messageSpy.success).toHaveBeenCalledWith('VISITORS.KIOSK_RETIRED');
  });

  it('should perform self-service kiosk check-in and check-out', () => {
    component.selfServiceCheckInForm.patchValue({
      visit_id: 'vst-1',
      badge_number: 'B-777',
    });
    component.executeSelfServiceCheckIn();
    expect(apiSpy.kioskCheckIn).toHaveBeenCalledWith({
      visit_id: 'vst-1',
      badge_number: 'B-777',
    });
    expect(messageSpy.success).toHaveBeenCalledWith('VISITORS.KIOSK_CHECKIN_SUCCESS');

    component.selfServiceCheckOutForm.patchValue({ badge_number: 'B-777' });
    component.executeSelfServiceCheckOut();
    expect(apiSpy.kioskCheckOut).toHaveBeenCalledWith({ badge_number: 'B-777' });
    expect(messageSpy.success).toHaveBeenCalledWith('VISITORS.KIOSK_CHECKOUT_SUCCESS');
  });

  it('should return correct badge color and print evacuation notification', () => {
    expect(component.getStatusBadgeColor('expected')).toBe('blue');
    expect(component.getStatusBadgeColor('checked_in')).toBe('success');
    expect(component.getStatusBadgeColor('checked_out')).toBe('default');
    expect(component.getStatusBadgeColor('cancelled')).toBe('error');
    expect(component.getStatusBadgeColor('unknown')).toBe('default');

    component.printEvacuationList();
    expect(messageSpy.info).toHaveBeenCalledWith('VISITORS.EVACUATION_LIST_PRINTED');
  });

  it('should handle API errors gracefully', () => {
    apiSpy.announceVisit.mockReturnValueOnce(throwError(() => new Error('Error')));
    component.openAnnounceModal();
    component.announceVisitForm.patchValue({
      first_name: 'Test',
      last_name: 'User',
      host_user_id: 'usr-1',
      expected_at: '2026-11-20T10:00:00Z',
    });
    component.saveAnnouncedVisit();
    expect(messageSpy.error).toHaveBeenCalledWith('VISITORS.ACTION_ERROR');

    apiSpy.checkOutVisit.mockReturnValueOnce(throwError(() => new Error('Error')));
    component.executeCheckOut('vst-1');
    expect(messageSpy.error).toHaveBeenCalledWith('VISITORS.ACTION_ERROR');
  });
});
