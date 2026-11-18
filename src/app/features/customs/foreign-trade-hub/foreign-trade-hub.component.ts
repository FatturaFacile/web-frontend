import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { CustomsValueResult, ForeignTradeApiService, INCOTERMS_2020 } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';

export interface HubLink {
  readonly route: string;
  readonly titleKey: string;
  readonly descriptionKey: string;
}

/** The four areas of foreign trade, in the order of a cross-border shipment. */
export const FOREIGN_TRADE_HUB_LINKS: readonly HubLink[] = [
  { route: '/customs/trade-compliance', titleKey: 'FOREIGN_TRADE.HUB.SHIPMENTS', descriptionKey: 'FOREIGN_TRADE.HUB.SHIPMENTS_DESC' },
  { route: '/customs/taric-codes', titleKey: 'FOREIGN_TRADE.HUB.TARIFF', descriptionKey: 'FOREIGN_TRADE.HUB.TARIFF_DESC' },
  { route: '/customs/setup', titleKey: 'FOREIGN_TRADE.HUB.COMPLIANCE', descriptionKey: 'FOREIGN_TRADE.HUB.COMPLIANCE_DESC' },
  { route: '/intrastat', titleKey: 'FOREIGN_TRADE.HUB.INTRASTAT', descriptionKey: 'FOREIGN_TRADE.HUB.INTRASTAT_DESC' },
];

/** Landing page of the Foreign Trade & Customs area, with the Incoterm customs value calculator. */
@Component({
  selector: 'app-foreign-trade-hub',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    NzButtonModule,
    NzCardModule,
    NzFormModule,
    NzInputNumberModule,
    NzSelectModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  template: `
    <app-page-header
      [title]="'FOREIGN_TRADE.HUB.TITLE' | translate"
      [subtitle]="'FOREIGN_TRADE.HUB.SUBTITLE' | translate"
    />

    <div class="hub-grid">
      @for (link of links; track link.route) {
        <a class="hub-card" [routerLink]="link.route">
          <nz-card [nzTitle]="link.titleKey | translate" nzHoverable>
            {{ link.descriptionKey | translate }}
          </nz-card>
        </a>
      }
    </div>

    <nz-card [nzTitle]="'FOREIGN_TRADE.VALUE.TITLE' | translate">
      <form nz-form [formGroup]="form" (ngSubmit)="calculate()">
        <nz-form-item>
          <nz-form-label nzRequired>{{ 'FOREIGN_TRADE.VALUE.INCOTERM' | translate }}</nz-form-label>
          <nz-form-control>
            <nz-select formControlName="incoterm">
              @for (code of incoterms; track code) {
                <nz-option [nzValue]="code" [nzLabel]="code" />
              }
            </nz-select>
          </nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzRequired>{{ 'FOREIGN_TRADE.VALUE.GOODS' | translate }}</nz-form-label>
          <nz-form-control><nz-input-number formControlName="goods_value" [nzMin]="0" /></nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label>{{ 'FOREIGN_TRADE.VALUE.FREIGHT' | translate }}</nz-form-label>
          <nz-form-control><nz-input-number formControlName="freight" [nzMin]="0" /></nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label>{{ 'FOREIGN_TRADE.VALUE.INSURANCE' | translate }}</nz-form-label>
          <nz-form-control><nz-input-number formControlName="insurance" [nzMin]="0" /></nz-form-control>
        </nz-form-item>
        <button nz-button nzType="primary" type="submit" [disabled]="form.invalid || loading()">
          {{ 'FOREIGN_TRADE.VALUE.CALCULATE' | translate }}
        </button>
      </form>

      @if (result(); as value) {
        <p class="result" data-testid="customs-value">
          {{ 'FOREIGN_TRADE.VALUE.CUSTOMS_VALUE' | translate }}: <strong>{{ value.customs_value }}</strong>
        </p>
      }
    </nz-card>
  `,
  styles: `
    .hub-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-bottom: 16px; }
    .hub-card { display: block; color: inherit; }
    .result { margin-top: 16px; }
  `,
})
export class ForeignTradeHubComponent {
  private readonly api = inject(ForeignTradeApiService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly links = FOREIGN_TRADE_HUB_LINKS;
  readonly incoterms = INCOTERMS_2020;
  readonly loading = signal(false);
  readonly result = signal<CustomsValueResult | null>(null);

  readonly form = this.fb.group({
    incoterm: this.fb.control<(typeof INCOTERMS_2020)[number]>('EXW', Validators.required),
    goods_value: this.fb.control(0, [Validators.required, Validators.min(0)]),
    freight: this.fb.control(0),
    insurance: this.fb.control(0),
  });

  calculate(): void {
    if (this.form.invalid) {
      return;
    }
    this.loading.set(true);
    this.api.calculateCustomsValue(this.form.getRawValue()).subscribe({
      next: (res) => {
        this.result.set(res.data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
