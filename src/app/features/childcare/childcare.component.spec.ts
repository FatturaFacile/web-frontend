import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../icons-provider';
import {
  ChildcareApiService,
  ChildcareAttendance,
  ChildcareBill,
  ChildcareChild,
  ChildcareDailyNote,
  ChildcareDocument,
  ChildcareFeePlan,
  ChildcareGroup,
  ChildcareReferencePerson,
  ChildcareRequirement,
  PaginatedResponse,
} from '@core';
import { ChildcareComponent } from './childcare.component';

describe('ChildcareComponent', () => {
  let fixture: ComponentFixture<ChildcareComponent>;
  let component: ChildcareComponent;

  const mockChild: ChildcareChild = {
    id: 'ch-1-uuid',
    group_id: 'grp-1',
    group_name: 'Coccinelle',
    billing_contact_id: 'parent-1',
    billing_contact_name: 'Marco Bianchi',
    first_name: 'Sofia',
    last_name: 'Bianchi',
    birth_date: '2023-05-12',
    enrolled_on: '2024-09-01',
    allergies: 'Lattosio',
    status: 'enrolled',
  };

  const mockWaitlistChild: ChildcareChild = {
    id: 'ch-2-uuid',
    billing_contact_id: 'parent-2',
    first_name: 'Leonardo',
    last_name: 'Verdi',
    birth_date: '2024-01-10',
    enrolled_on: '2024-09-01',
    status: 'waitlist',
  };

  const mockGroup: ChildcareGroup = {
    id: 'grp-1',
    name: 'Coccinelle',
    capacity: 18,
    enrolled_count: 12,
  };

  const mockAttendance: ChildcareAttendance = {
    id: 'att-1-uuid',
    child_id: 'ch-1-uuid',
    child_name: 'Sofia Bianchi',
    date: '2026-03-02',
    status: 'present',
    check_in_at: '2026-03-02T08:15:00Z',
    temperature: '36.5',
  };

  const mockDailyNote: ChildcareDailyNote = {
    id: 'note-1-uuid',
    child_id: 'ch-1-uuid',
    child_name: 'Sofia Bianchi',
    date: '2026-03-02',
    category: 'nap',
    body: 'Ha riposato serenamente',
    visible_to_family: true,
  };

  const mockBill: ChildcareBill = {
    id: 'bill-1-uuid',
    child_id: 'ch-1-uuid',
    child_name: 'Sofia Bianchi',
    contact_id: 'parent-1',
    contact_name: 'Marco Bianchi',
    period: '2026-03',
    gross_amount: '650.00',
    subsidy_amount: '150.00',
    net_amount: '500.00',
    currency: 'EUR',
    status: 'issued',
  };

  const mockFeePlan: ChildcareFeePlan = {
    id: 'fp-1-uuid',
    name: 'Tempo Pieno 08:00 - 17:00',
    basis: 'monthly',
    amount: '850.00',
    meal_amount: '120.00',
    tax_rate: '0.00',
    currency: 'EUR',
  };

  const mockRequirement: ChildcareRequirement = {
    id: 'req-1-uuid',
    name: 'Certificato Vaccinazioni Obbligatorie',
    requires_signature: true,
    is_mandatory: true,
  };

  const mockRefPerson: ChildcareReferencePerson = {
    id: 'ref-1-uuid',
    child_id: 'ch-1-uuid',
    full_name: 'Giulia Neri',
    relationship: 'Madre',
    phone: '+39 333 1122334',
    is_guardian: true,
    can_pick_up: true,
  };

  const mockDoc: ChildcareDocument = {
    id: 'doc-1-uuid',
    child_id: 'ch-1-uuid',
    title: 'Modulo Iscrizione Firmato',
    requirement_name: 'Regolamento',
    status: 'signed',
    signed_by: 'Giulia Neri',
  };

  const mockPaginatedChildren: PaginatedResponse<ChildcareChild> = {
    data: [mockChild, mockWaitlistChild],
    meta: {
      current_page: 1,
      last_page: 1,
      per_page: 10,
      total: 2,
    },
  };

  const mockChildcareApi = {
    getChildren: vi.fn().mockReturnValue(of(mockPaginatedChildren)),
    getChild: vi.fn().mockReturnValue(of({ data: mockChild })),
    enrolChild: vi.fn().mockReturnValue(of({ data: mockChild })),
    admitChild: vi.fn().mockReturnValue(of({ data: { ...mockWaitlistChild, status: 'enrolled' } })),
    getGroups: vi.fn().mockReturnValue(of({ data: [mockGroup] })),
    createGroup: vi.fn().mockReturnValue(of({ data: mockGroup })),
    getReferencePersons: vi.fn().mockReturnValue(of({ data: [mockRefPerson] })),
    addReferencePerson: vi.fn().mockReturnValue(of({ data: mockRefPerson })),
    grantPortalAccess: vi.fn().mockReturnValue(of({ data: { invitation_sent: true } })),
    getChildDocuments: vi.fn().mockReturnValue(of({ data: [mockDoc] })),
    getNotes: vi.fn().mockReturnValue(of({ data: [mockDailyNote] })),
    createNote: vi.fn().mockReturnValue(of({ data: mockDailyNote })),
    getMonthlyRegister: vi.fn().mockReturnValue(of({ data: [mockAttendance] })),
    checkIn: vi.fn().mockReturnValue(of({ data: mockAttendance })),
    checkOut: vi.fn().mockReturnValue(of({ data: mockAttendance })),
    recordAbsence: vi.fn().mockReturnValue(of({ data: mockAttendance })),
    getFeePlans: vi.fn().mockReturnValue(of({ data: [mockFeePlan] })),
    createFeePlan: vi.fn().mockReturnValue(of({ data: mockFeePlan })),
    runBilling: vi.fn().mockReturnValue(of({ data: { run_id: 'run-1', total_billed: '500.00' } })),
    getBills: vi.fn().mockReturnValue(of({ data: [mockBill] })),
    getDocumentRequirements: vi.fn().mockReturnValue(of({ data: [mockRequirement] })),
    createDocumentRequirement: vi.fn().mockReturnValue(of({ data: mockRequirement })),
    getOutstandingDocuments: vi.fn().mockReturnValue(of({ data: [] })),
  };

  const mockMessageService = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [ChildcareComponent],
      providers: [
        provideNzIcons(icons),
        { provide: ChildcareApiService, useValue: mockChildcareApi },
        { provide: NzMessageService, useValue: mockMessageService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChildcareComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should initialize and load children, groups, attendances, fee plans, and bills', () => {
    expect(component).toBeTruthy();
    expect(mockChildcareApi.getChildren).toHaveBeenCalled();
    expect(mockChildcareApi.getGroups).toHaveBeenCalled();
    expect(mockChildcareApi.getMonthlyRegister).toHaveBeenCalled();
    expect(mockChildcareApi.getNotes).toHaveBeenCalled();
    expect(mockChildcareApi.getFeePlans).toHaveBeenCalled();
    expect(mockChildcareApi.getBills).toHaveBeenCalled();
    expect(mockChildcareApi.getDocumentRequirements).toHaveBeenCalled();
    expect(component.children().length).toBe(2);
    expect(component.groups().length).toBe(1);
    expect(component.bills().length).toBe(1);
  });

  it('should enrol a new child', () => {
    component.openCreateChildModal();
    expect(component.childModalVisible()).toBe(true);

    component.childForm.patchValue({
      first_name: 'Sofia',
      last_name: 'Bianchi',
      birth_date: '2023-05-12',
      billing_contact_id: 'parent-1',
      enrolled_on: '2024-09-01',
    });

    component.saveChild();

    expect(mockChildcareApi.enrolChild).toHaveBeenCalledWith(
      expect.objectContaining({
        first_name: 'Sofia',
        last_name: 'Bianchi',
      }),
    );
    expect(mockMessageService.success).toHaveBeenCalled();
    expect(component.childModalVisible()).toBe(false);
  });

  it('should admit child from waitlist', () => {
    component.admitChild(mockWaitlistChild);
    expect(mockChildcareApi.admitChild).toHaveBeenCalledWith(
      'ch-2-uuid',
      expect.objectContaining({
        enrolled_on: expect.any(String),
      }),
    );
    expect(mockMessageService.success).toHaveBeenCalled();
  });

  it('should create group and reload groups', () => {
    component.openCreateGroupModal();
    expect(component.groupModalVisible()).toBe(true);

    component.groupForm.patchValue({
      name: 'Farfalle',
      capacity: 20,
    });

    component.saveGroup();
    expect(mockChildcareApi.createGroup).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Farfalle',
        capacity: 20,
      }),
    );
    expect(mockMessageService.success).toHaveBeenCalled();
    expect(component.groupModalVisible()).toBe(false);
  });

  it('should open child drawer, load details, add ref person, and grant portal access', () => {
    component.openChildDrawer(mockChild);
    expect(component.drawerVisible()).toBe(true);
    expect(mockChildcareApi.getReferencePersons).toHaveBeenCalledWith('ch-1-uuid');
    expect(mockChildcareApi.getChildDocuments).toHaveBeenCalledWith('ch-1-uuid');
    expect(mockChildcareApi.getNotes).toHaveBeenCalledWith({ child_id: 'ch-1-uuid' });

    component.openAddRefPersonModal();
    expect(component.refPersonModalVisible()).toBe(true);

    component.refPersonForm.patchValue({
      full_name: 'Giulia Neri',
      relationship: 'Madre',
      phone: '+39 333 1122334',
    });

    component.saveRefPerson();
    expect(mockChildcareApi.addReferencePerson).toHaveBeenCalledWith(
      'ch-1-uuid',
      expect.objectContaining({
        full_name: 'Giulia Neri',
      }),
    );
    expect(mockMessageService.success).toHaveBeenCalled();
    expect(component.refPersonModalVisible()).toBe(false);

    component.grantPortalAccess(mockRefPerson);
    expect(mockChildcareApi.grantPortalAccess).toHaveBeenCalledWith('ref-1-uuid');
    expect(mockMessageService.success).toHaveBeenCalled();

    component.closeChildDrawer();
    expect(component.drawerVisible()).toBe(false);
    expect(component.selectedChild()).toBeNull();
  });

  it('should offer only pick-up authorised persons and show the server 422 on the field', () => {
    const blocked = { ...mockRefPerson, id: 'ref-2-uuid', can_pick_up: false };
    mockChildcareApi.getReferencePersons.mockReturnValueOnce(of({ data: [mockRefPerson, blocked] }));
    mockChildcareApi.checkOut.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { message: 'Invalid', errors: { picked_up_by: ['The selected person is not allowed.'] } },
          }),
      ),
    );

    component.openCheckOutModal('ch-1-uuid');
    expect(component.pickUpPersons()).toEqual([mockRefPerson]);

    component.checkOutForm.patchValue({ picked_up_by: 'ref-1-uuid' });
    component.saveCheckOut();

    expect(component.checkOutForm.controls.picked_up_by.errors?.['serverError']).toBe('The selected person is not allowed.');
    expect(component.checkOutModalVisible()).toBe(true);
    expect(mockMessageService.error).not.toHaveBeenCalled();
  });

  it('should register check-in, check-out, and absence', () => {
    component.openCheckInModal('ch-1-uuid');
    expect(component.checkInModalVisible()).toBe(true);

    component.checkInForm.patchValue({
      child_id: 'ch-1-uuid',
      temperature: '36.6',
    });
    component.saveCheckIn();
    expect(mockChildcareApi.checkIn).toHaveBeenCalledWith(
      expect.objectContaining({
        child_id: 'ch-1-uuid',
        temperature: '36.6',
      }),
    );
    expect(mockMessageService.success).toHaveBeenCalled();
    expect(component.checkInModalVisible()).toBe(false);

    component.openCheckOutModal('ch-1-uuid');
    expect(component.checkOutModalVisible()).toBe(true);
    expect(mockChildcareApi.getReferencePersons).toHaveBeenCalledWith('ch-1-uuid');
    expect(component.pickUpPersons()).toEqual([mockRefPerson]);
    component.checkOutForm.patchValue({
      child_id: 'ch-1-uuid',
      picked_up_by: 'ref-1-uuid',
    });
    component.saveCheckOut();
    expect(mockChildcareApi.checkOut).toHaveBeenCalledWith(
      expect.objectContaining({
        child_id: 'ch-1-uuid',
        picked_up_by: 'ref-1-uuid',
      }),
    );
    expect(mockMessageService.success).toHaveBeenCalled();
    expect(component.checkOutModalVisible()).toBe(false);

    component.openAbsenceModal('ch-1-uuid');
    expect(component.absenceModalVisible()).toBe(true);
    component.absenceForm.patchValue({
      child_id: 'ch-1-uuid',
      date: '2026-03-02',
      reason: 'Influenza',
    });
    component.saveAbsence();
    expect(mockChildcareApi.recordAbsence).toHaveBeenCalledWith(
      expect.objectContaining({
        child_id: 'ch-1-uuid',
        reason: 'Influenza',
      }),
    );
    expect(mockMessageService.success).toHaveBeenCalled();
    expect(component.absenceModalVisible()).toBe(false);
  });

  it('should create daily note, fee plan, run billing, and create requirement', () => {
    component.openCreateNoteModal();
    expect(component.noteModalVisible()).toBe(true);
    component.noteForm.patchValue({
      child_id: 'ch-1-uuid',
      category: 'nap',
      body: 'Ha dormito 2 ore',
      date: '2026-03-02',
    });
    component.saveNote();
    expect(mockChildcareApi.createNote).toHaveBeenCalledWith(
      expect.objectContaining({
        child_id: 'ch-1-uuid',
        category: 'nap',
      }),
    );
    expect(mockMessageService.success).toHaveBeenCalled();
    expect(component.noteModalVisible()).toBe(false);

    component.openCreateFeePlanModal();
    expect(component.feePlanModalVisible()).toBe(true);
    component.feePlanForm.patchValue({
      name: 'Tempo Pieno',
      basis: 'monthly',
      amount: '850.00',
      currency: 'EUR',
    });
    component.saveFeePlan();
    expect(mockChildcareApi.createFeePlan).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Tempo Pieno',
      }),
    );
    expect(mockMessageService.success).toHaveBeenCalled();
    expect(component.feePlanModalVisible()).toBe(false);

    component.openBillingRunModal();
    expect(component.billingRunModalVisible()).toBe(true);
    component.billingRunForm.patchValue({
      period: '2026-03',
      date: '2026-03-01',
    });
    component.executeBillingRun();
    expect(mockChildcareApi.runBilling).toHaveBeenCalledWith(
      expect.objectContaining({
        period: '2026-03',
      }),
    );
    expect(mockMessageService.success).toHaveBeenCalled();
    expect(component.billingRunModalVisible()).toBe(false);

    component.openCreateRequirementModal();
    expect(component.requirementModalVisible()).toBe(true);
    component.requirementForm.patchValue({
      name: 'Consenso Uscite Didattiche',
      requires_signature: true,
      is_mandatory: false,
    });
    component.saveRequirement();
    expect(mockChildcareApi.createDocumentRequirement).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Consenso Uscite Didattiche',
      }),
    );
    expect(mockMessageService.success).toHaveBeenCalled();
    expect(component.requirementModalVisible()).toBe(false);
  });
});
