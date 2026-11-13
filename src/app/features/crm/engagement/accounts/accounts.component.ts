import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  CrmAccount,
  CrmAccountPayload,
  CrmAccountStatus,
  CrmAccountTier,
  CrmApiService,
  I18nService,
  PermissionsService,
} from '@core';
import { PageHeaderComponent, TranslatePipe, IconActionDirective, ModalActionsDirective, GridExportDirective, GridSortPipe, GridFilterListPipe, GridFilterFnPipe } from '@shared';

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
    GridExportDirective,
    GridSortPipe, GridFilterListPipe, GridFilterFnPipe,
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
    NzTableModule,
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
  protected readonly items = signal<CrmAccount[]>([]);
  protected readonly total = signal(0);
  protected readonly pageIndex = signal(1);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly modalOpen = signal(false);
  protected readonly editing = signal<CrmAccount | null>(null);
  protected readonly healthFor = signal<CrmAccount | null>(null);
  protected readonly health = signal<[string, unknown][]>([]);
  protected tierFilter: string | null = null;
  protected churnFilter: string | null = null;
  protected draft: AccountDraft = emptyDraft();

  constructor() {
    this.load(1);
  }

  protected load(page = this.pageIndex()): void {
    this.pageIndex.set(page);
    this.loading.set(true);
    this.api
      .getAccounts({
        page,
        per_page: 15,
        tier: this.tierFilter ?? undefined,
        churn_risk: this.churnFilter ?? undefined,
      })
      .subscribe({
        next: (res) => {
          this.items.set(res.data ?? []);
          this.total.set(res.meta?.total ?? 0);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
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
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  protected remove(account: CrmAccount): void {
    this.api.deleteAccount(account.id).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('CRMX.COMMON.DELETED'));
        this.load();
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
