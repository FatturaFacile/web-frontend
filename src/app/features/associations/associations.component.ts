import { DatePipe, UpperCasePipe } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
  AssociationFeeInstalment,
  AssociationFeePlan,
  AssociationMeeting,
  AssociationMeetingRequest,
  AssociationMember,
  AssociationMemberParams,
  AssociationMemberRequest,
  AssociationMemberStatus,
  AssociationPaymentMethod,
  AssociationReimbursement,
  AssociationVolunteer,
  AuthStore,
  TranslateService,
} from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { endsNotBefore, notInFuture, revalidateOnStartChange } from '@shared/utils/date-validators';

const AMOUNT_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;
const DONATION_AMOUNT_PATTERN = /^\d{1,12}(\.\d{1,2})?$/;

/** Mirrors `required_if`: the control is required while `isRequired()` holds. */
function requiredWhen(siblingKey: string, siblingValue: string) {
  return (control: AbstractControl) =>
    control.parent?.get(siblingKey)?.value === siblingValue && (control.value === null || control.value === '') ? { required: true } : null;
}

@Component({
  selector: 'app-associations',
  styleUrl: './associations.component.scss',
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
})
export class AssociationsComponent implements OnInit {
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
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
    first_name: ['', [Validators.required, Validators.maxLength(255)]],
    last_name: ['', [Validators.required, Validators.maxLength(255)]],
    email: ['', [Validators.email, Validators.maxLength(255)]],
    tax_code: ['', [Validators.maxLength(30)]],
    joined_on: [new Date().toISOString().slice(0, 10)],
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
  protected readonly feePlans = signal<AssociationFeePlan[]>([]);
  protected readonly feeForm = this.fb.group({
    member_id: ['', [Validators.required]],
    fee_plan_id: ['', [Validators.required]],
    starts_on: [new Date().toISOString().slice(0, 10)],
    ends_on: ['', [endsNotBefore('starts_on')]],
  });

  // Record Payment Modal
  protected paymentModalVisible = signal<boolean>(false);
  protected paymentFeeTarget = signal<AssociationFeeAssignment | null>(null);
  protected paymentAmount = signal<string>('50.00');
  protected paymentAmountTouched = signal(false);
  protected paymentDate = signal<string>(new Date().toISOString().slice(0, 10));
  protected paymentMethod = signal<AssociationPaymentMethod>('bank_transfer');
  protected readonly paymentMethods: readonly AssociationPaymentMethod[] = ['cash', 'bank_transfer', 'card', 'online', 'cheque'];
  protected paymentSubmitting = signal<boolean>(false);

