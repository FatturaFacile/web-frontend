import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { RecruitingLocale } from '@core';
import { TranslatePipe } from '@shared';

/** Publication-language selector of the careers portal. */
@Component({
  selector: 'app-careers-locale-switcher',
  imports: [FormsModule, NzSelectModule, TranslatePipe],
  template: `
    <span class="switcher">
      <label class="switcher__label" for="careers-locale">{{
        'careers.language' | translate
      }}</label>
      <nz-select
        nzId="careers-locale"
        class="switcher__select"
        nzSize="small"
        [ngModel]="locale()"
        (ngModelChange)="changed.emit($event)"
      >
        @for (l of locales(); track l) {
          <nz-option [nzValue]="l" [nzLabel]="'careers.locales.' + l | translate" />
        }
      </nz-select>
    </span>
  `,
  styles: `
    .switcher {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .switcher__select {
      min-width: 150px;
    }
  `,
})
export class CareersLocaleSwitcherComponent {
  readonly locale = input.required<RecruitingLocale>();
  readonly locales = input.required<readonly RecruitingLocale[]>();
  readonly changed = output<RecruitingLocale>();
}
