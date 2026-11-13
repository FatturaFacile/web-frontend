import { Component, computed, inject, signal, TemplateRef, viewChild } from '@angular/core';
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
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  applyServerErrors,
  ChartAccountDetail,
  ChartAccountPayload,
  FetchGridModel,
  QueryFilterParams,
  GeneralLedgerApiService,
  I18nService,
  PermissionsService,
} from '@core';
import { BaseTableComponent, TableColumnDef, TranslatePipe, IconActionDirective, ModalActionsDirective } from '@shared';
import { GlLookupStore } from '../shared/gl-lookup.store';

interface AccountGridFilter extends QueryFilterParams {
  type?: string;
}

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
    BaseTableComponent,
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
    NzTagModule,
    TranslatePipe,
  ],
  templateUrl: './gl-accounts.component.html',
})
export class GlAccountsComponent {
  private readonly api = inject(GeneralLedgerApiService);
  private readonly i18n = inject(I18nService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly lookups = inject(GlLookupStore);
  protected readonly canWrite = inject(PermissionsService).canWrite('ledger');

  protected readonly accountTypes = ACCOUNT_TYPES;
  protected readonly reportingClasses = REPORTING_CLASSES;
  protected readonly grid = new FetchGridModel<ChartAccountDetail, AccountGridFilter>((query) => this.api.getAccountList(query));
  protected readonly saving = signal(false);
  protected readonly modalOpen = signal(false);
  protected readonly formErrors = signal<string[]>([]);
  protected typeFilter: string | null = null;
  protected search = '';
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
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

  private readonly codeTpl = viewChild<TemplateRef<{ $implicit: ChartAccountDetail; value: unknown }>>('codeTpl');
  private readonly typeTpl = viewChild<TemplateRef<{ $implicit: ChartAccountDetail; value: unknown }>>('typeTpl');
  private readonly balanceTpl = viewChild<TemplateRef<{ $implicit: ChartAccountDetail; value: unknown }>>('balanceTpl');
  private readonly statusTpl = viewChild<TemplateRef<{ $implicit: ChartAccountDetail; value: unknown }>>('statusTpl');

  protected readonly columns = computed<TableColumnDef<ChartAccountDetail>[]>(() => {
    this.i18n.currentLanguage();
    return [
      { key: 'account_code', header: 'GL.COL_CODE', customCellTemplate: this.codeTpl() },
      { key: 'name', header: 'GL.COL_NAME' },
      {
        key: 'account_type',
        header: 'GL.ACCOUNT_TYPE',
        valueLabel: (value) => this.i18n.translate('GL.ACCOUNT_TYPE_' + value.toUpperCase()),
        customCellTemplate: this.typeTpl(),
      },
      {
        key: 'normal_balance',
        header: 'GL.NORMAL_BALANCE',
        valueLabel: (value) => this.i18n.translate('GL.NORMAL_' + value.toUpperCase()),
        customCellTemplate: this.balanceTpl(),
      },
      {
        key: 'is_active',
        serverKey: 'activity_state',
        header: 'GL.STATUS',
        valueLabel: (value) => this.i18n.translate(value === 'active' ? 'GL.ACTIVE' : 'GL.INACTIVE'),
        customCellTemplate: this.statusTpl(),
      },
    ];
  });

  constructor() {
    this.grid.setPageSize(25);
  }

  protected load(): void {
    this.grid.setFilter({ type: this.typeFilter ?? undefined });
  }

  /** The search text is matched by the server on code and name; typing is debounced. */
  protected onSearch(): void {
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
    }
    this.searchTimer = setTimeout(() => this.grid.setFilter({ search: this.search.trim() || undefined }), 300);
  }

  private reload(): void {
    this.grid.reload();
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
        this.reload();
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
        this.reload();
      },
    });
  }
}
