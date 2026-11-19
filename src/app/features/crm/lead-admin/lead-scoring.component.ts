import { Component, inject, signal } from '@angular/core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { I18nService, LeadApiService, LeadScoringRule } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { httpStatus } from '../leads/lead-i18n';
import { LeadScorePreviewComponent } from './lead-score-preview.component';
import {
  formatRuleValue,
  LeadScoringRuleModalComponent,
} from './lead-scoring-rule-modal.component';
import { LeadSettingsFormComponent } from './lead-settings-form.component';

@Component({
  selector: 'app-crm-lead-scoring',
  imports: [
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzGridModule,
    NzIconModule,
    NzPopconfirmModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
    LeadScorePreviewComponent,
    LeadScoringRuleModalComponent,
    LeadSettingsFormComponent,
  ],
  templateUrl: './lead-scoring.component.html',
  styleUrl: './lead-admin.scss',
})
export class LeadScoringComponent {
  private readonly api = inject(LeadApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  readonly rules = signal<LeadScoringRule[]>([]);
  readonly loading = signal(true);
  readonly forbidden = signal(false);
  readonly loadError = signal(false);
  readonly busyId = signal<string | null>(null);
  readonly modalOpen = signal(false);
  readonly editing = signal<LeadScoringRule | null>(null);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.api.listScoringRules().subscribe({
      next: (rules) => {
        this.rules.set(rules);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.forbidden.set(httpStatus(err) === 403);
        this.loadError.set(httpStatus(err) !== 403);
      },
    });
  }

  protected target(r: LeadScoringRule): string {
    return r.category === 'behavioral'
      ? this.i18n.translate(`CRM.LEADS.EVENTS.TYPES.${(r.event_type ?? '').toUpperCase()}`)
      : (r.field ?? '-');
  }

  protected operatorLabel(op: string): string {
    return this.i18n.translate(`CRM.LEAD_SCORING.OPERATORS.${op.toUpperCase()}`);
  }

  protected categoryLabel(c: string): string {
    return this.i18n.translate(`CRM.LEAD_SCORING.RULES.${c.toUpperCase()}`);
  }

  protected value(r: LeadScoringRule): string {
    return formatRuleValue(r.value) || '-';
  }

  openCreate(): void {
    this.editing.set(null);
    this.modalOpen.set(true);
  }

  openEdit(r: LeadScoringRule): void {
    this.editing.set(r);
    this.modalOpen.set(true);
  }

  onSaved(saved: LeadScoringRule): void {
    const editing = this.editing();
    if (saved && typeof saved === 'object' && 'id' in saved) {
      this.rules.update((list) =>
        editing ? list.map((r) => (r.id === saved.id ? saved : r)) : [...list, saved],
      );
    } else {
      this.load();
    }
    this.message.success(this.i18n.translate('CRM.LEAD_SCORING.RULES.SAVED'));
  }

  toggle(r: LeadScoringRule): void {
    if (this.busyId()) {
      return;
    }
    this.busyId.set(r.id);
    this.api
      .updateScoringRule(r.id, {
        code: r.code,
        name: r.name,
        category: r.category,
        field: r.field ?? null,
        event_type: r.event_type ?? null,
        operator: r.operator,
        value: r.value,
        points: r.points,
        max_applications: r.max_applications ?? null,
        decay_days: r.decay_days ?? null,
        is_active: !r.is_active,
      })
      .subscribe({
        next: () => {
          this.busyId.set(null);
          this.rules.update((list) =>
            list.map((x) => (x.id === r.id ? { ...x, is_active: !r.is_active } : x)),
          );
        },
        error: () => this.busyId.set(null),
      });
  }

  remove(r: LeadScoringRule): void {
    if (this.busyId()) {
      return;
    }
    this.busyId.set(r.id);
    this.api.deleteScoringRule(r.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.rules.update((list) => list.filter((x) => x.id !== r.id));
        this.message.success(this.i18n.translate('CRM.LEAD_SCORING.RULES.DELETED'));
      },
      error: () => this.busyId.set(null),
    });
  }
}
