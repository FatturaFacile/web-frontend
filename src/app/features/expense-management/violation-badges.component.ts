import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { ExmViolation } from '@core';
import { TranslatePipe } from '@shared';
import { severityColor, violationKey } from './expense-management.util';

/** Policy, duplicate and fiscal violations of a line as coloured tags: red blocks the submission, orange warns. */
@Component({
  selector: 'app-exm-violation-badges',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NzTagModule, NzTooltipModule, TranslatePipe],
  template: `
    @for (violation of violations(); track violation.code + $index) {
      <nz-tag
        [nzColor]="color(violation)"
        [attr.data-severity]="violation.severity"
        [nzTooltipTitle]="'expenseManagement.severity.' + violation.severity | translate"
        nz-tooltip
      >
        {{ key(violation) | translate: params(violation) }}
      </nz-tag>
    }
  `,
})
export class ViolationBadgesComponent {
  readonly violations = input<readonly ExmViolation[]>([]);

  protected color(violation: ExmViolation): string {
    return severityColor(violation.severity);
  }

  protected key(violation: ExmViolation): string {
    return violationKey(violation);
  }

  /** The parameters of the violation as the strings the translation placeholders take. */
  protected params(violation: ExmViolation): Record<string, string | number> {
    const result: Record<string, string | number> = {};
    for (const [name, value] of Object.entries(violation.params ?? {})) {
      result[name] = value ?? '';
    }
    return result;
  }
}
