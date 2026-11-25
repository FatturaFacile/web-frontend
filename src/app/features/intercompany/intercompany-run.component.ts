import { Component, effect, inject, OnInit, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCollapseModule } from 'ng-zorro-antd/collapse';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStepsModule } from 'ng-zorro-antd/steps';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTimelineModule } from 'ng-zorro-antd/timeline';
import { IcEliminationEntry, PermissionsService } from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';
import { GlConsolidationPeriodStore } from '../general-ledger/consolidation/gl-consolidation-period.store';
import { IntercompanyContextStore } from './intercompany-context.store';
import { IntercompanyNotifier } from './intercompany-notifier.service';
import { IntercompanyReasonDialogComponent } from './intercompany-reason-dialog.component';
import { IntercompanyRunStore } from './intercompany-run.store';
import { enumKey, IC_ELIMINATION_TYPES, IC_MODULE, IC_RUN_STEPS, isNonZero, runStatusColor } from './intercompany.util';

/**
 * The guided consolidation run: scope and tree validation, translation and NCI, the elimination ledger, review, then lock
 * (or post) and reopen with the audit history of every status change.
 */
@Component({
  selector: 'app-intercompany-run',
  styleUrl: './intercompany.scss',
  providers: [IntercompanyRunStore],
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzCollapseModule,
    NzSelectModule,
    NzStepsModule,
    NzTableModule,
    NzTagModule,
    NzTimelineModule,
    IntercompanyReasonDialogComponent,
    MoneyPipe,
    TranslatePipe,
  ],
  template: `
    @if (canWrite) {
      <div class="toolbar">
        <label for="ic-run-period">{{ 'intercompany.run.newRun' | translate }}</label>
        <nz-select id="ic-run-period" class="select-md" nzShowSearch [ngModel]="periodId()" (ngModelChange)="periodId.set($event)">
          @for (period of periods.periods(); track period.id) {
            <nz-option [nzValue]="period.id" [nzLabel]="period.label" />
          }
        </nz-select>
        <button nz-button type="button" [disabled]="!periodId()" [nzLoading]="store.busy()" (click)="start()">
          {{ 'intercompany.run.start' | translate }}
        </button>
      </div>
    }

    @if (!ctx.runId()) {
      <nz-alert nzType="info" nzShowIcon [nzMessage]="'intercompany.run.noRun' | translate" />
    } @else if (store.workflow(); as workflow) {
      <div class="toolbar">
        <nz-tag [nzColor]="statusColor(workflow.status)">{{ enumKey('runStatus', workflow.status) | translate }}</nz-tag>
        <span class="muted">{{ 'intercompany.run.version' | translate }} {{ workflow.version }}</span>
      </div>
      @if (store.error(); as key) {
        <nz-alert nzType="error" nzShowIcon [nzMessage]="key | translate" class="section" />
      }

      <nz-steps [nzCurrent]="store.step()" nzSize="small" (nzIndexChange)="store.goTo($event)" class="section">
        @for (step of steps; track step) {
          <nz-step [nzTitle]="'intercompany.run.step.' + step | translate" />
        }
      </nz-steps>

      @switch (store.step()) {
        @case (0) {
          <nz-card [nzTitle]="'intercompany.run.step.scope' | translate">
            <p class="muted">{{ 'intercompany.run.scopeHint' | translate }}</p>
            @if (store.scope(); as scope) {
              <nz-alert
                [nzType]="scope.ready ? 'success' : 'warning'"
                nzShowIcon
                [nzMessage]="(scope.ready ? 'intercompany.run.scopeReady' : 'intercompany.run.scopeNotReady') | translate"
              />
              <nz-table #checks nzSize="small" [nzData]="scope.checks" [nzShowPagination]="false">
                <thead>
                  <tr>
                    <th>{{ 'intercompany.run.check' | translate }}</th>
                    <th>{{ 'intercompany.structure.entity' | translate }}</th>
                    <th>{{ 'intercompany.common.status' | translate }}</th>
                    <th>{{ 'intercompany.run.detail' | translate }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (check of checks.data; track $index) {
                    <tr>
                      <td>{{ 'intercompany.run.checks.' + check.code | translate }}</td>
                      <td>{{ ctx.memberName(check.entity_tenant_id) }}</td>
                      <td><nz-tag [nzColor]="check.passed ? 'green' : 'red'">{{ (check.passed ? 'intercompany.run.passed' : 'intercompany.run.failed') | translate }}</nz-tag></td>
                      <td>{{ check.detail ?? '' }}</td>
                    </tr>
                  }
                </tbody>
              </nz-table>
            }
            <div class="toolbar">
              <button nz-button type="button" (click)="store.revalidateScope(runId())">{{ 'intercompany.run.revalidate' | translate }}</button>
              @if (canWrite && store.canAdvanceTo()('calculating')) {
                <button nz-button nzType="primary" type="button" [disabled]="!store.scope()?.ready" [nzLoading]="store.busy()" (click)="advance('calculating')">
                  {{ 'intercompany.run.advanceCalculating' | translate }}
                </button>
              }
              <button nz-button type="button" (click)="store.goTo(1)">{{ 'intercompany.common.next' | translate }}</button>
            </div>
          </nz-card>
        }
        @case (1) {
          <nz-card [nzTitle]="'intercompany.run.step.translation' | translate">
            @if (ctx.run(); as run) {
              <nz-table #members nzSize="small" [nzData]="run.members" [nzShowPagination]="false" [nzScroll]="{ x: '760px' }">
                <thead>
                  <tr>
                    <th>{{ 'intercompany.structure.entity' | translate }}</th>
                    <th>{{ 'intercompany.structure.currency' | translate }}</th>
                    <th>{{ 'intercompany.structure.method' | translate }}</th>
                    <th class="num">{{ 'intercompany.run.effectiveOwnership' | translate }} %</th>
                    <th class="num">{{ 'intercompany.run.share' | translate }} %</th>
                    <th class="num">{{ enumKey('rateType', 'closing') | translate }}</th>
                    <th class="num">{{ enumKey('rateType', 'average') | translate }}</th>
                    <th class="num">{{ enumKey('rateType', 'historical') | translate }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (member of members.data; track member.tenant_id) {
                    <tr>
                      <td>{{ member.name }}</td>
                      <td>{{ member.currency }}</td>
                      <td>{{ enumKey('consolidationMethod', member.consolidation_method) | translate }}</td>
                      <td class="num">{{ member.effective_ownership }}</td>
                      <td class="num">{{ member.consolidation_share }}</td>
                      <td class="num">{{ rateOf(member.tenant_id, 'closing') }}</td>
                      <td class="num">{{ rateOf(member.tenant_id, 'average') }}</td>
                      <td class="num">{{ rateOf(member.tenant_id, 'historical') }}</td>
                    </tr>
                  }
                </tbody>
              </nz-table>
              @for (warning of run.warnings; track $index) {
                <nz-alert nzType="warning" nzShowIcon [nzMessage]="warning.message" />
              }
            }
            @if (store.nci(); as nci) {
              <h4>{{ 'intercompany.run.nciBreakdown' | translate }}</h4>
              <nz-table #nciRows nzSize="small" [nzData]="nci.rows" [nzShowPagination]="false" [nzScroll]="{ x: '720px' }">
                <thead>
                  <tr>
                    <th>{{ 'intercompany.structure.entity' | translate }}</th>
                    <th class="num">NCI %</th>
                    <th class="num">{{ 'intercompany.run.nciNetAssets' | translate }}</th>
                    <th class="num">{{ 'intercompany.run.nciProfit' | translate }}</th>
                    <th class="num">{{ 'intercompany.run.nciMovement' | translate }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of nciRows.data; track row.member_tenant_id) {
                    <tr>
                      <td>{{ row.name }}</td>
                      <td class="num">{{ row.nci_percentage }}</td>
                      <td class="num">{{ row.nci_net_assets | money: nci.currency }}</td>
                      <td class="num">{{ row.nci_profit | money: nci.currency }}</td>
                      <td class="num">{{ row.nci_movement | money: nci.currency }}</td>
                    </tr>
                  }
                  <tr class="total-row">
                    <td>{{ 'intercompany.common.total' | translate }}</td>
                    <td></td>
                    <td class="num">{{ nci.total_nci_net_assets | money: nci.currency }}</td>
                    <td class="num">{{ nci.total_nci_profit | money: nci.currency }}</td>
                    <td></td>
                  </tr>
                </tbody>
              </nz-table>
            }
            <div class="toolbar">
              <button nz-button type="button" (click)="store.goTo(0)">{{ 'intercompany.common.back' | translate }}</button>
              <button nz-button type="button" (click)="store.goTo(2)">{{ 'intercompany.common.next' | translate }}</button>
            </div>
          </nz-card>
        }
        @case (2) {
          <nz-card [nzTitle]="'intercompany.run.step.eliminations' | translate">
            <div class="toolbar">
              <label for="ic-elim-type">{{ 'intercompany.run.eliminationType' | translate }}</label>
              <nz-select id="ic-elim-type" class="select-md" nzAllowClear [ngModel]="store.ledgerType() || null" (ngModelChange)="filterLedger($event)">
                @for (type of eliminationTypes; track type) {
                  <nz-option [nzValue]="type" [nzLabel]="enumKey('eliminationType', type) | translate" />
                }
              </nz-select>
            </div>
            @if (store.ledger(); as ledger) {
              <nz-table #totals nzSize="small" [nzData]="totalsOf(ledger.totals_by_type)" [nzShowPagination]="false">
                <thead>
                  <tr>
                    <th>{{ 'intercompany.run.eliminationType' | translate }}</th>
                    <th class="num">{{ 'intercompany.run.amount' | translate }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (entry of totals.data; track entry[0]) {
                    <tr>
                      <td>{{ enumKey('eliminationType', entry[0]) | translate }}</td>
                      <td class="num">{{ entry[1] | money: ledger.currency }}</td>
                    </tr>
                  }
                </tbody>
              </nz-table>
              <nz-collapse>
                @for (entry of ledger.entries; track entry.adjustment_id) {
                  <nz-collapse-panel [nzHeader]="entryHeader(entry)">
                    <nz-table #lines nzSize="small" [nzData]="entry.lines" [nzShowPagination]="false" [nzScroll]="{ x: '820px' }">
                      <thead>
                        <tr>
                          <th>{{ 'intercompany.run.account' | translate }}</th>
                          <th>{{ 'intercompany.structure.entity' | translate }}</th>
                          <th class="num">{{ 'intercompany.run.debit' | translate }}</th>
                          <th class="num">{{ 'intercompany.run.credit' | translate }}</th>
                          <th class="num">{{ 'intercompany.run.preElimination' | translate }}</th>
                          <th class="num">{{ 'intercompany.run.postElimination' | translate }}</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (line of lines.data; track line.line_number) {
                          <tr>
                            <td>{{ line.account_code }} {{ line.account_name }}</td>
                            <td>{{ ctx.memberName(line.entity_tenant_id) }}</td>
                            <td class="num">{{ line.debit | money: ledger.currency }}</td>
                            <td class="num">{{ line.credit | money: ledger.currency }}</td>
                            <td class="num">{{ line.pre_elimination_amount | money: ledger.currency }}</td>
                            <td class="num">{{ line.post_elimination_amount | money: ledger.currency }}</td>
                          </tr>
                        }
                      </tbody>
                    </nz-table>
                  </nz-collapse-panel>
                } @empty {
                  <p class="muted">{{ 'intercompany.run.noEliminations' | translate }}</p>
                }
              </nz-collapse>
            }
            <div class="toolbar">
              <button nz-button type="button" (click)="store.goTo(1)">{{ 'intercompany.common.back' | translate }}</button>
              @if (canWrite && store.canAdvanceTo()('review')) {
                <button nz-button nzType="primary" type="button" [nzLoading]="store.busy()" (click)="advance('review')">
                  {{ 'intercompany.run.advanceReview' | translate }}
                </button>
              }
              <button nz-button type="button" (click)="store.goTo(3)">{{ 'intercompany.common.next' | translate }}</button>
            </div>
          </nz-card>
        }
        @case (3) {
          <nz-card [nzTitle]="'intercompany.run.step.review' | translate">
            @if (ctx.run(); as run) {
              <div class="kpis">
                <nz-card nzSize="small"><strong>{{ run.totals.adjustment_count ?? 0 }}</strong><br />{{ 'intercompany.run.adjustments' | translate }}</nz-card>
                <nz-card nzSize="small"><strong>{{ run.totals.warning_count ?? 0 }}</strong><br />{{ 'intercompany.run.warnings' | translate }}</nz-card>
                <nz-card nzSize="small">
                  <nz-tag [nzColor]="run.totals.balance_sheet_is_balanced ? 'green' : 'red'">
                    {{ (run.totals.balance_sheet_is_balanced ? 'intercompany.run.balanced' : 'intercompany.run.unbalanced') | translate }}
                  </nz-tag>
                </nz-card>
              </div>
            }
            @if (store.failedChecks().length > 0) {
              <nz-alert nzType="warning" nzShowIcon [nzMessage]="'intercompany.run.scopeNotReady' | translate" />
            }
            <div class="toolbar">
              <button nz-button type="button" (click)="store.goTo(2)">{{ 'intercompany.common.back' | translate }}</button>
              <button nz-button type="button" (click)="store.goTo(4)">{{ 'intercompany.common.next' | translate }}</button>
            </div>
          </nz-card>
        }
        @default {
          <nz-card [nzTitle]="'intercompany.run.step.close' | translate">
            <div class="toolbar">
              @if (canWrite) {
                @if (store.canAdvanceTo()('locked')) {
                  <button nz-button nzType="primary" type="button" [nzLoading]="store.busy()" (click)="advance('locked')">{{ 'intercompany.run.lock' | translate }}</button>
                }
                @if (store.canAdvanceTo()('posted')) {
                  <button nz-button type="button" [nzLoading]="store.busy()" (click)="advance('posted')">{{ 'intercompany.run.post' | translate }}</button>
                }
                @if (store.closed()) {
                  <button nz-button nzDanger type="button" (click)="reopenOpen.set(true)">{{ 'intercompany.run.reopen' | translate }}</button>
                }
              }
            </div>
            <h4>{{ 'intercompany.run.history' | translate }}</h4>
            <nz-timeline>
              @for (entry of store.history(); track entry.id) {
                <nz-timeline-item>
                  {{ entry.created_at }}:
                  {{ entry.from_status ? (enumKey('runStatus', entry.from_status) | translate) : '-' }} →
                  {{ enumKey('runStatus', entry.to_status) | translate }}
                  ({{ 'intercompany.run.action.' + entry.action | translate }})
                  @if (entry.reason) {
                    <br /><span class="muted">{{ entry.reason }}</span>
                  }
                </nz-timeline-item>
              } @empty {
                <p class="muted">{{ 'intercompany.run.noHistory' | translate }}</p>
              }
            </nz-timeline>
            <div class="toolbar">
              <button nz-button type="button" (click)="store.goTo(3)">{{ 'intercompany.common.back' | translate }}</button>
            </div>
          </nz-card>
        }
      }
    }

    <app-intercompany-reason-dialog [(open)]="reopenOpen" titleKey="intercompany.run.reopen" [minLength]="10" (confirmed)="reopen($event.reason)" />
  `,
})
export class IntercompanyRunComponent implements OnInit {
  protected readonly ctx = inject(IntercompanyContextStore);
  protected readonly store = inject(IntercompanyRunStore);
  protected readonly periods = inject(GlConsolidationPeriodStore);
  private readonly notifier = inject(IntercompanyNotifier);
  protected readonly canWrite = inject(PermissionsService).canWrite(IC_MODULE);

