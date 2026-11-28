import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { TranslateService } from '@core';
import { downloadBlob, MoneyPipe, TranslatePipe } from '@shared';
import { FlowFile, SettlementsStore } from './settlements.store';
import { isNonZero, selectableYears, WrOutcome } from './withholding-recipients.util';

/**
 * Annual returns (settle ability): generates the CU records (Italy) and the AVS / source tax records (Switzerland) of a
 * year from the posted compensations, lists them with the causal, the non-taxable amount and the totals, and exports a CSV.
 */
@Component({
  selector: 'app-wr-annual-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MoneyPipe,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzEmptyModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <div class="toolbar">
      <label class="field" for="wr-annual-year">
        <span>{{ 'withholdingRecipients.field.taxYear' | translate }}</span>
        <nz-select
          nzId="wr-annual-year"
          [ngModel]="store.annualYear()"
          (ngModelChange)="store.setAnnualYear($event)"
        >
          @for (year of years; track year) {
            <nz-option [nzValue]="year" [nzLabel]="'' + year"></nz-option>
          }
        </nz-select>
      </label>
      <button
        nz-button
        nzType="primary"
        type="button"
        nz-popconfirm
        [nzPopconfirmTitle]="'withholdingRecipients.annual.confirmGenerate' | translate"
        [nzOkText]="'withholdingRecipients.annual.generate' | translate"
        [nzCancelText]="'withholdingRecipients.action.cancel' | translate"
        [nzLoading]="store.annualLoading()"
        (nzOnConfirm)="generate()"
      >
        {{ 'withholdingRecipients.annual.generate' | translate }}
      </button>
      <button
        nz-button
        type="button"
        [nzLoading]="store.exporting() === 'annual'"
        [disabled]="store.annualRecords().length === 0"
        (click)="download(store.exportAnnual())"
      >
        {{ 'withholdingRecipients.annual.export' | translate }}
      </button>
    </div>

    <p class="hint">{{ 'withholdingRecipients.annual.hint' | translate }}</p>

    @if (error(); as failure) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        [nzMessage]="failure.errorKey ?? '' | translate"
        [nzDescription]="failure.detail ?? ''"
      ></nz-alert>
    }

    <nz-spin [nzSpinning]="store.annualLoading()">
      <nz-table #table nzSize="small" [nzData]="store.annualRecords()" [nzPageSize]="20">
        <thead>
          <tr>
            <th scope="col">{{ 'withholdingRecipients.field.recipient' | translate }}</th>
            <th scope="col">{{ 'withholdingRecipients.annual.type' | translate }}</th>
            <th scope="col">{{ 'withholdingRecipients.field.cuCausal' | translate }}</th>
            <th scope="col" class="num">{{ 'withholdingRecipients.annual.gross' | translate }}</th>
            <th scope="col" class="num">
              {{ 'withholdingRecipients.annual.nonTaxable' | translate }}
            </th>
            <th scope="col" class="num">
              {{ 'withholdingRecipients.annual.withholding' | translate }}
            </th>
            <th scope="col" class="num">{{ 'withholdingRecipients.annual.inps' | translate }}</th>
            <th scope="col" class="num">
              {{ 'withholdingRecipients.annual.enasarco' | translate }}
            </th>
            <th scope="col" class="num">{{ 'withholdingRecipients.annual.avs' | translate }}</th>
            <th scope="col" class="num">
              {{ 'withholdingRecipients.annual.sourceTax' | translate }}
            </th>
          </tr>
        </thead>
        <tbody>
          @for (record of table.data; track record.id) {
            <tr>
              <th scope="row">
                {{ record.recipient_name }}
                @if (record.tax_code) {
                  <small class="muted">{{ record.tax_code }}</small>
                }
              </th>
              <td>
                <nz-tag [nzColor]="record.return_type === 'CU' ? 'blue' : 'purple'">{{
                  'withholdingRecipients.annual.returnType.' + record.return_type | translate
                }}</nz-tag>
              </td>
              <td>
                @if (record.causal) {
                  {{ 'withholdingRecipients.causal.' + record.causal | translate }}
                }
              </td>
              <td class="num">{{ record.gross_total | money: record.currency }}</td>
              <td class="num">
                @if (nonZero(record.non_taxable_total)) {
                  {{ record.non_taxable_total | money: record.currency }}
                  @if (record.non_taxable_code) {
                    <small class="muted">{{ record.non_taxable_code }}</small>
                  }
                }
              </td>
              <td class="num">{{ record.withholding_total | money: record.currency }}</td>
              <td class="num">
                {{ record.inps_worker_total | money: record.currency }}
                @if (nonZero(record.inps_company_total)) {
                  <small class="muted">{{
                    record.inps_company_total | money: record.currency
                  }}</small>
                }
              </td>
              <td class="num">{{ record.enasarco_total | money: record.currency }}</td>
              <td class="num">{{ record.avs_total | money: record.currency }}</td>
              <td class="num">{{ record.source_tax_total | money: record.currency }}</td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!store.annualLoading() && store.annualRecords().length === 0) {
        <nz-empty [nzNotFoundContent]="'withholdingRecipients.annual.empty' | translate"></nz-empty>
      }
    </nz-spin>
  `,
  styles: `
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 12px;
      margin-bottom: 12px;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 120px;
      font-size: 12px;
    }

    .hint {
      font-size: 12px;
      color: var(--ant-text-color-secondary, #595959);
    }

    .feedback {
      margin-bottom: 12px;
    }

    .num {
      text-align: right;
      white-space: nowrap;
    }

    .muted {
      display: block;
      font-weight: normal;
      color: var(--ant-text-color-secondary, #595959);
    }
  `,
})
export class AnnualPanelComponent implements OnInit {
  readonly store = inject(SettlementsStore);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly years = selectableYears();
  readonly nonZero = isNonZero;
  readonly error = signal<WrOutcome | null>(null);

  ngOnInit(): void {
    void this.store.loadAnnual();
  }

  async generate(): Promise<void> {
    this.error.set(null);
    const outcome = await this.store.generateAnnual();
    if (outcome.ok) {
      this.message.success(
        this.translate.instant('withholdingRecipients.message.returnsGenerated'),
      );
    } else {
      this.error.set(outcome);
    }
  }

  /** Hands the file to the browser; a refusal is already in the store (`error`). */
  async download(request: Promise<FlowFile>): Promise<void> {
    const file = await request;
    if (file.ok && file.blob) {
      downloadBlob(file.blob, file.filename);
    }
  }
}
