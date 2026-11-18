import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { INCOTERMS_2020 } from '@core';
import { TranslatePipe } from '@shared';

/**
 * Cross-border block of a sales document form: Incoterm 2020, named place and, optionally, the carriage and insurance
 * that the Incoterm leaves outside the price. It is highlighted with a warning when the counterparty country differs
 * from the country of the company, where customs data becomes mandatory.
 */
@Component({
  selector: 'app-cross-border-fields',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    NzAlertModule,
    NzFormModule,
    NzGridModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    TranslatePipe,
  ],
  template: `
    <section class="cross-border" [class.highlight]="crossBorder()" data-testid="cross-border-fields">
      <h4>{{ 'FOREIGN_TRADE.FIELDS.TITLE' | translate }}</h4>
      @if (crossBorder()) {
        <nz-alert nzType="warning" nzShowIcon [nzMessage]="'FOREIGN_TRADE.FIELDS.ALERT' | translate" />
      }
      <div nz-row [nzGutter]="16">
        <div nz-col [nzSpan]="costs() ? 6 : 12">
          <nz-form-item>
            <nz-form-label [nzRequired]="crossBorder()">{{ 'FOREIGN_TRADE.FIELDS.INCOTERM' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="'FOREIGN_TRADE.FIELDS.INCOTERM_REQUIRED' | translate">
              <nz-select [formControl]="incoterm()" nzAllowClear>
                @for (code of incoterms; track code) {
                  <nz-option [nzValue]="code" [nzLabel]="code" />
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
        </div>
        <div nz-col [nzSpan]="costs() ? 6 : 12">
          <nz-form-item>
            <nz-form-label>{{ 'FOREIGN_TRADE.FIELDS.PLACE' | translate }}</nz-form-label>
            <nz-form-control>
              <input nz-input maxlength="100" [formControl]="place()" />
            </nz-form-control>
          </nz-form-item>
        </div>
        @if (freight(); as freightControl) {
          <div nz-col [nzSpan]="6">
            <nz-form-item>
              <nz-form-label>{{ 'FOREIGN_TRADE.FIELDS.FREIGHT' | translate }}</nz-form-label>
              <nz-form-control><nz-input-number [formControl]="freightControl" [nzMin]="0" /></nz-form-control>
            </nz-form-item>
          </div>
        }
        @if (insurance(); as insuranceControl) {
          <div nz-col [nzSpan]="6">
            <nz-form-item>
              <nz-form-label>{{ 'FOREIGN_TRADE.FIELDS.INSURANCE' | translate }}</nz-form-label>
              <nz-form-control><nz-input-number [formControl]="insuranceControl" [nzMin]="0" /></nz-form-control>
            </nz-form-item>
          </div>
        }
      </div>
    </section>
  `,
  styles: `
    .cross-border { margin: 12px 0; padding: 12px; border: 1px solid var(--ant-color-border, #d9d9d9); border-radius: 6px; }
    .cross-border.highlight { border-color: var(--ant-color-warning, #faad14); }
    h4 { margin: 0 0 8px; }
    nz-alert { display: block; margin-bottom: 12px; }
  `,
})
export class CrossBorderFieldsComponent {
  readonly incoterm = input.required<FormControl<string | null>>();
  readonly place = input.required<FormControl<string | null>>();
  readonly freight = input<FormControl<number | null> | null>(null);
  readonly insurance = input<FormControl<number | null> | null>(null);
  /** The counterparty country differs from the one of the company. */
  readonly crossBorder = input(false);

  protected readonly incoterms = INCOTERMS_2020;
  protected readonly costs = computed(() => this.freight() !== null || this.insurance() !== null);
}
