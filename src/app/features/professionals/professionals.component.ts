import { DatePipe, UpperCasePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { endsNotBefore, revalidateOnStartChange } from '@shared/utils/date-validators';
import { decimalPattern, positiveNumber } from '@shared/utils/decimal-validators';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpaceModule } from 'ng-zorro-antd/space';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  CreateTimeLogPayload,
  FeeNote,
  LegalCase,
  PracticeActivityItem,
  PracticeApiService,
  PracticeAppliedRetainer,
  PracticeClosing,
  PracticeClosingChecklistItem,
  PracticeClosingOverview,
  PracticeClosingRequest,
  PracticeFeeNoteRequest,
  PracticeRetainer,
  PracticeRetainerApplyRequest,
  PracticeRetainerBalance,
  PracticeRetainerRequest,
  ProfessionalsApiService,
  TranslateService,
} from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe, IconActionDirective, ModalActionsDirective, GridExportDirective, GridSortPipe, GridFilterListPipe, GridFilterFnPipe } from '@shared';

@Component({
  selector: 'app-professionals',
  styleUrl: './professionals.component.scss',
  imports: [
    GridExportDirective,
    GridSortPipe, GridFilterListPipe, GridFilterFnPipe,
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
    NzInputNumberModule,
    NzSelectModule,
    NzFormModule,
    NzModalModule,
    NzDescriptionsModule,
    NzSpaceModule,
    NzStatisticModule,
    NzPopconfirmModule,
    NzCheckboxModule,
    NzProgressModule,
    NzIconModule,
    NzEmptyModule,
    PageHeaderComponent,
    TranslatePipe,
    MoneyPipe,
  ],
  templateUrl: './professionals.component.html',
})
export class ProfessionalsComponent implements OnInit {
  private readonly profApi = inject(ProfessionalsApiService);
  private readonly practiceApi = inject(PracticeApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly selectedTabIndex = signal<number>(0);

  // --- TAB 0: CASES ---
  readonly cases = signal<LegalCase[]>([]);
  readonly casesLoading = signal<boolean>(false);

  // --- TAB 1: ACTIVITY CONTROL ---
  readonly activities = signal<PracticeActivityItem[]>([]);
  readonly activitiesLoading = signal<boolean>(false);
  readonly selectedActivityIds = signal<string[]>([]);
  readonly filterActivityStatus = signal<string>('unbilled');
  readonly fromDate = signal<string>(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().substring(0, 10));
  readonly toDate = signal<string>(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().substring(0, 10));

  // --- TAB 2: FEE NOTES ---
  readonly feeNotes = signal<FeeNote[]>([]);
  readonly feeNotesLoading = signal<boolean>(false);
  readonly selectedFeeNote = signal<FeeNote | null>(null);
  readonly feeNoteDrawerVisible = signal<boolean>(false);
  readonly feeNoteActivities = signal<PracticeActivityItem[]>([]);
  readonly feeNoteRetainers = signal<PracticeAppliedRetainer[]>([]);
  readonly feeNoteDrawerLoading = signal<boolean>(false);

  // --- TAB 3: RETAINERS (FONDI SPESE) ---
  readonly retainers = signal<PracticeRetainer[]>([]);
  readonly retainerBalances = signal<PracticeRetainerBalance[]>([]);
  readonly retainersLoading = signal<boolean>(false);
  readonly filterRetainerStatus = signal<string>('');

  // --- TAB 4: CLOSINGS & CHECKLISTS ---
  readonly closingsOverview = signal<PracticeClosingOverview | null>(null);
  readonly closings = signal<PracticeClosing[]>([]);
  readonly closingsLoading = signal<boolean>(false);
  readonly activeChecklistClosing = signal<PracticeClosing | null>(null);
  readonly checklistModalVisible = signal<boolean>(false);

  // Derived metrics for summary cards
  readonly totalUnbilledHours = computed(() =>
    this.activities()
      .filter((a) => a.status === 'unbilled')
      .reduce((acc, a) => acc + (a.hours || 0), 0),
  );

  readonly totalUnbilledAmount = computed(() =>
    this.activities()
      .filter((a) => a.status === 'unbilled')
      .reduce((acc, a) => acc + (parseFloat(a.amount) || 0), 0),
  );

  readonly totalRetainerAvailable = computed(() =>
    this.retainerBalances().reduce((acc, b) => acc + (parseFloat(b.current_balance) || 0), 0),
  );

  // Modals visibility
  readonly feeNoteModalVisible = signal<boolean>(false);
  readonly timeLogModalVisible = signal<boolean>(false);
  readonly retainerModalVisible = signal<boolean>(false);
  readonly applyRetainerModalVisible = signal<boolean>(false);
  readonly closingModalVisible = signal<boolean>(false);

  // Forms
  readonly feeNoteForm = this.fb.group({
    client_id: ['', [Validators.required]],
    date: [new Date().toISOString().substring(0, 10), [Validators.required]],
    cpa_rate: ['4.00', [Validators.required, decimalPattern(2), Validators.max(100)]],
    ritenuta_rate: ['20.00', [Validators.required, decimalPattern(2), Validators.max(100)]],
    vat_rate: ['22.00', [Validators.required, decimalPattern(2), Validators.max(100)]],
    note_number: ['', [Validators.maxLength(50)]],
  });

  readonly timeLogForm = this.fb.group({
    legal_case_id: ['', [Validators.required]],
    date: [new Date().toISOString().substring(0, 10), [Validators.required]],
    duration_minutes: [60, [Validators.required, Validators.min(1)]],
    hourly_rate: [120, [Validators.required, Validators.min(0)]],
    description: ['', [Validators.required]],
  });

  readonly retainerForm = this.fb.group({
    client_id: ['', [Validators.required]],
    legal_case_id: [''],
    received_on: [new Date().toISOString().substring(0, 10), [Validators.required]],
    amount: ['1000.00', [Validators.required, decimalPattern(2), positiveNumber]],
    reference: ['', [Validators.maxLength(100)]],
    notes: ['', [Validators.maxLength(500)]],
  });

  readonly applyRetainerForm = this.fb.group({
    retainer_id: ['', [Validators.required]],
    fee_note_id: ['', [Validators.required]],
    amount: ['500.00', [Validators.required, decimalPattern(2), positiveNumber]],
  });

  readonly closingForm = this.fb.group({
    client_id: ['', [Validators.required]],
    period_start: [new Date(new Date().getFullYear(), 0, 1).toISOString().substring(0, 10), [Validators.required]],
    period_end: [new Date(new Date().getFullYear(), 11, 31).toISOString().substring(0, 10), [Validators.required, endsNotBefore('period_start')]],
    notes: ['', [Validators.maxLength(5000)]],
  });

  private readonly closingPeriodSync = revalidateOnStartChange(this.closingForm, 'period_start', 'period_end', inject(DestroyRef));

  ngOnInit(): void {
    this.loadCases();
    this.loadActivities();
    this.loadFeeNotes();
    this.loadRetainers();
    this.loadClosings();
  }

  // --- TAB 0: CASES ---
  loadCases(): void {
    this.casesLoading.set(true);
    this.profApi.getCases().subscribe({
      next: (res) => {
        this.cases.set(res?.data || []);
        this.casesLoading.set(false);
      },
      error: () => {
        this.casesLoading.set(false);
      },
    });
  }

  // --- TAB 1: ACTIVITY CONTROL ---
  loadActivities(): void {
    this.activitiesLoading.set(true);
    this.practiceApi
      .getActivityControl({
        from: this.fromDate(),
        to: this.toDate(),
      })
      .subscribe({
        next: (res) => {
          let list = res?.data?.activities || [];
          const status = this.filterActivityStatus();
          if (status) {
            list = list.filter((a) => a.status === status);
          }
          this.activities.set(list);
          this.selectedActivityIds.set([]);
          this.activitiesLoading.set(false);
        },
        error: () => {
          this.activitiesLoading.set(false);
        },
      });
  }

  toggleActivitySelection(activityId: string, checked: boolean): void {
    this.selectedActivityIds.update((current) =>
      checked ? [...current, activityId] : current.filter((id) => id !== activityId),
    );
  }

  openLogTimeModal(): void {
    this.timeLogForm.reset({
      legal_case_id: this.cases()[0]?.id || '',
      date: new Date().toISOString().substring(0, 10),
      duration_minutes: 60,
      hourly_rate: 120,
      description: '',
    });
    this.timeLogModalVisible.set(true);
  }

  saveTimeLog(): void {
    if (this.timeLogForm.invalid) {
      this.timeLogForm.markAllAsTouched();
      return;
    }
    const val = this.timeLogForm.getRawValue();
    const payload: CreateTimeLogPayload = {
      legal_case_id: val.legal_case_id,
      date: val.date,
      duration_minutes: Number(val.duration_minutes),
      hourly_rate: Number(val.hourly_rate),
      description: val.description,
    };

    this.profApi.logTime(payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('PRACTICE.TIME_LOG_SAVED'));
        this.timeLogModalVisible.set(false);
        this.loadActivities();
      },
      error: () => {
        this.message.error(this.translate.instant('PRACTICE.ACTION_ERROR'));
      },
    });
  }

  openCreateFeeNoteModal(): void {
    const selectedIds = this.selectedActivityIds();
    const selectedActs = this.activities().filter((a) => selectedIds.includes(a.id));
    const firstClientId = selectedActs[0]?.client_id || '';

    this.feeNoteForm.reset({
      client_id: firstClientId,
      date: new Date().toISOString().substring(0, 10),
      cpa_rate: '4.00',
      ritenuta_rate: '20.00',
      vat_rate: '22.00',
      note_number: '',
    });
    this.feeNoteModalVisible.set(true);
  }

  saveFeeNote(): void {
    if (this.feeNoteForm.invalid) {
      this.feeNoteForm.markAllAsTouched();
      return;
    }
    const val = this.feeNoteForm.getRawValue();
    const payload: PracticeFeeNoteRequest = {
      client_id: val.client_id,
      activity_ids: this.selectedActivityIds(),
      date: val.date,
      cpa_rate: val.cpa_rate,
      ritenuta_rate: val.ritenuta_rate,
      vat_rate: val.vat_rate,
      note_number: val.note_number || undefined,
    };

    this.practiceApi.createFeeNoteFromActivities(payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('PRACTICE.FEE_NOTE_CREATED'));
        this.feeNoteModalVisible.set(false);
        this.loadActivities();
        this.loadFeeNotes();
        this.selectedTabIndex.set(2);
      },
      error: () => {
        this.message.error(this.translate.instant('PRACTICE.ACTION_ERROR'));
      },
    });
  }

  // --- TAB 2: FEE NOTES ---
  loadFeeNotes(): void {
    this.feeNotesLoading.set(true);
    this.profApi.getFeeNotes().subscribe({
      next: (res) => {
        this.feeNotes.set(res?.data || []);
        this.feeNotesLoading.set(false);
      },
      error: () => {
        this.feeNotesLoading.set(false);
      },
    });
  }

  openFeeNoteDrawer(fn: FeeNote): void {
    this.selectedFeeNote.set(fn);
    this.feeNoteDrawerVisible.set(true);
    this.loadFeeNoteDetails(fn.id);
  }

  closeFeeNoteDrawer(): void {
    this.feeNoteDrawerVisible.set(false);
    this.selectedFeeNote.set(null);
    this.feeNoteActivities.set([]);
    this.feeNoteRetainers.set([]);
  }

  loadFeeNoteDetails(feeNoteId: string): void {
    this.feeNoteDrawerLoading.set(true);
    this.practiceApi.getFeeNoteActivities(feeNoteId).subscribe({
      next: (res) => {
        this.feeNoteActivities.set(res?.data || []);
      },
    });
    this.practiceApi.getFeeNoteRetainers(feeNoteId).subscribe({
      next: (res) => {
        this.feeNoteRetainers.set(res?.data || []);
        this.feeNoteDrawerLoading.set(false);
      },
      error: () => {
        this.feeNoteDrawerLoading.set(false);
      },
    });
  }

  openApplyRetainerModal(fn?: FeeNote): void {
    const feeNote = fn || this.selectedFeeNote();
    const availableRetainers = this.retainers().filter(
      (r) => r.status === 'available' || r.status === 'partially_applied',
    );

    this.applyRetainerForm.reset({
      fee_note_id: feeNote?.id || this.feeNotes()[0]?.id || '',
      retainer_id: availableRetainers[0]?.id || '',
      amount: '500.00',
    });
    this.applyRetainerModalVisible.set(true);
  }

  saveApplyRetainer(): void {
    if (this.applyRetainerForm.invalid) {
      this.applyRetainerForm.markAllAsTouched();
      return;
    }
    const val = this.applyRetainerForm.getRawValue();
    const payload: PracticeRetainerApplyRequest = {
      fee_note_id: val.fee_note_id,
      amount: val.amount,
    };

    this.practiceApi.applyRetainer(val.retainer_id, payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('PRACTICE.RETAINER_APPLIED'));
        this.applyRetainerModalVisible.set(false);
        this.loadRetainers();
        if (this.selectedFeeNote()) {
          this.loadFeeNoteDetails(this.selectedFeeNote()!.id);
        }
      },
      error: () => {
        this.message.error(this.translate.instant('PRACTICE.ACTION_ERROR'));
      },
    });
  }

  // --- TAB 3: RETAINERS (FONDI SPESE) ---
  loadRetainers(): void {
    this.retainersLoading.set(true);
    this.practiceApi
      .getRetainers({
        status: this.filterRetainerStatus() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.retainers.set(res?.data || []);
          this.retainersLoading.set(false);
        },
        error: () => {
          this.retainersLoading.set(false);
        },
      });

    this.practiceApi.getRetainerBalances().subscribe({
      next: (res) => {
        this.retainerBalances.set(res?.data || []);
      },
    });
  }

  openCreateRetainerModal(): void {
    this.retainerForm.reset({
      client_id: '',
      legal_case_id: '',
      received_on: new Date().toISOString().substring(0, 10),
      amount: '1000.00',
      reference: '',
      notes: '',
    });
    this.retainerModalVisible.set(true);
  }

  saveRetainer(): void {
    if (this.retainerForm.invalid) {
      this.retainerForm.markAllAsTouched();
      return;
    }
    const val = this.retainerForm.getRawValue();
    const payload: PracticeRetainerRequest = {
      client_id: val.client_id,
      legal_case_id: val.legal_case_id || undefined,
      received_on: val.received_on,
      amount: val.amount,
      reference: val.reference || undefined,
      notes: val.notes || undefined,
    };

    this.practiceApi.createRetainer(payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('PRACTICE.RETAINER_CREATED'));
        this.retainerModalVisible.set(false);
        this.loadRetainers();
      },
      error: () => {
        this.message.error(this.translate.instant('PRACTICE.ACTION_ERROR'));
      },
    });
  }

  voidRetainer(retainerId: string): void {
    this.practiceApi.voidRetainer(retainerId).subscribe({
      next: () => {
        this.message.success(this.translate.instant('PRACTICE.RETAINER_VOIDED'));
        this.loadRetainers();
      },
      error: () => {
        this.message.error(this.translate.instant('PRACTICE.ACTION_ERROR'));
      },
    });
  }

  // --- TAB 4: CLOSINGS & CHECKLISTS ---
  loadClosings(): void {
    this.closingsLoading.set(true);
    this.practiceApi
      .getClosingOverview({
        from: this.fromDate(),
        to: this.toDate(),
      })
      .subscribe({
        next: (res) => {
          this.closingsOverview.set(res?.data || null);
          this.closings.set(res?.data?.closings || []);
          this.closingsLoading.set(false);
        },
        error: () => {
          this.closingsLoading.set(false);
        },
      });
  }

  openCreateClosingModal(): void {
    this.closingForm.reset({
      client_id: '',
      period_start: new Date(new Date().getFullYear(), 0, 1).toISOString().substring(0, 10),
      period_end: new Date(new Date().getFullYear(), 11, 31).toISOString().substring(0, 10),
      notes: '',
    });
    this.closingModalVisible.set(true);
  }

  saveClosing(): void {
    if (this.closingForm.invalid) {
      this.closingForm.markAllAsTouched();
      return;
    }
    const val = this.closingForm.getRawValue();
    const defaultChecklist: PracticeClosingChecklistItem[] = [
      { key: 'bank_recon', label: 'Riconciliazione bancaria & estratti conto', done: false },
      { key: 'vat_settlement', label: 'Liquidazione IVA e comunicazione LIPE', done: false },
      { key: 'depreciation', label: 'Ammortamenti e registro cespiti', done: false },
      { key: 'accruals', label: 'Ratei, risconti e fatture da emettere/ricevere', done: false },
      { key: 'withholding_cert', label: 'Certificazione Unica (CU) compensi', done: false },
    ];

    const payload: PracticeClosingRequest = {
      client_id: val.client_id,
      period_start: val.period_start,
      period_end: val.period_end,
      checklist: defaultChecklist,
      notes: val.notes || undefined,
    };

    this.practiceApi.openClosing(payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('PRACTICE.CLOSING_OPENED'));
        this.closingModalVisible.set(false);
        this.loadClosings();
      },
      error: () => {
        this.message.error(this.translate.instant('PRACTICE.ACTION_ERROR'));
      },
    });
  }

  openChecklistModal(closing: PracticeClosing): void {
    this.activeChecklistClosing.set(closing);
    this.checklistModalVisible.set(true);
  }

  toggleChecklistItem(itemKey: string, done: boolean): void {
    const closing = this.activeChecklistClosing();
    if (!closing) return;

    const updatedChecklist = (closing.checklist || []).map((item) =>
      item.key === itemKey ? { ...item, done } : item,
    );
    this.activeChecklistClosing.set({ ...closing, checklist: updatedChecklist });

    this.practiceApi
      .updateClosingChecklist(closing.id, {
        items: updatedChecklist.map((i) => ({ key: i.key, done: i.done })),
      })
      .subscribe({
        next: () => {
          this.loadClosings();
        },
        error: () => {
          this.message.error(this.translate.instant('PRACTICE.ACTION_ERROR'));
        },
      });
  }

  closePeriod(closingId: string): void {
    this.practiceApi.closePeriod(closingId, { allow_unbilled: true }).subscribe({
      next: () => {
        this.message.success(this.translate.instant('PRACTICE.PERIOD_CLOSED'));
        this.checklistModalVisible.set(false);
        this.loadClosings();
      },
      error: () => {
        this.message.error(this.translate.instant('PRACTICE.ACTION_ERROR'));
      },
    });
  }

  reopenPeriod(closingId: string): void {
    this.practiceApi.reopenPeriod(closingId).subscribe({
      next: () => {
        this.message.success(this.translate.instant('PRACTICE.PERIOD_REOPENED'));
        this.checklistModalVisible.set(false);
        this.loadClosings();
      },
      error: () => {
        this.message.error(this.translate.instant('PRACTICE.ACTION_ERROR'));
      },
    });
  }

  // Formatting helpers
  getChecklistCompletion(closing: PracticeClosing): number {
    if (!closing.checklist || closing.checklist.length === 0) return 0;
    const completed = closing.checklist.filter((i) => i.done).length;
    return Math.round((completed / closing.checklist.length) * 100);
  }

  getActivityStatusColor(status: string): string {
    switch (status) {
      case 'unbilled':
        return 'warning';
      case 'billed':
        return 'success';
      case 'written_off':
        return 'default';
      default:
        return 'default';
    }
  }

  getRetainerStatusColor(status: string): string {
    switch (status) {
      case 'available':
        return 'success';
      case 'partially_applied':
        return 'processing';
      case 'depleted':
        return 'default';
      case 'voided':
        return 'error';
      default:
        return 'default';
    }
  }
}
