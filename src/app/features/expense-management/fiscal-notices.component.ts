import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { ExmJurisdiction } from '@core';
import { TranslatePipe } from '@shared';
import { fiscalNotices } from './expense-management.util';

/** The fiscal notices of the jurisdiction: Art. 51 TUIR and traceable payments (IT), Spesenreglement and TCS (CH). */
@Component({
  selector: 'app-exm-fiscal-notices',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NzAlertModule, TranslatePipe],
  template: `
    @for (code of codes(); track code) {
      <nz-alert
        class="notice"
        nzType="info"
        nzShowIcon
        [nzMessage]="'expenseManagement.fiscal.' + code | translate"
      ></nz-alert>
    }
  `,
  styles: `
    .notice {
      margin-bottom: 8px;
    }
  `,
})
export class FiscalNoticesComponent {
  readonly jurisdiction = input<ExmJurisdiction>('IT');
  /** Codes from the lookups; the notices of the jurisdiction are the fallback. */
  readonly noticeCodes = input<readonly string[]>([]);

  protected readonly codes = computed(() =>
    this.noticeCodes().length > 0 ? this.noticeCodes() : fiscalNotices(this.jurisdiction()),
  );
}
