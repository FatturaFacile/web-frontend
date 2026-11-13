import { DatePipe, DecimalPipe, UpperCasePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal, TemplateRef, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { decimalPattern } from '@shared/utils/decimal-validators';
import { notInFuture } from '@shared/utils/date-validators';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpaceModule } from 'ng-zorro-antd/space';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  applyServerErrors,
  ChildcareAdmitRequest,
  ChildcareApiService,
  ChildcareBillsParams,
  ChildcareNotesParams,
  ChildcareParams,
  FetchGridModel,
  ChildcareAttendance,
  ChildcareBill,
  ChildcareBillingRunRequest,
  ChildcareCheckInRequest,
  ChildcareCheckOutRequest,
  ChildcareChild,
  ChildcareChildRequest,
  ChildcareChildStatus,
  ChildcareDailyNote,
  ChildcareDocument,
  ChildcareFeePlan,
  ChildcareFeePlanRequest,
  ChildcareGroup,
  ChildcareGroupRequest,
  ChildcareNoteRequest,
  ChildcareReferencePerson,
  ChildcareReferencePersonRequest,
  ChildcareRequirement,
  ChildcareRequirementRequest,
  isValidationError,
  TranslateService,
  ChildcareAbsenceReason,
  ChildcareFeeBasis,
  ChildcareNoteCategory,
  ChildcareRelationship,
} from '@core';
import { BaseTableComponent, MoneyPipe, PageHeaderComponent, TableColumnDef, TranslatePipe, ModalActionsDirective, IconActionDirective, GridExportDirective, GridSortPipe, GridFilterListPipe, GridFilterFnPipe } from '@shared';

