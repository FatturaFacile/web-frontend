import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { DownPaymentChainComponent } from './down-payment-chain.component';

/** Page of one down-payment chain: the chain component fed with the id of the route. */
@Component({
  selector: 'app-dp-chain-detail-page',
  imports: [DownPaymentChainComponent, PageHeaderComponent, TranslatePipe],
  template: `
    <app-page-header
      [title]="'PAGE_TITLE.DOWN_PAYMENTS_CHAIN_DETAIL' | translate"
      [subtitle]="'down_payments.detail.subtitle' | translate"
    />
    <app-down-payment-chain [chainId]="chainId()" />
  `,
})
export class ChainDetailPageComponent {
  private readonly route = inject(ActivatedRoute);

  private readonly id = toSignal(this.route.paramMap.pipe(map((params) => params.get('id'))), {
    initialValue: this.route.snapshot.paramMap.get('id'),
  });

  protected readonly chainId = computed(() => this.id() ?? null);
}
