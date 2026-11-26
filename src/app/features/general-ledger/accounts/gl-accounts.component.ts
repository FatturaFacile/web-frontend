import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzDropdownModule } from 'ng-zorro-antd/dropdown';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTreeModule, NzTreeNodeOptions } from 'ng-zorro-antd/tree';
import type {
  AccountMapping,
  AccountMappingPayload,
  ChartAccountDetail,
  ChartAccountPayload,
  ChartAccountTreeNode,
} from '../../../core/models/general-ledger.model';
import { GlAccountsStore } from './gl-accounts.store';

@Component({
  selector: 'app-gl-accounts',
  providers: [GlAccountsStore],
  imports: [
    FormsModule,
    ReactiveFormsModule,
    NzAlertModule,
    NzBreadCrumbModule,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
    NzDescriptionsModule,
    NzDropdownModule,
    NzEmptyModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSwitchModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    NzTreeModule,
  ],
  templateUrl: './gl-accounts.component.html',
  styleUrl: './gl-accounts.component.scss',
})
export class GlAccountsComponent implements OnInit {
  readonly store = inject(GlAccountsStore);
  private readonly fb = inject(FormBuilder);
  private readonly msg = inject(NzMessageService);

  readonly activeTab = signal<number>(0);
  readonly accountModalOpen = signal<boolean>(false);
  readonly editingAccountId = signal<string | null>(null);

  readonly moveModalOpen = signal<boolean>(false);
  readonly movingAccount = signal<ChartAccountTreeNode | null>(null);
  readonly moveTargetParentId = signal<string | null>(null);

  readonly provisionModalOpen = signal<boolean>(false);
  readonly selectedTemplateKey = signal<string>('ch_kmu_pme');
  readonly includeDefaultMappings = signal<boolean>(true);

  readonly mappingModalOpen = signal<boolean>(false);
  readonly editingMappingId = signal<string | null>(null);
  readonly mappingSourceFilter = signal<string>('');
  readonly mappingTargetFilter = signal<string>('');

  readonly currencyOptions = ['CHF', 'EUR', 'USD', 'GBP'];
  readonly accountTypeOptions = [
    'asset',
    'liability',
    'equity',
    'revenue',
    'expense',
    'cogs',
    'wip',
    'memo',
    'statistical',
  ];

  readonly form = this.fb.group({
    account_code: ['', [Validators.required, Validators.maxLength(50)]],
    name: ['', [Validators.required, Validators.maxLength(255)]],
    description: [''],
    account_type: ['asset', [Validators.required]],
    normal_balance: ['debit' as 'debit' | 'credit', [Validators.required]],
    parent_account_id: [null as string | null],
    vat_code_id: [null as string | null],
    default_cost_center_id: [null as string | null],
    open_items_enabled: [false],
    allowed_currencies: [[] as string[]],
    is_postable: [true],
    is_active: [true],
    template_code: [null as string | null],
    statutory_code: [''],
  });

  readonly mappingForm = this.fb.group({
    source_account_id: ['', [Validators.required]],
    target_account_id: [null as string | null],
    source_standard: [''],
    target_standard: ['it_general_ledger', [Validators.required]],
    target_account_code: ['', [Validators.required, Validators.maxLength(50)]],
    target_account_name: ['', [Validators.required, Validators.maxLength(255)]],
    mapping_type: ['direct' as 'direct' | 'split' | 'aggregation' | 'reclassification'],
    allocation_percentage: [100, [Validators.required, Validators.min(0.01), Validators.max(100)]],
    is_bidirectional: [true],
    notes: [''],
    is_active: [true],
  });

  readonly nzTreeNodes = computed<NzTreeNodeOptions[]>(() => {
    const mapNode = (node: ChartAccountTreeNode): NzTreeNodeOptions => ({
      key: node.id,
      title: `${node.account_code} — ${node.account_name}`,
      isLeaf: node.children.length === 0,
      expanded: node.level <= 2,
      origin: node,
      children: node.children.map(mapNode),
    });
    return this.store.tree().map(mapNode);
  });

  /** Form values as a signal: a computed over plain form controls would never re-evaluate. */
  private readonly formValue = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  readonly balanceCoherenceWarning = computed<boolean>(() => {
    const { account_type: type, normal_balance: side } = this.formValue();
    if (!type || !side) {
      return false;
    }
    const debitTypes = ['asset', 'expense', 'cogs', 'wip'];
    const creditTypes = ['liability', 'equity', 'revenue'];
    return (debitTypes.includes(type) && side === 'credit') || (creditTypes.includes(type) && side === 'debit');
  });

