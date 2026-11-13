import { DatePipe, UpperCasePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormGroup,
  FormsModule,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpaceModule } from 'ng-zorro-antd/space';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AuthStore,
  I18nService,
  serverErrorMessage,
  TranslateService,
  VisitorsApiService,
  VisitorsCheckInRequest,
  VisitorsKiosk,
  VisitorsKioskCheckInRequest,
  VisitorsKioskCheckOutRequest,
  VisitorsKioskRequest,
  VisitorsKioskVisit,
  VisitorsVisit,
  VisitorsVisitRequest,
  VisitorsVisitor,
  VisitorsVisitorRequest,
} from '@core';
import { IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { endsNotBefore, revalidateOnStartChange } from '@shared/utils/date-validators';
import { uuidFormat } from '@shared/utils/uuid-validator';
import { validationTipKey } from '@shared/utils/validation-tip';

const BADGE_PATTERN = /^[A-Za-z0-9._-]+$/;

/** Start of the next hour as ISO 8601 (UTC), the default arrival of an announced visit. */
function nextHourIso(): string {
  const next = new Date();
  next.setHours(next.getHours() + 1, 0, 0, 0);
  return next.toISOString();
}

/** API rule `date` on a free text date-time input. */
function dateTimeValidator(control: AbstractControl<string>): ValidationErrors | null {
  return !control.value || !Number.isNaN(Date.parse(control.value)) ? null : { date: true };
}

@Component({
  selector: 'app-visitors',
  styleUrl: './visitors.component.scss',
  imports: [
    IconActionDirective,
    ModalActionsDirective,
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
    NzSelectModule,
    NzFormModule,
    NzModalModule,
    NzDescriptionsModule,
    NzSpaceModule,
    NzStatisticModule,
    NzPopconfirmModule,
    NzRadioModule,
    NzSwitchModule,
    NzAlertModule,
    NzIconModule,
    NzEmptyModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './visitors.component.html',
})
export class VisitorsComponent implements OnInit {
  private readonly api = inject(VisitorsApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly i18n = inject(I18nService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly authStore = inject(AuthStore);

  readonly selectedTabIndex = signal<number>(0);

  // --- TAB 0: ON-SITE VISITORS (EVACUATION LIST) ---
  readonly onSiteVisits = signal<VisitorsVisit[]>([]);
  readonly onSiteLoading = signal<boolean>(false);

  // --- TAB 1: VISITS LOG & PRE-REGISTRATIONS ---
  readonly visits = signal<VisitorsVisit[]>([]);
  readonly visitsLoading = signal<boolean>(false);
  readonly filterVisitStatus = signal<string>('');
  readonly selectedVisit = signal<VisitorsVisit | null>(null);
  readonly drawerVisible = signal<boolean>(false);
  readonly announceModalVisible = signal<boolean>(false);
  readonly checkInModalVisible = signal<boolean>(false);

  // --- TAB 2: VISITORS REGISTRY ---
  readonly visitors = signal<VisitorsVisitor[]>([]);
  readonly visitorsLoading = signal<boolean>(false);
  readonly searchVisitorQuery = signal<string>('');
  readonly selectedVisitor = signal<VisitorsVisitor | null>(null);
  readonly visitorModalVisible = signal<boolean>(false);

  // --- TAB 3: KIOSKS & RECEPTION TERMINALS ---
  readonly kiosks = signal<VisitorsKiosk[]>([]);
  readonly kiosksLoading = signal<boolean>(false);
  readonly kioskModalVisible = signal<boolean>(false);
  readonly newKioskSecret = signal<string | null>(null);

  // --- TAB 4: SELF-SERVICE KIOSK SIMULATOR ---
  readonly kioskExpected = signal<VisitorsKioskVisit[]>([]);
  readonly kioskExpectedLoading = signal<boolean>(false);

  // Derived metrics
  readonly totalOnSite = computed(() => this.onSiteVisits().length);
  readonly totalExpectedToday = computed(
    () => this.visits().filter((v) => v.status === 'expected').length,
  );
  readonly totalCompletedToday = computed(
    () => this.visits().filter((v) => v.status === 'checked_out').length,
  );
  readonly activeKiosksCount = computed(
    () => this.kiosks().filter((k) => k.is_active).length,
  );

  // Forms
  readonly announceVisitForm = this.fb.group({
    mode: ['new' as 'new' | 'existing'],
    visitor_id: ['', [uuidFormat]],
    first_name: ['', [Validators.required, Validators.maxLength(100)]],
    last_name: ['', [Validators.required, Validators.maxLength(100)]],
    company_name: ['', [Validators.maxLength(150)]],
    email: ['', [Validators.email, Validators.maxLength(255)]],
    phone: ['', [Validators.maxLength(40)]],
    document_number: ['', [Validators.maxLength(50)]],
    host_user_id: ['', [Validators.required, uuidFormat]],
    expected_at: ['', [Validators.required, dateTimeValidator]],
    // API: expected_until must be after expected_at
    expected_until: ['', [dateTimeValidator, endsNotBefore('expected_at', { strict: true })]],
    purpose: ['', [Validators.maxLength(500)]],
  });

  readonly checkInForm = this.fb.group({
    badge_number: ['', [Validators.required, Validators.maxLength(30), Validators.pattern(BADGE_PATTERN)]],
  });

  readonly visitorForm = this.fb.group({
    first_name: ['', [Validators.required, Validators.maxLength(100)]],
    last_name: ['', [Validators.required, Validators.maxLength(100)]],
    company_name: ['', [Validators.maxLength(150)]],
    email: ['', [Validators.email, Validators.maxLength(255)]],
    phone: ['', [Validators.maxLength(40)]],
    document_number: ['', [Validators.maxLength(50)]],
  });

  readonly kioskForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
  });

  readonly selfServiceCheckInForm = this.fb.group({
    visit_id: ['', [Validators.required, uuidFormat]],
    badge_number: ['B-001', [Validators.required, Validators.maxLength(30), Validators.pattern(BADGE_PATTERN)]],
  });

  readonly selfServiceCheckOutForm = this.fb.group({
    badge_number: ['', [Validators.required, Validators.maxLength(30), Validators.pattern(BADGE_PATTERN)]],
  });

  constructor() {
    revalidateOnStartChange(this.announceVisitForm, 'expected_at', 'expected_until', inject(DestroyRef));
    this.announceVisitForm.controls.mode.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.syncAnnounceRequirements());
    this.syncAnnounceRequirements();
  }

  /** API rules `required_without` / `required_with`: the visitor is either picked or described. */
  isNewVisitor(): boolean {
    return this.announceVisitForm.controls.mode.value === 'new';
  }

  private syncAnnounceRequirements(): void {
    const { visitor_id, first_name, last_name } = this.announceVisitForm.controls;
    for (const [control, required] of [
      [visitor_id, !this.isNewVisitor()],
      [first_name, this.isNewVisitor()],
      [last_name, this.isNewVisitor()],
    ] as const) {
      if (required) {
        control.addValidators(Validators.required);
      } else {
        control.removeValidators(Validators.required);
      }
      control.updateValueAndValidity({ emitEvent: false });
    }
  }

  errorTip(form: FormGroup, path: string): string {
    const control = form.get(path);
    if (control?.hasError('serverError')) {
      return serverErrorMessage(form, path) ?? '';
    }
    const key = validationTipKey(control ?? null);
    return key ? this.i18n.translate(key) : '';
  }

  ngOnInit(): void {
    this.loadOnSite();
    this.loadVisits();
    this.loadVisitors();
    this.loadKiosks();
    this.loadKioskExpected();
  }

  // --- TAB 0: ON-SITE ---
  loadOnSite(): void {
    this.onSiteLoading.set(true);
    this.api.getOnSiteVisitors().subscribe({
      next: (res) => {
        this.onSiteVisits.set(res?.data || []);
        this.onSiteLoading.set(false);
      },
      error: () => {
        this.onSiteLoading.set(false);
      },
    });
  }

  printEvacuationList(): void {
    this.message.info(this.translate.instant('VISITORS.EVACUATION_LIST_PRINTED'));
  }

  // --- TAB 1: VISITS ---
  loadVisits(): void {
    this.visitsLoading.set(true);
    this.api
      .getVisits({
        status: this.filterVisitStatus() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.visits.set(res?.data || []);
          this.visitsLoading.set(false);
        },
        error: () => {
          this.visitsLoading.set(false);
        },
      });
  }

  openAnnounceModal(): void {
    this.announceVisitForm.reset({
      mode: 'new',
      visitor_id: '',
      first_name: '',
      last_name: '',
      company_name: '',
      email: '',
      phone: '',
      document_number: '',
      host_user_id: this.authStore.user()?.id ?? '',
      expected_at: nextHourIso(),
      expected_until: '',
      purpose: '',
    });
    this.announceModalVisible.set(true);
  }

  saveAnnouncedVisit(): void {
    const val = this.announceVisitForm.getRawValue();
    if (this.announceVisitForm.invalid) {
      this.announceVisitForm.markAllAsTouched();
      return;
    }

    const payload: VisitorsVisitRequest = {
      host_user_id: val.host_user_id,
      expected_at: val.expected_at,
      expected_until: val.expected_until || undefined,
      purpose: val.purpose || undefined,
    };

    if (val.mode === 'existing' && val.visitor_id) {
      payload.visitor_id = val.visitor_id;
    } else {
      payload.visitor = {
        first_name: val.first_name,
        last_name: val.last_name,
        company_name: val.company_name || undefined,
        email: val.email || undefined,
        phone: val.phone || undefined,
        document_number: val.document_number || undefined,
      };
    }

    this.api.announceVisit(payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('VISITORS.VISIT_ANNOUNCED'));
        this.announceModalVisible.set(false);
        this.loadVisits();
        this.loadVisitors();
      },
      error: () => {
        this.message.error(this.translate.instant('VISITORS.ACTION_ERROR'));
      },
    });
  }

  openCheckInModal(v: VisitorsVisit): void {
    this.selectedVisit.set(v);
    this.checkInForm.reset({
      badge_number: 'B-' + Math.floor(100 + Math.random() * 900),
    });
    this.checkInModalVisible.set(true);
  }

  confirmCheckIn(): void {
    const v = this.selectedVisit();
    if (!v || this.checkInForm.invalid) {
      this.checkInForm.markAllAsTouched();
      return;
    }
    const val = this.checkInForm.getRawValue();
    const payload: VisitorsCheckInRequest = { badge_number: val.badge_number };

    this.api.checkInVisit(v.id, payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('VISITORS.CHECKIN_SUCCESS'));
        this.checkInModalVisible.set(false);
        this.loadVisits();
        this.loadOnSite();
      },
      error: () => {
        this.message.error(this.translate.instant('VISITORS.ACTION_ERROR'));
      },
    });
  }

  executeCheckOut(visitId: string): void {
    this.api.checkOutVisit(visitId).subscribe({
      next: () => {
        this.message.success(this.translate.instant('VISITORS.CHECKOUT_SUCCESS'));
        this.loadVisits();
        this.loadOnSite();
      },
      error: () => {
        this.message.error(this.translate.instant('VISITORS.ACTION_ERROR'));
      },
    });
  }

  executeCancelVisit(visitId: string): void {
    this.api.cancelVisit(visitId).subscribe({
      next: () => {
        this.message.success(this.translate.instant('VISITORS.VISIT_CANCELLED'));
        this.loadVisits();
      },
      error: () => {
        this.message.error(this.translate.instant('VISITORS.ACTION_ERROR'));
      },
    });
  }

  openVisitDrawer(v: VisitorsVisit): void {
    this.selectedVisit.set(v);
    this.drawerVisible.set(true);
  }

  closeVisitDrawer(): void {
    this.drawerVisible.set(false);
    this.selectedVisit.set(null);
  }

  // --- TAB 2: VISITORS REGISTRY ---
  loadVisitors(): void {
    this.visitorsLoading.set(true);
    this.api
      .getVisitors({
        search: this.searchVisitorQuery() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.visitors.set(res?.data || []);
          this.visitorsLoading.set(false);
        },
        error: () => {
          this.visitorsLoading.set(false);
        },
      });
  }

  openCreateVisitorModal(): void {
    this.selectedVisitor.set(null);
    this.visitorForm.reset({
      first_name: '',
      last_name: '',
      company_name: '',
      email: '',
      phone: '',
      document_number: '',
    });
    this.visitorModalVisible.set(true);
  }

  openEditVisitorModal(v: VisitorsVisitor): void {
    this.selectedVisitor.set(v);
    this.visitorForm.reset({
      first_name: v.first_name,
      last_name: v.last_name,
      company_name: v.company_name || '',
      email: v.email || '',
      phone: v.phone || '',
      document_number: '',
    });
    this.visitorModalVisible.set(true);
  }

  saveVisitor(): void {
    if (this.visitorForm.invalid) {
      this.visitorForm.markAllAsTouched();
      return;
    }
    const val = this.visitorForm.getRawValue();
    const payload: VisitorsVisitorRequest = {
      first_name: val.first_name,
      last_name: val.last_name,
      company_name: val.company_name || undefined,
      email: val.email || undefined,
      phone: val.phone || undefined,
      document_number: val.document_number || undefined,
    };

    const existing = this.selectedVisitor();
    const req = existing
      ? this.api.updateVisitor(existing.id, payload)
      : this.api.createVisitor(payload);

    req.subscribe({
      next: () => {
        this.message.success(this.translate.instant('VISITORS.VISITOR_SAVED'));
        this.visitorModalVisible.set(false);
        this.loadVisitors();
      },
      error: () => {
        this.message.error(this.translate.instant('VISITORS.ACTION_ERROR'));
      },
    });
  }

  eraseVisitor(id: string): void {
    this.api.eraseVisitor(id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('VISITORS.VISITOR_ERASED'));
        this.loadVisitors();
      },
      error: () => {
        this.message.error(this.translate.instant('VISITORS.ACTION_ERROR'));
      },
    });
  }

  // --- TAB 3: KIOSKS ---
  loadKiosks(): void {
    this.kiosksLoading.set(true);
    this.api.getKiosks().subscribe({
      next: (res) => {
        this.kiosks.set(res?.data || []);
        this.kiosksLoading.set(false);
      },
      error: () => {
        this.kiosksLoading.set(false);
      },
    });
  }

  openRegisterKioskModal(): void {
    this.newKioskSecret.set(null);
    this.kioskForm.reset({ name: '' });
    this.kioskModalVisible.set(true);
  }

  registerKiosk(): void {
    if (this.kioskForm.invalid) {
      this.kioskForm.markAllAsTouched();
      return;
    }
    const val = this.kioskForm.getRawValue();
    const payload: VisitorsKioskRequest = { name: val.name };

    this.api.registerKiosk(payload).subscribe({
      next: (res) => {
        this.message.success(this.translate.instant('VISITORS.KIOSK_REGISTERED'));
        if (res.data?.secret) {
          this.newKioskSecret.set(res.data.secret);
        } else {
          this.kioskModalVisible.set(false);
        }
        this.loadKiosks();
      },
      error: () => {
        this.message.error(this.translate.instant('VISITORS.ACTION_ERROR'));
      },
    });
  }

  rotateKioskSecret(id: string): void {
    this.api.rotateKioskSecret(id).subscribe({
      next: (res) => {
        this.message.success(this.translate.instant('VISITORS.SECRET_ROTATED'));
        if (res.data?.secret) {
          this.newKioskSecret.set(res.data.secret);
          this.kioskModalVisible.set(true);
        }
        this.loadKiosks();
      },
      error: () => {
        this.message.error(this.translate.instant('VISITORS.ACTION_ERROR'));
      },
    });
  }

  retireKiosk(id: string): void {
    this.api.retireKiosk(id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('VISITORS.KIOSK_RETIRED'));
        this.loadKiosks();
      },
      error: () => {
        this.message.error(this.translate.instant('VISITORS.ACTION_ERROR'));
      },
    });
  }

  // --- TAB 4: KIOSK SELF-SERVICE SIMULATOR ---
  loadKioskExpected(): void {
    this.kioskExpectedLoading.set(true);
    this.api.getKioskExpected().subscribe({
      next: (res) => {
        this.kioskExpected.set(res?.data || []);
        this.kioskExpectedLoading.set(false);
      },
      error: () => {
        this.kioskExpectedLoading.set(false);
      },
    });
  }

  executeSelfServiceCheckIn(): void {
    if (this.selfServiceCheckInForm.invalid) {
      this.selfServiceCheckInForm.markAllAsTouched();
      return;
    }
    const val = this.selfServiceCheckInForm.getRawValue();
    const payload: VisitorsKioskCheckInRequest = {
      visit_id: val.visit_id,
      badge_number: val.badge_number,
    };

    this.api.kioskCheckIn(payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('VISITORS.KIOSK_CHECKIN_SUCCESS'));
        this.selfServiceCheckInForm.reset({ visit_id: '', badge_number: 'B-001' });
        this.loadKioskExpected();
        this.loadOnSite();
        this.loadVisits();
      },
      error: () => {
        this.message.error(this.translate.instant('VISITORS.ACTION_ERROR'));
      },
    });
  }

  executeSelfServiceCheckOut(): void {
    if (this.selfServiceCheckOutForm.invalid) {
      this.selfServiceCheckOutForm.markAllAsTouched();
      return;
    }
    const val = this.selfServiceCheckOutForm.getRawValue();
    const payload: VisitorsKioskCheckOutRequest = { badge_number: val.badge_number };

    this.api.kioskCheckOut(payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('VISITORS.KIOSK_CHECKOUT_SUCCESS'));
        this.selfServiceCheckOutForm.reset({ badge_number: '' });
        this.loadKioskExpected();
        this.loadOnSite();
        this.loadVisits();
      },
      error: () => {
        this.message.error(this.translate.instant('VISITORS.ACTION_ERROR'));
      },
    });
  }

  getStatusBadgeColor(status: string): string {
    switch (status) {
      case 'expected':
        return 'blue';
      case 'checked_in':
        return 'success';
      case 'checked_out':
        return 'default';
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  }
}
