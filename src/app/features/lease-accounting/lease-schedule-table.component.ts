import { Component, computed, inject, input, TemplateRef, viewChild } from '@angular/core';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { I18nService, LeaseScheduleLine } from '@core';
import { BaseTableComponent, MoneyPipe, TableColumnDef, TranslatePipe } from '@shared';

/** Monthly schedule of a lease: roll-forward of the lease liability and depreciation of the right-of-use asset. */
@Component({
  selector: 'app-lease-schedule-table',
  imports: [BaseTableComponent, NzTagModule, TranslatePipe],
  template: `
    <app-base-table
      [data]="lines()"
      [total]="lines().length"
      [pageSize]="12"
      [columns]="columns()"
      [scroll]="{ x: '1400px' }"
      size="small"
      [bordered]="true"
      [exportFileName]="exportFileName()"
    />
    <ng-template #statusTpl let-line>
      @if (line.status) {
        <nz-tag [nzColor]="line.status === 'posted' ? 'green' : 'default'">{{ 'LEASES.LINE_' + line.status | translate }}</nz-tag>
      }
    </ng-template>
  `,
  providers: [MoneyPipe],
})
export class LeaseScheduleTableComponent {
  private readonly i18n = inject(I18nService);
  private readonly money = inject(MoneyPipe);

  readonly lines = input.required<LeaseScheduleLine[]>();
  readonly currency = input<string>('EUR');
  readonly exportFileName = input<string>('lease-schedule');

  private readonly statusTpl = viewChild<TemplateRef<unknown>>('statusTpl');

  protected readonly columns = computed<TableColumnDef<LeaseScheduleLine>[]>(() => {
    this.i18n.currentLanguage();
    const currency = this.currency();
    const amount = (key: keyof LeaseScheduleLine, header: string): TableColumnDef<LeaseScheduleLine> => ({
      key,
      header: this.i18n.translate(header),
      valueGetter: (line) => this.money.transform(line[key] as string, currency),
      sortFn: (a, b) => Number(a[key]) - Number(b[key]),
      filterable: false,
    });

    return [
      { key: 'period_number', header: this.i18n.translate('LEASES.COL_PERIOD'), width: '90px', sortFn: (a, b) => a.period_number - b.period_number },
      { key: 'period_start', header: this.i18n.translate('LEASES.COL_PERIOD_START') },
      { key: 'period_end', header: this.i18n.translate('LEASES.COL_PERIOD_END') },
      amount('opening_liability', 'LEASES.COL_OPENING'),
      amount('payment', 'LEASES.COL_PAYMENT_AMOUNT'),
      amount('interest', 'LEASES.COL_INTEREST'),
      amount('principal', 'LEASES.COL_PRINCIPAL'),
      amount('closing_liability', 'LEASES.COL_CLOSING'),
      amount('rou_opening', 'LEASES.COL_ROU_OPENING'),
      amount('depreciation', 'LEASES.COL_DEPRECIATION'),
      amount('rou_closing', 'LEASES.COL_ROU_CLOSING'),
      { key: 'status', header: this.i18n.translate('LEASES.COL_LINE_STATUS'), customCellTemplate: this.statusTpl() },
    ];
  });
}
