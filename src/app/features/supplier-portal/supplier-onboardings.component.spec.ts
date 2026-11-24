import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProcurementApiService, SupplierOnboarding, SupplierOnboardingDetail, SupplierPortalApiService, TranslateService } from '@core';
import { icons } from '../../icons-provider';
import { SupplierOnboardingsComponent } from './supplier-onboardings.component';

describe('SupplierOnboardingsComponent', () => {
  let fixture: ComponentFixture<SupplierOnboardingsComponent>;
  let component: SupplierOnboardingsComponent;

  const onboarding: SupplierOnboarding = {
    id: 'onb-1',
    supplier_id: 'sup-1',
    supplier_name: 'Fornitore Spa',
    supplier_vat_number: 'IT00743110157',
    status: 'under_review',
    country: 'IT',
    allowed_transitions: ['documents_required', 'approved', 'rejected'],
  };

  const detail: SupplierOnboardingDetail = {
    onboarding,
    requirements: [
      {
        id: 'req-1',
        code: 'DURC',
        name: 'DURC',
        country: 'IT',
        is_mandatory: true,
        requires_expiry: true,
        validity_days: 120,
        alert_days: 30,
        is_active: true,
        sort_order: 10,
        submission: null,
      },
    ],
    blockers: [{ code: 'document_not_accepted', detail: 'DURC' }],
    assessment: null,
    risk: null,
  };

  const apiSpy = {
    getOnboardings: vi.fn(),
    getOnboarding: vi.fn(),
    inviteSupplier: vi.fn(),
    sendPortalAccess: vi.fn(),
    requestDocuments: vi.fn(),
    startReview: vi.fn(),
    approveOnboarding: vi.fn(),
    rejectOnboarding: vi.fn(),
    blockOnboarding: vi.fn(),
  };
  const procurementSpy = { getSuppliers: vi.fn() };
  const messageSpy = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
  const translateSpy = {
    instant: vi.fn().mockImplementation((key: string) => key),
    translate: vi.fn().mockImplementation((key: string) => key),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    apiSpy.getOnboardings.mockReturnValue(of({ data: [onboarding] }));
    apiSpy.getOnboarding.mockReturnValue(of({ data: detail }));
    apiSpy.inviteSupplier.mockReturnValue(of({ data: onboarding }));
    apiSpy.approveOnboarding.mockReturnValue(of({ data: { ...onboarding, status: 'approved' } }));
    apiSpy.rejectOnboarding.mockReturnValue(of({ data: { ...onboarding, status: 'rejected' } }));
    procurementSpy.getSuppliers.mockReturnValue(of({ data: [{ id: 'sup-2', supplier_code: 'S-2', company_name: 'Altro Fornitore' }] }));

    await TestBed.configureTestingModule({
      imports: [SupplierOnboardingsComponent],
      providers: [
        { provide: SupplierPortalApiService, useValue: apiSpy },
        { provide: ProcurementApiService, useValue: procurementSpy },
        { provide: NzMessageService, useValue: messageSpy },
        { provide: TranslateService, useValue: translateSpy },
        provideNzIcons(icons),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SupplierOnboardingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads the onboardings with the filters it starts with', () => {
    expect(apiSpy.getOnboardings).toHaveBeenCalledWith(expect.objectContaining({ status: undefined, country: undefined, search: '' }));
    expect(component.onboardings()).toHaveLength(1);
  });

  it('reloads with the status that was picked', () => {
    component.setStatusFilter('under_review');

    expect(apiSpy.getOnboardings).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'under_review' }));
  });

  it('opens the review of an onboarding and offers only the steps the API allows', () => {
    component.openDetail(onboarding);

    expect(apiSpy.getOnboarding).toHaveBeenCalledWith('onb-1');
    expect(component.drawerVisible()).toBe(true);
    expect(component.can('approved')).toBe(true);
    expect(component.can('blocked')).toBe(false);
    expect(component.can('under_review')).toBe(false);
  });

  it('asks for a reason to reject, and sends it', () => {
    component.openDetail(onboarding);
    component.openAction('reject');
    expect(component.needsReason()).toBe(true);
    expect(component.actionForm.invalid).toBe(true);

    component.confirmAction();
    expect(apiSpy.rejectOnboarding).not.toHaveBeenCalled();

    component.actionForm.patchValue({ text: ' No answer ' });
    component.confirmAction();

    expect(apiSpy.rejectOnboarding).toHaveBeenCalledWith('onb-1', { reason: 'No answer' });
    expect(component.actionVisible()).toBe(false);
  });

  it('approves with optional notes', () => {
    component.openDetail(onboarding);
    component.openAction('approve');
    expect(component.actionForm.valid).toBe(true);

    component.confirmAction();

    expect(apiSpy.approveOnboarding).toHaveBeenCalledWith('onb-1', { notes: null });
  });

  it('invites a supplier chosen from the procurement suppliers', () => {
    component.openInvite();
    expect(procurementSpy.getSuppliers).toHaveBeenCalled();
    expect(component.inviteForm.invalid).toBe(true);

    component.inviteForm.patchValue({ supplier_id: 'sup-2', country: 'CH', invitation_email: 'a@b.ch' });
    component.saveInvite();

    expect(apiSpy.inviteSupplier).toHaveBeenCalledWith({ supplier_id: 'sup-2', country: 'CH', invitation_email: 'a@b.ch' });
    expect(component.inviteVisible()).toBe(false);
  });
});
