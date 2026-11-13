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
  CrmApiService,
  CrmCampaign,
  CrmCampaignMember,
  CrmCampaignStatus,
  CrmSegment,
  I18nService,
  PermissionsService,
} from '@core';
import { PageHeaderComponent, TranslatePipe, IconActionDirective, ModalActionsDirective, GridExportDirective, GridSortPipe, GridFilterListPipe, GridFilterFnPipe } from '@shared';
import { toTimestamp } from '@shared/utils/date-validators';

const STATUSES: CrmCampaignStatus[] = ['planned', 'active', 'completed', 'cancelled'];
const DECIMAL = /^\d+(\.\d{1,2})?$/;

interface CampaignDraft {
  name: string;
  code: string;
  status: CrmCampaignStatus;
  start_date: string;
  end_date: string;
  budgeted_cost: string;
  expected_revenue: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
}

const emptyDraft = (): CampaignDraft => ({
  name: '',
  code: '',
  status: 'planned',
  start_date: '',
  end_date: '',
  budgeted_cost: '',
  expected_revenue: '',
  utm_source: '',
  utm_medium: '',
  utm_campaign: '',
});

/** Campaigns with members (contacts, leads or a whole segment), email send to opted-in members and ROI. */
@Component({
  selector: 'app-crm-campaigns',
  styleUrl: './campaigns.component.scss',
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
  templateUrl: './campaigns.component.html',
})
export class CampaignsComponent {
  private readonly api = inject(CrmApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly permissions = inject(PermissionsService);
  protected readonly canWrite = computed(() => this.permissions.canWrite('crm'));

  protected readonly statuses = STATUSES;
  protected readonly campaigns = signal<CrmCampaign[]>([]);
  protected readonly total = signal(0);
  protected readonly pageIndex = signal(1);
  protected readonly loading = signal(false);
  protected readonly createOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly selected = signal<CrmCampaign | null>(null);
  protected readonly members = signal<CrmCampaignMember[]>([]);
  protected readonly roi = signal<[string, unknown][]>([]);
  protected readonly segments = signal<CrmSegment[]>([]);
  protected readonly sendOpen = signal(false);
  protected draft: CampaignDraft = emptyDraft();
  protected memberKind: 'segment' | 'contact' | 'lead' = 'segment';
  protected memberRef = '';
  protected subject = '';
  protected body = '';

  constructor() {
    this.load(1);
  }

  protected load(page = this.pageIndex()): void {
    this.pageIndex.set(page);
    this.loading.set(true);
    this.api.getCampaigns({ page, per_page: 15 }).subscribe({
      next: (res) => {
        this.campaigns.set(res.data ?? []);
        this.total.set(res.meta?.total ?? 0);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  /** Mirrors `end_date: after_or_equal:start_date`. */
  protected endsBeforeStart(): boolean {
    const start = toTimestamp(this.draft.start_date);
    const end = toTimestamp(this.draft.end_date);
    return start !== null && end !== null && end < start;
  }

  protected validDraft(): boolean {
    const d = this.draft;
    return (
      d.name.trim().length > 0 &&
      !this.endsBeforeStart() &&
      (!d.budgeted_cost || DECIMAL.test(d.budgeted_cost)) &&
      (!d.expected_revenue || DECIMAL.test(d.expected_revenue))
    );
  }

  protected save(): void {
    const d = this.draft;
    this.saving.set(true);
    this.api
      .createCampaign({
        name: d.name.trim(),
        code: d.code || null,
        status: d.status,
        start_date: d.start_date || null,
        end_date: d.end_date || null,
        budgeted_cost: d.budgeted_cost || null,
        expected_revenue: d.expected_revenue || null,
        utm_source: d.utm_source || null,
        utm_medium: d.utm_medium || null,
        utm_campaign: d.utm_campaign || null,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.createOpen.set(false);
          this.message.success(this.i18n.translate('CRMX.COMMON.SAVED'));
          this.load(1);
        },
        error: () => this.saving.set(false),
      });
  }

  protected openCreate(): void {
    this.draft = emptyDraft();
    this.createOpen.set(true);
  }

  protected view(campaign: CrmCampaign): void {
    this.selected.set(campaign);
    this.members.set([]);
    this.roi.set([]);
    this.loadMembers(campaign.id);
    this.api.getCampaignRoi(campaign.id).subscribe({
      next: (res) => this.roi.set(Object.entries(res.data ?? {})),
    });
    this.api.getSegments().subscribe({
      next: (res) => this.segments.set(res.data ?? []),
      error: () => this.segments.set([]),
    });
  }

  private loadMembers(id: string): void {
    this.api.getCampaignMembers(id).subscribe({ next: (res) => this.members.set(res.data ?? []) });
  }

  protected addMember(campaign: CrmCampaign): void {
    if (!this.memberRef) {
      return;
    }
    const payload =
      this.memberKind === 'segment'
        ? { segment_id: this.memberRef }
        : this.memberKind === 'contact'
          ? { contact_id: this.memberRef }
          : { lead_id: this.memberRef };
    this.api.addCampaignMembers(campaign.id, payload).subscribe({
      next: () => {
        this.memberRef = '';
        this.message.success(this.i18n.translate('CRMX.CAMPAIGNS.MEMBER_ADDED'));
        this.loadMembers(campaign.id);
      },
    });
  }

  protected removeMember(campaign: CrmCampaign, member: CrmCampaignMember): void {
    this.api.removeCampaignMember(campaign.id, member.id).subscribe({
      next: () => this.loadMembers(campaign.id),
    });
  }

  protected openSend(): void {
    this.subject = '';
    this.body = '';
    this.sendOpen.set(true);
  }

  protected send(campaign: CrmCampaign): void {
    this.api.sendCampaign(campaign.id, { subject: this.subject.trim(), body: this.body.trim() }).subscribe({
      next: () => {
        this.sendOpen.set(false);
        this.message.success(this.i18n.translate('CRMX.CAMPAIGNS.SENT'));
        this.loadMembers(campaign.id);
      },
    });
  }

  protected display(value: unknown): string {
    return value !== null && typeof value === 'object' ? JSON.stringify(value) : String(value ?? '-');
  }
}