  // --- TAB 3: COURSES ---
  protected readonly courses = signal<AssociationCourse[]>([]);
  protected readonly coursesLoading = signal<boolean>(false);
  protected readonly coursesTotal = signal<number>(0);
  protected createCourseModalVisible = signal<boolean>(false);
  protected createCourseSubmitting = signal<boolean>(false);
  protected readonly courseForm = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(255)]],
    starts_on: [new Date().toISOString().slice(0, 10), [Validators.required]],
    ends_on: ['', [endsNotBefore('starts_on')]],
    capacity: [20 as number | null, [Validators.min(1)]],
  });

  // Enrol Member in Course Modal
  protected enrolModalVisible = signal<boolean>(false);
  protected enrolCourseTarget = signal<AssociationCourse | null>(null);
  protected enrolMemberId = signal<string>('');
  protected enrolSubmitted = signal(false);
  protected enrolSubmitting = signal<boolean>(false);

  // --- TAB 4: DONATIONS & 5 PER MILLE ---
  protected readonly donations = signal<AssociationDonation[]>([]);
  protected readonly donationsLoading = signal<boolean>(false);
  protected readonly fivePerMille = signal<{ year: number; total_received: string } | null>(null);
  protected createDonationModalVisible = signal<boolean>(false);
  protected createDonationSubmitting = signal<boolean>(false);
  protected readonly donationForm = this.fb.group({
    kind: ['money' as 'money' | 'in_kind', [Validators.required]],
    amount: ['100.00', [Validators.required, Validators.pattern(DONATION_AMOUNT_PATTERN)]],
    received_on: [new Date().toISOString().slice(0, 10), [Validators.required, notInFuture]],
    payment_method: ['bank' as 'cash' | 'bank' | '', [requiredWhen('kind', 'money')]],
    in_kind_description: ['', [requiredWhen('kind', 'in_kind'), Validators.maxLength(2000)]],
    purpose: ['', [Validators.maxLength(500)]],
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
    member_id: ['', [Validators.required]],
    kind: ['expense' as 'expense' | 'mileage', [Validators.required]],
    incurred_on: [new Date().toISOString().slice(0, 10), [Validators.required]],
    description: ['', [Validators.required, Validators.maxLength(500)]],
    amount: ['45.00', [requiredWhen('kind', 'expense'), Validators.pattern(AMOUNT_PATTERN)]],
    vehicle: ['', [requiredWhen('kind', 'mileage'), Validators.maxLength(100)]],
    plate: ['', [requiredWhen('kind', 'mileage'), Validators.maxLength(20)]],
    distance_km: ['', [requiredWhen('kind', 'mileage'), Validators.pattern(/^\d{1,7}(\.\d{1,2})?$/)]],
    unit_price: ['', [requiredWhen('kind', 'mileage'), Validators.pattern(/^\d{1,4}(\.\d{1,4})?$/)]],
  });

  // --- TAB 6: MEETINGS ---
  protected readonly meetings = signal<AssociationMeeting[]>([]);
  protected readonly meetingsLoading = signal<boolean>(false);
  protected createMeetingModalVisible = signal<boolean>(false);
  protected meetingSubmitting = signal<boolean>(false);
  protected readonly meetingForm = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(255)]],
    body: ['assembly' as 'assembly' | 'board' | 'other', [Validators.required]],
    body_name: ['', [requiredWhen('body', 'other'), Validators.maxLength(255)]],
    scheduled_at: [new Date().toISOString().slice(0, 16)],
    second_call_at: ['', [endsNotBefore('scheduled_at', { strict: true })]],
    location: ['', [Validators.maxLength(255)]],
  });

  constructor() {
    revalidateOnStartChange(this.feeForm, 'starts_on', 'ends_on', this.destroyRef);
    revalidateOnStartChange(this.courseForm, 'starts_on', 'ends_on', this.destroyRef);
    revalidateOnStartChange(this.meetingForm, 'scheduled_at', 'second_call_at', this.destroyRef);
    this.donationForm.controls.kind.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.donationForm.controls.payment_method.updateValueAndValidity();
      this.donationForm.controls.in_kind_description.updateValueAndValidity();
    });
    this.reimbForm.controls.kind.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      for (const key of ['amount', 'vehicle', 'plate', 'distance_km', 'unit_price'] as const) {
        this.reimbForm.controls[key].updateValueAndValidity();
      }
    });
    this.meetingForm.controls.body.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.meetingForm.controls.body_name.updateValueAndValidity();
    });
  }

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
      tax_code: '',
      joined_on: new Date().toISOString().slice(0, 10),
    });
    this.createMemberModalVisible.set(true);
  }

  protected submitCreateMember(): void {
    if (this.memberForm.invalid) {
      this.memberForm.markAllAsTouched();
      return;
    }

    const raw = this.memberForm.getRawValue();
    const payload: AssociationMemberRequest = {
      first_name: raw.first_name,
      last_name: raw.last_name,
      email: raw.email || null,
      tax_code: raw.tax_code || undefined,
      joined_on: raw.joined_on || null,
    };
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
      fee_plan_id: '',
      starts_on: new Date().toISOString().slice(0, 10),
      ends_on: '',
    });
    this.associationApi.getFeePlans().subscribe({
      next: (res) => this.feePlans.set(res.data),
      error: () => this.feePlans.set([]),
    });
    this.createFeeModalVisible.set(true);
  }

  protected submitCreateFee(): void {
    if (this.feeForm.invalid) {
      this.feeForm.markAllAsTouched();
      return;
    }

    this.createFeeSubmitting.set(true);
    const raw = this.feeForm.getRawValue();
    this.associationApi
      .createFeeAssignment({
        member_id: raw.member_id,
        fee_plan_id: raw.fee_plan_id,
        starts_on: raw.starts_on || null,
        ends_on: raw.ends_on || null,
      })
      .subscribe({
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
    this.paymentAmountTouched.set(false);
    const instalment = this.openInstalmentOf(fee);
    this.paymentAmount.set(instalment ? (Number(instalment.amount) - Number(instalment.paid_amount)).toFixed(2) : fee.net_amount);
    this.paymentDate.set(new Date().toISOString().slice(0, 10));
    this.paymentMethod.set('bank_transfer');
    this.paymentModalVisible.set(true);
  }

  /** First instalment still to be paid: the payment endpoint works on instalments, not on the assignment. */
  protected openInstalmentOf(fee: AssociationFeeAssignment): AssociationFeeInstalment | undefined {
    return (fee.instalments ?? []).find((instalment) => instalment.status !== 'paid');
  }

  protected isPaymentAmountValid(): boolean {
    return AMOUNT_PATTERN.test(this.paymentAmount().trim());
  }

  /** Mirrors `paid_on`: `before_or_equal:today`. */
  protected isPaymentDateValid(): boolean {
    const value = this.paymentDate();
    return value !== '' && notInFuture(new FormControl(value)) === null;
  }

  protected submitPayment(): void {
    const fee = this.paymentFeeTarget();
    if (!fee) return;
    this.paymentAmountTouched.set(true);
    const instalment = this.openInstalmentOf(fee);
    if (!instalment || !this.isPaymentAmountValid() || !this.isPaymentDateValid()) return;

    this.paymentSubmitting.set(true);
    this.associationApi
      .recordFeePayment(instalment.id, {
        amount: this.paymentAmount().trim(),
        paid_on: this.paymentDate(),
        method: this.paymentMethod(),
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
      title: '',
      starts_on: new Date().toISOString().slice(0, 10),
      ends_on: '',
      capacity: 20,
    });
    this.createCourseModalVisible.set(true);
  }

  protected submitCreateCourse(): void {
    if (this.courseForm.invalid) {
      this.courseForm.markAllAsTouched();
      return;
    }

    this.createCourseSubmitting.set(true);
    const raw = this.courseForm.getRawValue();
    const payload: AssociationCourseRequest = {
      title: raw.title,
      starts_on: raw.starts_on,
      ends_on: raw.ends_on || null,
      capacity: raw.capacity,
    };
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
    this.enrolSubmitted.set(false);
    this.enrolMemberId.set(this.members()[0]?.id || '');
    this.enrolModalVisible.set(true);
  }

  protected submitEnrol(): void {
    const course = this.enrolCourseTarget();
    this.enrolSubmitted.set(true);
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
    const year = new Date().getFullYear();
    this.associationApi.getFivePerMille().subscribe({
      next: (res) => {
        const ofYear = res.data.filter((allocation) => allocation.reference_year === String(year));
        this.fivePerMille.set(
          ofYear.length > 0
            ? { year, total_received: ofYear.reduce((sum, allocation) => sum + Number(allocation.amount), 0).toFixed(2) }
            : null,
        );
      },
      error: () => this.fivePerMille.set(null),
    });
  }

  protected openCreateDonationModal(): void {
    this.donationForm.reset({
      kind: 'money',
      amount: '100.00',
      received_on: new Date().toISOString().slice(0, 10),
      payment_method: 'bank',
      in_kind_description: '',
      purpose: '',
    });
    this.createDonationModalVisible.set(true);
  }

  protected submitCreateDonation(): void {
    if (this.donationForm.invalid) {
      this.donationForm.markAllAsTouched();
      return;
    }

    this.createDonationSubmitting.set(true);
    const raw = this.donationForm.getRawValue();
    const isMoney = raw.kind === 'money';
    const payload: AssociationDonationRequest = {
      kind: raw.kind,
      amount: raw.amount,
      received_on: raw.received_on,
      payment_method: isMoney && raw.payment_method !== '' ? raw.payment_method : null,
      in_kind_description: isMoney ? null : raw.in_kind_description,
      purpose: raw.purpose || null,
    };
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
        this.loadDonations();
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
      member_id: this.volunteers()[0]?.member_id || '',
      kind: 'expense',
      incurred_on: new Date().toISOString().slice(0, 10),
      description: '',
      amount: '45.00',
      vehicle: '',
      plate: '',
      distance_km: '',
      unit_price: '',
    });
    this.createReimbModalVisible.set(true);
  }

  protected submitCreateReimb(): void {
    if (this.reimbForm.invalid) {
      this.reimbForm.markAllAsTouched();
      return;
    }

    this.reimbSubmitting.set(true);
    const raw = this.reimbForm.getRawValue();
    const isMileage = raw.kind === 'mileage';
    this.associationApi
      .createReimbursement({
        member_id: raw.member_id,
        kind: raw.kind,
        incurred_on: raw.incurred_on,
        description: raw.description,
        amount: isMileage ? null : raw.amount,
        vehicle: isMileage ? raw.vehicle : null,
        plate: isMileage ? raw.plate : null,
        distance_km: isMileage ? raw.distance_km : null,
        unit_price: isMileage ? raw.unit_price : null,
      })
      .subscribe({
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
    const payload = approved ? { approved } : { approved, reason: this.translate.instant('ASSOCIATIONS.LBL_RIMBORSO_RESPINTO') };
    this.associationApi.decideReimbursement(reimb.id, payload).subscribe({
      next: () => {
        this.message.success(approved ? 'Rimborso approvato' : 'Rimborso respinto');
        this.loadReimbursements();
      },
      error: () => this.message.error(this.translate.instant('ASSOCIATIONS.MSG_ERRORE_DURANTE_LA_DECISIONE_SUL_RIMBORSO')),
    });
  }

  protected payReimb(reimb: AssociationReimbursement): void {
    this.associationApi.payReimbursement(reimb.id, { paid_on: new Date().toISOString().slice(0, 10), payment_method: 'bank' }).subscribe({
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
      title: '',
      body: 'assembly',
      body_name: '',
      scheduled_at: new Date().toISOString().slice(0, 16),
      second_call_at: '',
      location: '',
    });
    this.createMeetingModalVisible.set(true);
  }

  protected submitCreateMeeting(): void {
    if (this.meetingForm.invalid) {
      this.meetingForm.markAllAsTouched();
      return;
    }

    this.meetingSubmitting.set(true);
    const raw = this.meetingForm.getRawValue();
    const payload: AssociationMeetingRequest = {
      body: raw.body,
      body_name: raw.body === 'other' ? raw.body_name : null,
      title: raw.title,
      scheduled_at: raw.scheduled_at || null,
      second_call_at: raw.second_call_at || null,
      location: raw.location || null,
    };
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
  protected memberNameOf(memberId: string | null | undefined): string {
    const member = this.members().find((candidate) => candidate.id === memberId);
    return member ? `${member.first_name ?? ''} ${member.last_name ?? ''}`.trim() : (memberId ?? '-');
  }

  protected volunteerNameOf(volunteer: AssociationVolunteer): string {
    const contact = volunteer.member?.contact;
    return contact ? `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim() : this.memberNameOf(volunteer.member_id);
  }

  protected getStatusColor(status: string): string {
    switch (status?.toLowerCase()) {
      case 'active':
      case 'paid':
      case 'completed':
      case 'ended':
      case 'approved':
        return 'success';
      case 'candidate':
      case 'open':
      case 'submitted':
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