  ngOnInit(): void {
    this.store.loadAll();
  }

  copy(key: string, fallback: string): string {
    return this.store.uiCopy()[key] || fallback;
  }

  onSearchChange(value: string): void {
    this.store.setFilters({ searchFilter: value });
  }

  onTemplateFilterChange(value: string): void {
    this.store.setFilters({ templateFilter: value ?? '' });
  }

  onTypeFilterChange(value: string): void {
    this.store.setFilters({ typeFilter: value ?? '' });
  }

  onActiveFilterChange(value: string): void {
    this.store.setFilters({ activeFilter: value ?? '' });
  }

  onTreeNodeClick(event: { node?: { origin?: unknown } }): void {
    const node = event.node?.origin as ChartAccountTreeNode | undefined;
    if (node) {
      this.store.selectAccount(node);
    }
  }

  openCreate(parentAccountId: string | null = null): void {
    this.editingAccountId.set(null);
    this.form.reset({
      account_code: '',
      name: '',
      description: '',
      account_type: 'asset',
      normal_balance: 'debit',
      parent_account_id: parentAccountId,
      vat_code_id: null,
      default_cost_center_id: null,
      open_items_enabled: false,
      allowed_currencies: [],
      is_postable: true,
      is_active: true,
      template_code: null,
      statutory_code: '',
    });
    this.accountModalOpen.set(true);
  }

  openEdit(account: ChartAccountDetail | ChartAccountTreeNode): void {
    this.editingAccountId.set(account.id);
    const name = 'account_name' in account && account.account_name ? account.account_name : (account as ChartAccountDetail).name ?? '';
    this.form.reset({
      account_code: account.account_code,
      name,
      description: (account as ChartAccountTreeNode).description ?? '',
      account_type: account.account_type,
      normal_balance: account.normal_balance,
      parent_account_id: account.parent_account_id ?? null,
      vat_code_id: (account as ChartAccountTreeNode).vat_code_id ?? null,
      default_cost_center_id: (account as ChartAccountTreeNode).default_cost_center_id ?? null,
      open_items_enabled: Boolean((account as ChartAccountTreeNode).open_items_enabled),
      allowed_currencies: (account as ChartAccountTreeNode).allowed_currencies ?? [],
      is_postable: (account as ChartAccountTreeNode).is_postable ?? account.allows_manual_posting ?? true,
      is_active: account.is_active,
      template_code: (account as ChartAccountTreeNode).template_code ?? null,
      statutory_code: (account as ChartAccountTreeNode).statutory_code ?? '',
    });
    this.accountModalOpen.set(true);
  }

  save(): void {
    if (this.form.invalid) {
      Object.values(this.form.controls).forEach((control) => {
        control.markAsDirty();
        control.updateValueAndValidity({ onlySelf: true });
      });
      return;
    }

    const raw = this.form.getRawValue();
    const payload: ChartAccountPayload = {
      account_code: raw.account_code ?? '',
      name: raw.name ?? '',
      description: raw.description || null,
      account_type: raw.account_type ?? 'asset',
      normal_balance: raw.normal_balance ?? 'debit',
      parent_account_id: raw.parent_account_id ?? null,
      vat_code_id: raw.vat_code_id ?? null,
      default_cost_center_id: raw.default_cost_center_id ?? null,
      open_items_enabled: Boolean(raw.open_items_enabled),
      allowed_currencies: raw.allowed_currencies ?? [],
      is_postable: Boolean(raw.is_postable),
      allows_manual_posting: Boolean(raw.is_postable),
      is_active: Boolean(raw.is_active),
      template_code: raw.template_code ?? null,
      statutory_code: raw.statutory_code || null,
    };

    this.store.saveAccount(
      this.editingAccountId(),
      payload,
      () => {
        this.accountModalOpen.set(false);
        this.msg.success(this.editingAccountId() ? 'Account updated' : 'Account created');
      },
      (errMsg) => this.msg.error(errMsg),
    );
  }

  openMoveModal(account: ChartAccountTreeNode): void {
    this.movingAccount.set(account);
    this.moveTargetParentId.set(account.parent_account_id);
    this.moveModalOpen.set(true);
  }

  confirmMove(): void {
    const acc = this.movingAccount();
    if (!acc) {
      return;
    }
    this.store.moveAccount(
      acc.id,
      this.moveTargetParentId(),
      () => {
        this.moveModalOpen.set(false);
        this.msg.success('Account moved');
      },
      (errMsg) => this.msg.error(errMsg),
    );
  }

