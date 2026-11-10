import { DatePipe, UpperCasePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpaceModule } from 'ng-zorro-antd/space';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule, NzTableQueryParams } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AssociationsApiService,
  AssociationCourse,
  AssociationCourseRequest,
  AssociationDonation,
  AssociationDonationRequest,
  AssociationFeeAssignment,
  AssociationMeeting,
  AssociationMeetingRequest,
  AssociationMember,
  AssociationMemberParams,
  AssociationMemberRequest,
  AssociationMemberStatus,
  AssociationReimbursement,
  AssociationVolunteer,
  AuthStore,
  TranslateService,
} from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';

@Component({
  selector: 'app-associations',
  imports: [
    DatePipe,
    UpperCasePipe,
    FormsModule,
    ReactiveFormsModule,
    NzCardModule,
    NzTabsModule,
    NzTableModule,
    NzTagModule,
    NzButtonModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzSwitchModule,
    NzFormModule,
    NzModalModule,
    NzDrawerModule,
    NzDescriptionsModule,
    NzStatisticModule,
    NzSpaceModule,
    NzIconModule,
    NzEmptyModule,
    PageHeaderComponent,
    MoneyPipe,
    TranslatePipe,
  ],
  templateUrl: './associations.component.html',
  styleUrls: ['./associations.component.scss'],
})
export class AssociationsComponent implements OnInit {
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly associationApi = inject(AssociationsApiService);
  private readonly message = inject(NzMessageService);
  protected readonly authStore = inject(AuthStore);

  // Active tab index (0: Members, 1: Fees, 2: Courses, 3: Donations, 4: Volunteers, 5: Meetings)
  protected selectedTabIndex = signal<number>(0);

  // --- TAB 1: MEMBERS / LIBRO SOCI ---
  protected readonly members = signal<AssociationMember[]>([]);
  protected readonly membersLoading = signal<boolean>(false);
  protected readonly membersTotal = signal<number>(0);
  protected readonly membersPageIndex = signal<number>(1);
  protected readonly membersPageSize = signal<number>(10);
  protected readonly memberSearch = signal<string>('');
  protected readonly memberStatusFilter = signal<AssociationMemberStatus | ''>('');

  // Create Member Modal
  protected createMemberModalVisible = signal<boolean>(false);
  protected createMemberSubmitting = signal<boolean>(false);
  protected readonly memberForm = this.fb.group({
    first_name: ['', [Validators.required]],
    last_name: ['', [Validators.required]],
    email: ['', [Validators.email]],
    fiscal_code: ['', [Validators.required]],
    joined_on: [new Date().toISOString().slice(0, 10), [Validators.required]],
    member_number: [''],
  });

  // Member Detail Drawer
  protected memberDrawerVisible = signal<boolean>(false);
  protected selectedMember = signal<AssociationMember | null>(null);
  protected memberFeeStanding = signal<{ is_in_good_standing: boolean; outstanding_amount: string } | null>(null);

  // --- TAB 2: FEES & PAYMENTS ---
  protected readonly fees = signal<AssociationFeeAssignment[]>([]);
  protected readonly feesLoading = signal<boolean>(false);
  protected readonly feesTotal = signal<number>(0);
  protected readonly feesPageIndex = signal<number>(1);
  protected readonly feesPageSize = signal<number>(10);

  // Create Fee Modal
  protected createFeeModalVisible = signal<boolean>(false);
  protected createFeeSubmitting = signal<boolean>(false);
  protected readonly feeForm = this.fb.group({
    member_id: ['', [Validators.required]],
    fee_type: ['quota_annuale', [Validators.required]],
    year: [new Date().getFullYear(), [Validators.required]],
    amount: ['50.00', [Validators.required]],
    due_date: [new Date().toISOString().slice(0, 10), [Validators.required]],
  });

  // Record Payment Modal
  protected paymentModalVisible = signal<boolean>(false);
  protected paymentFeeTarget = signal<AssociationFeeAssignment | null>(null);
  protected paymentAmount = signal<string>('50.00');
  protected paymentMethod = signal<string>('bonifico');
  protected paymentSubmitting = signal<boolean>(false);

