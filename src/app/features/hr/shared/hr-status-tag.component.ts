import { Component, computed, inject, input } from '@angular/core';
import { I18nService } from '@core';
import { NzTagModule } from 'ng-zorro-antd/tag';

const COLORS: Record<string, string> = {
  approved: 'green',
  active: 'green',
  completed: 'green',
  valid: 'green',
  finalized: 'green',
  pending: 'gold',
  scheduled: 'blue',
  assigned: 'blue',
  in_progress: 'blue',
  calculated: 'blue',
  probation: 'blue',
  expiring: 'orange',
  rejected: 'red',
  expired: 'red',
  cancelled: 'default',
  withdrawn: 'default',
  terminated: 'default',
  draft: 'default',
  closed: 'default',
  archived: 'default',
};

/** Status tag: translates `hrmCommon.status.<value>`, falls back to the raw value. */
@Component({
  selector: 'app-hr-status-tag',
  imports: [NzTagModule],
  template: `<nz-tag [nzColor]="color()">{{ label() }}</nz-tag>`,
})
export class HrStatusTagComponent {
  private readonly i18n = inject(I18nService);
  readonly value = input.required<string>();

  protected readonly color = computed(() => COLORS[this.value()] ?? 'default');
  protected readonly label = computed(() => {
    const key = `hrmCommon.status.${this.value()}`;
    const text = this.i18n.translate(key);
    return text === key ? this.value() : text;
  });
}
