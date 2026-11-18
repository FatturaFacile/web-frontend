import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { CrossBorderReadiness, ForeignTradeApiService } from '@core';
import { TranslatePipe } from '@shared';

/**
 * "Customs readiness" card of a cross-border invoice: whether Incoterm, tariff code, origin and net weight are all
 * present, which line lacks what, and the VAT regime with the follow-up obligations (VIES, Intrastat, customs
 * declaration).
 */
@Component({
  selector: 'app-cross-border-readiness',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NzAlertModule, NzCardModule, NzTagModule, TranslatePipe],
  template: `
    @if (readiness(); as r) {
      @if (r.cross_border) {
        <nz-card [nzTitle]="'FOREIGN_TRADE.READINESS.TITLE' | translate" nzSize="small" data-testid="cross-border-readiness">
          @if (r.ready) {
            <nz-alert nzType="success" nzShowIcon [nzMessage]="'FOREIGN_TRADE.READINESS.READY' | translate" />
          } @else {
            <nz-alert nzType="warning" nzShowIcon [nzMessage]="'FOREIGN_TRADE.READINESS.NOT_READY' | translate" />
            <ul class="issues">
              @for (issue of r.issues; track $index) {
                <li>
                  {{ 'FOREIGN_TRADE.READINESS.' + issue.code.toUpperCase() | translate }}
                  @if (issue.line !== null) {
                    ({{ 'FOREIGN_TRADE.READINESS.LINE' | translate }} {{ issue.line + 1 }})
                  }
                </li>
              }
            </ul>
          }
          @if (r.regime; as regime) {
            <p class="regime">
              {{ 'FOREIGN_TRADE.READINESS.REGIME' | translate }}:
              <strong>{{ 'FOREIGN_TRADE.REGIME.' + regime.regime.toUpperCase() | translate }}</strong>
            </p>
            @if (regime.requires_vies) {
              <nz-tag>{{ 'FOREIGN_TRADE.READINESS.VIES' | translate }}</nz-tag>
            }
            @if (regime.requires_intrastat) {
              <nz-tag>{{ 'FOREIGN_TRADE.READINESS.INTRASTAT' | translate }}</nz-tag>
            }
            @if (regime.requires_customs_declaration) {
              <nz-tag>{{ 'FOREIGN_TRADE.READINESS.CUSTOMS' | translate }}</nz-tag>
            }
          }
        </nz-card>
      }
    }
  `,
  styles: `
    .issues { margin: 8px 0 0; padding-left: 20px; }
    .regime { margin: 8px 0 4px; }
  `,
})
export class CrossBorderReadinessComponent {
  private readonly api = inject(ForeignTradeApiService);

  readonly invoiceId = input.required<string>();
  protected readonly readiness = signal<CrossBorderReadiness | null>(null);

  constructor() {
    effect(() => {
      this.api.getInvoiceReadiness(this.invoiceId()).subscribe({
        next: (res) => this.readiness.set(res.data),
        error: () => this.readiness.set(null),
      });
    });
  }
}
