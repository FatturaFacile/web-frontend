import { Component, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { CurrencyFormatPipe, PageHeaderComponent, TranslatePipe } from '@shared';

type MarginMode = 'from-price' | 'from-margin';

@Component({
  selector: 'app-margin-calculator',
  styleUrl: './margin-calculator.component.scss',
  imports: [
    ReactiveFormsModule,
    NzCardModule,
    NzFormModule,
    NzGridModule,
    NzInputNumberModule,
    NzSelectModule,
    NzStatisticModule,
    CurrencyFormatPipe,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './margin-calculator.component.html',
})
export class MarginCalculatorComponent {
  protected readonly modes: readonly { value: MarginMode; labelKey: string }[] = [
    { value: 'from-price', labelKey: 'TOOLS.MARGIN_FROM_PRICE' },
    { value: 'from-margin', labelKey: 'TOOLS.MARGIN_FROM_MARGIN' },
  ];

  protected readonly form = new FormGroup({
    mode: new FormControl<MarginMode>('from-price', { nonNullable: true }),
    cost: new FormControl<number>(60, { nonNullable: true }),
    price: new FormControl<number>(100, { nonNullable: true }),
    marginPercent: new FormControl<number>(40, { nonNullable: true }),
  });

  private readonly value = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  protected readonly isFromPrice = computed(() => this.value().mode !== 'from-margin');

  protected readonly result = computed(() => {
    const { mode, cost, price, marginPercent } = this.value();
    const unitCost = Number(cost ?? 0);
    const targetMargin = Math.min(Math.max(Number(marginPercent ?? 0), 0), 99.99);
    const sellingPrice =
      mode === 'from-margin' ? unitCost / (1 - targetMargin / 100) : Number(price ?? 0);
    const margin = sellingPrice - unitCost;
    return {
      price: sellingPrice,
      margin,
      marginPercent: sellingPrice > 0 ? (margin / sellingPrice) * 100 : 0,
      markupPercent: unitCost > 0 ? (margin / unitCost) * 100 : 0,
    };
  });
}
