import { DecimalPipe } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { InvoiceMatchRun } from '@domain/procurement/invoice-matching.models';
import { DocumentFlowDrawerComponent } from '../srm/document-flow-drawer.component';
import { DateFormatPipe, MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { InvoiceMatchGrIrComponent } from './invoice-match-gr-ir.component';
import { InvoiceMatchLinesTableComponent } from './invoice-match-lines-table.component';
import { InvoiceMatchResolutionActionsComponent } from './invoice-match-resolution-actions.component';
import {
  actionKey,
  describeTolerance,
  matchStatusColor,
  matchStatusKey,
  matchTypeKey,
  reasonKey,
  sourceKey,
  triggerKey,
} from './invoice-matching.helpers';
import { InvoiceMatchingStore } from './invoice-matching.store';

const TAB_LINES = 0;
const TAB_GR_IR = 2;
const TAB_HISTORY = 3;

/** Detail of one matching run: header summary, line comparison, resolution history, GR/IR and run history. */
@Component({
  selector: 'app-invoice-match-detail-page',
  providers: [InvoiceMatchingStore],
  imports: [
    DateFormatPipe,
    DecimalPipe,
    DocumentFlowDrawerComponent,
    InvoiceMatchGrIrComponent,
    InvoiceMatchLinesTableComponent,
    InvoiceMatchResolutionActionsComponent,
    MoneyPipe,
    PageHeaderComponent,
    RouterLink,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzDescriptionsModule,
    NzEmptyModule,
    NzSpinModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
  ],
  template: `
    <app-page-header
      [title]="'PAGE_TITLE.PROCUREMENT_INVOICE_MATCHING_DETAIL' | translate"
      [subtitle]="'invoiceMatching.page.detailSubtitle' | translate"
    >
      <a nz-button routerLink="/procurement/invoice-matching">{{
        'invoiceMatching.page.backToWorkbench' | translate
      }}</a>
      @if (store.detail(); as flowRun) {
        <app-document-flow-drawer
          type="supplier_invoice"
          [documentId]="flowRun.passive_invoice_id"
        />
      }
    </app-page-header>

    @if (store.failed()) {
      <nz-alert
        nzType="error"
        nzShowIcon
        [nzMessage]="store.error() || ('invoiceMatching.message.loadError' | translate)"
      />
    }

    <nz-spin [nzSpinning]="store.loading()">
      @if (store.detail(); as run) {
        <nz-descriptions nzBordered nzSize="small" [nzColumn]="3" data-testid="detail-header">
          <nz-descriptions-item [nzTitle]="'invoiceMatching.field.invoice' | translate">
            {{ run.invoice_number ?? '-' }}
            <small>{{ run.invoice_date | appDate }}</small>
          </nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'invoiceMatching.field.supplier' | translate">
            {{ run.supplier_name ?? '-' }}
          </nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'invoiceMatching.field.purchaseOrder' | translate">
            {{ run.po_number ?? '-' }}
          </nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'invoiceMatching.field.matchType' | translate">
            {{ typeKey(run.match_type) | translate }}
          </nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'invoiceMatching.field.status' | translate">
            <nz-tag [nzColor]="color(run)" data-testid="detail-status">{{
              statusKey(run.status) | translate
            }}</nz-tag>
          </nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'invoiceMatching.field.trigger' | translate">
            {{ triggerText(run.trigger) | translate }}
          </nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'invoiceMatching.field.referenceSource' | translate">
            {{ sourceText(run.reference_source) | translate }}
          </nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'invoiceMatching.field.referenceValue' | translate">
            {{ run.reference_value ?? '-' }}
          </nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'invoiceMatching.field.invoiceTotal' | translate">
            {{ run.invoice_total_amount | money: run.currency }}
          </nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'invoiceMatching.field.orderedTotal' | translate">
            {{ run.ordered_total | money: run.currency }}
          </nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'invoiceMatching.field.receivedTotal' | translate">
            {{ run.received_total | money: run.currency }}
          </nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'invoiceMatching.field.invoicedTotal' | translate">
            {{ run.invoiced_total | money: run.currency }}
          </nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'invoiceMatching.field.variance' | translate">
            {{ run.variance_amount | money: run.currency }}
          </nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'invoiceMatching.field.variancePercent' | translate">
            {{ run.variance_percent | number: '1.0-2' }}%
          </nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'invoiceMatching.field.evaluatedAt' | translate">
            {{ run.evaluated_at | appDate }}
          </nz-descriptions-item>
          <nz-descriptions-item
            [nzTitle]="'invoiceMatching.field.reasons' | translate"
            [nzSpan]="2"
          >
            @for (reason of run.reasons; track reason) {
              <nz-tag>{{ reasonText(reason) | translate }}</nz-tag>
            }
          </nz-descriptions-item>
          <nz-descriptions-item
            [nzTitle]="'invoiceMatching.field.tolerance' | translate"
            [nzSpan]="3"
          >
            @for (item of tolerance(run); track $index) {
              <div class="tolerance" data-testid="tolerance-item">
                @for (part of item; track part.labelKey) {
                  <span
                    >{{ part.labelKey | translate }}:
                    {{ part.valueKey ? (part.valueKey | translate) : part.value }}
                  </span>
                }
              </div>
            } @empty {
              {{ 'invoiceMatching.field.noTolerance' | translate }}
            }
          </nz-descriptions-item>
        </nz-descriptions>

        <app-invoice-match-resolution-actions [run]="run" (resolved)="onResolved($event)" />

        <nz-tabs
          [nzSelectedIndex]="tab()"
          (nzSelectedIndexChange)="onTab($event)"
          data-testid="detail-tabs"
        >
          <nz-tab [nzTitle]="'invoiceMatching.tab.lines' | translate">
            <app-invoice-match-lines-table [lines]="run.lines ?? []" [currency]="run.currency" />
          </nz-tab>

          <nz-tab [nzTitle]="'invoiceMatching.tab.resolutions' | translate">
            <nz-table
              #resolutions
              nzSize="small"
              [nzData]="run.resolutions ?? []"
              [nzShowPagination]="false"
              [nzPageSize]="1000"
              [nzNoResult]="noResolutions"
              data-testid="resolutions-table"
            >
              <thead>
                <tr>
                  <th>{{ 'invoiceMatching.column.action' | translate }}</th>
                  <th>{{ 'invoiceMatching.column.fromStatus' | translate }}</th>
                  <th>{{ 'invoiceMatching.column.toStatus' | translate }}</th>
                  <th>{{ 'invoiceMatching.column.reason' | translate }}</th>
                  <th>{{ 'invoiceMatching.column.actor' | translate }}</th>
                  <th>{{ 'invoiceMatching.column.resolvedAt' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (row of resolutions.data; track row.id) {
                  <tr>
                    <td>{{ actionText(row.action) | translate }}</td>
                    <td>
                      @if (row.from_status) {
                        <nz-tag [nzColor]="statusColor(row.from_status)">{{
                          statusKey(row.from_status) | translate
                        }}</nz-tag>
                      }
                    </td>
                    <td>
                      @if (row.to_status) {
                        <nz-tag [nzColor]="statusColor(row.to_status)">{{
                          statusKey(row.to_status) | translate
                        }}</nz-tag>
                      }
                    </td>
                    <td>{{ row.reason ?? '-' }}</td>
                    <td>{{ row.actor_name ?? '-' }}</td>
                    <td>{{ row.resolved_at | appDate }}</td>
                  </tr>
                }
              </tbody>
            </nz-table>
            <ng-template #noResolutions>
              <nz-empty [nzNotFoundContent]="'invoiceMatching.message.noResolutions' | translate" />
            </ng-template>
          </nz-tab>

          <nz-tab [nzTitle]="'invoiceMatching.tab.grIr' | translate">
            <app-invoice-match-gr-ir [data]="store.grIr()" />
          </nz-tab>

          <nz-tab [nzTitle]="'invoiceMatching.tab.history' | translate">
            <nz-table
              #history
              nzSize="small"
              [nzData]="store.history()"
              [nzShowPagination]="false"
              [nzPageSize]="1000"
              [nzNoResult]="noHistory"
              data-testid="history-table"
            >
              <thead>
                <tr>
                  <th>{{ 'invoiceMatching.column.evaluatedAt' | translate }}</th>
                  <th>{{ 'invoiceMatching.column.trigger' | translate }}</th>
                  <th>{{ 'invoiceMatching.column.status' | translate }}</th>
                  <th>{{ 'invoiceMatching.column.reasons' | translate }}</th>
                  <th class="num">{{ 'invoiceMatching.column.variance' | translate }}</th>
                  <th>{{ 'invoiceMatching.column.current' | translate }}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (row of history.data; track row.id) {
                  <tr>
                    <td>{{ row.evaluated_at | appDate }}</td>
                    <td>{{ triggerText(row.trigger) | translate }}</td>
                    <td>
                      <nz-tag [nzColor]="color(row)">{{
                        statusKey(row.status) | translate
                      }}</nz-tag>
                    </td>
                    <td>
                      @for (reason of row.reasons; track reason) {
                        <nz-tag>{{ reasonText(reason) | translate }}</nz-tag>
                      }
                    </td>
                    <td class="num">{{ row.variance_amount | money: row.currency }}</td>
                    <td>
                      @if (row.is_current) {
                        <nz-tag nzColor="green">{{
                          'invoiceMatching.column.current' | translate
                        }}</nz-tag>
                      }
                    </td>
                    <td>
                      @if (row.id !== run.id) {
                        <a
                          nz-button
                          nzSize="small"
                          [routerLink]="['/procurement/invoice-matching', row.id]"
                          >{{ 'invoiceMatching.button.open' | translate }}</a
                        >
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </nz-table>
            <ng-template #noHistory>
              <nz-empty [nzNotFoundContent]="'invoiceMatching.message.noHistory' | translate" />
            </ng-template>
          </nz-tab>
        </nz-tabs>
      }
    </nz-spin>
  `,
  styles: `
    .tolerance {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    .num {
      text-align: right;
    }
    nz-descriptions {
      margin-bottom: 8px;
    }
  `,
})
export class InvoiceMatchDetailPageComponent implements OnInit {
  protected readonly store = inject(InvoiceMatchingStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly tab = signal(TAB_LINES);
  protected readonly runId = signal<string | null>(null);
  protected readonly statusColor = matchStatusColor;
  protected readonly statusKey = matchStatusKey;
  protected readonly typeKey = matchTypeKey;
  protected readonly reasonText = reasonKey;
  protected readonly sourceText = sourceKey;
  protected readonly triggerText = triggerKey;
  protected readonly actionText = actionKey;
  protected readonly tolerance = (run: InvoiceMatchRun) =>
    describeTolerance(run.tolerance_snapshot);

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('id');
      if (id) {
        void this.open(id);
      }
    });
  }

  protected color(run: Pick<InvoiceMatchRun, 'status'>): string {
    return matchStatusColor(run.status);
  }

  protected onTab(index: number): void {
    this.tab.set(index);
    void this.loadTabData();
  }

  /** The API answered a resolution: a re-match returns a new run, which has its own URL. */
  protected onResolved(run: InvoiceMatchRun): void {
    if (run.id !== this.runId()) {
      void this.router.navigate(['/procurement/invoice-matching', run.id]);
    } else {
      void this.open(run.id);
    }
  }

  private async open(id: string): Promise<void> {
    this.runId.set(id);
    await this.store.loadDetail(id);
    await this.loadTabData();
  }

  private async loadTabData(): Promise<void> {
    const run = this.store.detail();
    if (!run) {
      return;
    }
    if (this.tab() === TAB_GR_IR && this.store.grIr() === null) {
      await this.store.loadGrIr(run.id);
    } else if (this.tab() === TAB_HISTORY && this.store.history().length === 0) {
      await this.store.loadHistory(run.passive_invoice_id);
    }
  }
}
