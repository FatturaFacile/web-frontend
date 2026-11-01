import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { LookupItemDto, LookupService } from '@core';
import { TranslatePipe } from '@shared';

@Component({
  selector: 'app-payment-selector',
  imports: [FormsModule, NzSelectModule, TranslatePipe],
  templateUrl: './payment-selector.component.html',
})
export class PaymentSelectorComponent implements OnInit {
  private readonly lookupService = inject(LookupService);

  readonly paymentTypes = signal<LookupItemDto[]>([]);
  selectedPaymentType: string | null = null;

  async ngOnInit(): Promise<void> {
    const items = await this.lookupService.getLookup('payment_type');
    this.paymentTypes.set(items);
  }
}
