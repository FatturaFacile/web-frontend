import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { IlrBillingPayload, IlrBillingRun } from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { BillingStore } from './billing.store';
import { IlrOutcome, previousMonthRange } from './industrial-laundry.util';

/** The monthly wash and rental bill: preview, consolidation with its draft invoice (TD24 / QR-bill) and the run history. */
@Component({
  selector: 'app-ilr-billing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MoneyPipe,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
    NzEmptyModule,
    NzInputModule,
    NzSelectModule,
    NzSpinModule,
    NzStatisticModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  providers: [BillingStore],
  styleUrl: './industrial-laundry.scss',
  template: `
    <app-page-header [title]="'PAGE_TITLE.INDUSTRIAL_LAUNDRY_BILLING' | translate"></app-page-header>

    @if (store.error(); as error) {
      <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="error | translate"></nz-alert>
    }
    @if (feedback(); as failure) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        nzCloseable
        [nzMessage]="(failure.errorKey ?? 'industrialLaundry.error.generic') | translate: failure.params"
        [nzDescription]="failure.detail ?? null"
        (nzOnClose)="feedback.set(null)"
      ></nz-alert>
    }

    <nz-card class="main-card" [nzTitle]="'industrialLaundry.section.billingPeriod' | translate">
      <div class="form-grid">
        <label class="field wide" for="ilr-bill-contract">
          <span>{{ 'industrialLaundry.field.contract' | translate }}</span>
          <nz-select id="ilr-bill-contract" nzId="ilr-bill-contract" nzShowSearch [ngModel]="contractId()" (ngModelChange)="contractId.set($event); store.clearPreview()">
            @for (contract of store.contracts(); track contract.id) {
              <nz-option [nzValue]="contract.id" [nzLabel]="contract.code + ' · ' + (contract.customer?.name ?? '')"></nz-option>
            }
          </nz-select>
        </label>
        <label class="field" for="ilr-bill-start">
          <span>{{ 'industrialLaundry.field.periodStart' | translate }}</span>
          <input nz-input id="ilr-bill-start" type="date" [ngModel]="start()" (ngModelChange)="start.set($event); store.clearPreview()" />
        </label>
        <label class="field" for="ilr-bill-end">
          <span>{{ 'industrialLaundry.field.periodEnd' | translate }}</span>
          <input nz-input id="ilr-bill-end" type="date" [ngModel]="end()" (ngModelChange)="end.set($event); store.clearPreview()" />
        </label>
      </div>
      <label nz-checkbox for="ilr-bill-create-inv" nzId="ilr-bill-create-inv" [ngModel]="createInvoice()" (ngModelChange)="createInvoice.set($event)">
        {{ 'industrialLaundry.field.createInvoice' | translate }}
      </label>
      <div class="toolbar">
        <span class="spacer"></span>
        <button nz-button type="button" [disabled]="!ready() || store.saving()" (click)="preview()">{{ 'industrialLaundry.action.preview' | translate }}</button>
        <button nz-button nzType="primary" type="button" [disabled]="!ready() || store.saving()" [nzLoading]="store.saving()" (click)="calculate()">
          {{ 'industrialLaundry.action.calculate' | translate }}
        </button>
      </div>

      @if (store.preview(); as preview) {
        <div class="stats-grid">
          <nz-statistic [nzTitle]="'industrialLaundry.field.pieces' | translate" [nzValue]="preview.washed_pieces"></nz-statistic>
          <nz-statistic [nzTitle]="'industrialLaundry.field.netWeight' | translate" [nzValue]="preview.net_weight_kg + ' kg'"></nz-statistic>
          <nz-statistic [nzTitle]="'industrialLaundry.field.subtotal' | translate" [nzValue]="preview.subtotal | money: currency()"></nz-statistic>
          <nz-statistic [nzTitle]="'industrialLaundry.field.tax' | translate" [nzValue]="preview.tax_amount | money: currency()"></nz-statistic>
          <nz-statistic [nzTitle]="'industrialLaundry.field.total' | translate" [nzValue]="preview.total | money: currency()"></nz-statistic>
        </div>
        <nz-table nzSize="small" [nzData]="preview.lines" [nzShowPagination]="false">
          <thead>
            <tr>
              <th scope="col">{{ 'industrialLaundry.field.line' | translate }}</th>
              <th scope="col" class="num">{{ 'industrialLaundry.field.quantity' | translate }}</th>
              <th scope="col" class="num">{{ 'industrialLaundry.field.unitPrice' | translate }}</th>
              <th scope="col" class="num">{{ 'industrialLaundry.field.amount' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (line of preview.lines; track $index) {
              <tr>
                <th scope="row">
                  {{ 'industrialLaundry.billingLineKind.' + line.kind | translate }}
                  @if (line.article_type) {
                    <span class="hint"> · {{ 'industrialLaundry.articleType.' + line.article_type | translate }}</span>
                  }
                </th>
                <td class="num">{{ line.quantity }} {{ line.uom }}</td>
                <td class="num">{{ line.unit_price | money: currency() }}</td>
                <td class="num">{{ line.amount | money: currency() }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
        <div class="chips">
          @if (preview.document_type) {
            <nz-tag nzColor="purple">{{ 'industrialLaundry.field.documentType' | translate }}: {{ preview.document_type }}</nz-tag>
          }
          @if (preview.compliance.returnable_containers; as containers) {
            <nz-tag>{{ 'industrialLaundry.field.returnableContainers' | translate }}: {{ containers.out }} / {{ containers.back }} / {{ containers.at_customer }}</nz-tag>
          }
          @if (preview.compliance.water_discharge; as water) {
            <nz-tag>{{ 'industrialLaundry.field.waterDischarge' | translate }}: {{ water.discharged_m3 }} m³</nz-tag>
          }
        </div>
      }
    </nz-card>

    <nz-card class="main-card" [nzTitle]="'industrialLaundry.section.billingRuns' | translate">
      <nz-spin [nzSpinning]="store.loading()">
        <nz-table nzSize="small" [nzData]="store.runs()" [nzPageSize]="10">
          <thead>
            <tr>
              <th scope="col">{{ 'industrialLaundry.field.period' | translate }}</th>
              <th scope="col">{{ 'industrialLaundry.field.customer' | translate }}</th>
              <th scope="col">{{ 'industrialLaundry.field.contract' | translate }}</th>
              <th scope="col" class="num">{{ 'industrialLaundry.field.total' | translate }}</th>
              <th scope="col">{{ 'industrialLaundry.field.status' | translate }}</th>
              <th scope="col">{{ 'industrialLaundry.field.invoice' | translate }}</th>
              <th scope="col"></th>
            </tr>
          </thead>
          <tbody>
            @for (run of store.runs(); track run.id) {
              <tr>
                <td>{{ run.period_start }} – {{ run.period_end }}</td>
                <td>{{ run.customer?.name }}</td>
                <td>{{ run.contract_code }}</td>
                <td class="num">{{ run.total | money: run.currency }}</td>
                <td>
                  <nz-tag [nzColor]="run.status === 'invoiced' ? 'green' : 'default'">{{ 'industrialLaundry.billingRunStatus.' + run.status | translate }}</nz-tag>
                </td>
                <td>{{ run.invoice_number }}</td>
                <td>
                  @if (run.status === 'drafted') {
                    <button nz-button nzSize="small" type="button" (click)="invoice(run)">{{ 'industrialLaundry.action.issueInvoice' | translate }}</button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
        @if (store.runs().length === 0 && !store.loading()) {
          <nz-empty [nzNotFoundContent]="'industrialLaundry.empty.billingRuns' | translate"></nz-empty>
        }
      </nz-spin>
    </nz-card>
  `,
})
export class BillingComponent implements OnInit {
  protected readonly store = inject(BillingStore);
  protected readonly feedback = signal<IlrOutcome | null>(null);
  protected readonly contractId = signal<string | null>(null);
  protected readonly start = signal(previousMonthRange().start);
  protected readonly end = signal(previousMonthRange().end);
  protected readonly createInvoice = signal(true);

  protected readonly ready = computed(() => this.contractId() !== null && this.start() !== '' && this.end() !== '' && this.end() >= this.start());
  protected readonly currency = computed(() => this.store.contracts().find((contract) => contract.id === this.contractId())?.currency ?? 'EUR');

  ngOnInit(): void {
    void this.store.init();
  }

  private payload(): IlrBillingPayload {
    return {
      contract_id: this.contractId() ?? '',
      period_start: this.start(),
      period_end: this.end(),
      create_invoice: this.createInvoice(),
    };
  }

  protected async preview(): Promise<void> {
    const outcome = await this.store.previewFor(this.payload());
    this.feedback.set(outcome.ok ? null : outcome);
  }

  protected async calculate(): Promise<void> {
    const outcome = await this.store.calculate(this.payload());
    this.feedback.set(outcome.ok ? null : outcome);
  }

  protected async invoice(run: IlrBillingRun): Promise<void> {
    const outcome = await this.store.invoice(run.id);
    this.feedback.set(outcome.ok ? null : outcome);
  }
}
