import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
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
  CRM_CONSENT_CHANNELS,
  CRM_CONSENT_PURPOSES,
  CRM_SEGMENT_FIELDS,
  CRM_SEGMENT_OPERATORS,
  CrmApiService,
  CrmSegment,
  CrmSegmentEntity,
  CrmSegmentFilter,
  I18nService,
  PermissionsService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';

const CONSENT_FIELD = 'consent';
const NO_VALUE_OPERATORS: readonly string[] = ['is_null', 'not_null'];

interface FilterDraft {
  field: string;
  operator: string;
  value: string;
  channel: string;
  purpose: string;
}

const emptyFilter = (): FilterDraft => ({ field: '', operator: 'eq', value: '', channel: 'email', purpose: 'marketing' });

/** Segments: saved filters on contacts or leads, used to target campaigns. */
@Component({
  selector: 'app-crm-segments',
  imports: [
    FormsModule,
    NzButtonModule,
    NzCardModule,
    NzDrawerModule,
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
  templateUrl: './segments.component.html',
})
export class SegmentsComponent {
  private readonly api = inject(CrmApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly permissions = inject(PermissionsService);
  protected readonly canWrite = computed(() => this.permissions.canWrite('crm'));

  protected readonly segments = signal<CrmSegment[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly modalOpen = signal(false);
  protected readonly editing = signal<CrmSegment | null>(null);
  protected readonly previewFor = signal<CrmSegment | null>(null);
  protected readonly preview = signal<unknown[]>([]);
  protected name = '';
  protected description = '';
  protected entity: CrmSegmentEntity = 'contacts';
  protected isActive = true;
  protected filters: FilterDraft[] = [];
  protected readonly consentField = CONSENT_FIELD;
  protected readonly operators = CRM_SEGMENT_OPERATORS;
  protected readonly channels = CRM_CONSENT_CHANNELS;
  protected readonly purposes = CRM_CONSENT_PURPOSES;

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.api.getSegments().subscribe({
      next: (res) => {
        this.segments.set(res.data ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected open(segment: CrmSegment | null): void {
    this.editing.set(segment);
    this.name = segment?.name ?? '';
    this.description = segment?.description ?? '';
    this.entity = segment?.entity ?? 'contacts';
    this.isActive = segment?.is_active ?? true;
    const stored = Array.isArray(segment?.filters) ? segment.filters : [];
    this.filters = stored.map((f) => ({
      ...emptyFilter(),
      field: f.field ?? '',
      operator: f.operator ?? 'eq',
      value: f.value == null ? '' : String(f.value),
      channel: f.channel ?? 'email',
      purpose: f.purpose ?? 'marketing',
    }));
    if (!this.filters.length) {
      this.addFilter();
    }
    this.modalOpen.set(true);
  }

  protected addFilter(): void {
    this.filters = [...this.filters, emptyFilter()];
  }

  protected removeFilter(index: number): void {
    this.filters = this.filters.filter((_, i) => i !== index);
  }

  /** Fields offered for the entity of the segment, plus the consent condition. */
  protected fieldOptions(): readonly string[] {
    return [...CRM_SEGMENT_FIELDS[this.entity], CONSENT_FIELD];
  }

  protected isConsent(filter: FilterDraft): boolean {
    return filter.field === CONSENT_FIELD;
  }

  protected needsValue(filter: FilterDraft): boolean {
    return !NO_VALUE_OPERATORS.includes(filter.operator);
  }

  /** Changing the entity drops the conditions on fields it does not have. */
  protected onEntityChange(): void {
    const allowed = this.fieldOptions();
    this.filters = this.filters.map((f) => (f.field && !allowed.includes(f.field) ? { ...f, field: '' } : f));
  }

  protected valid(): boolean {
    return this.name.trim().length > 0 && this.filters.some((f) => f.field.trim().length > 0);
  }

  /** The API wants objects `{ field, operator, value }` (or `{ field: 'consent', channel, purpose }`). */
  protected buildFilters(): CrmSegmentFilter[] {
    return this.filters
      .filter((f) => f.field)
      .map((f): CrmSegmentFilter => {
        if (this.isConsent(f)) {
          return { field: CONSENT_FIELD, channel: f.channel, purpose: f.purpose };
        }
        return this.needsValue(f)
          ? { field: f.field, operator: f.operator, value: f.value }
          : { field: f.field, operator: f.operator };
      });
  }

  protected save(): void {
    const base = {
      name: this.name.trim(),
      description: this.description || null,
      filters: this.buildFilters(),
      is_active: this.isActive,
    };
    const current = this.editing();
    this.saving.set(true);
    const request = current
      ? this.api.updateSegment(current.id, base)
      : this.api.createSegment({ ...base, entity: this.entity });
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

  protected remove(segment: CrmSegment): void {
    this.api.deleteSegment(segment.id).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('CRMX.COMMON.DELETED'));
        this.load();
      },
    });
  }

  protected showMembers(segment: CrmSegment): void {
    this.previewFor.set(segment);
    this.preview.set([]);
    this.api.getSegmentMembers(segment.id).subscribe({ next: (res) => this.preview.set(res.data ?? []) });
  }

  protected memberLabel(member: unknown): string {
    const m = member as Record<string, unknown>;
    return String(m['display_name'] ?? m['company_name'] ?? m['name'] ?? m['email'] ?? m['id'] ?? '-');
  }
}
