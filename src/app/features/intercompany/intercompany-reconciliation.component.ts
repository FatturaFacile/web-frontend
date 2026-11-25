import { Component, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { IcAnomalyType, IcMatchStatus, IcMatrixCell, IcReconciliationItem, PermissionsService } from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';
import { IntercompanyContextStore } from './intercompany-context.store';
import { IntercompanyNotifier } from './intercompany-notifier.service';
import { IntercompanyReasonDialogComponent } from './intercompany-reason-dialog.component';
import { IntercompanyReconciliationStore } from './intercompany-reconciliation.store';
import {
  anomalyColor,
  anomalyTotal,
  enumKey,
  IC_ANOMALY_FILTERS,
  IC_MATCH_STATUSES,
  IC_MODULE,
  isNonZero,
  matchStatusColor,
} from './intercompany.util';

type Resolution = 'dispute' | 'write_off' | 'adjust';

/** Reciprocal reconciliation: the quadrature matrix of every pair of entities, the automatic match and the manual resolutions. */
@Component({
  selector: 'app-intercompany-reconciliation',
  styleUrl: './intercompany.scss',
  providers: [IntercompanyReconciliationStore],
  imports: [
    FormsModule,
    NzButtonModule,
    NzCardModule,
    NzInputModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    IntercompanyReasonDialogComponent,
    MoneyPipe,
    TranslatePipe,
  ],
  template: `
    <div class="toolbar">
      <label for="ic-rec-date">{{ 'intercompany.reconciliation.asOf' | translate }}</label>
      <input id="ic-rec-date" nz-input type="date" class="select-sm" [ngModel]="asOf()" (ngModelChange)="asOf.set($event)" />
      @if (canWrite) {
        <button nz-button nzType="primary" type="button" [disabled]="!asOf()" [nzLoading]="store.loading()" (click)="run(true)">
          {{ 'intercompany.reconciliation.runMatch' | translate }}
        </button>
        <button nz-button type="button" [disabled]="!asOf()" (click)="run(false)">{{ 'intercompany.reconciliation.runWithoutMatch' | translate }}</button>
      }
      <span class="spacer"></span>
      @if (store.batches().length > 1) {
        <label for="ic-rec-batch">{{ 'intercompany.reconciliation.batch' | translate }}</label>
        <nz-select id="ic-rec-batch" class="select-md" [ngModel]="store.batch()?.id" (ngModelChange)="store.openBatch($event)">
          @for (batch of store.batches(); track batch.id) {
            <nz-option [nzValue]="batch.id" [nzLabel]="batch.as_of_date + ' (' + batch.totals.items + ')'" />
          }
        </nz-select>
      }
    </div>

    @if (store.error(); as key) {
      <p class="muted">{{ key | translate }}</p>
    }

    @if (store.batch(); as batch) {
      <div class="kpis">
        <nz-card nzSize="small"><strong>{{ batch.totals.items }}</strong><br />{{ 'intercompany.reconciliation.kpiItems' | translate }}</nz-card>
        <nz-card nzSize="small"><strong>{{ batch.totals.matched }}</strong><br />{{ 'intercompany.enum.matchStatus.matched' | translate }}</nz-card>
        <nz-card nzSize="small"><strong>{{ batch.totals.unmatched }}</strong><br />{{ 'intercompany.enum.matchStatus.unmatched' | translate }}</nz-card>
        <nz-card nzSize="small"><strong>{{ batch.totals.disputed }}</strong><br />{{ 'intercompany.enum.matchStatus.disputed' | translate }}</nz-card>
        @for (anomaly of anomalies; track anomaly) {
          <nz-card nzSize="small">
            <strong>{{ batch.totals.difference_by_anomaly[anomaly] | money: ctx.groupCurrency() }}</strong><br />
            {{ enumKey('anomalyType', anomaly) | translate }}
          </nz-card>
        }
      </div>
    }

    @if (store.matrix(); as matrix) {
      <nz-card [nzTitle]="'intercompany.reconciliation.matrix' | translate" class="section">
        <p class="muted">{{ 'intercompany.reconciliation.matrixHint' | translate }} ({{ matrix.currency }}, {{ matrix.as_of_date }})</p>
        <div style="overflow-x: auto">
          <table class="matrix">
            <caption class="muted">{{ 'intercompany.reconciliation.matrixCaption' | translate }}</caption>
            <thead>
              <tr>
                <th scope="col">{{ 'intercompany.reconciliation.entityA' | translate }} \\ {{ 'intercompany.reconciliation.entityB' | translate }}</th>
                @for (entity of matrix.entities; track entity.tenant_id) {
                  <th scope="col">{{ entity.name }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (rowEntity of matrix.entities; track rowEntity.tenant_id) {
                <tr>
                  <th scope="row">{{ rowEntity.name }}</th>
                  @for (colEntity of matrix.entities; track colEntity.tenant_id) {
                    @if (rowEntity.tenant_id === colEntity.tenant_id) {
                      <td class="self">-</td>
                    } @else {
                      @if (store.cellOf()(rowEntity.tenant_id, colEntity.tenant_id); as cell) {
                        <td>
                          <button
                            type="button"
                            class="cell"
                            [class.cell-diff]="cell.status === 'difference'"
                            [class.cell-selected]="isSelected(cell)"
                            [attr.aria-pressed]="isSelected(cell)"
                            (click)="drill(cell)"
                          >
                            <span>{{ cell.receivable_a | money: matrix.currency }} / {{ cell.payable_b | money: matrix.currency }}</span><br />
                            <strong>{{ cell.difference | money: matrix.currency }}</strong>
                            @if (anomalyCount(cell) > 0) {
                              <br /><nz-tag nzColor="orange">{{ anomalyCount(cell) }}</nz-tag>
                            }
                          </button>
                        </td>
                      } @else {
                        <td>-</td>
                      }
                    }
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      </nz-card>

      <div class="toolbar">
        <label for="ic-rec-anomaly">{{ 'intercompany.reconciliation.anomaly' | translate }}</label>
        <nz-select id="ic-rec-anomaly" class="select-sm" nzAllowClear [ngModel]="store.filters().anomaly_type" (ngModelChange)="filter({ anomaly_type: $event })">
          @for (anomaly of anomalies; track anomaly) {
            <nz-option [nzValue]="anomaly" [nzLabel]="enumKey('anomalyType', anomaly) | translate" />
          }
        </nz-select>
        <label for="ic-rec-status">{{ 'intercompany.reconciliation.status' | translate }}</label>
        <nz-select id="ic-rec-status" class="select-sm" nzAllowClear [ngModel]="store.filters().status" (ngModelChange)="filter({ status: $event })">
          @for (status of statuses; track status) {
            <nz-option [nzValue]="status" [nzLabel]="enumKey('matchStatus', status) | translate" />
          }
        </nz-select>
        @if (store.cell()) {
          <button nz-button nzSize="small" type="button" (click)="store.drillDown(null)">{{ 'intercompany.reconciliation.clearCell' | translate }}</button>
        }
      </div>

      <nz-table #table nzSize="small" [nzData]="store.items()" [nzLoading]="store.loading()" [nzScroll]="{ x: '1240px' }" [nzPageSize]="20">
        <thead>
          <tr>
            <th>{{ 'intercompany.reconciliation.documentA' | translate }}</th>
            <th class="num">{{ 'intercompany.reconciliation.amountA' | translate }}</th>
            <th>{{ 'intercompany.reconciliation.documentB' | translate }}</th>
            <th class="num">{{ 'intercompany.reconciliation.amountB' | translate }}</th>
            <th class="num">{{ 'intercompany.reconciliation.difference' | translate }}</th>
            <th>{{ 'intercompany.reconciliation.anomaly' | translate }}</th>
            <th>{{ 'intercompany.reconciliation.status' | translate }}</th>
            <th>{{ 'intercompany.common.actions' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (item of table.data; track item.id) {
            <tr>
              <td>
                {{ item.entity_a_name }}<br />{{ item.a_document_number }}<br /><span class="muted">{{ item.a_document_date }}</span>
              </td>
              <td class="num">{{ item.a_amount | money: item.a_currency }}</td>
              <td>
                {{ item.entity_b_name }}<br />{{ item.b_document_number ?? '-' }}
                @if (item.b_document_date) {
                  <br /><span class="muted">{{ item.b_document_date }}</span>
                }
              </td>
              <td class="num">{{ item.b_amount ? (item.b_amount | money: item.b_currency) : '-' }}</td>
              <td class="num">
                {{ item.difference | money: item.a_currency }}
                @if (hasDifference(item)) {
                  <br /><span class="muted">{{ item.difference_group_currency | money: ctx.groupCurrency() }}</span>
                }
              </td>
              <td>
                <nz-tag [nzColor]="anomalyColor(item.anomaly_type)">{{ enumKey('anomalyType', item.anomaly_type) | translate }}</nz-tag>
                @if (item.anomaly_reason) {
                  <br /><span class="muted">{{ item.anomaly_reason }}</span>
                }
              </td>
              <td>
                <nz-tag [nzColor]="statusColor(item.status)">{{ enumKey('matchStatus', item.status) | translate }}</nz-tag>
                @if (item.match_kind) {
                  <br /><span class="muted">{{ 'intercompany.reconciliation.matchKind.' + item.match_kind | translate }}</span>
                }
                @if (item.resolution_reason) {
                  <br /><span class="muted">{{ item.resolution_reason }}</span>
                }
              </td>
              <td>
                @if (canWrite) {
                  @if (item.status === 'unmatched') {
                    <button nz-button nzSize="small" type="button" (click)="askMatch(item)">{{ 'intercompany.reconciliation.match' | translate }}</button>
                    <button nz-button nzSize="small" type="button" (click)="askResolve(item, 'dispute')">{{ 'intercompany.reconciliation.dispute' | translate }}</button>
                    <button nz-button nzSize="small" type="button" (click)="askResolve(item, 'adjust')">{{ 'intercompany.reconciliation.adjust' | translate }}</button>
                    <button nz-button nzSize="small" nzDanger type="button" (click)="askResolve(item, 'write_off')">{{ 'intercompany.reconciliation.writeOff' | translate }}</button>
                  } @else if (item.status === 'disputed') {
                    <button nz-button nzSize="small" type="button" (click)="askResolve(item, 'adjust')">{{ 'intercompany.reconciliation.adjust' | translate }}</button>
                    <button nz-button nzSize="small" nzDanger type="button" (click)="askResolve(item, 'write_off')">{{ 'intercompany.reconciliation.writeOff' | translate }}</button>
                    <button nz-button nzSize="small" type="button" (click)="unmatch(item)">{{ 'intercompany.reconciliation.unmatch' | translate }}</button>
                  } @else {
                    <button nz-button nzSize="small" type="button" (click)="unmatch(item)">{{ 'intercompany.reconciliation.unmatch' | translate }}</button>
                  }
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    } @else if (!store.loading()) {
      <p class="muted">{{ 'intercompany.reconciliation.empty' | translate }}</p>
    }

    <app-intercompany-reason-dialog
      [(open)]="resolveOpen"
      [titleKey]="'intercompany.reconciliation.' + resolution()"
      [withAmount]="resolution() === 'adjust'"
      (confirmed)="resolve($event)"
    />
    <app-intercompany-reason-dialog [(open)]="matchOpen" titleKey="intercompany.reconciliation.match" fieldLabelKey="intercompany.reconciliation.counterpartDocument" [minLength]="1" (confirmed)="match($event.reason)" />
  `,
})
export class IntercompanyReconciliationComponent {
  protected readonly ctx = inject(IntercompanyContextStore);
  protected readonly store = inject(IntercompanyReconciliationStore);
  private readonly notifier = inject(IntercompanyNotifier);
  protected readonly canWrite = inject(PermissionsService).canWrite(IC_MODULE);

  protected readonly enumKey = enumKey;
  protected readonly anomalyColor = anomalyColor;
  protected readonly statusColor = matchStatusColor;
  protected readonly anomalies = IC_ANOMALY_FILTERS;
  protected readonly statuses: readonly IcMatchStatus[] = IC_MATCH_STATUSES;
  protected readonly asOf = signal(new Date().toISOString().slice(0, 10));
  protected readonly resolveOpen = signal(false);
  protected readonly matchOpen = signal(false);
  protected readonly resolution = signal<Resolution>('dispute');
  private current: IcReconciliationItem | null = null;

  constructor() {
    effect(() => {
      const groupId = this.ctx.groupId();
      if (groupId !== null) {
        untracked(() => void this.store.load(groupId));
      }
    });
  }

  protected anomalyCount(cell: IcMatrixCell): number {
    return anomalyTotal(cell.anomaly_counts);
  }

  protected hasDifference(item: IcReconciliationItem): boolean {
    return isNonZero(item.difference);
  }

  protected isSelected(cell: IcMatrixCell): boolean {
    const selected = this.store.cell();
    return selected?.entity_a_tenant_id === cell.entity_a_tenant_id && selected?.entity_b_tenant_id === cell.entity_b_tenant_id;
  }

  protected drill(cell: IcMatrixCell): void {
    void this.store.drillDown(this.isSelected(cell) ? null : cell);
  }

  protected filter(change: { anomaly_type?: IcAnomalyType | null; status?: IcMatchStatus | null }): void {
    const cleaned = Object.fromEntries(Object.entries(change).map(([key, value]) => [key, value ?? undefined]));
    void this.store.applyFilters({ ...this.store.filters(), ...cleaned });
  }

  protected async run(autoMatch: boolean): Promise<void> {
    const groupId = this.ctx.groupId();
    if (groupId !== null) {
      this.notifier.report(await this.store.runBatch(groupId, this.asOf(), autoMatch), 'intercompany.reconciliation.batchDone');
    }
  }

  protected askMatch(item: IcReconciliationItem): void {
    this.current = item;
    this.matchOpen.set(true);
  }

  /** The text field of the dialog carries the id of the counterpart document for a manual match. */
  protected async match(counterpartDocumentId: string): Promise<void> {
    if (this.current !== null) {
      this.notifier.report(await this.store.match(this.current, counterpartDocumentId), 'intercompany.reconciliation.matched');
    }
  }

  protected async unmatch(item: IcReconciliationItem): Promise<void> {
    this.notifier.report(await this.store.unmatch(item));
  }

  protected askResolve(item: IcReconciliationItem, resolution: Resolution): void {
    this.current = item;
    this.resolution.set(resolution);
    this.resolveOpen.set(true);
  }

  protected async resolve(input: { reason: string; amount: string }): Promise<void> {
    const item = this.current;
    if (item === null) {
      return;
    }
    switch (this.resolution()) {
      case 'dispute':
        this.notifier.report(await this.store.dispute(item, input.reason));
        break;
      case 'write_off':
        this.notifier.report(await this.store.writeOff(item, input.reason));
        break;
      default:
        this.notifier.report(await this.store.adjust(item, input.reason, input.amount));
    }
  }
}
