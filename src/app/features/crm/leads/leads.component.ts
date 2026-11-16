import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
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
  CreateLeadPayload,
  DuplicateStrategy,
  I18nService,
  LeadApiService,
  LeadBehaviorEvent,
  LeadRating,
  LeadResource,
  LeadStatus,
  UpdateLeadPayload,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';

const RATING_COLORS: Record<LeadRating, string> = { cold: 'blue', warm: 'orange', hot: 'red' };
const STATUS_COLORS: Record<string, string> = {
  new: 'default',
  contacting: 'processing',
  engaged: 'processing',
  qualified: 'green',
  disqualified: 'default',
  converted: 'purple',
  archived: 'default',
};

@Component({
  selector: 'app-crm-leads',
  imports: [
    FormsModule,
    RouterLink,
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
  templateUrl: './leads.component.html',
  styleUrl: './leads.component.scss',
})
export class LeadsComponent implements OnInit {
  private readonly api = inject(LeadApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly leads = signal<LeadResource[]>([]);
  protected readonly loading = signal(false);
  protected readonly ratingFilter = signal<LeadRating | null>(null);
  protected readonly statusFilter = signal<LeadStatus | null>(null);
  protected readonly modalOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly form = signal<CreateLeadPayload>({ country: 'IT', duplicate_strategy: 'notify' });

  protected readonly ratingOptions = computed(() => {
    this.i18n.currentLanguage();
    return (['hot', 'warm', 'cold'] as LeadRating[]).map((value) => ({
      value,
      label: this.i18n.translate(`CRM.LEADS.RATING.${value.toUpperCase()}`),
    }));
  });

  protected readonly statusOptions = computed(() => {
    this.i18n.currentLanguage();
    return (['new', 'qualified', 'disqualified', 'converted'] as LeadStatus[]).map((value) => ({
      value,
      label: this.i18n.translate(`CRM.LEADS.STATUS.${value.toUpperCase()}`),
    }));
  });

  protected readonly strategyOptions = computed(() => {
    this.i18n.currentLanguage();
    return (['notify', 'merge', 'create'] as DuplicateStrategy[]).map((value) => ({
      value,
      label: this.i18n.translate(`CRM.LEADS.STRATEGY.${value.toUpperCase()}`),
    }));
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.api
      .list({
        rating: this.ratingFilter() ?? undefined,
        status: this.statusFilter() ?? undefined,
      })
      .subscribe({
        next: (res) => {
          this.leads.set(res.data);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  protected setRating(value: LeadRating | null): void {
    this.ratingFilter.set(value);
    this.load();
  }

  protected setStatus(value: LeadStatus | null): void {
    this.statusFilter.set(value);
    this.load();
  }

  protected ratingColor(rating: LeadRating): string {
    return RATING_COLORS[rating] ?? 'blue';
  }

  protected statusColor(status: string): string {
    return STATUS_COLORS[status] ?? 'default';
  }

  protected statusLabel(status: string): string {
    return this.i18n.translate(`CRM.LEADS.STATUS.${status.toUpperCase()}`);
  }

  protected canConvert(lead: LeadResource): boolean {
    return lead.status !== 'converted' && lead.status !== 'disqualified';
  }

  protected openCreate(): void {
    this.form.set({ country: 'IT', duplicate_strategy: 'notify' });
    this.modalOpen.set(true);
  }

  protected patchForm(patch: Partial<CreateLeadPayload>): void {
    this.form.update((f) => ({ ...f, ...patch }));
  }

  protected save(): void {
    const payload = Object.fromEntries(
      Object.entries(this.form()).filter(([, v]) => v !== '' && v !== undefined && v !== null),
    ) as CreateLeadPayload;

    this.saving.set(true);
    this.api.create(payload).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.modalOpen.set(false);
        const key = res.merged
          ? 'CRM.LEADS.MESSAGES.MERGED'
          : res.duplicate_ids.length > 0
            ? 'CRM.LEADS.MESSAGES.CREATED_DUPLICATE'
            : 'CRM.LEADS.MESSAGES.CREATED';
        this.message.success(this.i18n.translate(key));
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  protected qualify(lead: LeadResource): void {
    this.api.qualify(lead.id).subscribe(() => {
      this.message.success(this.i18n.translate('CRM.LEADS.MESSAGES.QUALIFIED'));
      this.load();
    });
  }

  /** 1-click conversion into Contact, Company (Account) and Opportunity. */
  protected convert(lead: LeadResource): void {
    this.api.convert(lead.id).subscribe((res) => {
      this.message.success(
        this.i18n.translate('CRM.LEADS.MESSAGES.CONVERTED', { account: res.account.name }),
      );
      this.load();
    });
  }

  // --- Detail: edit, score breakdown, engagement events, duplicates / merge -----
  protected readonly detail = signal<LeadResource | null>(null);
  protected readonly detailForm = signal<UpdateLeadPayload>({});
  protected readonly duplicates = signal<LeadResource[]>([]);
  protected readonly breakdown = computed(() =>
    Object.entries(this.detail()?.score_breakdown ?? {}).map(([key, points]) => ({ key, points })),
  );

  protected openDetail(lead: LeadResource): void {
    this.api.get(lead.id).subscribe((fresh) => this.showDetail(fresh));
  }

  private showDetail(lead: LeadResource): void {
    this.detail.set(lead);
    this.detailForm.set({
      first_name: lead.first_name ?? '',
      last_name: lead.last_name ?? '',
      company_name: lead.company_name ?? '',
      title: lead.title ?? '',
      email: lead.email ?? '',
      phone: lead.phone ?? '',
      vat_number: lead.vat_number ?? '',
      industry: lead.industry ?? '',
      region: lead.region ?? '',
    });
    this.api
      .detectDuplicates({
        email: lead.email,
        phone: lead.phone,
        company_name: lead.company_name,
        vat_number: lead.vat_number,
      })
      .subscribe((list) => this.duplicates.set(list.filter((d) => d.id !== lead.id)));
  }

  protected patchDetail(patch: Partial<UpdateLeadPayload>): void {
    this.detailForm.update((f) => ({ ...f, ...patch }));
  }

  protected saveDetail(): void {
    const lead = this.detail();
    if (!lead) {
      return;
    }
    this.api.update(lead.id, this.detailForm()).subscribe((updated) => {
      this.message.success(this.i18n.translate('CRM.LEADS.MESSAGES.UPDATED'));
      this.showDetail(updated);
      this.load();
    });
  }

  protected track(event: LeadBehaviorEvent): void {
    const lead = this.detail();
    if (!lead) {
      return;
    }
    this.api.recordBehavior(lead.id, event).subscribe((updated) => {
      this.detail.set(updated);
      this.load();
    });
  }

  /** Merges the chosen duplicate into the lead currently open. */
  protected mergeDuplicate(duplicate: LeadResource): void {
    const lead = this.detail();
    if (!lead) {
      return;
    }
    this.api.merge(lead.id, duplicate.id).subscribe((merged) => {
      this.message.success(this.i18n.translate('CRM.LEADS.MESSAGES.MERGED_MANUAL'));
      this.showDetail(merged);
      this.load();
    });
  }

  // --- Disqualify --------------------------------------------------------------
  protected readonly disqualifying = signal<LeadResource | null>(null);
  protected readonly disqualifyReason = signal('');

  protected confirmDisqualify(): void {
    const lead = this.disqualifying();
    if (!lead || !this.disqualifyReason().trim()) {
      return;
    }
    this.api.disqualify(lead.id, this.disqualifyReason().trim()).subscribe(() => {
      this.disqualifying.set(null);
      this.disqualifyReason.set('');
      this.message.success(this.i18n.translate('CRM.LEADS.MESSAGES.DISQUALIFIED'));
      this.load();
    });
  }

  protected remove(lead: LeadResource): void {
    this.api.remove(lead.id).subscribe(() => {
      this.message.success(this.i18n.translate('CRM.LEADS.MESSAGES.DELETED'));
      this.load();
    });
  }
}
