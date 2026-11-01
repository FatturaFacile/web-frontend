import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { LookupService } from '../../core/lookups/lookup.service';
import { LookupItemDto } from '../../core/lookups/lookup.types';

@Component({
  selector: 'app-payment-selector',
  standalone: true,
  imports: [CommonModule, FormsModule, NzSelectModule],
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
