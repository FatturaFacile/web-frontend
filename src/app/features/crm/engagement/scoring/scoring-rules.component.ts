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
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  CrmActivityStatus,
  CrmActivityType,
  CrmApiService,
  I18nService,
  LeadScoringRule,
  LeadScoringRulePayload,
  LeadScoringRuleType,
  PermissionsService,
} from '@core';
import { PageHeaderComponent, TranslatePipe, IconActionDirective, ModalActionsDirective } from '@shared';

const FIELDS = ['title', 'email', 'phone', 'company_name', 'website', 'country', 'estimated_budget', 'status', 'lead_source_code', 'campaign_id'];
const OPERATORS = ['filled', 'empty', 'equals', 'not_equals', 'contains', 'in', 'gte', 'lte', 'business_email'];
const ACTIVITY_TYPES: CrmActivityType[] = ['task', 'call', 'meeting', 'note', 'email', 'follow_up'];
const ACTIVITY_STATUSES: CrmActivityStatus[] = ['pending', 'in_progress', 'completed', 'cancelled'];

interface RuleDraft {
  name: string;
  rule_type: LeadScoringRuleType;
  field: string | null;
  operator: string | null;
  value: string;
  activity_type: CrmActivityType | null;
  activity_status: CrmActivityStatus | null;
  points: number;
  max_points: number | null;
  sequence: number | null;
  is_active: boolean;
}

const emptyDraft = (): RuleDraft => ({
  name: '',
  rule_type: 'field',
  field: null,
  operator: null,
  value: '',
  activity_type: null,
  activity_status: null,
  points: 10,
  max_points: null,
  sequence: null,
  is_active: true,
});

/** Lead scoring rules (field or activity based) and the recalculation of every lead score. */
@Component({
  selector: 'app-lead-scoring-rules',
  styleUrl: './scoring-rules.component.scss',
  imports: [
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
    NzSwitchModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './scoring-rules.component.html',
})
export class ScoringRulesComponent {
  private readonly api = inject(CrmApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly permissions = inject(PermissionsService);
  protected readonly canWrite = computed(() => this.permissions.canWrite('crm'));

  protected readonly fields = FIELDS;
  protected readonly operators = OPERATORS;
  protected readonly activityTypes = ACTIVITY_TYPES;
  protected readonly activityStatuses = ACTIVITY_STATUSES;
  protected readonly rules = signal<LeadScoringRule[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly modalOpen = signal(false);
  protected readonly editing = signal<LeadScoringRule | null>(null);
  protected draft: RuleDraft = emptyDraft();

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.api.getLeadScoringRules().subscribe({
      next: (res) => {
        this.rules.set(res.data ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected open(rule: LeadScoringRule | null): void {
    this.editing.set(rule);
    this.draft = rule
      ? {
          name: rule.name,
          rule_type: rule.rule_type,
          field: rule.field ?? null,
          operator: rule.operator ?? null,
          value: rule.value ?? '',
          activity_type: rule.activity_type ?? null,
          activity_status: rule.activity_status ?? null,
          points: rule.points,
          max_points: rule.max_points ?? null,
          sequence: rule.sequence ?? null,
          is_active: rule.is_active ?? true,
        }
      : emptyDraft();
    this.modalOpen.set(true);
  }

  protected valid(): boolean {
    const d = this.draft;
    if (!d.name.trim() || d.points === null || Number.isNaN(d.points)) {
      return false;
    }
    if (d.points < -100 || d.points > 100 || (d.max_points !== null && (d.max_points < 0 || d.max_points > 100)) || (d.sequence !== null && d.sequence < 0)) {
      return false;
    }
    return d.rule_type === 'field' ? !!d.field && !!d.operator : !!d.activity_type;
  }

  protected save(): void {
    const d = this.draft;
    const payload: LeadScoringRulePayload = {
      name: d.name.trim(),
      rule_type: d.rule_type,
      field: d.rule_type === 'field' ? d.field : null,
      operator: d.rule_type === 'field' ? d.operator : null,
      value: d.rule_type === 'field' ? d.value || null : null,
      activity_type: d.rule_type === 'activity' ? d.activity_type : null,
      activity_status: d.rule_type === 'activity' ? d.activity_status : null,
      points: d.points,
      max_points: d.max_points,
      sequence: d.sequence,
      is_active: d.is_active,
    };
    const current = this.editing();
    this.saving.set(true);
    const request = current ? this.api.updateLeadScoringRule(current.id, payload) : this.api.createLeadScoringRule(payload);
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

  protected remove(rule: LeadScoringRule): void {
    this.api.deleteLeadScoringRule(rule.id).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('CRMX.COMMON.DELETED'));
        this.load();
      },
    });
  }

  protected recalculate(): void {
    this.api.recalculateLeadScores().subscribe({
      next: () => this.message.success(this.i18n.translate('CRMX.SCORING.RECALCULATED')),
    });
  }
}
