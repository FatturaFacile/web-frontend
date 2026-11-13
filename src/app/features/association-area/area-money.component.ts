import { Component, effect, inject, input, signal } from '@angular/core';
import { AssociationAreaApiService, AssociationAreaFees, AssociationAreaRecord, I18nService } from '@core';
import { MoneyPipe, TranslatePipe, GridExportDirective, GridSortPipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { recordText, saveBlob } from './save-blob';

/** Fees with the online payment link and the receipts of the selected person. */
@Component({
  selector: 'app-area-money',
  styleUrl: './area-money.component.scss',
  imports: [
    GridExportDirective,
    GridSortPipe,
    MoneyPipe, NzAlertModule, NzButtonModule, NzEmptyModule, NzTableModule, NzTagModule, TranslatePipe],
  template: `
    @if (fees(); as standing) {
      <nz-alert
        [nzType]="standing.standing === 'settled' ? 'success' : standing.standing === 'attention' ? 'warning' : 'error'"
        [nzMessage]="'ASSOC_AREA.STANDING_' + standing.standing | translate"
        nzShowIcon
      />
      <nz-table class="area-gap" nzSize="small" [nzData]="standing.assignments" [nzShowPagination]="false" [nzScroll]="{ x: 'max-content' }">
        <thead>
          <tr>
            <th [nzSortFn]="'description' | gridSort">{{ 'ASSOC_AREA.DESCRIPTION' | translate }}</th>
            <th>{{ 'ASSOC_AREA.STARTS_ON' | translate }}</th>
            <th [nzSortFn]="'net_amount' | gridSort">{{ 'ASSOC_AREA.NET_AMOUNT' | translate }}</th>
            <th [nzSortFn]="'lessons_remaining' | gridSort">{{ 'ASSOC_AREA.LESSONS_REMAINING' | translate }}</th>
            <th [nzSortFn]="'status' | gridSort">{{ 'ASSOC_AREA.STATUS' | translate }}</th>
            <th>{{ 'ASSOC_AREA.ACTIONS' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (fee of standing.assignments; track fee.id) {
            <tr>
              <td>{{ fee.description }}</td>
              <td>{{ fee.starts_on.slice(0, 10) }}</td>
              <td>{{ fee.net_amount | money }}</td>
              <td>{{ fee.lessons_remaining }}</td>
              <td><nz-tag>{{ fee.status }}</nz-tag></td>
              <td>
                @for (instalment of fee.instalments ?? []; track instalment.id) {
                  @if (instalment.status !== 'paid') {
                    <button nz-button nzSize="small" type="button" (click)="pay(instalment.id)">
                      {{ 'ASSOC_AREA.PAY_INSTALMENT' | translate: { sequence: instalment.sequence, amount: instalment.amount } }}
                    </button>
                  }
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    }

    <h3 class="area-section">{{ 'ASSOC_AREA.RECEIPTS' | translate }}</h3>
    @if (receipts().length === 0) {
      <nz-empty />
    } @else {
      <nz-table nzSize="small" [nzData]="receipts()" [nzShowPagination]="false">
        <thead>
          <tr>
            <th>{{ 'ASSOC_AREA.NUMBER' | translate }}</th>
            <th>{{ 'ASSOC_AREA.DATE' | translate }}</th>
            <th>{{ 'ASSOC_AREA.AMOUNT' | translate }}</th>
            <th>{{ 'ASSOC_AREA.ACTIONS' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (receipt of receipts(); track text(receipt, 'id')) {
            <tr>
              <td>{{ text(receipt, 'number') }}</td>
              <td>{{ text(receipt, 'issued_on').slice(0, 10) }}</td>
              <td>{{ text(receipt, 'amount') | money }}</td>
              <td>
                <button nz-button nzSize="small" type="button" (click)="downloadReceipt(text(receipt, 'id'), text(receipt, 'number'))">
                  {{ 'ASSOC_AREA.DOWNLOAD_PDF' | translate }}
                </button>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    }
  `,
})
export class AreaMoneyComponent {
  private readonly api = inject(AssociationAreaApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  readonly memberId = input.required<string>();

  protected readonly fees = signal<AssociationAreaFees | null>(null);
  protected readonly receipts = signal<AssociationAreaRecord[]>([]);
  protected readonly text = recordText;

  constructor() {
    effect(() => {
      const id = this.memberId();
      this.api.fees(id).subscribe({ next: (res) => this.fees.set(res.data), error: () => this.fees.set(null) });
      this.api.receipts(id).subscribe({ next: (res) => this.receipts.set(res.data), error: () => this.receipts.set([]) });
    });
  }

  /** Opens the payment page of the provider in a new tab. */
  protected pay(instalmentId: string): void {
    this.api.payInstalment(instalmentId).subscribe({
      next: (res) => window.open(res.data.url, '_blank', 'noopener'),
      error: () => this.message.error(this.i18n.translate('ASSOC_AREA.PAY_FAILED')),
    });
  }

  protected downloadReceipt(receiptId: string, number: string): void {
    this.api.receiptPdf(receiptId).subscribe((blob) => saveBlob(blob, `receipt-${number || receiptId}.pdf`));
  }
}