  // --- TAB 3: COURSES ---
  protected readonly courses = signal<AssociationCourse[]>([]);
  protected readonly coursesLoading = signal<boolean>(false);
  protected readonly coursesTotal = signal<number>(0);
  protected createCourseModalVisible = signal<boolean>(false);
  protected createCourseSubmitting = signal<boolean>(false);
  protected readonly courseForm = this.fb.group({
    name: ['', [Validators.required]],
    discipline: [''],
    max_participants: [20, [Validators.min(1)]],
    season: [`${new Date().getFullYear()}/${new Date().getFullYear() + 1}`],
  });

  // Enrol Member in Course Modal
  protected enrolModalVisible = signal<boolean>(false);
  protected enrolCourseTarget = signal<AssociationCourse | null>(null);
  protected enrolMemberId = signal<string>('');
  protected enrolSubmitting = signal<boolean>(false);

  // --- TAB 4: DONATIONS & 5 PER MILLE ---
  protected readonly donations = signal<AssociationDonation[]>([]);
  protected readonly donationsLoading = signal<boolean>(false);
  protected readonly fivePerMille = signal<{ year: number; total_received: string; allocated: string } | null>(null);
  protected createDonationModalVisible = signal<boolean>(false);
  protected createDonationSubmitting = signal<boolean>(false);
  protected readonly donationForm = this.fb.group({
    donor_name: ['', [Validators.required]],
    fiscal_code: [''],
    amount: ['100.00', [Validators.required]],
    currency: ['CHF', [Validators.required]],
    donation_date: [new Date().toISOString().slice(0, 10), [Validators.required]],
    is_cash: [false],
    notes: [''],
  });

  // --- TAB 5: VOLUNTEERS & REIMBURSEMENTS ---
  protected readonly volunteers = signal<AssociationVolunteer[]>([]);
  protected readonly volunteersLoading = signal<boolean>(false);
  protected readonly reimbursements = signal<AssociationReimbursement[]>([]);
  protected readonly reimbursementsLoading = signal<boolean>(false);

  // Create Reimbursement Modal
  protected createReimbModalVisible = signal<boolean>(false);
  protected reimbSubmitting = signal<boolean>(false);
  protected readonly reimbForm = this.fb.group({
    volunteer_id: ['', [Validators.required]],
    amount: ['45.00', [Validators.required]],
    description: ['', [Validators.required]],
    expense_date: [new Date().toISOString().slice(0, 10), [Validators.required]],
  });

  // --- TAB 6: MEETINGS ---
  protected readonly meetings = signal<AssociationMeeting[]>([]);
  protected readonly meetingsLoading = signal<boolean>(false);
  protected createMeetingModalVisible = signal<boolean>(false);
  protected meetingSubmitting = signal<boolean>(false);
  protected readonly meetingForm = this.fb.group({
    title: ['', [Validators.required]],
    meeting_type: ['ordinary' as const, [Validators.required]],
    meeting_date: [new Date().toISOString().slice(0, 16), [Validators.required]],
    location: ['Sede Sociale'],
  });

  ngOnInit(): void {
    this.loadMembers();
  }

  protected onTabChange(index: number): void {
    this.selectedTabIndex.set(index);
    if (index === 0) {
      this.loadMembers();
    } else if (index === 1) {
      this.loadFees();
    } else if (index === 2) {
      this.loadCourses();
    } else if (index === 3) {
      this.loadDonations();
      this.loadFivePerMille();
    } else if (index === 4) {
      this.loadVolunteers();
      this.loadReimbursements();
    } else if (index === 5) {
      this.loadMeetings();
    }
  }

