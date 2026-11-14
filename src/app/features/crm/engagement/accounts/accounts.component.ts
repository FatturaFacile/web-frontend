import { Component, computed, inject, signal, TemplateRef, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  CrmAccount,
  CrmAccountPayload,
  CrmAccountStatus,
  CrmAccountTier,
  CrmAccountFilterParams,
  CrmApiService,
  FetchGridModel,
  I18nService,
  PermissionsService,
} from '@core';
import { BaseTableComponent, PageHeaderComponent, TableColumnDef, TranslatePipe, IconActionDirective, ModalActionsDirective } from '@shared';

const TIERS: CrmAccountTier[] = ['strategic', 'enterprise', 'mid_market', 'smb', 'standard'];
const STATUSES: CrmAccountStatus[] = ['prospect', 'active', 'inactive', 'churned'];

interface AccountDraft {
  name: string;
  tier: CrmAccountTier | null;
  status: CrmAccountStatus;
  industry: string;
  website: string;
  vat_number: string;
  email: string;
  phone: string;
}

const emptyDraft = (): AccountDraft => ({
  name: '',
  tier: null,
  status: 'prospect',
  industry: '',
  website: '',
  vat_number: '',
  email: '',
  phone: '',
});

/** CRM accounts linked to their contact, with tier, churn risk and health profile. */
@Component({
  selector: 'app-crm-accounts',
  styleUrl: './accounts.component.scss',
  imports: [
    BaseTableComponent,
    ModalActionsDirective,
    IconActionDirective,
    FormsModule,
    NzButtonModule,
    NzCardModule,
    NzIconModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './accounts.component.html',
})
export class AccountsComponent {
  private readonly api = inject(CrmApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly permissions = inject(PermissionsService);
  protected readonly canWrite = computed(() => this.permissions.canWrite('crm'));

  protected readonly tiers = TIERS;
  protected readonly statuses = STATUSES;
  protected readonly grid = new FetchGridModel<CrmAccount, CrmAccountFilterParams>((query) => this.api.getAccounts(query));
  protected readonly saving = signal(false);
  protected readonly modalOpen = signal(false);
  protected readonly editing = signal<CrmAccount | null>(null);
  protected readonly healthFor = signal<CrmAccount | null>(null);
  protected readonly health = signal<[string, unknown][]>([]);
  protected tierFilter: string | null = null;
  protected churnFilter: string | null = null;
  protected draft: AccountDraft = emptyDraft();

  private readonly statusTpl = viewChild<TemplateRef<unknown>>('statusTpl');
  private readonly tierTpl = viewChild<TemplateRef<unknown>>('tierTpl');

  /** `name` is sorted/filtered by `display_name`: the linked contact's company name, else the account column. */
  protected readonly columns = computed<TableColumnDef<CrmAccount>[]>(() => {
    this.i18n.currentLanguage();
    return [
      { key: 'name', serverKey: 'display_name', header: this.i18n.translate('CRMX.COMMON.NAME') },
      {
        key: 'tier',
        header: this.i18n.translate('CRMX.ACCOUNTS.TIER'),
        valueGetter: (a) => this.tierLabel(a.tier),
        valueLabel: (value) => this.tierLabel(value),
        customCellTemplate: this.tierTpl(),
      },
      { key: 'status', header: this.i18n.translate('CRMX.COMMON.STATUS'), customCellTemplate: this.statusTpl() },
      { key: 'industry', header: this.i18n.translate('CRMX.ACCOUNTS.INDUSTRY') },
      { key: 'churn_risk', header: this.i18n.translate('CRMX.ACCOUNTS.CHURN_RISK') },
    ];
  });

  protected tierLabel(tier: string | null | undefined): string {
    return tier ? this.i18n.translate('CRMX.ACCOUNTS.TIER_' + tier) : '';
  }

  protected applyFilters(): void {
    this.grid.setFilter({ tier: this.tierFilter ?? undefined, churn_risk: this.churnFilter ?? undefined });
  }

  protected open(account: CrmAccount | null): void {
    this.editing.set(account);
    this.draft = account
      ? {
          ...emptyDraft(),
          name: account.name,
          tier: account.tier ?? null,
          status: (account.status as CrmAccountStatus) ?? 'prospect',
          industry: account.industry ?? '',
          website: account.website ?? '',
        }
      : emptyDraft();
    this.modalOpen.set(true);
  }

  protected save(): void {
    const d = this.draft;
    const current = this.editing();
    const payload: CrmAccountPayload = {
      name: d.name.trim(),
      tier: d.tier,
      industry: d.industry || null,
      website: d.website || null,
      ...(current
        ? { status: d.status }
        : {
            vat_number: d.vat_number || null,
            email: d.email || null,
            phone: d.phone || null,
          }),
    };
    this.saving.set(true);
    const request = current ? this.api.updateAccount(current.id, payload) : this.api.createAccount(payload);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.message.success(this.i18n.translate('CRMX.COMMON.SAVED'));
        this.grid.reload();
      },
      error: () => this.saving.set(false),
    });
  }

  protected remove(account: CrmAccount): void {
    this.api.deleteAccount(account.id).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('CRMX.COMMON.DELETED'));
        this.grid.reload();
      },
    });
  }

  protected showHealth(account: CrmAccount): void {
    this.healthFor.set(account);
    this.health.set([]);
    this.api.getAccountHealth(account.id).subscribe({
      next: (res) => this.health.set(Object.entries(res.data ?? {})),
    });
  }

  protected display(value: unknown): string {
    return value !== null && typeof value === 'object' ? JSON.stringify(value) : String(value ?? '-');
  }
}