  deleteAccount(id: string): void {
    this.store.deleteAccount(
      id,
      () => this.msg.success('Account deleted'),
      (errMsg) => this.msg.error(errMsg),
    );
  }

  openProvisionModal(templateKey?: string): void {
    if (templateKey) {
      this.selectedTemplateKey.set(templateKey);
    }
    this.provisionModalOpen.set(true);
  }

  confirmProvision(): void {
    this.store.provisionTemplate(
      this.selectedTemplateKey(),
      this.includeDefaultMappings(),
      (res) => {
        this.provisionModalOpen.set(false);
        this.msg.success(`${res.template}: +${res.created} accounts (${res.skipped} skipped), +${res.mappings_created ?? 0} mappings`);
      },
      (errMsg) => this.msg.error(errMsg),
    );
  }

  exportAs(format: 'xlsx' | 'csv' | 'xml'): void {
    this.store.exportCoa(format, (errMsg) => this.msg.error(errMsg));
  }

  openCreateMapping(sourceAccountId?: string): void {
    this.editingMappingId.set(null);
    const sourceAcc = this.store.accounts().find((a) => a.id === sourceAccountId);
    this.mappingForm.reset({
      source_account_id: sourceAccountId ?? '',
      target_account_id: null,
      source_standard: (sourceAcc as unknown as ChartAccountTreeNode | undefined)?.template_code ?? 'ch_kmu_pme',
      target_standard: 'it_general_ledger',
      target_account_code: '',
      target_account_name: '',
      mapping_type: 'direct',
      allocation_percentage: 100,
      is_bidirectional: true,
      notes: '',
      is_active: true,
    });
    this.mappingModalOpen.set(true);
  }

  openEditMapping(mapping: AccountMapping): void {
    this.editingMappingId.set(mapping.id);
    this.mappingForm.reset({
      source_account_id: mapping.source_account_id,
      target_account_id: mapping.target_account_id,
      source_standard: mapping.source_standard,
      target_standard: mapping.target_standard,
      target_account_code: mapping.target_account_code,
      target_account_name: mapping.target_account_name,
      mapping_type: mapping.mapping_type,
      allocation_percentage: mapping.allocation_percentage,
      is_bidirectional: mapping.is_bidirectional,
      notes: mapping.notes ?? '',
      is_active: mapping.is_active,
    });
    this.mappingModalOpen.set(true);
  }

  onTargetAccountPicked(accountId: string | null): void {
    if (!accountId) {
      return;
    }
    const target = this.store.accounts().find((a) => a.id === accountId);
    if (target) {
      this.mappingForm.patchValue({
        target_account_code: target.account_code,
        target_account_name: target.account_name ?? target.name ?? target.account_code,
      });
    }
  }

  saveMapping(): void {
    if (this.mappingForm.invalid) {
      Object.values(this.mappingForm.controls).forEach((control) => {
        control.markAsDirty();
        control.updateValueAndValidity({ onlySelf: true });
      });
      return;
    }

    const raw = this.mappingForm.getRawValue();
    const payload: AccountMappingPayload = {
      source_account_id: raw.source_account_id ?? '',
      target_account_id: raw.target_account_id ?? null,
      source_standard: raw.source_standard || null,
      target_standard: raw.target_standard ?? 'it_general_ledger',
      target_account_code: raw.target_account_code ?? '',
      target_account_name: raw.target_account_name ?? '',
      mapping_type: raw.mapping_type ?? 'direct',
      allocation_percentage: Number(raw.allocation_percentage ?? 100),
      is_bidirectional: Boolean(raw.is_bidirectional),
      notes: raw.notes || null,
      is_active: Boolean(raw.is_active),
    };

    this.store.saveMapping(
      this.editingMappingId(),
      payload,
      () => {
        this.mappingModalOpen.set(false);
        this.msg.success('Mapping saved');
      },
      (errMsg) => this.msg.error(errMsg),
    );
  }

  deleteMapping(id: string): void {
    this.store.deleteMapping(
      id,
      () => this.msg.success('Mapping deleted'),
      (errMsg) => this.msg.error(errMsg),
    );
  }

  filterMappings(): void {
    this.store.loadMappings({
      source_standard: this.mappingSourceFilter() || undefined,
      target_standard: this.mappingTargetFilter() || undefined,
    });
  }

  seedDefaultMappings(): void {
    this.store.seedDefaultMappings(
      this.mappingSourceFilter() || undefined,
      (created) => this.msg.success(`+${created} default mappings`),
      (errMsg) => this.msg.error(errMsg),
    );
  }
}
