import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPaginationModule } from 'ng-zorro-antd/pagination';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  I18nService,
  LeadApiService,
  LeadDuplicateCandidate,
  LeadMergePayload,
  LeadMergeSurvivor,
  leadDisplayName,
} from '@core';
import { PageHeaderComponent } from '@shared';
import { apiErrorMessage, humanize, translateOr, TranslateOrPipe } from './lead-i18n';
import { LeadRatingTagComponent } from './lead-rating-tag.component';
import { LeadScoreBadgeComponent } from './lead-score-badge.component';

/** Fields that can be picked individually when merging two records. */
export const MERGE_FIELDS = ['first_name', 'last_name', 'company_name', 'email', 'phone', 'vat_number'] as const;
type MergeField = (typeof MERGE_FIELDS)[number];

export interface MergeFieldRow {
  field: MergeField;
  lead: string;
  candidate: string;
}

function asText(v: unknown): string {
  return v === null || v === undefined ? '' : String(v);
}

/** Candidate summary as a field map (the backend may send an object or a plain string). */
export function candidateFields(d: LeadDuplicateCandidate): Record<string, unknown> {
  const s = d.candidate?.summary;
  return s && typeof s === 'object' ? (s as Record<string, unknown>) : {};
}

/** Rows where lead and candidate disagree, offered as per-field choices. */
export function conflictingFields(d: LeadDuplicateCandidate): MergeFieldRow[] {
  const c = candidateFields(d);
  const lead = d.lead as unknown as Record<string, unknown>;
  return MERGE_FIELDS.map((field) => ({ field, lead: asText(lead?.[field]), candidate: asText(c[field]) })).filter(
    (r) => r.candidate !== '' && r.lead !== r.candidate,
  );
}