  // --- MEMBERS LOGIC ---
  protected loadMembers(): void {
    this.membersLoading.set(true);
    const params: AssociationMemberParams = {
      status: (this.memberStatusFilter() || undefined) as AssociationMemberStatus | undefined,
      search: this.memberSearch() || undefined,
      page: this.membersPageIndex(),
      per_page: this.membersPageSize(),
    };

    this.associationApi.getMembers(params).subscribe({
      next: (res) => {
        this.members.set(res.data);
        this.membersTotal.set(res.meta?.total ?? res.data.length);
        this.membersLoading.set(false);
      },
      error: () => {
        this.message.error(this.translate.instant('ASSOCIATIONS.MSG_ERRORE_NEL_CARICAMENTO_DEL_LIBRO_SOCI'));
        this.membersLoading.set(false);
      },
    });
  }

  protected onMembersTableQueryChange(params: NzTableQueryParams): void {
    this.membersPageIndex.set(params.pageIndex);
    this.membersPageSize.set(params.pageSize);
    this.loadMembers();
  }

  protected openCreateMemberModal(): void {
    this.memberForm.reset({
      first_name: '',
      last_name: '',
      email: '',
      fiscal_code: '',
      joined_on: new Date().toISOString().slice(0, 10),
      member_number: `SOC-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
    });
    this.createMemberModalVisible.set(true);
  }

  protected submitCreateMember(): void {
    if (this.memberForm.invalid) {
      this.memberForm.markAllAsTouched();
      return;
    }

    const payload: AssociationMemberRequest = this.memberForm.getRawValue();
    this.createMemberSubmitting.set(true);
    this.associationApi.createMember(payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('ASSOCIATIONS.MSG_NUOVO_SOCIO_ISCRITTO_AL_LIBRO_SOCI'));
        this.createMemberModalVisible.set(false);
        this.createMemberSubmitting.set(false);
        this.loadMembers();
      },
      error: () => {
        this.message.error(this.translate.instant('ASSOCIATIONS.MSG_ERRORE_DURANTE_L_ISCRIZIONE_DEL_SOCIO'));
        this.createMemberSubmitting.set(false);
      },
    });
  }

  protected deleteMember(member: AssociationMember): void {
    this.associationApi.deleteMember(member.id).subscribe({
      next: () => {
        this.message.info(this.translate.instant('ASSOCIATIONS.MSG_SOCIO_RIMOSSO'));
        this.loadMembers();
      },
      error: () => this.message.error(this.translate.instant('ASSOCIATIONS.MSG_IMPOSSIBILE_RIMUOVERE_IL_SOCIO')),
    });
  }

  protected openMemberDrawer(member: AssociationMember): void {
    this.selectedMember.set(member);
    this.memberDrawerVisible.set(true);

    this.associationApi.getMemberFeeStanding(member.id).subscribe({
      next: (res) => this.memberFeeStanding.set(res.data),
      error: () => this.memberFeeStanding.set(null),
    });
  }

  // --- FEES LOGIC ---
  protected loadFees(): void {
    this.feesLoading.set(true);
    this.associationApi.getFeeAssignments({ page: this.feesPageIndex(), per_page: this.feesPageSize() }).subscribe({
      next: (res) => {
        this.fees.set(res.data);
        this.feesTotal.set(res.meta?.total ?? res.data.length);
        this.feesLoading.set(false);
      },
      error: () => {
        this.message.error(this.translate.instant('ASSOCIATIONS.MSG_ERRORE_NEL_CARICAMENTO_DELLE_QUOTE_ASSOCIATIVE'));
        this.feesLoading.set(false);
      },
    });
  }

  protected openCreateFeeModal(): void {
    this.feeForm.reset({
      member_id: this.members()[0]?.id || '',
      fee_type: 'quota_annuale',
      year: new Date().getFullYear(),
      amount: '50.00',
      due_date: new Date().toISOString().slice(0, 10),
    });
    this.createFeeModalVisible.set(true);
  }

  protected submitCreateFee(): void {
    if (this.feeForm.invalid) return;

    this.createFeeSubmitting.set(true);
    this.associationApi.createFeeAssignment(this.feeForm.getRawValue()).subscribe({
      next: () => {
        this.message.success(this.translate.instant('ASSOCIATIONS.MSG_QUOTA_ASSOCIATIVA_ASSEGNATA'));
        this.createFeeModalVisible.set(false);
        this.createFeeSubmitting.set(false);
        this.loadFees();
      },
      error: () => {
        this.message.error(this.translate.instant('ASSOCIATIONS.MSG_ERRORE_DURANTE_L_ASSEGNAZIONE_DELLA_QUOTA'));
        this.createFeeSubmitting.set(false);
      },
    });
  }

  protected cancelFee(fee: AssociationFeeAssignment): void {
    this.associationApi.cancelFeeAssignment(fee.id).subscribe({
      next: () => {
        this.message.info(this.translate.instant('ASSOCIATIONS.MSG_QUOTA_ANNULLATA'));
        this.loadFees();
      },
      error: () => this.message.error(this.translate.instant('ASSOCIATIONS.MSG_ERRORE_NELL_ANNULLAMENTO_DELLA_QUOTA')),
    });
  }

  protected openPaymentModal(fee: AssociationFeeAssignment): void {
    this.paymentFeeTarget.set(fee);
    this.paymentAmount.set(fee.amount);
    this.paymentMethod.set('bonifico');
    this.paymentModalVisible.set(true);
  }

  protected submitPayment(): void {
    const fee = this.paymentFeeTarget();
    if (!fee) return;

    this.paymentSubmitting.set(true);
    this.associationApi
      .recordFeePayment(fee.id, {
        amount: this.paymentAmount(),
        payment_date: new Date().toISOString().slice(0, 10),
        payment_method: this.paymentMethod(),
      })
      .subscribe({
        next: () => {
          this.message.success(this.translate.instant('ASSOCIATIONS.MSG_PAGAMENTO_QUOTA_REGISTRATO'));
          this.paymentModalVisible.set(false);
          this.paymentSubmitting.set(false);
          this.loadFees();
        },
        error: () => {
          this.message.error(this.translate.instant('ASSOCIATIONS.MSG_ERRORE_NELLA_REGISTRAZIONE_DEL_PAGAMENTO'));
          this.paymentSubmitting.set(false);
        },
      });
  }

  // --- COURSES LOGIC ---
  protected loadCourses(): void {
    this.coursesLoading.set(true);
    this.associationApi.getCourses().subscribe({
      next: (res) => {
        this.courses.set(res.data);
        this.coursesTotal.set(res.meta?.total ?? res.data.length);
        this.coursesLoading.set(false);
      },
      error: () => {
        this.message.error(this.translate.instant('ASSOCIATIONS.MSG_ERRORE_NEL_CARICAMENTO_DEI_CORSI'));
        this.coursesLoading.set(false);
      },
    });
  }

  protected openCreateCourseModal(): void {
    this.courseForm.reset({
      name: '',
      discipline: 'Sport & Benessere',
      max_participants: 20,
      season: `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`,
    });
    this.createCourseModalVisible.set(true);
  }

  protected submitCreateCourse(): void {
    if (this.courseForm.invalid) return;

    this.createCourseSubmitting.set(true);
    const payload: AssociationCourseRequest = this.courseForm.getRawValue();
    this.associationApi.createCourse(payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('ASSOCIATIONS.MSG_NUOVO_CORSO_CREATO'));
        this.createCourseModalVisible.set(false);
        this.createCourseSubmitting.set(false);
        this.loadCourses();
      },
      error: () => {
        this.message.error(this.translate.instant('ASSOCIATIONS.MSG_ERRORE_DURANTE_LA_CREAZIONE_DEL_CORSO'));
        this.createCourseSubmitting.set(false);
      },
    });
  }

  protected openEnrolModal(course: AssociationCourse): void {
    this.enrolCourseTarget.set(course);
    this.enrolMemberId.set(this.members()[0]?.id || '');
    this.enrolModalVisible.set(true);
  }

  protected submitEnrol(): void {
    const course = this.enrolCourseTarget();
    if (!course || !this.enrolMemberId()) return;

    this.enrolSubmitting.set(true);
    this.associationApi.enrolInCourse(course.id, { member_id: this.enrolMemberId() }).subscribe({
      next: () => {
        this.message.success(this.translate.instant('ASSOCIATIONS.MSG_SOCIO_ISCRITTO_AL_CORSO_CON_SUCCESSO'));
        this.enrolModalVisible.set(false);
        this.enrolSubmitting.set(false);
        this.loadCourses();
      },
      error: () => {
        this.message.error(this.translate.instant('ASSOCIATIONS.MSG_ERRORE_DURANTE_L_ISCRIZIONE_AL_CORSO'));
        this.enrolSubmitting.set(false);
      },
    });
  }

  // --- DONATIONS LOGIC ---
  protected loadDonations(): void {
    this.donationsLoading.set(true);
    this.associationApi.getDonations().subscribe({
      next: (res) => {
        this.donations.set(res.data);
        this.donationsLoading.set(false);
      },
      error: () => {
        this.message.error(this.translate.instant('ASSOCIATIONS.MSG_ERRORE_NEL_CARICAMENTO_DELLE_DONAZIONI'));
        this.donationsLoading.set(false);
      },
    });
  }

  protected loadFivePerMille(): void {
    this.associationApi.getFivePerMille(new Date().getFullYear()).subscribe({
      next: (res) => this.fivePerMille.set(res.data),
      error: () => this.fivePerMille.set(null),
    });
  }

  protected openCreateDonationModal(): void {
    this.donationForm.reset({
      donor_name: '',
      fiscal_code: '',
      amount: '100.00',
      currency: 'CHF',
      donation_date: new Date().toISOString().slice(0, 10),
      is_cash: false,
      notes: '',
    });
    this.createDonationModalVisible.set(true);
  }

  protected submitCreateDonation(): void {
    if (this.donationForm.invalid) return;

    this.createDonationSubmitting.set(true);
    const payload: AssociationDonationRequest = this.donationForm.getRawValue();
    this.associationApi.createDonation(payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('ASSOCIATIONS.MSG_DONAZIONE_REGISTRATA'));
        this.createDonationModalVisible.set(false);
        this.createDonationSubmitting.set(false);
        this.loadDonations();
      },
      error: () => {
        this.message.error(this.translate.instant('ASSOCIATIONS.MSG_ERRORE_NELLA_REGISTRAZIONE_DELLA_DONAZIONE'));
        this.createDonationSubmitting.set(false);
      },
    });
  }

  protected generateReceipt(donation: AssociationDonation): void {
    this.associationApi.generateDonationReceipt(donation.id).subscribe({
      next: (res) => {
        this.message.success(this.translate.instant('ASSOCIATIONS.MSG_RICEVUTA_FISCALE_N_GENERATA', { receipt_number: res.data.receipt_number }));
        donation.receipt_number = res.data.receipt_number;
      },
      error: () => this.message.error(this.translate.instant('ASSOCIATIONS.MSG_ERRORE_NELLA_GENERAZIONE_DELLA_RICEVUTA')),
    });
  }

  // --- VOLUNTEERS & REIMBURSEMENTS LOGIC ---
  protected loadVolunteers(): void {
    this.volunteersLoading.set(true);
    this.associationApi.getVolunteers().subscribe({
      next: (res) => {
        this.volunteers.set(res.data);
        this.volunteersLoading.set(false);
      },
      error: () => {
        this.message.error(this.translate.instant('ASSOCIATIONS.MSG_ERRORE_NEL_CARICAMENTO_DEI_VOLONTARI_RUNTS'));
        this.volunteersLoading.set(false);
      },
    });
  }

  protected loadReimbursements(): void {
    this.reimbursementsLoading.set(true);
    this.associationApi.getReimbursements().subscribe({
      next: (res) => {
        this.reimbursements.set(res.data);
        this.reimbursementsLoading.set(false);
      },
      error: () => {
        this.message.error(this.translate.instant('ASSOCIATIONS.MSG_ERRORE_NEL_CARICAMENTO_DEI_RIMBORSI_SPESE'));
        this.reimbursementsLoading.set(false);
      },
    });
  }

  protected openCreateReimbModal(): void {
    this.reimbForm.reset({
      volunteer_id: this.volunteers()[0]?.id || '',
      amount: '45.00',
      description: 'Rimborso chilometrico attività sociale',
      expense_date: new Date().toISOString().slice(0, 10),
    });
    this.createReimbModalVisible.set(true);
  }

  protected submitCreateReimb(): void {
    if (this.reimbForm.invalid) return;

    this.reimbSubmitting.set(true);
    this.associationApi.createReimbursement(this.reimbForm.getRawValue()).subscribe({
      next: () => {
        this.message.success(this.translate.instant('ASSOCIATIONS.MSG_RICHIESTA_RIMBORSO_PRESENTATA'));
        this.createReimbModalVisible.set(false);
        this.reimbSubmitting.set(false);
        this.loadReimbursements();
      },
      error: () => {
        this.message.error(this.translate.instant('ASSOCIATIONS.MSG_ERRORE_NELLA_CREAZIONE_DELLA_RICHIESTA_RIMBORSO'));
        this.reimbSubmitting.set(false);
      },
    });
  }

  protected decideReimb(reimb: AssociationReimbursement, approved: boolean): void {
    this.associationApi.decideReimbursement(reimb.id, { approved }).subscribe({
      next: () => {
        this.message.success(approved ? 'Rimborso approvato' : 'Rimborso respinto');
        this.loadReimbursements();
      },
      error: () => this.message.error(this.translate.instant('ASSOCIATIONS.MSG_ERRORE_DURANTE_LA_DECISIONE_SUL_RIMBORSO')),
    });
  }

  protected payReimb(reimb: AssociationReimbursement): void {
    this.associationApi.payReimbursement(reimb.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('ASSOCIATIONS.MSG_LIQUIDAZIONE_RIMBORSO_REGISTRATA'));
        this.loadReimbursements();
      },
      error: () => this.message.error(this.translate.instant('ASSOCIATIONS.MSG_ERRORE_DURANTE_LA_LIQUIDAZIONE')),
    });
  }

  // --- MEETINGS LOGIC ---
  protected loadMeetings(): void {
    this.meetingsLoading.set(true);
    this.associationApi.getMeetings().subscribe({
      next: (res) => {
        this.meetings.set(res.data);
        this.meetingsLoading.set(false);
      },
      error: () => {
        this.message.error(this.translate.instant('ASSOCIATIONS.MSG_ERRORE_NEL_CARICAMENTO_DELLE_ASSEMBLEE'));
        this.meetingsLoading.set(false);
      },
    });
  }

  protected openCreateMeetingModal(): void {
    this.meetingForm.reset({
      title: 'Assemblea Generale Ordinaria dei Soci',
      meeting_type: 'ordinary',
      meeting_date: new Date().toISOString().slice(0, 16),
      location: 'Sede Sociale',
    });
    this.createMeetingModalVisible.set(true);
  }

  protected submitCreateMeeting(): void {
    if (this.meetingForm.invalid) return;

    this.meetingSubmitting.set(true);
    const payload: AssociationMeetingRequest = this.meetingForm.getRawValue();
    this.associationApi.createMeeting(payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('ASSOCIATIONS.MSG_ASSEMBLEA_CONVOCATA_CON_SUCCESSO'));
        this.createMeetingModalVisible.set(false);
        this.meetingSubmitting.set(false);
        this.loadMeetings();
      },
      error: () => {
        this.message.error(this.translate.instant('ASSOCIATIONS.MSG_ERRORE_DURANTE_LA_CONVOCAZIONE_DELL_ASSEMBLEA'));
        this.meetingSubmitting.set(false);
      },
    });
  }

  // --- HELPERS ---
  protected getStatusColor(status: string): string {
    switch (status?.toLowerCase()) {
      case 'active':
      case 'paid':
      case 'completed':
      case 'approved':
        return 'success';
      case 'candidate':
      case 'pending':
      case 'scheduled':
        return 'processing';
      case 'inactive':
      case 'cancelled':
      case 'ceased':
      case 'rejected':
        return 'default';
      default:
        return 'default';
    }
  }
}
