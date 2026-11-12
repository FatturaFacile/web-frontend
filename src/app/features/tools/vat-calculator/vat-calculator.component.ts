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

type VatMode = 'net-to-gross' | 'gross-to-net';

@Component({
  selector: 'app-vat-calculator',
  styleUrl: './vat-calculator.component.scss',
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
  templateUrl: './vat-calculator.component.html',
})
export class VatCalculatorComponent {
  protected readonly rates = [22, 10, 5, 4, 0] as const;
  protected readonly modes: readonly { value: VatMode; labelKey: string }[] = [
    { value: 'net-to-gross', labelKey: 'TOOLS.VAT_NET_TO_GROSS' },
    { value: 'gross-to-net', labelKey: 'TOOLS.VAT_GROSS_TO_NET' },
  ];

  protected readonly form = new FormGroup({
    amount: new FormControl<number>(100, { nonNullable: true }),
    rate: new FormControl<number>(22, { nonNullable: true }),
    mode: new FormControl<VatMode>('net-to-gross', { nonNullable: true }),
  });

  private readonly value = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  protected readonly result = computed(() => {
    const { amount, rate, mode } = this.value();
    const base = Number(amount ?? 0);
    const pct = Number(rate ?? 0) / 100;
    const net = mode === 'gross-to-net' ? base / (1 + pct) : base;
    const gross = mode === 'gross-to-net' ? base : base * (1 + pct);
    return { net, vat: gross - net, gross };
  });
}
