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
import { CrmApiService, CrmSegment, CrmSegmentEntity, I18nService, PermissionsService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';

interface FilterDraft {
  field: string;
  operator: string;
  value: string;
}

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
  styleUrl: '../engagement.scss',
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
    const stored = Array.isArray(segment?.filters) ? (segment?.filters as unknown[][]) : [];
    this.filters = stored.map((f) => ({
      field: String(f[0] ?? ''),
      operator: String(f[1] ?? ''),
      value: String(f[2] ?? ''),
    }));
    if (!this.filters.length) {
      this.addFilter();
    }
    this.modalOpen.set(true);
  }

  protected addFilter(): void {
    this.filters = [...this.filters, { field: '', operator: '=', value: '' }];
  }

  protected removeFilter(index: number): void {
    this.filters = this.filters.filter((_, i) => i !== index);
  }

  protected valid(): boolean {
    return this.name.trim().length > 0 && this.filters.some((f) => f.field.trim() && f.operator.trim());
  }

  protected save(): void {
    const payload = {
      name: this.name.trim(),
      description: this.description || null,
      entity: this.entity,
      filters: this.filters.filter((f) => f.field.trim()).map((f) => [f.field.trim(), f.operator.trim(), f.value]),
      is_active: this.isActive,
    };
    const current = this.editing();
    this.saving.set(true);
    const request = current ? this.api.updateSegment(current.id, payload) : this.api.createSegment(payload);
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
