import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AuthStore, I18nService } from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { reportProblem } from './italian-vat-feedback';
import { ItalianVatStore } from './italian-vat.store';
import { annualNetPosition, currentYear, diagnosticKey } from './italian-vat.util';

/** Annual VAT reconciliation: settlements, pro-rata adjustment, annual position and alignment with the Erario c/IVA ledger. */
@Component({
  selector: 'app-italian-vat-annual',
  styleUrl: '../general-ledger/localization/gl-localization.scss',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzDescriptionsModule,
    NzInputNumberModule,
    NzPopconfirmModule,
    NzTagModule,
    MoneyPipe,
    PageHeaderComponent,
    TranslatePipe,
  ],
  template: `
    <app-page-header [title]="'PAGE_TITLE.ITALIAN_VAT_ANNUAL' | translate" />
    <nz-card>
      <div class="filters">
        <div class="field">
          <span>{{ 'GL.VAT_YEAR' | translate }}</span>
          <nz-input-number
            data-testid="annual-year"
            [nzMin]="2000"
            [nzMax]="2100"
            [ngModel]="year()"
            (ngModelChange)="year.set($event ?? year())"
          />
        </div>
        <button
          nz-button
          type="button"
          data-testid="annual-load"
          [nzLoading]="store.loading()"
          (click)="load()"
        >
          {{ 'GL.RUN_REPORT' | translate }}
        </button>
        <button
          nz-button
          nzType="primary"
          type="button"
          data-testid="annual-calculate"
          [nzLoading]="store.saving()"
          (click)="calculate()"
        >
          {{ 'italianVat.annual.calculate' | translate }}
        </button>
        <button
          nz-button
          type="button"
          data-testid="annual-finalize"
          nz-popconfirm
          [nzPopconfirmTitle]="'italianVat.ui.finalizeConfirm' | translate"
          [disabled]="!store.annualFinalizable()"
          (nzOnConfirm)="finalize()"
        >
          {{ 'italianVat.annual.finalize' | translate }}
        </button>
      </div>

      @if (store.annual(); as annual) {
        <nz-alert
          data-testid="annual-status"
          [nzType]="annual.is_reconciled ? 'success' : 'warning'"
          nzShowIcon
          [nzMessage]="
            (annual.is_reconciled ? 'italianVat.annual.reconciled' : 'italianVat.ui.notReconciled')
              | translate
          "
        />
        @for (diagnostic of annual.diagnostics ?? []; track $index) {
          <nz-alert
            nzType="warning"
            nzShowIcon
            data-testid="diagnostic"
            [nzMessage]="diagnosticKey(diagnostic.code) | translate: diagnostic.params"
          />
        }
        <nz-descriptions nzBordered nzSize="small" [nzColumn]="2" data-testid="annual-figures">
          <nz-descriptions-item [nzTitle]="'italianVat.ui.outputVat' | translate">{{
            annual.total_output_vat | money: currency()
          }}</nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'italianVat.ui.inputVat' | translate">{{
            annual.total_input_vat | money: currency()
          }}</nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'italianVat.register.proRata' | translate"
            >{{ annual.pro_rata_percentage }}%</nz-descriptions-item
          >
          <nz-descriptions-item [nzTitle]="'italianVat.annual.proRataAdjustment' | translate">{{
            annual.pro_rata_adjustment | money: currency()
          }}</nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'italianVat.annual.priorYearCredit' | translate">{{
            annual.prior_year_credit | money: currency()
          }}</nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'italianVat.ui.interest' | translate">{{
            annual.interest_total | money: currency()
          }}</nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'italianVat.ui.paid' | translate">{{
            annual.paid_total | money: currency()
          }}</nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'italianVat.annual.debit' | translate">{{
            annual.annual_debit | money: currency()
          }}</nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'italianVat.annual.credit' | translate">{{
            annual.annual_credit | money: currency()
          }}</nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'italianVat.ui.netPosition' | translate"
            ><strong data-testid="net-position">{{
              netPosition(annual) | money: currency()
            }}</strong></nz-descriptions-item
          >
          <nz-descriptions-item [nzTitle]="'italianVat.annual.ledgerBalance' | translate">{{
            annual.ledger_balance | money: currency()
          }}</nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'italianVat.ui.difference' | translate">{{
            annual.difference | money: currency()
          }}</nz-descriptions-item>
        </nz-descriptions>
        @if (annual.finalized_at) {
          <nz-tag nzColor="green" data-testid="finalized">{{
            'italianVat.ui.finalized' | translate
          }}</nz-tag>
        }
      } @else {
        <p data-testid="annual-empty">{{ 'italianVat.ui.annualNotCalculated' | translate }}</p>
      }
    </nz-card>
  `,
})
export class ItalianVatAnnualComponent implements OnInit {
  protected readonly store = inject(ItalianVatStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  protected readonly currency = inject(AuthStore).activeCurrency;
  protected readonly year = signal(currentYear() - 1);
  protected readonly diagnosticKey = diagnosticKey;
  protected readonly netPosition = annualNetPosition;

  ngOnInit(): void {
    void this.load();
  }

  protected load(): Promise<void> {
    return this.store.loadAnnual(this.year());
  }

  protected async calculate(): Promise<void> {
    if (!(await this.store.calculateAnnual(this.year()))) {
      reportProblem(this.store.error(), this.i18n, this.message);
    }
  }

  protected async finalize(): Promise<void> {
    if (await this.store.finalizeAnnual(this.year())) {
      this.message.success(this.i18n.translate('italianVat.ui.finalized'));
    } else {
      reportProblem(this.store.error(), this.i18n, this.message);
    }
  }
}
