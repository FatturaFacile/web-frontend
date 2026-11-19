import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  GeneralLedgerFiscalApiService,
  I18nService,
  LIPE_BOXES,
  PermissionsService,
  SWISS_ZIFFERN,
  SwissBoxRate,
  VatPeriodType,
  VatSettlementCalculation,
  VatSettlementRecord,
  VatSettlementRequest,
  VatSettlementSummary,
} from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';
import { downloadBlob } from '../../accounting/tax/tax-report.utils';

/** A box of the AFC form / LIPE with its amount (or base, rate and tax). */
export interface VatBoxRow {
  code: string;
  amount: string | null;
  rated: SwissBoxRate | null;
}

const MAX_PERIOD: Record<VatPeriodType, number> = { monthly: 12, quarterly: 4, semiannual: 2 };

/** Jurisdiction-aware VAT settlement dashboard: Swiss AFC Ziffern (CH) or Italian LIPE boxes (IT), drill-down, period lock and exports. */
@Component({
  selector: 'app-gl-vat-settlement',
  styleUrl: '../localization/gl-localization.scss',
  imports: [
    FormsModule,
    NgTemplateOutlet,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzInputNumberModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    MoneyPipe,
    TranslatePipe,
  ],
  template: `
    <nz-card [nzTitle]="'GL.VAT_TITLE' | translate">
      <div class="filters">
        <div class="field">
          <span>{{ 'GL.VAT_PERIOD_TYPE' | translate }}</span>
          <nz-select class="select-sm" data-testid="period-type" [ngModel]="periodType()" (ngModelChange)="setPeriodType($event)">
            @for (type of periodTypes; track type) {
              <nz-option [nzValue]="type" [nzLabel]="'GL.VAT_PERIOD_' + type.toUpperCase() | translate" />
            }
          </nz-select>
        </div>
        <div class="field">
          <span>{{ 'GL.VAT_YEAR' | translate }}</span>
          <nz-input-number [nzMin]="2000" [nzMax]="2100" [ngModel]="year()" (ngModelChange)="year.set($event ?? year())" />
        </div>
        <div class="field">
          <span>{{ 'GL.VAT_PERIOD' | translate }}</span>
          <nz-input-number [nzMin]="1" [nzMax]="maxPeriod()" [ngModel]="period()" (ngModelChange)="period.set($event ?? period())" />
        </div>
        <button nz-button nzType="primary" type="button" data-testid="preview" [nzLoading]="previewing()" (click)="preview()">
          {{ 'GL.VAT_PREVIEW' | translate }}
        </button>
        @if (canWrite && calculation() && !lockedRecord()) {
          <button
            nz-button
            type="button"
            data-testid="lock"
            nz-popconfirm
            [nzPopconfirmTitle]="'GL.VAT_LOCK_CONFIRM' | translate"
            [nzLoading]="locking()"
            (nzOnConfirm)="lock()"
          >
            {{ 'GL.VAT_LOCK' | translate }}
          </button>
        }
      </div>

      @if (lockedRecord(); as record) {
        <nz-alert
          class="section"
          nzType="success"
          nzShowIcon
          data-testid="locked-banner"
          [nzMessage]="'GL.VAT_LOCKED' | translate"
          [nzDescription]="'GL.VAT_STATUS_' + record.status | translate"
        />
      }

      @if (calculation(); as calc) {
        <div class="section" data-testid="summary">
          <nz-tag nzColor="blue">{{ calc.jurisdiction }}</nz-tag>
          <strong>{{ calc.period.label }}</strong>
          ({{ calc.period.from }} - {{ calc.period.to }})
          @if (calc.regime) {
            <nz-tag>{{ 'GL.VAT_REGIME' | translate }}: {{ calc.regime }}</nz-tag>
          }
          @if (calc.basis) {
            <nz-tag>{{ 'GL.VAT_BASIS' | translate }}: {{ calc.basis }}</nz-tag>
          }
          <div class="result">
            <strong>{{ 'GL.VAT_PAYABLE' | translate }}:</strong>
            {{ calc.payable_amount | money: currency() }}
          </div>
        </div>

        @for (warning of calc.warnings; track $index) {
          <nz-alert class="section" nzType="warning" nzShowIcon data-testid="warning" [nzMessage]="warning" />
        }

        <nz-card class="section" [nzTitle]="(calc.jurisdiction === 'CH' ? 'GL.VAT_SWISS_BOXES' : 'GL.VAT_LIPE_BOXES') | translate">
          <nz-table nzSize="small" [nzData]="boxRows()" [nzShowPagination]="false" data-testid="boxes">
            <thead>
              <tr>
                <th>{{ 'GL.VAT_BOX' | translate }}</th>
                <th>{{ 'GL.VAT_BOX_DESCRIPTION' | translate }}</th>
                <th class="num">{{ 'GL.VAT_AMOUNT' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (row of boxRows(); track row.code) {
                <tr [attr.data-box]="row.code">
                  <td>{{ boxCode(row.code) }}</td>
                  <td>{{ boxLabelKey(row.code) | translate }}</td>
                  <td class="num">
                    @if (row.rated; as rated) {
                      {{ rated.base | money: currency() }} x {{ rated.rate }}% = {{ rated.tax | money: currency() }}
                    } @else {
                      {{ row.amount | money: currency() }}
                    }
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-card>

        <nz-card class="section" [nzTitle]="'GL.VAT_DRILLDOWN_SALES' | translate">
          <ng-container *ngTemplateOutlet="lines; context: { rows: calc.drilldown.sales, testid: 'sales-lines' }" />
        </nz-card>
        <nz-card class="section" [nzTitle]="'GL.VAT_DRILLDOWN_PURCHASES' | translate">
          <ng-container *ngTemplateOutlet="lines; context: { rows: calc.drilldown.purchases, testid: 'purchase-lines' }" />
        </nz-card>
      }
    </nz-card>

    <nz-card class="section" [nzTitle]="'GL.VAT_LOCKED_PERIODS' | translate">
      <nz-table nzSize="small" [nzData]="settlements()" [nzShowPagination]="false" data-testid="settlements">
        <thead>
          <tr>
            <th>{{ 'GL.VAT_JURISDICTION' | translate }}</th>
            <th>{{ 'GL.VAT_PERIOD' | translate }}</th>
            <th>{{ 'GL.VAT_STATUS' | translate }}</th>
            <th class="num">{{ 'GL.VAT_PAYABLE' | translate }}</th>
            <th>{{ 'GL.VAT_ACTIONS' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (item of settlements(); track item.id) {
            <tr>
              <td>{{ item.jurisdiction }}</td>
              <td>{{ item.period_from }} - {{ item.period_to }}</td>
              <td>
                <nz-tag>{{ 'GL.VAT_STATUS_' + item.status | translate }}</nz-tag>
              </td>
              <td class="num">{{ item.payable_amount | money: (item.jurisdiction === 'CH' ? 'CHF' : 'EUR') }}</td>
              <td>
                <button nz-button nzSize="small" type="button" data-testid="export-xml" (click)="exportXml(item)">
                  {{ 'GL.VAT_EXPORT_XML' | translate }}
                </button>
                <button nz-button nzSize="small" type="button" data-testid="export-pdf" (click)="exportPdf(item)">
                  {{ 'GL.VAT_EXPORT_PDF' | translate }}
                </button>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    <ng-template #lines let-rows="rows" let-testid="testid">
      <nz-table nzSize="small" [nzData]="rows" [nzShowPagination]="false" [attr.data-testid]="testid">
        <thead>
          <tr>
            <th>{{ 'GL.VAT_LINE_ENTRY' | translate }}</th>
            <th>{{ 'GL.VAT_LINE_DATE' | translate }}</th>
            <th>{{ 'GL.VAT_LINE_DOCUMENT' | translate }}</th>
            <th>{{ 'GL.VAT_LINE_TREATMENT' | translate }}</th>
            <th class="num">{{ 'GL.VAT_LINE_TAXABLE' | translate }}</th>
            <th class="num">{{ 'GL.VAT_LINE_RATE' | translate }}</th>
            <th class="num">{{ 'GL.VAT_LINE_TAX' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (line of rows; track $index) {
            <tr>
              <td>{{ line.entry_number }}</td>
              <td>{{ line.posting_date }}</td>
              <td>{{ line.document_number }}</td>
              <td>{{ line.treatment }}</td>
              <td class="num">{{ line.taxable | money: currency() }}</td>
              <td class="num">{{ line.rate }}</td>
              <td class="num">{{ line.tax | money: currency() }}</td>
            </tr>
          }
        </tbody>
      </nz-table>
    </ng-template>
  `,
})
export class GlVatSettlementComponent implements OnInit {
  private readonly api = inject(GeneralLedgerFiscalApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  protected readonly canWrite = inject(PermissionsService).canWrite('ledger');

  protected readonly periodTypes: VatPeriodType[] = ['monthly', 'quarterly', 'semiannual'];
  protected readonly periodType = signal<VatPeriodType>('quarterly');
  protected readonly year = signal(new Date().getFullYear());
  protected readonly period = signal(1);
  protected readonly maxPeriod = computed(() => MAX_PERIOD[this.periodType()]);

  protected readonly calculation = signal<VatSettlementCalculation | null>(null);
  protected readonly lockedRecord = signal<VatSettlementRecord | null>(null);
  protected readonly settlements = signal<VatSettlementSummary[]>([]);
  protected readonly previewing = signal(false);
  protected readonly locking = signal(false);

  protected readonly currency = computed(() => (this.calculation()?.jurisdiction === 'IT' ? 'EUR' : 'CHF'));

  /** The boxes of the active jurisdiction in form order. */
  protected readonly boxRows = computed<VatBoxRow[]>(() => {
    const calc = this.calculation();
    if (!calc) {
      return [];
    }
    if (calc.jurisdiction === 'CH') {
      const boxes = calc.swiss_boxes ?? {};
      return SWISS_ZIFFERN.map((code) => toBoxRow(code, boxes[code]));
    }
    const boxes = calc.lipe_boxes ?? {};
    return LIPE_BOXES.map((code) => toBoxRow(code, boxes[code]));
  });

  ngOnInit(): void {
    this.loadSettlements();
  }

  protected setPeriodType(type: VatPeriodType): void {
    this.periodType.set(type);
    this.period.update((value) => Math.min(value, MAX_PERIOD[type]));
  }

  protected boxCode(code: string): string {
    return code.replace('_', ' ');
  }

  protected boxLabelKey(code: string): string {
    return this.calculation()?.jurisdiction === 'CH' ? `GL.VAT_ZIFFER_${code}` : `GL.VAT_LIPE_${code}`;
  }

  protected preview(): void {
    this.previewing.set(true);
    this.lockedRecord.set(null);
    this.api.previewVatSettlement(this.request()).subscribe({
      next: (res) => {
        this.previewing.set(false);
        this.calculation.set(res.data);
      },
      error: () => {
        this.previewing.set(false);
        this.calculation.set(null);
        this.message.error(this.i18n.translate('GL.VAT_PREVIEW_FAILED'));
      },
    });
  }

  protected lock(): void {
    this.locking.set(true);
    this.api.lockVatSettlement(this.request()).subscribe({
      next: (res) => {
        this.locking.set(false);
        this.lockedRecord.set(res.data);
        this.calculation.set(res.data.calculation);
        this.message.success(this.i18n.translate('GL.VAT_LOCK_SUCCESS'));
        this.loadSettlements();
      },
      error: () => {
        this.locking.set(false);
        this.message.error(this.i18n.translate('GL.VAT_LOCK_FAILED'));
      },
    });
  }

  protected exportXml(item: VatSettlementSummary): void {
    this.api.exportVatSettlementXml(item.id).subscribe({
      next: (blob) => downloadBlob(blob, `vat-${item.jurisdiction}-${item.period_from}-${item.period_to}.xml`),
      error: () => this.message.error(this.i18n.translate('GL.VAT_EXPORT_FAILED')),
    });
  }

  protected exportPdf(item: VatSettlementSummary): void {
    this.api.exportVatSettlementPdf(item.id).subscribe({
      next: (blob) => downloadBlob(blob, `vat-${item.jurisdiction}-${item.period_from}-${item.period_to}.pdf`),
      error: () => this.message.error(this.i18n.translate('GL.VAT_EXPORT_FAILED')),
    });
  }

  private loadSettlements(): void {
    this.api.getVatSettlements().subscribe({
      next: (res) => this.settlements.set(res.data),
      error: () => this.settlements.set([]),
    });
  }

  private request(): VatSettlementRequest {
    return { period_type: this.periodType(), year: this.year(), period: this.period() };
  }
}

function toBoxRow(code: string, value: unknown): VatBoxRow {
  if (value !== null && typeof value === 'object') {
    return { code, amount: null, rated: value as SwissBoxRate };
  }
  return { code, amount: value === null || value === undefined ? null : String(value), rated: null };
}
