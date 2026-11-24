import { Component, computed, inject, input } from '@angular/core';
import { I18nService } from '@core';
import { NzTagModule } from 'ng-zorro-antd/tag';

const COLORS: Record<string, string> = {
  Draft: 'default',
  Calculated: 'blue',
  Approved: 'gold',
  Final: 'green',
};

/** Status of a payroll run: Draft, Calculated, Approved, Final. */
@Component({
  selector: 'app-payroll-run-status-tag',
  styleUrl: './payroll-run-status-tag.component.scss',
  imports: [NzTagModule],
  template: `<nz-tag [nzColor]="color()">{{ label() }}</nz-tag>`,
})
export class PayrollRunStatusTagComponent {
  private readonly i18n = inject(I18nService);
  readonly status = input.required<string>();

  protected readonly color = computed(() => COLORS[this.status()] ?? 'default');
  protected readonly label = computed(() => {
    const key = `hrmPayroll.status.${this.status()}`;
    const text = this.i18n.translate(key);
    return text === key ? this.status() : text;
  });
}
