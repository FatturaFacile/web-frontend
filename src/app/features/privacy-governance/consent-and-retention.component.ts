import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzPaginationModule } from 'ng-zorro-antd/pagination';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTimelineModule } from 'ng-zorro-antd/timeline';
import {
  I18nService,
  PgConsentChain,
  PgConsentEntry,
  PgRetentionRule,
  PgRetentionRunLog,
  PrivacyGovernanceApiService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { consentOptInRate, pgErrorMessage } from './privacy-governance.helpers';

/** Read-only consent ledger with its hash-chain check, and the retention rules with manual purge runs. */
@Component({
  selector: 'app-consent-and-retention',
  imports: [
    DatePipe,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzInputModule,
    NzInputNumberModule,
    NzPaginationModule,
    NzSelectModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    NzTimelineModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  styles: `
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 12px;
    }
    .toolbar nz-select {
      min-width: 190px;
    }
    .meta {
      opacity: 0.75;
      font-size: 12px;
    }
    .runs {
      margin-top: 16px;
    }
  `,
  template: `
    <app-page-header
      [title]="'PRIVACY.CONSENT.TITLE' | translate"
      [subtitle]="'PRIVACY.CONSENT.SUBTITLE' | translate"
    />

    <nz-tabs>
      <nz-tab [nzTitle]="'PRIVACY.CONSENT.TAB_LEDGER' | translate">
        @if (chain(); as c) {
          <nz-alert
            data-testid="chain-status"
            [nzType]="c.is_intact ? 'success' : 'error'"
            nzShowIcon
            [nzMessage]="
              (c.is_intact ? 'PRIVACY.CONSENT.CHAIN_INTACT' : 'PRIVACY.CONSENT.CHAIN_BROKEN')
                | translate: { sequence: c.first_broken_sequence ?? 0 }
            "
          />
        }
        <nz-card>
          <div class="toolbar">
            <input
              nz-input
              style="max-width: 280px"
              [ngModel]="subject()"
              (ngModelChange)="subject.set($event)"
              (keyup.enter)="loadConsents(1)"
              [placeholder]="'PRIVACY.CONSENT.SEARCH' | translate"
              [attr.aria-label]="'PRIVACY.CONSENT.SEARCH' | translate"
            />
            <input
              nz-input
              style="max-width: 220px"
              [ngModel]="purpose()"
              (ngModelChange)="purpose.set($event)"
              (keyup.enter)="loadConsents(1)"
              [placeholder]="'PRIVACY.CONSENT.PURPOSE' | translate"
              [attr.aria-label]="'PRIVACY.CONSENT.PURPOSE' | translate"
            />
            <nz-select
              [ngModel]="granted()"
              (ngModelChange)="granted.set($event); loadConsents(1)"
              nzAllowClear
              [nzPlaceHolder]="'PRIVACY.CONSENT.OUTCOME' | translate"
              [attr.aria-label]="'PRIVACY.CONSENT.OUTCOME' | translate"
            >
              <nz-option [nzValue]="1" [nzLabel]="'PRIVACY.CONSENT.GRANTED' | translate" />
              <nz-option [nzValue]="0" [nzLabel]="'PRIVACY.CONSENT.WITHDRAWN' | translate" />
            </nz-select>
            <button nz-button nzType="primary" (click)="loadConsents(1)">
              {{ 'PRIVACY.COMMON.SEARCH' | translate }}
            </button>
            @if (pageRate() !== null) {
              <nz-tag nzColor="blue">{{
                'PRIVACY.CONSENT.PAGE_RATE' | translate: { rate: pageRate() ?? 0 }
              }}</nz-tag>
            }
          </div>

          <nz-timeline>
            @for (entry of consents(); track entry.id) {
              <nz-timeline-item [nzColor]="entry.consent_granted ? 'green' : 'red'">
                <strong>#{{ entry.sequence }}</strong> {{ entry.purpose_code }} -
                <nz-tag [nzColor]="entry.consent_granted ? 'green' : 'red'">
                  {{
                    (entry.consent_granted
                      ? 'PRIVACY.CONSENT.GRANTED'
                      : 'PRIVACY.CONSENT.WITHDRAWN'
                    ) | translate
                  }}
                </nz-tag>
                <div class="meta">
                  {{ entry.captured_at | date: 'medium' }} |
                  {{ 'PRIVACY.PROOF_CHANNEL.' + entry.proof_channel | translate }} |
                  {{ 'PRIVACY.CONSENT.POLICY' | translate }} {{ entry.policy_version }}
                  @if (entry.ip_address) {
                    | {{ 'PRIVACY.CONSENT.IP' | translate }} {{ entry.ip_address }}
                  }
                  @if (entry.subject_identifier) {
                    | {{ entry.subject_identifier }}
                  }
                </div>
                <div class="meta" [title]="entry.entry_hash">
                  {{ 'PRIVACY.CONSENT.HASH' | translate }} {{ entry.entry_hash.slice(0, 16) }}
                </div>
              </nz-timeline-item>
            } @empty {
              <p>{{ 'PRIVACY.CONSENT.EMPTY' | translate }}</p>
            }
          </nz-timeline>
          <nz-pagination
            [nzPageIndex]="page()"
            [nzPageSize]="pageSize"
            [nzTotal]="total()"
            (nzPageIndexChange)="loadConsents($event)"
          />
        </nz-card>
      </nz-tab>

      <nz-tab [nzTitle]="'PRIVACY.RETENTION.TAB' | translate">
        <nz-card>
          <div class="toolbar">
            <button nz-button [nzLoading]="running() === 'dry'" (click)="runPurge(true)">
              {{ 'PRIVACY.RETENTION.DRY_RUN' | translate }}
            </button>
            <button
              nz-button
              nzDanger
              nzType="primary"
              [nzLoading]="running() === 'real'"
              (click)="confirmPurge()"
            >
              {{ 'PRIVACY.RETENTION.RUN_NOW' | translate }}
            </button>
          </div>

          @if (lastRun(); as run) {
            <nz-alert
              data-testid="last-run"
              nzType="info"
              nzShowIcon
              [nzMessage]="
                (run.dry_run ? 'PRIVACY.RETENTION.LAST_DRY' : 'PRIVACY.RETENTION.LAST_REAL')
                  | translate
              "
              [nzDescription]="
                'PRIVACY.RETENTION.RUN_COUNTS'
                  | translate
                    : {
                        evaluated: run.evaluated_count,
                        purged: run.purged_count,
                        anonymized: run.anonymized_count,
                        skipped: run.statutory_skipped_count,
                      }
              "
            />
          }

          <nz-table #table [nzData]="rules()" nzSize="middle" [nzShowPagination]="false">
            <thead>
              <tr>
                <th>{{ 'PRIVACY.RETENTION.MODULE' | translate }}</th>
                <th>{{ 'PRIVACY.RETENTION.ENTITY' | translate }}</th>
                <th>{{ 'PRIVACY.RETENTION.DAYS' | translate }}</th>
                <th>{{ 'PRIVACY.RETENTION.ACTION' | translate }}</th>
                <th>{{ 'PRIVACY.RETENTION.LEGAL_NOTE' | translate }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (rule of table.data; track rule.id) {
                <tr>
                  <td>{{ rule.module_code }}</td>
                  <td>{{ rule.entity_class }}</td>
                  <td>
                    @if (rule.is_statutory_locked) {
                      <nz-tag nzColor="orange" data-testid="lock-indicator">
                        <i class="fa-solid fa-lock" aria-hidden="true"></i>
                        {{ rule.retention_days }}
                        {{ 'PRIVACY.RETENTION.LOCKED' | translate }}
                      </nz-tag>
                    } @else {
                      <nz-input-number
                        [nzMin]="1"
                        [nzStep]="1"
                        [ngModel]="draftDays()[rule.id] ?? rule.retention_days"
                        (ngModelChange)="setDraft(rule.id, $event)"
                        [attr.aria-label]="'PRIVACY.RETENTION.DAYS' | translate"
                      />
                    }
                  </td>
                  <td>{{ 'PRIVACY.RETENTION_ACTION.' + rule.action_on_expiry | translate }}</td>
                  <td>{{ rule.legal_basis_note }}</td>
                  <td>
                    @if (!rule.is_statutory_locked) {
                      <button
                        nz-button
                        nzSize="small"
                        nzType="primary"
                        [disabled]="!isDirty(rule)"
                        [nzLoading]="savingRule() === rule.id"
                        (click)="saveRule(rule)"
                      >
                        {{ 'PRIVACY.COMMON.SAVE' | translate }}
                      </button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6">{{ 'PRIVACY.RETENTION.EMPTY' | translate }}</td>
                </tr>
              }
            </tbody>
          </nz-table>

          <nz-card
            class="runs"
            nzSize="small"
            [nzTitle]="'PRIVACY.RETENTION.RECENT_RUNS' | translate"
          >
            <nz-table #runsTable [nzData]="runs()" nzSize="small" [nzShowPagination]="false">
              <thead>
                <tr>
                  <th>{{ 'PRIVACY.RETENTION.STARTED' | translate }}</th>
                  <th>{{ 'PRIVACY.RETENTION.MODE' | translate }}</th>
                  <th>{{ 'PRIVACY.RETENTION.EVALUATED' | translate }}</th>
                  <th>{{ 'PRIVACY.RETENTION.PURGED' | translate }}</th>
                  <th>{{ 'PRIVACY.RETENTION.ANONYMIZED' | translate }}</th>
                  <th>{{ 'PRIVACY.RETENTION.SKIPPED' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (run of runsTable.data; track run.id) {
                  <tr>
                    <td>{{ run.started_at | date: 'medium' }}</td>
                    <td>
                      <nz-tag [nzColor]="run.dry_run ? 'blue' : 'red'">
                        {{
                          (run.dry_run
                            ? 'PRIVACY.RETENTION.MODE_DRY'
                            : 'PRIVACY.RETENTION.MODE_REAL'
                          ) | translate
                        }}
                      </nz-tag>
                    </td>
                    <td>{{ run.evaluated_count }}</td>
                    <td>{{ run.purged_count }}</td>
                    <td>{{ run.anonymized_count }}</td>
                    <td>{{ run.statutory_skipped_count }}</td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="6">{{ 'PRIVACY.RETENTION.NO_RUNS' | translate }}</td>
                  </tr>
                }
              </tbody>
            </nz-table>
          </nz-card>
        </nz-card>
      </nz-tab>
    </nz-tabs>
  `,
})
export class ConsentAndRetentionComponent implements OnInit {
  private readonly api = inject(PrivacyGovernanceApiService);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);
  private readonly i18n = inject(I18nService);

  readonly pageSize = 20;
  readonly consents = signal<PgConsentEntry[]>([]);
  readonly chain = signal<PgConsentChain | null>(null);
  readonly page = signal(1);
  readonly total = signal(0);
  readonly subject = signal('');
  readonly purpose = signal('');
  readonly granted = signal<0 | 1 | null>(null);
  readonly pageRate = computed(() => consentOptInRate(this.consents()));

  readonly rules = signal<PgRetentionRule[]>([]);
  readonly runs = signal<PgRetentionRunLog[]>([]);
  readonly lastRun = signal<PgRetentionRunLog | null>(null);
  readonly running = signal<'dry' | 'real' | null>(null);
  readonly savingRule = signal<string | null>(null);
  readonly draftDays = signal<Record<string, number>>({});

  ngOnInit(): void {
    this.loadConsents(1);
    this.loadRules();
  }

  loadConsents(page: number): void {
    this.page.set(page);
    this.api
      .getConsents({
        subject_identifier: this.subject().trim(),
        purpose_code: this.purpose().trim().toUpperCase(),
        consent_granted: this.granted() ?? '',
        per_page: this.pageSize,
        page,
      })
      .subscribe({
        next: (response) => {
          this.consents.set(response.data);
          this.chain.set(response.meta_chain ?? null);
          this.total.set(response.meta?.total ?? response.data.length);
        },
        error: (err: unknown) =>
          this.message.error(
            pgErrorMessage(err, this.i18n.translate('PRIVACY.COMMON.LOAD_FAILED')),
          ),
      });
  }

  loadRules(): void {
    this.api.getRetentionRules().subscribe({
      next: (response) => {
        this.rules.set(response.data);
        this.runs.set(response.recent_runs ?? []);
        this.draftDays.set({});
      },
      error: (err: unknown) =>
        this.message.error(pgErrorMessage(err, this.i18n.translate('PRIVACY.COMMON.LOAD_FAILED'))),
    });
  }

  setDraft(id: string, value: number | null): void {
    if (value === null) {
      return;
    }
    this.draftDays.update((draft) => ({ ...draft, [id]: value }));
  }

  isDirty(rule: PgRetentionRule): boolean {
    const draft = this.draftDays()[rule.id];
    return draft !== undefined && draft !== rule.retention_days;
  }

  saveRule(rule: PgRetentionRule): void {
    const days = this.draftDays()[rule.id];
    if (days === undefined || rule.is_statutory_locked) {
      return;
    }
    this.savingRule.set(rule.id);
    this.api.updateRetentionRule(rule.id, { retention_days: days }).subscribe({
      next: ({ data }) => {
        this.savingRule.set(null);
        this.rules.update((list) => list.map((item) => (item.id === data.id ? data : item)));
        this.draftDays.update(({ [rule.id]: _removed, ...rest }) => rest);
        this.message.success(this.i18n.translate('PRIVACY.COMMON.SAVED'));
      },
      error: (err: unknown) => {
        this.savingRule.set(null);
        this.message.error(pgErrorMessage(err, this.i18n.translate('PRIVACY.COMMON.SAVE_FAILED')));
      },
    });
  }

  /** The real purge deletes or anonymises data for good: it always asks first. */
  confirmPurge(): void {
    this.modal.confirm({
      nzTitle: this.i18n.translate('PRIVACY.RETENTION.CONFIRM_TITLE'),
      nzContent: this.i18n.translate('PRIVACY.RETENTION.CONFIRM_BODY'),
      nzOkText: this.i18n.translate('PRIVACY.RETENTION.RUN_NOW'),
      nzOkDanger: true,
      nzCancelText: this.i18n.translate('PRIVACY.COMMON.CANCEL'),
      nzOnOk: () => this.runPurge(false),
    });
  }

  runPurge(dryRun: boolean): void {
    this.running.set(dryRun ? 'dry' : 'real');
    this.api.runRetentionNow(dryRun).subscribe({
      next: ({ data }) => {
        this.running.set(null);
        this.lastRun.set(data);
        this.runs.update((list) => [data, ...list].slice(0, 10));
        this.message.success(
          this.i18n.translate(dryRun ? 'PRIVACY.RETENTION.DRY_DONE' : 'PRIVACY.RETENTION.RUN_DONE'),
        );
      },
      error: (err: unknown) => {
        this.running.set(null);
        this.message.error(pgErrorMessage(err, this.i18n.translate('PRIVACY.COMMON.SAVE_FAILED')));
      },
    });
  }
}
