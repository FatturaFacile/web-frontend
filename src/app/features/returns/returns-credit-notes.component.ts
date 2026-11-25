import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  CreditNoteFiscalCheckResult,
  CustomerReturn,
  IssuedReturnCreditNote,
  ReturnsApiService,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText, todayIso } from './returns.util';

/** Credit Note (TD04) Fiscal Time-Limit Control: Art. 26 DPR 633/72 (1-year N2.2) & Art. 41 LIVA. */
@Component({
  selector: 'app-returns-credit-notes',
  styleUrl: './returns.scss',
  imports: [
    FormsModule,
    PageHeaderComponent,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
    NzEmptyModule,
    NzInputModule,
    NzSelectModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'RETURNS_RL.CN_TITLE' | translate" [subtitle]="'RETURNS_RL.CN_SUBTITLE' | translate">
      <button nz-button (click)="runCheck()" [disabled]="!selectedReturnId()">
        {{ 'RETURNS_RL.RUN_FISCAL_CHECK' | translate }}
      </button>
      <button nz-button nzType="primary" (click)="issueCreditNote()" [disabled]="!checkResult()">
        {{ 'RETURNS_RL.ISSUE_CREDIT_NOTE' | translate }}
      </button>
    </app-page-header>

    <nz-card class="main-card">
      <div class="toolbar">
        <nz-select
          style="width: 320px"
          [ngModel]="selectedReturnId()"
          (ngModelChange)="selectedReturnId.set($event); checkResult.set(null)"
          [nzPlaceHolder]="'RETURNS.RMA_NUMBER' | translate"
        >
          @for (ret of returnsList(); track ret.id) {
            <nz-option [nzValue]="ret.id" [nzLabel]="ret.rma_number + ' — ' + ret.customer_name"></nz-option>
          }
        </nz-select>

        <input nz-input type="date" style="width: 180px" [ngModel]="creditDate()" (ngModelChange)="creditDate.set($event)" />
      </div>

      @if (checkResult(); as res) {
        @if (res.warning_message) {
          <nz-alert
            [nzType]="res.art26_one_year_exceeded ? 'warning' : 'info'"
            [nzMessage]="res.warning_message"
            nzShowIcon
            style="margin-bottom: 16px;"
          ></nz-alert>
        }

        <dl class="detail-grid">
          <div>
            <dt>{{ 'RETURNS.SOURCE_INVOICE' | translate }}</dt>
            <dd>{{ res.original_invoice_number }}</dd>
          </div>
          <div>
            <dt>{{ 'RETURNS_RL.ORIGINAL_INVOICE_DATE' | translate }}</dt>
            <dd>{{ res.original_invoice_date }}</dd>
          </div>
          <div>
            <dt>{{ 'RETURNS_RL.DAYS_ELAPSED' | translate }}</dt>
            <dd>{{ res.days_elapsed }}</dd>
          </div>
          <div>
            <dt>{{ 'RETURNS_RL.VAT_RECOVERABLE' | translate }}</dt>
            <dd>
              <nz-tag [nzColor]="res.vat_recoverable ? 'green' : 'orange'">
                {{ res.vat_recoverable ? 'YES' : (res.proposed_natura ?? 'N2.2') }}
              </nz-tag>
            </dd>
          </div>
          <div>
            <dt>Net / VAT / Gross</dt>
            <dd>{{ res.totals.net }} / {{ res.totals.vat }} / <strong>{{ res.totals.gross }}</strong></dd>
          </div>
        </dl>

        @if (res.art26_one_year_exceeded) {
          <div style="margin-top: 12px;">
            <label nz-checkbox [ngModel]="applyN22()" (ngModelChange)="applyN22.set($event)">
              {{ 'RETURNS_RL.APPLY_N2_2' | translate }}
            </label>
          </div>
        }
      }

      @if (issuedNote(); as note) {
        <nz-alert
          nzType="success"
          [nzMessage]="('RETURNS_RL.CN_ISSUED_SUCCESS' | translate) + ': ' + note.invoice_number + ' (' + (note.vat_nature ?? 'VAT') + ')'"
          nzShowIcon
          style="margin-top: 16px;"
        ></nz-alert>
      }
    </nz-card>
  `,
})
export class ReturnsCreditNotesComponent implements OnInit {
  private readonly api = inject(ReturnsApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly returnsList = signal<CustomerReturn[]>([]);
  readonly selectedReturnId = signal<string | null>(null);
  readonly creditDate = signal(todayIso());
  readonly checkResult = signal<CreditNoteFiscalCheckResult | null>(null);
  readonly applyN22 = signal(false);
  readonly issuedNote = signal<IssuedReturnCreditNote | null>(null);

  ngOnInit(): void {
    this.api.getCustomerReturns({ per_page: 50 }).subscribe({
      next: (res) => this.returnsList.set(res.data.filter((r) => r.invoice_id !== null && r.credit_note_id === null)),
    });
  }

  runCheck(): void {
    const id = this.selectedReturnId();
    if (!id) {
      return;
    }
    this.api.checkCreditNoteFiscal(id, this.creditDate()).subscribe({
      next: (res) => {
        this.checkResult.set(res.data);
        this.applyN22.set(res.data.proposed_natura === 'N2.2');
      },
      error: (err: unknown) => this.message.error(apiErrorText(err) ?? this.translate.instant('RETURNS.ACTION_ERROR')),
    });
  }

  issueCreditNote(): void {
    const id = this.selectedReturnId();
    if (!id) {
      return;
    }
    this.api.issueReturnCreditNote({
      customer_return_id: id,
      date: this.creditDate(),
      apply_n2_2: this.applyN22(),
    }).subscribe({
      next: (res) => {
        this.issuedNote.set(res.data);
        this.message.success(this.translate.instant('RETURNS_RL.CN_ISSUED_SUCCESS'));
      },
      error: (err: unknown) => this.message.error(apiErrorText(err) ?? this.translate.instant('RETURNS.ACTION_ERROR')),
    });
  }
}
