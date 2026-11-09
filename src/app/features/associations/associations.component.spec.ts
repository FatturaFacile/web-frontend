import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../icons-provider';
import {
  AssociationCourse,
  AssociationDonation,
  AssociationFeeAssignment,
  AssociationMeeting,
  AssociationMember,
  AssociationReimbursement,
  AssociationsApiService,
  AssociationVolunteer,
} from '@core';
import { AssociationsComponent } from './associations.component';

describe('AssociationsComponent', () => {
  let fixture: ComponentFixture<AssociationsComponent>;
  let component: AssociationsComponent;

  const mockMembers: AssociationMember[] = [
    {
      id: 'mem-001-uuid',
      member_number: 'SOC-2026-001',
      first_name: 'Giulia',
      last_name: 'Bernasconi',
      email: 'giulia.bernasconi@example.ch',
      fiscal_code: 'BRNGLI90A41L123Z',
      status: 'active',
      joined_on: '2026-01-10',
      has_medical_certificate: true,
      medical_certificate_expiry: '2026-12-31',
    },
  ];

  const mockFees: AssociationFeeAssignment[] = [
    {
      id: 'fee-1',
      member_id: 'mem-001-uuid',
      member_name: 'Giulia Bernasconi',
      fee_type: 'quota_annuale',
      year: 2026,
      amount: '50.00',
      due_date: '2026-02-28',
      status: 'pending',
    },
  ];

  const mockCourses: AssociationCourse[] = [
    {
      id: 'crs-1',
      name: 'Yoga Dinamico Adulti',
      discipline: 'Posturale',
      instructor_name: 'Marco Valli',
      max_participants: 18,
      enrolled_count: 12,
      status: 'active',
      season: '2025/2026',
    },
  ];

  const mockDonations: AssociationDonation[] = [
    {
      id: 'don-1',
      donor_name: 'Banca Stato Solidarietà',
      fiscal_code: 'CHE-999.888.777',
      amount: '2500.00',
      currency: 'CHF',
      donation_date: '2026-01-20',
      is_cash: false,
      receipt_number: 'RIC-2026-001',
    },
  ];

  const mockVolunteers: AssociationVolunteer[] = [
    {
      id: 'vol-1',
      member_id: 'mem-001-uuid',
      name: 'Giulia Bernasconi',
      insurance_policy_number: 'POL-RUNTS-2026',
      insurance_expiry: '2026-12-31',
      is_registered_in_runts_book: true,
    },
  ];

  const mockReimbursements: AssociationReimbursement[] = [
    {
      id: 'reimb-1',
      volunteer_id: 'vol-1',
      volunteer_name: 'Giulia Bernasconi',
      amount: '35.00',
      description: 'Carburante navetta sociale anziani',
      expense_date: '2026-02-05',
      status: 'pending',
    },
  ];

  const mockMeetings: AssociationMeeting[] = [
    {
      id: 'meet-1',
      title: 'Assemblea Annuale Approvazione Bilancio',
      meeting_type: 'ordinary',
      meeting_date: '2026-04-15T18:30:00Z',
      location: 'Sede Sociale Lugano',
      is_convoked: true,
      has_quorum: true,
      status: 'scheduled',
    },
  ];

  const mockAssociationApi = {
    getMembers: vi.fn().mockReturnValue(of({ success: true, data: mockMembers, meta: { total: 1 } })),
    createMember: vi.fn().mockReturnValue(of({ success: true, data: mockMembers[0] })),
    deleteMember: vi.fn().mockReturnValue(of(null)),
    getMemberFeeStanding: vi.fn().mockReturnValue(of({ success: true, data: { is_in_good_standing: true, outstanding_amount: '0.00' } })),
    getFeeAssignments: vi.fn().mockReturnValue(of({ success: true, data: mockFees, meta: { total: 1 } })),
    createFeeAssignment: vi.fn().mockReturnValue(of({ success: true, data: mockFees[0] })),
    cancelFeeAssignment: vi.fn().mockReturnValue(of({ success: true, data: { success: true } })),
    recordFeePayment: vi.fn().mockReturnValue(of({ success: true, data: { success: true } })),
    getCourses: vi.fn().mockReturnValue(of({ success: true, data: mockCourses, meta: { total: 1 } })),
    createCourse: vi.fn().mockReturnValue(of({ success: true, data: mockCourses[0] })),
    enrolInCourse: vi.fn().mockReturnValue(of({ success: true, data: { success: true } })),
    getDonations: vi.fn().mockReturnValue(of({ success: true, data: mockDonations, meta: { total: 1 } })),
    createDonation: vi.fn().mockReturnValue(of({ success: true, data: mockDonations[0] })),
    generateDonationReceipt: vi.fn().mockReturnValue(of({ success: true, data: { receipt_number: 'RIC-2026-002' } })),
    getFivePerMille: vi.fn().mockReturnValue(of({ success: true, data: { year: 2026, total_received: '12400.00', allocated: '10000.00' } })),
    getVolunteers: vi.fn().mockReturnValue(of({ success: true, data: mockVolunteers })),
    getReimbursements: vi.fn().mockReturnValue(of({ success: true, data: mockReimbursements })),
    createReimbursement: vi.fn().mockReturnValue(of({ success: true, data: mockReimbursements[0] })),
    decideReimbursement: vi.fn().mockReturnValue(of({ success: true, data: { ...mockReimbursements[0], status: 'approved' } })),
    payReimbursement: vi.fn().mockReturnValue(of({ success: true, data: { success: true } })),
    getMeetings: vi.fn().mockReturnValue(of({ success: true, data: mockMeetings })),
    createMeeting: vi.fn().mockReturnValue(of({ success: true, data: mockMeetings[0] })),
  };

  const mockMessage = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssociationsComponent],
      providers: [
        { provide: AssociationsApiService, useValue: mockAssociationApi },
        { provide: NzMessageService, useValue: mockMessage },
        provideNzIcons(icons),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AssociationsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('initializes component and loads members list', () => {
    expect(component).toBeTruthy();
    expect(mockAssociationApi.getMembers).toHaveBeenCalled();
    expect(component.members().length).toBe(1);
    expect(component.members()[0].first_name).toBe('Giulia');
  });

  it('submits create member modal form', () => {
    component.openCreateMemberModal();
    expect(component.createMemberModalVisible()).toBe(true);

    component.memberForm.patchValue({
      first_name: 'Paolo',
      last_name: 'Meda',
      fiscal_code: 'MDAPLA78B12L123K',
      email: 'paolo.meda@example.ch',
      joined_on: '2026-02-01',
    });

    component.submitCreateMember();
    expect(mockAssociationApi.createMember).toHaveBeenCalled();
    expect(component.createMemberModalVisible()).toBe(false);
    expect(mockMessage.success).toHaveBeenCalled();
  });

  it('opens member drawer and loads fee standing', () => {
    const member = component.members()[0];
    component.openMemberDrawer(member);
    expect(component.memberDrawerVisible()).toBe(true);
    expect(mockAssociationApi.getMemberFeeStanding).toHaveBeenCalledWith(member.id);
  });

  it('switches to fees tab and records payment', () => {
    component.onTabChange(1);
    expect(mockAssociationApi.getFeeAssignments).toHaveBeenCalled();
    expect(component.fees().length).toBe(1);

    const fee = component.fees()[0];
    component.openPaymentModal(fee);
    expect(component.paymentModalVisible()).toBe(true);

    component.submitPayment();
    expect(mockAssociationApi.recordFeePayment).toHaveBeenCalled();
    expect(component.paymentModalVisible()).toBe(false);
  });

  it('switches to courses tab, creates course and enrols member', () => {
    component.onTabChange(2);
    expect(mockAssociationApi.getCourses).toHaveBeenCalled();

    component.openCreateCourseModal();
    expect(component.createCourseModalVisible()).toBe(true);
    component.courseForm.patchValue({
      name: 'Pilates Funzionale',
      max_participants: 12,
    });
    component.submitCreateCourse();
    expect(mockAssociationApi.createCourse).toHaveBeenCalled();

    const course = component.courses()[0];
    component.openEnrolModal(course);
    component.enrolMemberId.set('mem-001-uuid');
    component.submitEnrol();
    expect(mockAssociationApi.enrolInCourse).toHaveBeenCalledWith(course.id, { member_id: 'mem-001-uuid' });
  });

  it('switches to donations tab and generates tax deduction receipt', () => {
    component.onTabChange(3);
    expect(mockAssociationApi.getDonations).toHaveBeenCalled();
    expect(mockAssociationApi.getFivePerMille).toHaveBeenCalled();

    const don = component.donations()[0];
    component.generateReceipt(don);
    expect(mockAssociationApi.generateDonationReceipt).toHaveBeenCalledWith(don.id);
    expect(mockMessage.success).toHaveBeenCalled();
  });

  it('switches to volunteers and meetings tabs, decides reimbursement', () => {
    component.onTabChange(4);
    expect(mockAssociationApi.getVolunteers).toHaveBeenCalled();
    expect(mockAssociationApi.getReimbursements).toHaveBeenCalled();

    const reimb = component.reimbursements()[0];
    component.decideReimb(reimb, true);
    expect(mockAssociationApi.decideReimbursement).toHaveBeenCalledWith(reimb.id, { approved: true });

    // Meetings
    component.onTabChange(5);
    expect(mockAssociationApi.getMeetings).toHaveBeenCalled();
    expect(component.meetings().length).toBe(1);
  });
});
