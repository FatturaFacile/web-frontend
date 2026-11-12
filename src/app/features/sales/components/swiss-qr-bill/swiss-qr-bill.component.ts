import { Component, computed, inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { QrBill } from '@domain/models/qr-bill.model';
import { QrBillStore } from '../../state/qr-bill.store';

@Component({
  selector: 'app-swiss-qr-bill',
  imports: [
    ReactiveFormsModule,
    DecimalPipe,
    NzCardModule,
    NzFormModule,
    NzGridModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    NzButtonModule,
    NzAlertModule,
    NzSpinModule,
    NzStatisticModule,
    NzDividerModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './swiss-qr-bill.component.html',
})
export class SwissQrBillComponent implements OnInit {
  readonly store = inject(QrBillStore);

  readonly billForm = new FormGroup({
    debtorName: new FormControl('Bernasconi Costruzioni SA', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    debtorAddress: new FormControl('Corso Elvezia 18', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    debtorPostalCode: new FormControl('6900', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    debtorCity: new FormControl('Lugano', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    rawAmount: new FormControl<number>(1450.83, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0.05)],
    }),
    message: new FormControl('Fornitura sistemi gestionali Q4 2026', { nonNullable: true }),
  });

  readonly roundedAmount = computed(() => {
    const raw = this.billForm.controls.rawAmount.value ?? 0;
    return Math.round(raw * 20) / 20;
  });

  ngOnInit(): void {
    this.store.loadBills();
  }

  formatScor(reference: string): string {
    return reference.replace(/(\d{2})(\d{5})(\d{5})(\d{5})(\d{5})(\d{5})/, '$1 $2 $3 $4 $5 $6');
  }

  onCreateBill(): void {
    if (this.billForm.valid) {
      const formVal = this.billForm.getRawValue();
      const rounded = Math.round(formVal.rawAmount * 20) / 20;
      const newBill: QrBill = {
        id: `qrb-${Date.now()}`,
        billNumber: `QR-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        currency: 'CHF',
        amount: rounded,
        creditor: {
          name: 'Helvetia Tech SA',
          address: 'Via Nassa 12',
          postalCode: '6900',
          city: 'Lugano',
          country: 'CH',
          qrIban: 'CH4431999123000889012',
        },
        debtor: {
          name: formVal.debtorName,
          address: formVal.debtorAddress,
          postalCode: formVal.debtorPostalCode,
          city: formVal.debtorCity,
          country: 'CH',
        },
        reference: `21000000000${Math.floor(100000000000000 + Math.random() * 900000000000000)}`,
        unstructuredMessage: formVal.message,
        status: 'PENDING',
      };

      this.store.addBill(newBill);
    }
  }
}