@Component({
  selector: 'app-crm-lead-duplicates',
  imports: [
    FormsModule,
    RouterLink,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
    NzEmptyModule,
    NzIconModule,
    NzModalModule,
    NzPaginationModule,
    NzPopconfirmModule,
    NzRadioModule,
    NzSkeletonModule,
    NzTagModule,
    PageHeaderComponent,
    TranslateOrPipe,
    LeadRatingTagComponent,
    LeadScoreBadgeComponent,
  ],
  templateUrl: './lead-duplicates.component.html',
  styleUrl: './lead-duplicates.component.scss',
})
export class LeadDuplicatesComponent {
  private readonly api = inject(LeadApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  readonly items = signal<LeadDuplicateCandidate[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly pageSize = 10;
  readonly loading = signal(true);
  readonly loadError = signal(false);
  /** Per-row error after a failed merge/dismiss; the row is kept. */
  readonly rowErrors = signal<Record<string, string>>({});
  readonly pendingId = signal<string | null>(null);

  // Merge dialog state
  readonly merging = signal<LeadDuplicateCandidate | null>(null);
  readonly survivor = signal<LeadMergeSurvivor>('lead');
  readonly pickFields = signal(false);
  readonly fieldChoices = signal<Record<string, LeadMergeSurvivor>>({});
  protected readonly mergeRows = computed(() => {
    const d = this.merging();
    return d ? conflictingFields(d) : [];
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.api.listDuplicates({ status: 'pending', page: this.page(), per_page: this.pageSize }).subscribe({
      next: (res) => {
        this.items.set(res.data);
        this.total.set(res.meta.total);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
      },
    });
  }

  setPage(page: number): void {
    this.page.set(page);
    this.load();
  }

  protected leadName(d: LeadDuplicateCandidate): string {
    return d.lead ? leadDisplayName(d.lead) : '-';
  }

  protected candidateTitle(d: LeadDuplicateCandidate): string {
    const s = d.candidate?.summary;
    if (typeof s === 'string' && s) {
      return s;
    }
    const f = candidateFields(d);
    const person = [f['first_name'], f['last_name']].filter(Boolean).join(' ');
    return asText(f['name'] ?? f['full_name']) || person || asText(f['company_name']) || asText(f['email']) || d.candidate?.id;
  }

  protected candidateValue(d: LeadDuplicateCandidate, field: string): string {
    return asText(candidateFields(d)[field]) || '-';
  }

  protected candidateTypeLabel(type: string): string {
    return translateOr(this.i18n, `CRM.LEADS.DUPLICATES.CANDIDATE_TYPES.${type.toUpperCase()}`, humanize(type));
  }

  protected matchLabel(type: string): string {
    return translateOr(this.i18n, `CRM.LEADS.DUPLICATES.MATCH.${type.toUpperCase()}`, humanize(type));
  }

  protected fieldLabel(field: string): string {
    return translateOr(this.i18n, `CRM.LEADS.FIELDS.${field.toUpperCase()}`, humanize(field));
  }

  /** Confidence as a percentage, accepting both 0-1 and 0-100 scales. */
  protected confidence(d: LeadDuplicateCandidate): number {
    const c = Number(d.confidence) || 0;
    return Math.round(c <= 1 ? c * 100 : c);
  }

  openMerge(d: LeadDuplicateCandidate): void {
    this.merging.set(d);
    this.survivor.set('lead');
    this.pickFields.set(false);
    this.fieldChoices.set({});
  }

  closeMerge(): void {
    this.merging.set(null);
  }

  protected choiceFor(field: string): LeadMergeSurvivor {
    return this.fieldChoices()[field] ?? this.survivor();
  }

  protected setChoice(field: string, value: LeadMergeSurvivor): void {
    this.fieldChoices.update((c) => ({ ...c, [field]: value }));
  }

  buildMergePayload(): LeadMergePayload {
    const payload: LeadMergePayload = { survivor: this.survivor() };
    if (this.pickFields()) {
      const choices: Record<string, LeadMergeSurvivor> = {};
      for (const row of this.mergeRows()) {
        choices[row.field] = this.choiceFor(row.field);
      }
      if (Object.keys(choices).length) {
        payload.field_choices = choices;
      }
    }
    return payload;
  }

  confirmMerge(): void {
    const d = this.merging();
    if (!d || this.pendingId()) {
      return;
    }
    this.run(d, this.api.mergeDuplicate(d.id, this.buildMergePayload()), 'CRM.LEADS.DUPLICATES.MERGED', 'Records merged');
  }

  dismiss(d: LeadDuplicateCandidate): void {
    if (this.pendingId()) {
      return;
    }
    this.run(d, this.api.dismissDuplicate(d.id), 'CRM.LEADS.DUPLICATES.DISMISSED', 'Duplicate dismissed');
  }

  private run(
    d: LeadDuplicateCandidate,
    call: ReturnType<LeadApiService['dismissDuplicate']>,
    key: string,
    fallback: string,
  ): void {
    this.pendingId.set(d.id);
    this.clearRowError(d.id);
    call.subscribe({
      next: () => {
        this.pendingId.set(null);
        this.items.update((list) => list.filter((x) => x.id !== d.id));
        this.total.update((t) => Math.max(0, t - 1));
        this.merging.set(null);
        this.message.success(translateOr(this.i18n, key, fallback));
        if (this.items().length === 0) {
          // Last row of the page resolved: step back (or refetch) instead of showing an empty page.
          if (this.page() > 1) {
            this.page.update((p) => p - 1);
          }
          this.load();
        }
      },
      error: (err: unknown) => {
        this.pendingId.set(null);
        this.merging.set(null);
        this.rowErrors.update((e) => ({
          ...e,
          [d.id]:
            apiErrorMessage(err) ??
            translateOr(this.i18n, 'CRM.LEADS.DUPLICATES.ACTION_FAILED', 'The action failed; the duplicate was kept.'),
        }));
      },
    });
  }

  private clearRowError(id: string): void {
    this.rowErrors.update((e) => {
      const next = { ...e };
      delete next[id];
      return next;
    });
  }
}