  protected readonly enumKey = enumKey;
  protected readonly steps = IC_RUN_STEPS;
  protected readonly eliminationTypes = IC_ELIMINATION_TYPES;
  protected readonly statusColor = runStatusColor;
  protected readonly periodId = signal<string | null>(null);
  protected readonly reopenOpen = signal(false);

  constructor() {
    effect(() => {
      const runId = this.ctx.runId();
      if (runId !== null) {
        untracked(() => void this.store.load(runId));
      }
    });
  }

  ngOnInit(): void {
    this.periods.load();
  }

  protected runId(): string {
    return this.ctx.runId() ?? '';
  }

  protected rateOf(tenantId: string, type: 'closing' | 'average' | 'historical'): string {
    return this.ctx.run()?.rates.find((rate) => rate.tenant_id === tenantId)?.[type] ?? '-';
  }

  protected totalsOf(totals: Partial<Record<string, string>>): [string, string][] {
    return Object.entries(totals).filter((entry): entry is [string, string] => entry[1] !== undefined && isNonZero(entry[1]));
  }

  protected entryHeader(entry: IcEliminationEntry): string {
    return `${entry.description} (${entry.elimination_type})`;
  }

  protected filterLedger(type: string | null): void {
    void this.store.filterLedger(this.runId(), type ?? '');
  }

  protected async start(): Promise<void> {
    const groupId = this.ctx.groupId();
    const periodId = this.periodId();
    if (groupId === null || periodId === null) {
      return;
    }
    const result = await this.store.startRun(groupId, periodId);
    if (this.notifier.report(result, 'intercompany.run.started')) {
      await this.ctx.refreshRuns();
      this.ctx.selectRun(result.run?.id ?? null);
    }
  }

  protected async advance(to: 'calculating' | 'review' | 'locked' | 'posted'): Promise<void> {
    if (this.notifier.report(await this.store.advance(this.runId(), to), 'intercompany.run.advanced')) {
      await this.ctx.refreshRuns();
    }
  }

  protected async reopen(reason: string): Promise<void> {
    if (this.notifier.report(await this.store.reopen(this.runId(), reason), 'intercompany.run.reopened')) {
      await this.ctx.refreshRuns();
    }
  }
}
