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
  CrmActivity,
  CrmActivityPayload,
  CrmActivityPriority,
  CrmActivityType,
  CrmApiService,
  CrmRelatedType,
  I18nService,
  PermissionsService,
} from '@core';
import { PageHeaderComponent, TranslatePipe, IconActionDirective, ModalActionsDirective, GridExportDirective, GridSortPipe, GridFilterListPipe, GridFilterFnPipe } from '@shared';

const TYPES: CrmActivityType[] = ['task', 'call', 'meeting', 'note', 'email', 'follow_up'];
const PRIORITIES: CrmActivityPriority[] = ['low', 'medium', 'high', 'urgent'];
const STATUSES = ['pending', 'in_progress', 'completed', 'cancelled'];
const RELATED: CrmRelatedType[] = ['lead', 'account', 'contact', 'opportunity', 'campaign'];

interface ActivityDraft {
  subject: string;
  type: CrmActivityType;
  priority: CrmActivityPriority;
  due_date: string;
  reminder_at: string;
  related_type: CrmRelatedType | null;
  related_id: string;
  notes: string;
}

const emptyDraft = (): ActivityDraft => ({
  subject: '',
  type: 'task',
  priority: 'medium',
  due_date: '',
  reminder_at: '',
  related_type: null,
  related_id: '',
  notes: '',
});

/** CRM activities: tasks, calls and meetings with due date and reminder, completed with an outcome. */
@Component({
  selector: 'app-crm-activities',
  styleUrl: './activities.component.scss',
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
  templateUrl: './activities.component.html',
})
export class ActivitiesComponent {
  private readonly api = inject(CrmApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly permissions = inject(PermissionsService);
  protected readonly canWrite = computed(() => this.permissions.canWrite('crm'));

  protected readonly types = TYPES;
  protected readonly priorities = PRIORITIES;
  protected readonly statuses = STATUSES;
  protected readonly relatedTypes = RELATED;

  protected readonly items = signal<CrmActivity[]>([]);
  protected readonly total = signal(0);
  protected readonly pageIndex = signal(1);
  protected readonly loading = signal(false);
  protected readonly createOpen = signal(false);
  protected readonly completeTarget = signal<CrmActivity | null>(null);
  protected readonly saving = signal(false);
  protected typeFilter: string | null = null;
  protected statusFilter: string | null = null;
  protected draft: ActivityDraft = emptyDraft();
  protected outcome = '';

  constructor() {
    this.load(1);
  }

  protected load(page = this.pageIndex()): void {
    this.pageIndex.set(page);
    this.loading.set(true);
    this.api
      .getActivities({
        page,
        per_page: 15,
        type: this.typeFilter ?? undefined,
        status: this.statusFilter ?? undefined,
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

  protected openCreate(): void {
    this.draft = emptyDraft();
    this.createOpen.set(true);
  }

  protected valid(): boolean {
    return this.draft.subject.trim().length > 0 && (!this.draft.related_type || this.draft.related_id.length > 0);
  }

  protected save(): void {
    const d = this.draft;
    const payload: CrmActivityPayload = {
      subject: d.subject.trim(),
      type: d.type,
      priority: d.priority,
      due_date: d.due_date || null,
      reminder_at: d.reminder_at ? new Date(d.reminder_at).toISOString() : null,
      related_type: d.related_type,
      related_id: d.related_type ? d.related_id : null,
      notes: d.notes || null,
    };
    this.saving.set(true);
    this.api.createActivity(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.createOpen.set(false);
        this.message.success(this.i18n.translate('CRMX.COMMON.SAVED'));
        this.load(1);
      },
      error: () => this.saving.set(false),
    });
  }

  protected openComplete(activity: CrmActivity): void {
    this.outcome = '';
    this.completeTarget.set(activity);
  }

  protected complete(): void {
    const target = this.completeTarget();
    if (!target) {
      return;
    }
    this.api.completeActivity(target.id, this.outcome.trim() || undefined).subscribe({
      next: () => {
        this.completeTarget.set(null);
        this.message.success(this.i18n.translate('CRMX.ACTIVITIES.COMPLETED'));
        this.load();
      },
    });
  }

  protected cancel(activity: CrmActivity): void {
    this.api.updateActivity(activity.id, { status: 'cancelled' }).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('CRMX.ACTIVITIES.CANCELLED'));
        this.load();
      },
    });
  }

  protected isOpen(activity: CrmActivity): boolean {
    return activity.status === 'pending' || activity.status === 'in_progress';
  }
}
