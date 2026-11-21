import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { PgRetentionRule, PrivacyGovernanceApiService } from '@core';
import { TranslatePipe } from '@shared';

export interface StatutoryRetention {
  /** Matches the `entity_class` of a retention rule and names the translation key of the record class. */
  readonly recordClass: string;
  readonly ch: { readonly reference: string; readonly years: number | null };
  readonly it: { readonly reference: string; readonly years: number | null };
}

/** Statutory retention of the main record classes under Swiss and Italian law; `null` means no fixed period. */
export const STATUTORY_RETENTION: readonly StatutoryRetention[] = [
  {
    recordClass: 'accounting_records',
    ch: { reference: 'Art. 958f CO', years: 10 },
    it: { reference: 'Art. 2220 c.c.', years: 10 },
  },
  {
    recordClass: 'vat_documents',
    ch: { reference: 'Art. 70 MWSTG', years: 10 },
    it: { reference: 'Art. 39 DPR 633/1972', years: 10 },
  },
  {
    recordClass: 'consent_records',
    ch: { reference: 'Art. 6 nLPD', years: null },
    it: { reference: 'Art. 5(1)(e) GDPR', years: null },
  },
  {
    recordClass: 'dsar_records',
    ch: { reference: 'Art. 6 nLPD', years: null },
    it: { reference: 'Art. 5(1)(e) GDPR', years: null },
  },
];

export type RetentionVerdict = 'compliant' | 'too_short' | 'not_configured' | 'no_fixed_period';

/**
 * Compares the retention the tenant configured (in days) with the statutory minimum of a jurisdiction: a rule that
 * deletes earlier than the law allows is `too_short`.
 */
export function retentionVerdict(
  configuredDays: number | null,
  statutoryYears: number | null,
): RetentionVerdict {
  if (statutoryYears === null) {
    return 'no_fixed_period';
  }
  if (configuredDays === null) {
    return 'not_configured';
  }
  return configuredDays >= statutoryYears * 365 ? 'compliant' : 'too_short';
}

export function verdictColor(verdict: RetentionVerdict): string {
  switch (verdict) {
    case 'compliant':
      return 'green';
    case 'too_short':
      return 'red';
    case 'not_configured':
      return 'orange';
    default:
      return 'default';
  }
}

export interface RetentionMatrixRow {
  readonly entry: StatutoryRetention;
  readonly configuredDays: number | null;
  readonly ch: RetentionVerdict;
  readonly it: RetentionVerdict;
}

/** One row per statutory record class, joined with the configured retention rule of the same class. */
export function buildRetentionMatrix(rules: readonly PgRetentionRule[]): RetentionMatrixRow[] {
  return STATUTORY_RETENTION.map((entry) => {
    const rule = rules.find((candidate) => candidate.entity_class === entry.recordClass);
    const configuredDays = rule?.retention_days ?? null;
    return {
      entry,
      configuredDays,
      ch: retentionVerdict(configuredDays, entry.ch.years),
      it: retentionVerdict(configuredDays, entry.it.years),
    };
  });
}

/** Retention matrix: statutory periods in Switzerland and Italy against the configured retention rules. */
@Component({
  selector: 'app-security-retention-matrix',
  styleUrl: './security-center.scss',
  imports: [NzAlertModule, NzCardModule, NzTableModule, NzTagModule, TranslatePipe],
  template: `
    @if (error()) {
      <nz-alert
        class="banner"
        nzType="error"
        nzShowIcon
        [nzMessage]="'SECURITY_CENTER.RETENTION.LOAD_ERROR' | translate"
      />
    }
    <nz-card [nzTitle]="'SECURITY_CENTER.RETENTION.TITLE' | translate" [nzLoading]="loading()">
      <div class="table-scroll">
        <nz-table
          nzSize="small"
          [nzData]="matrix()"
          [nzShowPagination]="false"
          data-testid="retention-matrix"
        >
          <thead>
            <tr>
              <th>{{ 'SECURITY_CENTER.RETENTION.RECORD_CLASS' | translate }}</th>
              <th>{{ 'SECURITY_CENTER.RETENTION.CH' | translate }}</th>
              <th>{{ 'SECURITY_CENTER.RETENTION.IT' | translate }}</th>
              <th>{{ 'SECURITY_CENTER.RETENTION.CONFIGURED' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of matrix(); track row.entry.recordClass) {
              <tr [attr.data-record-class]="row.entry.recordClass">
                <td>
                  {{
                    'SECURITY_CENTER.RETENTION.CLASS_' + row.entry.recordClass.toUpperCase()
                      | translate
                  }}
                </td>
                <td class="matrix-ref">
                  <div>{{ row.entry.ch.reference }}</div>
                  <nz-tag [nzColor]="color(row.ch)">{{
                    years(row.entry.ch.years) | translate: { years: row.entry.ch.years ?? 0 }
                  }}</nz-tag>
                </td>
                <td class="matrix-ref">
                  <div>{{ row.entry.it.reference }}</div>
                  <nz-tag [nzColor]="color(row.it)">{{
                    years(row.entry.it.years) | translate: { years: row.entry.it.years ?? 0 }
                  }}</nz-tag>
                </td>
                <td data-testid="configured">
                  @if (row.configuredDays === null) {
                    {{ 'SECURITY_CENTER.RETENTION.NOT_CONFIGURED' | translate }}
                  } @else {
                    {{ 'SECURITY_CENTER.RETENTION.DAYS' | translate: { days: row.configuredDays } }}
                  }
                  @if (row.ch === 'too_short' || row.it === 'too_short') {
                    <nz-tag nzColor="red">{{
                      'SECURITY_CENTER.RETENTION.TOO_SHORT' | translate
                    }}</nz-tag>
                  }
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
      </div>
    </nz-card>
  `,
})
export class RetentionMatrixComponent implements OnInit {
  private readonly api = inject(PrivacyGovernanceApiService);

  protected readonly color = verdictColor;
  protected readonly years = (value: number | null): string =>
    value === null ? 'SECURITY_CENTER.RETENTION.NO_FIXED' : 'SECURITY_CENTER.RETENTION.YEARS';

  readonly rules = signal<PgRetentionRule[]>([]);
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly matrix = computed(() => buildRetentionMatrix(this.rules()));

  ngOnInit(): void {
    this.loading.set(true);
    this.api.getRetentionRules().subscribe({
      next: (response) => {
        this.rules.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }
}
