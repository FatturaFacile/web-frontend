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

/** Waits for the debounced grid models (a real timer: the debounce is not tracked by the test zone). */
function settle(ms = 30): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
      tax_code: 'BRNGLI90A41L123Z',
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
      description: 'Quota annuale',
      starts_on: '2026-01-01',
      net_amount: '50.00',
      status: 'active',
      instalments: [{ id: 'inst-1', sequence: 1, due_on: '2026-02-28', amount: '50.00', paid_amount: '0.00', status: 'open' }],
    },
  ];

  const mockCourses: AssociationCourse[] = [
    { id: 'crs-1', title: 'Yoga Dinamico Adulti', starts_on: '2026-01-10', capacity: 18, enrolled_count: 12, status: 'active' },
  ];

  const mockDonations: AssociationDonation[] = [
    { id: 'don-1', kind: 'money', amount: '2500.00', received_on: '2026-01-20', payment_method: 'bank', receipts: [{ id: 'r1', number: 'RIC-2026-001' }] },
  ];

  const mockVolunteers: AssociationVolunteer[] = [
    {
      id: 'vol-1',
      member_id: 'mem-001-uuid',
      activity: 'Trasporto',
      started_on: '2026-01-01',
      member: { contact: { first_name: 'Giulia', last_name: 'Bernasconi' } },
    },
  ];

  const mockReimbursements: AssociationReimbursement[] = [
    {
      id: 'reimb-1',
      member_id: 'mem-001-uuid',
      kind: 'expense',
      amount: '35.00',
      description: 'Carburante navetta sociale anziani',
      incurred_on: '2026-02-05',
      status: 'submitted',
    },
  ];

  const mockMeetings: AssociationMeeting[] = [
    {
      id: 'meet-1',
      title: 'Assemblea Annuale Approvazione Bilancio',
      body: 'assembly',
      scheduled_at: '2026-04-15T18:30:00Z',
      location: 'Sede Sociale Lugano',
      status: 'scheduled',
    },
  ];

  const mockAssociationApi = {
    getMembers: vi.fn().mockReturnValue(of({ success: true, data: mockMembers, meta: { total: 1 } })),
    createMember: vi.fn().mockReturnValue(of({ success: true, data: mockMembers[0] })),
    deleteMember: vi.fn().mockReturnValue(of(null)),
    getMemberFeeStanding: vi.fn().mockReturnValue(of({ success: true, data: { is_in_good_standing: true, outstanding_amount: '0.00' } })),
    getFeePlans: vi.fn().mockReturnValue(of({ success: true, data: [{ id: 'plan-1', name: 'Quota annuale' }] })),
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
    getFivePerMille: vi.fn().mockReturnValue(of({ success: true, data: [] })),
    getVolunteers: vi.fn().mockReturnValue(of({ success: true, data: mockVolunteers })),
    getReimbursements: vi.fn().mockReturnValue(of({ success: true, data: mockReimbursements, meta: { total: 1, last_page: 1 } })),
    createReimbursement: vi.fn().mockReturnValue(of({ success: true, data: mockReimbursements[0] })),
    decideReimbursement: vi.fn().mockReturnValue(of({ success: true, data: { ...mockReimbursements[0], status: 'approved' } })),
    payReimbursement: vi.fn().mockReturnValue(of({ success: true, data: { success: true } })),
    getMeetings: vi.fn().mockReturnValue(of({ success: true, data: mockMeetings, meta: { total: 1, last_page: 1 } })),
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
    // The grids load their rows through a debounced model.
    await settle();
  });

  it('initializes component and loads members list', () => {
    expect(component).toBeTruthy();
    expect(mockAssociationApi.getMembers).toHaveBeenCalled();
    expect(component.members().length).toBe(1);
    expect(component.members()[0].first_name).toBe('Giulia');
  });

  it('sends the registry filters of the toolbar and the column filters of the grid to the API', async () => {
    component['memberStatusFilter'].set('active');
    component['memberSearch'].set('Giulia');
    component['applyMemberFilters']();
    component['membersGrid'].onGridParams({ pageIndex: 1, pageSize: 10, sort: { key: 'full_name', order: 'ascend' }, filters: { full_name: ['Giulia Bernasconi'], status: 'act' } });
    await settle(450);

    const last = mockAssociationApi.getMembers.mock.calls.at(-1)?.[0];
    expect(last).toMatchObject({
      status: 'active',
      search: 'Giulia',
      sort_by: 'full_name',
      sort_dir: 'asc',
      filter: { full_name: ['Giulia Bernasconi'] },
      filter_like: { status: 'act' },
    });
  });

  it('shows the member of a fee from the contact embedded by the API', () => {
    expect(component['memberNameOfRow']({ member_id: 'unknown', member: { contact: { first_name: 'Anna', last_name: 'Rossi' } } })).toBe('Anna Rossi');
    expect(component['memberNameOfRow']({ member_id: 'mem-001-uuid' })).toBe('Giulia Bernasconi');
    expect(component['personLabel']({ company_name: 'ASD Lugano' })).toBe('ASD Lugano');
  });

  it('submits create member modal form', () => {
    component.openCreateMemberModal();
    expect(component.createMemberModalVisible()).toBe(true);

    component.memberForm.patchValue({
      first_name: 'Paolo',
      last_name: 'Meda',
      tax_code: 'MDAPLA78B12L123K',
      email: 'paolo.meda@example.ch',
      joined_on: '2026-02-01',
    });

    component.submitCreateMember();
    expect(mockAssociationApi.createMember).toHaveBeenCalledWith({
      first_name: 'Paolo',
      last_name: 'Meda',
      email: 'paolo.meda@example.ch',
      tax_code: 'MDAPLA78B12L123K',
      joined_on: '2026-02-01',
    });
    expect(component.createMemberModalVisible()).toBe(false);
    expect(mockMessage.success).toHaveBeenCalled();
  });

  it('does not call the API when the forms are submitted empty or with an invalid amount', () => {
    component.openCreateMemberModal();
    component.memberForm.patchValue({ first_name: '', last_name: '', tax_code: '' });
    component.submitCreateMember();
    expect(mockAssociationApi.createMember).not.toHaveBeenCalled();
    expect(component.memberForm.controls.first_name.touched).toBe(true);

    component.onTabChange(1);
    component.openPaymentModal(component.fees()[0]);
    component.paymentAmount.set('abc');
    component.submitPayment();
    expect(mockAssociationApi.recordFeePayment).not.toHaveBeenCalled();
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
    expect(mockAssociationApi.recordFeePayment).toHaveBeenCalledWith('inst-1', {
      amount: '50.00',
      paid_on: new Date().toISOString().slice(0, 10),
      method: 'bank_transfer',
    });
    expect(component.paymentModalVisible()).toBe(false);
  });

  it('rejects a future payment date', () => {
    component.onTabChange(1);
    component.openPaymentModal(component.fees()[0]);
    component.paymentDate.set('2999-01-01');
    component.submitPayment();
    expect(mockAssociationApi.recordFeePayment).not.toHaveBeenCalled();
  });

  it('assigns a fee with the fee plan the API requires and blocks an end before the start', () => {
    component.onTabChange(1);
    component.openCreateFeeModal();
    component.feeForm.patchValue({ member_id: 'mem-001-uuid', fee_plan_id: 'plan-1', starts_on: '2026-03-01', ends_on: '2026-02-01' });
    component.submitCreateFee();
    expect(mockAssociationApi.createFeeAssignment).not.toHaveBeenCalled();
    expect(component.feeForm.controls.ends_on.hasError('endsBeforeStart')).toBe(true);

    component.feeForm.patchValue({ ends_on: '2026-12-31' });
    component.submitCreateFee();
    expect(mockAssociationApi.createFeeAssignment).toHaveBeenCalledWith({
      member_id: 'mem-001-uuid',
      fee_plan_id: 'plan-1',
      starts_on: '2026-03-01',
      ends_on: '2026-12-31',
    });
  });

  it('sends the donation fields of the API and requires the description for an in-kind gift', () => {
    component.openCreateDonationModal();
    component.donationForm.patchValue({ kind: 'in_kind', amount: '80.00', received_on: '2026-02-01' });
    component.submitCreateDonation();
    expect(mockAssociationApi.createDonation).not.toHaveBeenCalled();

    component.donationForm.patchValue({ in_kind_description: 'Arredi' });
    component.submitCreateDonation();
    expect(mockAssociationApi.createDonation).toHaveBeenCalledWith({
      kind: 'in_kind',
      amount: '80.00',
      received_on: '2026-02-01',
      payment_method: null,
      in_kind_description: 'Arredi',
      purpose: null,
    });
  });

  it('does not accept a donation dated in the future', () => {
    component.openCreateDonationModal();
    component.donationForm.patchValue({ received_on: '2999-01-01' });
    expect(component.donationForm.controls.received_on.hasError('futureDate')).toBe(true);
  });

  it('sends the reimbursement fields of the API', () => {
    component.openCreateReimbModal();
    component.reimbForm.patchValue({ member_id: 'mem-001-uuid', description: 'Carburante', incurred_on: '2026-02-05', amount: '35.00' });
    component.submitCreateReimb();
    expect(mockAssociationApi.createReimbursement).toHaveBeenCalledWith({
      member_id: 'mem-001-uuid',
      kind: 'expense',
      incurred_on: '2026-02-05',
      description: 'Carburante',
      amount: '35.00',
      vehicle: null,
      plate: null,
      distance_km: null,
      unit_price: null,
    });
  });

  it('sends the meeting fields of the API and requires the second call after the first', () => {
    component.openCreateMeetingModal();
    component.meetingForm.patchValue({ title: 'Assemblea', scheduled_at: '2026-04-15T18:30', second_call_at: '2026-04-15T18:30' });
    component.submitCreateMeeting();
    expect(mockAssociationApi.createMeeting).not.toHaveBeenCalled();

    component.meetingForm.patchValue({ second_call_at: '2026-04-15T19:30' });
    component.submitCreateMeeting();
    expect(mockAssociationApi.createMeeting).toHaveBeenCalledWith({
      body: 'assembly',
      body_name: null,
      title: 'Assemblea',
      scheduled_at: '2026-04-15T18:30',
      second_call_at: '2026-04-15T19:30',
      location: null,
    });
  });

  it('switches to courses tab, creates course and enrols member', () => {
    component.onTabChange(2);
    expect(mockAssociationApi.getCourses).toHaveBeenCalled();

    component.openCreateCourseModal();
    expect(component.createCourseModalVisible()).toBe(true);
    component.courseForm.patchValue({
      title: 'Pilates Funzionale',
      starts_on: '2026-03-01',
      capacity: 12,
    });
    component.submitCreateCourse();
    expect(mockAssociationApi.createCourse).toHaveBeenCalledWith({
      title: 'Pilates Funzionale',
      starts_on: '2026-03-01',
      ends_on: null,
      capacity: 12,
    });

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