@Component({
  selector: 'app-childcare',
  styleUrl: './childcare.component.scss',
  imports: [
    BaseTableComponent,
    GridExportDirective,
    GridSortPipe, GridFilterListPipe, GridFilterFnPipe,
    ModalActionsDirective,
    IconActionDirective,
    DatePipe,
    DecimalPipe,
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
    NzDescriptionsModule,
    NzSpaceModule,
    NzStatisticModule,
    NzPopconfirmModule,
    NzIconModule,
    NzEmptyModule,
    PageHeaderComponent,
    TranslatePipe,
    MoneyPipe,
  ],
  templateUrl: './childcare.component.html',
})
export class ChildcareComponent implements OnInit {
  private readonly api = inject(ChildcareApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly selectedTabIndex = signal<number>(0);

  // --- TAB 1: CHILDREN ---
  /** Active children for the check-in, check-out and note selects (the grid below only holds one page). */
  readonly children = signal<ChildcareChild[]>([]);
  readonly childGrid = new FetchGridModel<ChildcareChild, ChildcareParams>((q) => this.api.getChildren(q));
  readonly filterStatus = signal<string>('');
  readonly filterSearch = signal<string>('');

  private readonly childNameTpl = viewChild<TemplateRef<unknown>>('childNameTpl');
  private readonly childGroupTpl = viewChild<TemplateRef<unknown>>('childGroupTpl');
  private readonly childBirthTpl = viewChild<TemplateRef<unknown>>('childBirthTpl');
  private readonly childEnrolledTpl = viewChild<TemplateRef<unknown>>('childEnrolledTpl');
  private readonly childStatusTpl = viewChild<TemplateRef<unknown>>('childStatusTpl');
  private readonly childBillingTpl = viewChild<TemplateRef<unknown>>('childBillingTpl');

  readonly childColumns = computed<TableColumnDef<ChildcareChild>[]>(() => [
    {
      key: 'first_name',
      serverKey: 'display_name',
      header: 'CHILDCARE.COL_NAME',
      valueGetter: (c) => `${c.first_name} ${c.last_name}`.trim(),
      customCellTemplate: this.childNameTpl(),
    },
    {
      key: 'group_name',
      serverKey: 'group.name',
      header: 'CHILDCARE.COL_GROUP',
      valueGetter: (c) => c.group_name || c.group_id || '',
      customCellTemplate: this.childGroupTpl(),
    },
    {
      key: 'birth_date',
      header: 'CHILDCARE.COL_BIRTH_DATE',
      sortable: false,
      filterable: false,
      groupable: false,
      customCellTemplate: this.childBirthTpl(),
    },
    { key: 'enrolled_on', header: 'CHILDCARE.COL_ENROLLED_ON', customCellTemplate: this.childEnrolledTpl() },
    {
      key: 'status',
      header: 'CHILDCARE.COL_STATUS',
      valueGetter: (c) => this.childStatusLabel(c.status),
      valueLabel: (value) => this.childStatusLabel(value),
      customCellTemplate: this.childStatusTpl(),
    },
    {
      key: 'billing_contact_name',
      header: 'CHILDCARE.COL_BILLING_CONTACT',
      valueGetter: (c) => c.billing_contact_name || c.billing_contact_id,
      customCellTemplate: this.childBillingTpl(),
    },
  ]);

  // Groups cache
  readonly groups = signal<ChildcareGroup[]>([]);

  // Child Drawer
  readonly drawerVisible = signal<boolean>(false);
  readonly selectedChild = signal<ChildcareChild | null>(null);
  private readonly destroyRef = inject(DestroyRef);
  readonly refPersons = signal<ChildcareReferencePerson[]>([]);
  /** Reference persons allowed to pick up the child selected in the check-out dialog. */
  readonly pickUpPersons = signal<ChildcareReferencePerson[]>([]);
  readonly childDocuments = signal<ChildcareDocument[]>([]);
  readonly childDailyNotes = signal<ChildcareDailyNote[]>([]);
  readonly drawerLoading = signal<boolean>(false);

  // --- TAB 2: ATTENDANCES ---
  readonly attendances = signal<ChildcareAttendance[]>([]);
  readonly attendancesLoading = signal<boolean>(false);
  readonly attendanceMonth = signal<string>(new Date().toISOString().substring(0, 7));

  // --- TAB 3: DAILY LOG NOTES ---
  readonly noteGrid = new FetchGridModel<ChildcareDailyNote, ChildcareNotesParams>((q) => this.api.getNotes(q));

  private readonly noteDateTpl = viewChild<TemplateRef<unknown>>('noteDateTpl');
  private readonly noteChildTpl = viewChild<TemplateRef<unknown>>('noteChildTpl');
  private readonly noteCategoryTpl = viewChild<TemplateRef<unknown>>('noteCategoryTpl');
  private readonly noteFamilyTpl = viewChild<TemplateRef<unknown>>('noteFamilyTpl');

  readonly noteColumns = computed<TableColumnDef<ChildcareDailyNote>[]>(() => [
    { key: 'date', header: 'CHILDCARE.COL_DATE', customCellTemplate: this.noteDateTpl() },
    {
      key: 'child_name',
      header: 'CHILDCARE.COL_CHILD',
      valueGetter: (n) => n.child_name || n.child_id,
      customCellTemplate: this.noteChildTpl(),
    },
    { key: 'category', header: 'CHILDCARE.COL_CATEGORY', customCellTemplate: this.noteCategoryTpl() },
    { key: 'body', serverKey: 'body_text', header: 'CHILDCARE.COL_BODY' },
    {
      key: 'visible_to_family',
      header: 'CHILDCARE.COL_FAMILY_VISIBLE',
      sortable: false,
      filterable: false,
      groupable: false,
      customCellTemplate: this.noteFamilyTpl(),
    },
  ]);

  // --- TAB 4: BILLING & FEE PLANS ---
  readonly bills = signal<ChildcareBill[]>([]);
  readonly feePlans = signal<ChildcareFeePlan[]>([]);
  readonly billingPeriod = signal<string>(new Date().toISOString().substring(0, 7));
  readonly billGrid = new FetchGridModel<ChildcareBill, ChildcareBillsParams>((q) => this.api.getBills(q), 300);

  private readonly billPeriodTpl = viewChild<TemplateRef<unknown>>('billPeriodTpl');
  private readonly billChildTpl = viewChild<TemplateRef<unknown>>('billChildTpl');
  private readonly billContactTpl = viewChild<TemplateRef<unknown>>('billContactTpl');
  private readonly billGrossTpl = viewChild<TemplateRef<unknown>>('billGrossTpl');
  private readonly billSubsidyTpl = viewChild<TemplateRef<unknown>>('billSubsidyTpl');
  private readonly billNetTpl = viewChild<TemplateRef<unknown>>('billNetTpl');
  private readonly billStatusTpl = viewChild<TemplateRef<unknown>>('billStatusTpl');

  readonly billColumns = computed<TableColumnDef<ChildcareBill>[]>(() => [
    { key: 'period', header: 'CHILDCARE.COL_PERIOD', customCellTemplate: this.billPeriodTpl() },
    {
      key: 'child_name',
      header: 'CHILDCARE.COL_CHILD',
      valueGetter: (b) => b.child_name || b.child_id,
      customCellTemplate: this.billChildTpl(),
    },
    {
      key: 'contact_name',
      header: 'CHILDCARE.COL_BILLING_CONTACT',
      valueGetter: (b) => b.contact_name || b.contact_id,
      customCellTemplate: this.billContactTpl(),
    },
    { key: 'gross_amount', header: 'CHILDCARE.COL_GROSS_AMOUNT', align: 'right', customCellTemplate: this.billGrossTpl() },
    { key: 'subsidy_amount', header: 'CHILDCARE.COL_SUBSIDY_AMOUNT', align: 'right', customCellTemplate: this.billSubsidyTpl() },
    { key: 'net_amount', header: 'CHILDCARE.COL_NET_AMOUNT', align: 'right', customCellTemplate: this.billNetTpl() },
    { key: 'status', header: 'CHILDCARE.COL_STATUS', customCellTemplate: this.billStatusTpl() },
  ]);

  // Billing statistics
  readonly totalBilledAmount = computed(() =>
    this.bills().reduce((acc, b) => acc + (parseFloat(b.net_amount) || 0), 0),
  );
  readonly totalSubsidyAmount = computed(() =>
    this.bills().reduce((acc, b) => acc + (parseFloat(b.subsidy_amount) || 0), 0),
  );

  // --- TAB 5: REQUIREMENTS & DOCUMENTS ---
  readonly requirements = signal<ChildcareRequirement[]>([]);
  readonly outstandingDocuments = signal<ChildcareDocument[]>([]);
  readonly requirementsLoading = signal<boolean>(false);

  // Modals visibility
  readonly childModalVisible = signal<boolean>(false);
  readonly groupModalVisible = signal<boolean>(false);
  readonly checkInModalVisible = signal<boolean>(false);
  readonly checkOutModalVisible = signal<boolean>(false);
  readonly absenceModalVisible = signal<boolean>(false);
  readonly noteModalVisible = signal<boolean>(false);
  readonly feePlanModalVisible = signal<boolean>(false);
  readonly billingRunModalVisible = signal<boolean>(false);
  readonly requirementModalVisible = signal<boolean>(false);
  readonly refPersonModalVisible = signal<boolean>(false);

  // --- FORMS ---
  protected readonly absenceReasons: readonly ChildcareAbsenceReason[] = ['sick', 'holiday', 'other'];
  protected readonly relationships: readonly ChildcareRelationship[] = ['mother', 'father', 'guardian', 'grandparent', 'relative', 'other'];

  readonly childForm = this.fb.group({
    first_name: ['', [Validators.required, Validators.maxLength(100)]],
    last_name: ['', [Validators.required, Validators.maxLength(100)]],
    birth_date: ['', [notInFuture]],
    group_id: [''],
    billing_contact_id: ['', [Validators.required]],
    enrolled_on: [new Date().toISOString().substring(0, 10), [Validators.required]],
    allergies: ['', [Validators.maxLength(2000)]],
    dietary_notes: ['', [Validators.maxLength(2000)]],
    health_notes: ['', [Validators.maxLength(5000)]],
    subsidy_canton: ['', [Validators.pattern(/^[A-Z]{2}$/)]],
  });

  readonly groupForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    capacity: [15, [Validators.min(0), Validators.max(1000)]],
  });

  readonly checkInForm = this.fb.group({
    child_id: ['', [Validators.required]],
    at: [new Date().toISOString().substring(0, 16)],
    temperature: ['36.5', [decimalPattern(1, 2), Validators.min(34), Validators.max(43)]],
  });

  readonly checkOutForm = this.fb.group({
    child_id: ['', [Validators.required]],
    at: [new Date().toISOString().substring(0, 16)],
    picked_up_by: ['', [Validators.required]],
  });

  readonly absenceForm = this.fb.group({
    child_id: ['', [Validators.required]],
    date: [new Date().toISOString().substring(0, 10), [Validators.required]],
    reason: ['sick' as ChildcareAbsenceReason, [Validators.required]],
  });

  readonly noteForm = this.fb.group({
    child_id: ['', [Validators.required]],
    date: [new Date().toISOString().substring(0, 10), [Validators.required]],
    category: ['general' as ChildcareNoteCategory, [Validators.required]],
    body: ['', [Validators.required, Validators.maxLength(5000)]],
    visible_to_family: [true],
  });

  readonly feePlanForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    basis: ['monthly_flat' as ChildcareFeeBasis, [Validators.required]],
    amount: ['850.00', [Validators.required, decimalPattern(2)]],
    meal_amount: ['120.00', [decimalPattern(2)]],
    tax_rate: ['0.00', [Validators.required, decimalPattern(2), Validators.max(100)]],
    currency: ['EUR', [Validators.required, Validators.pattern(/^[A-Za-z]{3}$/)]],
  });

  readonly billingRunForm = this.fb.group({
    period: [new Date().toISOString().substring(0, 7), [Validators.required]],
    date: [new Date().toISOString().substring(0, 10), [Validators.required]],
  });

  readonly requirementForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    requires_signature: [true],
    is_mandatory: [true],
  });

  readonly refPersonForm = this.fb.group({
    full_name: ['', [Validators.required, Validators.maxLength(150)]],
    relationship: ['mother' as ChildcareRelationship, [Validators.required]],
    phone: ['', [Validators.maxLength(40)]],
    email: ['', [Validators.email, Validators.maxLength(180)]],
    is_guardian: [true],
    can_pick_up: [true],
  });

  constructor() {
    // The period is required by the API: set it before the grid sends its first request.
    this.billGrid.setFilter({ period: this.billingPeriod() });
  }

  ngOnInit(): void {
    this.checkOutForm.controls.child_id.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((childId) => this.loadPickUpPersons(childId));
    this.loadGroups();
    this.loadChildOptions();
    this.loadAttendances();
    this.loadFeePlans();
    this.loadBillTotals();
    this.loadRequirements();
  }

  // --- CHILDREN METHODS ---
  loadChildren(): void {
    this.childGrid.reload();
    this.loadChildOptions();
  }

  private loadChildOptions(): void {
    this.api.getChildren({ status: 'active', per_page: 200 }).subscribe({
      next: (res) => this.children.set(res.data ?? []),
      error: () => this.message.error(this.translate.instant('CHILDCARE.LOAD_ERROR')),
    });
  }

  onStatusFilterChange(status: string | null): void {
    this.filterStatus.set(status ?? '');
    this.childGrid.setFilter({ status: status ? status : undefined });
  }

  onSearchChange(search: string): void {
    this.filterSearch.set(search);
  }

  applySearch(): void {
    const search = this.filterSearch().trim();
    this.childGrid.setFilter({ search: search ? search : undefined });
  }

  childStatusLabel(status: ChildcareChildStatus | string): string {
    const keys: Record<string, string> = {
      active: 'CHILDCARE.STATUS.ENROLLED',
      waiting: 'CHILDCARE.STATUS.WAITLIST',
      left: 'CHILDCARE.STATUS.WITHDRAWN',
    };
    return keys[status] ? this.translate.instant(keys[status]) : status;
  }

  loadGroups(): void {
    this.api.getGroups().subscribe({
      next: (res) => {
        this.groups.set(res.data || []);
      },
    });
  }

  openCreateChildModal(): void {
    this.childForm.reset({
      first_name: '',
      last_name: '',
      birth_date: '',
      group_id: '',
      billing_contact_id: '',
      enrolled_on: new Date().toISOString().substring(0, 10),
      allergies: '',
      dietary_notes: '',
      health_notes: '',
      subsidy_canton: '',
    });
    this.childModalVisible.set(true);
  }

  saveChild(): void {
    if (this.childForm.invalid) {
      this.childForm.markAllAsTouched();
      return;
    }
    const val = this.childForm.getRawValue();
    const payload: ChildcareChildRequest = {
      first_name: val.first_name,
      last_name: val.last_name,
      birth_date: val.birth_date || undefined,
      group_id: val.group_id || undefined,
      billing_contact_id: val.billing_contact_id,
      enrolled_on: val.enrolled_on,
      allergies: val.allergies || undefined,
      dietary_notes: val.dietary_notes || undefined,
      health_notes: val.health_notes || undefined,
      subsidy_canton: val.subsidy_canton || undefined,
      status: 'active',
    };

    this.api.enrolChild(payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('CHILDCARE.CHILD_ENROLLED'));
        this.childModalVisible.set(false);
        this.loadChildren();
      },
      error: () => {
        this.message.error(this.translate.instant('CHILDCARE.ACTION_ERROR'));
      },
    });
  }

  admitChild(child: ChildcareChild): void {
    const payload: ChildcareAdmitRequest = {
      enrolled_on: new Date().toISOString().substring(0, 10),
    };
    this.api.admitChild(child.id, payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('CHILDCARE.CHILD_ADMITTED'));
        this.loadChildren();
      },
      error: () => {
        this.message.error(this.translate.instant('CHILDCARE.ACTION_ERROR'));
      },
    });
  }

  openCreateGroupModal(): void {
    this.groupForm.reset({
      name: '',
      capacity: 15,
    });
    this.groupModalVisible.set(true);
  }

  saveGroup(): void {
    if (this.groupForm.invalid) {
      this.groupForm.markAllAsTouched();
      return;
    }
    const val = this.groupForm.getRawValue();
    const payload: ChildcareGroupRequest = {
      name: val.name,
      capacity: Number(val.capacity),
    };

    this.api.createGroup(payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('CHILDCARE.GROUP_CREATED'));
        this.groupModalVisible.set(false);
        this.loadGroups();
      },
      error: () => {
        this.message.error(this.translate.instant('CHILDCARE.ACTION_ERROR'));
      },
    });
  }

  // --- DRAWER DETAILS ---
  openChildDrawer(child: ChildcareChild): void {
    this.selectedChild.set(child);
    this.drawerVisible.set(true);
    this.drawerLoading.set(true);

    this.api.getReferencePersons(child.id).subscribe({
      next: (res) => {
        this.refPersons.set(res.data || []);
      },
    });

    this.api.getChildDocuments(child.id).subscribe({
      next: (res) => {
        this.childDocuments.set(res.data || []);
      },
    });

    this.api.getNotes({ child_id: child.id, per_page: 200 }).subscribe({
      next: (res) => {
        this.childDailyNotes.set(res.data || []);
        this.drawerLoading.set(false);
      },
      error: () => {
        this.drawerLoading.set(false);
      },
    });
  }

  closeChildDrawer(): void {
    this.drawerVisible.set(false);
    this.selectedChild.set(null);
    this.refPersons.set([]);
    this.childDocuments.set([]);
    this.childDailyNotes.set([]);
  }

  openAddRefPersonModal(): void {
    this.refPersonForm.reset({
      full_name: '',
      relationship: 'mother',
      phone: '',
      email: '',
      is_guardian: true,
      can_pick_up: true,
    });
    this.refPersonModalVisible.set(true);
  }

  saveRefPerson(): void {
    const child = this.selectedChild();
    if (!child || this.refPersonForm.invalid) {
      this.refPersonForm.markAllAsTouched();
      return;
    }
    const val = this.refPersonForm.getRawValue();
    const payload: ChildcareReferencePersonRequest = {
      full_name: val.full_name,
      relationship: val.relationship,
      phone: val.phone || undefined,
      email: val.email || undefined,
      is_guardian: val.is_guardian,
      can_pick_up: val.can_pick_up,
    };

    this.api.addReferencePerson(child.id, payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('CHILDCARE.REF_PERSON_ADDED'));
        this.refPersonModalVisible.set(false);
        this.api.getReferencePersons(child.id).subscribe((res) => {
          this.refPersons.set(res.data || []);
        });
      },
      error: () => {
        this.message.error(this.translate.instant('CHILDCARE.ACTION_ERROR'));
      },
    });
  }

  grantPortalAccess(refPerson: ChildcareReferencePerson): void {
    this.api.grantPortalAccess(refPerson.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('CHILDCARE.PORTAL_INVITATION_SENT'));
      },
      error: () => {
        this.message.error(this.translate.instant('CHILDCARE.ACTION_ERROR'));
      },
    });
  }

  // --- ATTENDANCE METHODS ---
  loadAttendances(): void {
    this.attendancesLoading.set(true);
    this.api.getMonthlyRegister({ month: this.attendanceMonth() }).subscribe({
      next: (res) => {
        this.attendances.set(
          (res.data?.children ?? []).flatMap((row) =>
            Object.entries(row.days).map(([date, day]) => ({
              id: `${row.child_id}-${date}`,
              child_id: row.child_id,
              child_name: row.name,
              date,
              status: day.status,
              check_in_at: day.check_in_at,
              check_out_at: day.check_out_at,
              absence_reason: day.absence_reason,
            })),
          ),
        );
        this.attendancesLoading.set(false);
      },
      error: () => {
        this.attendancesLoading.set(false);
      },
    });
  }

  openCheckInModal(childId?: string): void {
    this.checkInForm.reset({
      child_id: childId || '',
      at: new Date().toISOString().substring(0, 16),
      temperature: '36.5',
    });
    this.checkInModalVisible.set(true);
  }

  saveCheckIn(): void {
    if (this.checkInForm.invalid) {
      this.checkInForm.markAllAsTouched();
      return;
    }
    const val = this.checkInForm.getRawValue();
    const payload: ChildcareCheckInRequest = {
      child_id: val.child_id,
      at: val.at || undefined,
      temperature: val.temperature || undefined,
    };

    this.api.checkIn(payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('CHILDCARE.CHECK_IN_SUCCESS'));
        this.checkInModalVisible.set(false);
        this.loadAttendances();
      },
      error: () => {
        this.message.error(this.translate.instant('CHILDCARE.ACTION_ERROR'));
      },
    });
  }

  openCheckOutModal(childId?: string): void {
    this.checkOutForm.reset({
      child_id: childId || '',
      at: new Date().toISOString().substring(0, 16),
      picked_up_by: '',
    });
    this.checkOutModalVisible.set(true);
  }

  /** Loads the persons authorised to pick up the child and clears the previous choice. */
  loadPickUpPersons(childId: string): void {
    this.checkOutForm.controls.picked_up_by.reset('');
    this.pickUpPersons.set([]);
    if (!childId) {
      return;
    }
    this.api.getReferencePersons(childId).subscribe({
      next: (res) => {
        this.pickUpPersons.set((res.data ?? []).filter((person) => person.can_pick_up));
      },
      error: () => {
        this.message.error(this.translate.instant('CHILDCARE.ACTION_ERROR'));
      },
    });
  }

  saveCheckOut(): void {
    if (this.checkOutForm.invalid) {
      this.checkOutForm.markAllAsTouched();
      return;
    }
    const val = this.checkOutForm.getRawValue();
    const payload: ChildcareCheckOutRequest = {
      child_id: val.child_id,
      at: val.at || undefined,
      picked_up_by: val.picked_up_by,
    };

    this.api.checkOut(payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('CHILDCARE.CHECK_OUT_SUCCESS'));
        this.checkOutModalVisible.set(false);
        this.loadAttendances();
      },
      error: (err: unknown) => {
        const unmapped = applyServerErrors(this.checkOutForm, err);
        if (unmapped.length > 0 || !isValidationError(err)) {
          this.message.error(this.translate.instant('CHILDCARE.ACTION_ERROR'));
        }
      },
    });
  }

  openAbsenceModal(childId?: string): void {
    this.absenceForm.reset({
      child_id: childId || '',
      date: new Date().toISOString().substring(0, 10),
      reason: 'sick',
    });
    this.absenceModalVisible.set(true);
  }

  saveAbsence(): void {
    if (this.absenceForm.invalid) {
      this.absenceForm.markAllAsTouched();
      return;
    }
    const val = this.absenceForm.getRawValue();
    this.api
      .recordAbsence({
        child_id: val.child_id,
        date: val.date,
        reason: val.reason,
      })
      .subscribe({
        next: () => {
          this.message.success(this.translate.instant('CHILDCARE.ABSENCE_RECORDED'));
          this.absenceModalVisible.set(false);
          this.loadAttendances();
        },
        error: () => {
          this.message.error(this.translate.instant('CHILDCARE.ACTION_ERROR'));
        },
      });
  }

  // --- DAILY LOG METHODS ---
  loadDailyNotes(): void {
    this.noteGrid.reload();
  }

  openCreateNoteModal(): void {
    this.noteForm.reset({
      child_id: '',
      date: new Date().toISOString().substring(0, 10),
      category: 'general',
      body: '',
      visible_to_family: true,
    });
    this.noteModalVisible.set(true);
  }

  saveNote(): void {
    if (this.noteForm.invalid) {
      this.noteForm.markAllAsTouched();
      return;
    }
    const val = this.noteForm.getRawValue();
    const payload: ChildcareNoteRequest = {
      child_id: val.child_id,
      date: val.date,
      category: val.category,
      body: val.body,
      visible_to_family: val.visible_to_family,
    };

    this.api.createNote(payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('CHILDCARE.NOTE_SAVED'));
        this.noteModalVisible.set(false);
        this.loadDailyNotes();
      },
      error: () => {
        this.message.error(this.translate.instant('CHILDCARE.ACTION_ERROR'));
      },
    });
  }

  // --- BILLING METHODS ---
  loadFeePlans(): void {
    this.api.getFeePlans().subscribe({
      next: (res) => {
        this.feePlans.set(res.data || []);
      },
    });
  }

  loadBills(): void {
    this.billGrid.setFilter({ period: this.billingPeriod() });
    this.billGrid.reload();
    this.loadBillTotals();
  }

  /** Totals of the whole period (the grid only holds one page of bills). */
  private loadBillTotals(): void {
    this.api.getBills({ period: this.billingPeriod(), per_page: 200 }).subscribe({
      next: (res) => this.bills.set(res.data || []),
    });
  }

  openCreateFeePlanModal(): void {
    this.feePlanForm.reset({
      name: '',
      basis: 'monthly_flat',
      amount: '850.00',
      meal_amount: '120.00',
      tax_rate: '0.00',
      currency: 'EUR',
    });
    this.feePlanModalVisible.set(true);
  }

  saveFeePlan(): void {
    if (this.feePlanForm.invalid) {
      this.feePlanForm.markAllAsTouched();
      return;
    }
    const val = this.feePlanForm.getRawValue();
    const payload: ChildcareFeePlanRequest = {
      name: val.name,
      basis: val.basis,
      amount: val.amount,
      meal_amount: val.meal_amount || undefined,
      tax_rate: val.tax_rate,
      currency: val.currency,
    };

    this.api.createFeePlan(payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('CHILDCARE.FEE_PLAN_CREATED'));
        this.feePlanModalVisible.set(false);
        this.loadFeePlans();
      },
      error: () => {
        this.message.error(this.translate.instant('CHILDCARE.ACTION_ERROR'));
      },
    });
  }

  openBillingRunModal(): void {
    this.billingRunForm.reset({
      period: this.billingPeriod(),
      date: new Date().toISOString().substring(0, 10),
    });
    this.billingRunModalVisible.set(true);
  }

  executeBillingRun(): void {
    if (this.billingRunForm.invalid) {
      this.billingRunForm.markAllAsTouched();
      return;
    }
    const val = this.billingRunForm.getRawValue();
    const payload: ChildcareBillingRunRequest = {
      period: val.period,
      date: val.date,
    };

    this.api.runBilling(payload).subscribe({
      next: (res) => {
        this.message.success(
          `${this.translate.instant('CHILDCARE.BILLING_RUN_COMPLETED')}: ${res.data.total_billed}`,
        );
        this.billingRunModalVisible.set(false);
        this.loadBills();
      },
      error: () => {
        this.message.error(this.translate.instant('CHILDCARE.ACTION_ERROR'));
      },
    });
  }

  // --- REQUIREMENTS & DOCUMENTS ---
  loadRequirements(): void {
    this.requirementsLoading.set(true);
    this.api.getDocumentRequirements().subscribe({
      next: (res) => {
        this.requirements.set(res.data || []);
        this.requirementsLoading.set(false);
      },
      error: () => {
        this.requirementsLoading.set(false);
      },
    });

    this.api.getOutstandingDocuments().subscribe({
      next: (res) => {
        this.outstandingDocuments.set(
          (res.data?.children ?? []).flatMap((row) =>
            row.missing.map((requirement) => ({
              id: `${row.child_id}-${requirement.requirement_id}`,
              child_id: row.child_id,
              child_name: row.name,
              title: requirement.name,
              requirement_id: requirement.requirement_id,
              status: 'missing' as const,
            })),
          ),
        );
      },
    });
  }

  openCreateRequirementModal(): void {
    this.requirementForm.reset({
      name: '',
      requires_signature: true,
      is_mandatory: true,
    });
    this.requirementModalVisible.set(true);
  }

  saveRequirement(): void {
    if (this.requirementForm.invalid) {
      this.requirementForm.markAllAsTouched();
      return;
    }
    const val = this.requirementForm.getRawValue();
    const payload: ChildcareRequirementRequest = {
      name: val.name,
      requires_signature: val.requires_signature,
      is_mandatory: val.is_mandatory,
    };

    this.api.createDocumentRequirement(payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('CHILDCARE.REQUIREMENT_CREATED'));
        this.requirementModalVisible.set(false);
        this.loadRequirements();
      },
      error: () => {
        this.message.error(this.translate.instant('CHILDCARE.ACTION_ERROR'));
      },
    });
  }

  // Status colors
  getChildStatusColor(status: ChildcareChildStatus | string): string {
    switch (status) {
      case 'active':
        return 'success';
      case 'waiting':
        return 'warning';
      case 'left':
        return 'default';
      default:
        return 'default';
    }
  }

  getAttendanceColor(status: string): string {
    switch (status) {
      case 'present':
        return 'success';
      case 'absent':
        return 'error';
      case 'late':
        return 'warning';
      case 'excused':
        return 'purple';
      default:
        return 'default';
    }
  }

  getCategoryColor(cat: string): string {
    switch (cat) {
      case 'sleep':
        return 'cyan';
      case 'general':
        return 'default';
      case 'meal':
        return 'orange';
      case 'health':
        return 'blue';
      case 'activity':
        return 'green';
      case 'behaviour':
        return 'purple';
      default:
        return 'default';
    }
  }
}
