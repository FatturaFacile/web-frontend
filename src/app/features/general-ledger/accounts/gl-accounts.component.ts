import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  applyServerErrors,
  ChartAccountDetail,
  ChartAccountPayload,
  GeneralLedgerApiService,
  PermissionsService,
} from '@core';
import { TranslatePipe, IconActionDirective, ModalActionsDirective, GridExportDirective, GridSortPipe } from '@shared';
import { GlLookupStore } from '../shared/gl-lookup.store';

const ACCOUNT_TYPES = ['asset', 'liability', 'equity', 'revenue', 'expense', 'cogs', 'wip', 'memo', 'statistical'];
const REPORTING_CLASSES = [
  'cash',
  'receivable',
  'inventory',
  'other_current_asset',
  'non_current_asset',
  'current_liability',
  'non_current_liability',
];

@Component({
  selector: 'app-gl-accounts',
  styleUrl: './gl-accounts.component.scss',
  imports: [
    GridExportDirective,
    GridSortPipe,
    IconActionDirective,
    ModalActionsDirective,
    FormsModule,
    ReactiveFormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    TranslatePipe,
  ],
  templateUrl: './gl-accounts.component.html',
})
export class GlAccountsComponent implements OnInit {
  private readonly api = inject(GeneralLedgerApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly lookups = inject(GlLookupStore);
  protected readonly canWrite = inject(PermissionsService).canWrite('ledger');

  protected readonly accountTypes = ACCOUNT_TYPES;
  protected readonly reportingClasses = REPORTING_CLASSES;
  protected readonly items = signal<ChartAccountDetail[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly modalOpen = signal(false);
  protected readonly formErrors = signal<string[]>([]);
  protected typeFilter: string | null = null;
  protected search = '';
  private editingId: string | null = null;

  protected readonly form = this.fb.group({
    account_code: this.fb.control('', [Validators.required, Validators.maxLength(50)]),
    name: this.fb.control('', [Validators.required, Validators.maxLength(255)]),
    account_type: this.fb.control('asset', Validators.required),
    normal_balance: this.fb.control<'debit' | 'credit'>('debit', Validators.required),
    currency: this.fb.control(''),
    reporting_class: this.fb.control(''),
    allows_manual_posting: this.fb.control(true),
    is_cost_center_mandatory: this.fb.control(false),
    is_active: this.fb.control(true),
  });

  ngOnInit(): void {
    this.load();
  }

  protected filtered(): ChartAccountDetail[] {
    const term = this.search.trim().toLowerCase();
    return this.items().filter(
      (a) =>
        !term || `${a.account_code ?? ''} ${a.name}`.toLowerCase().includes(term),
    );
  }

  protected load(): void {
    this.loading.set(true);
    this.api.getAccountList({ type: this.typeFilter ?? undefined, per_page: 500 }).subscribe({
      next: (res) => {
        this.items.set(res.data ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected openModal(account: ChartAccountDetail | null): void {
    this.editingId = account?.id ?? null;
    this.formErrors.set([]);
    this.form.reset({
      account_code: account?.account_code ?? '',
      name: account?.name ?? '',
      account_type: account?.account_type ?? 'asset',
      normal_balance: account?.normal_balance ?? 'debit',
      currency: account?.currency ?? '',
      reporting_class: account?.reporting_class ?? '',
      allows_manual_posting: account?.allows_manual_posting ?? true,
      is_cost_center_mandatory: account?.is_cost_center_mandatory ?? false,
      is_active: account?.is_active ?? true,
    });
    this.modalOpen.set(true);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const payload: ChartAccountPayload = {
      ...value,
      currency: value.currency || null,
      reporting_class: value.reporting_class || null,
    };
    const id = this.editingId;
    this.saving.set(true);
    (id ? this.api.updateAccount(id, payload) : this.api.createAccount(payload)).subscribe({
      next: () => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.lookups.load(true);
        this.load();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.formErrors.set(applyServerErrors(this.form, err));
      },
    });
  }

  protected remove(account: ChartAccountDetail): void {
    this.api.deleteAccount(account.id).subscribe({
      next: () => {
        this.lookups.load(true);
        this.load();
      },
    });
  }
}
