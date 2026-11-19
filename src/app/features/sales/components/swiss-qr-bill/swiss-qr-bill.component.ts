import { Component, computed, inject, OnInit, signal } from '@angular/core';
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
import { SwissQrBillApiService } from '@core/api/swiss-qr-bill-api.service';
import { QrReferenceCheck } from '@core/models/swiss-qr-bill.model';
import { PageHeaderComponent, TranslatePipe, GridExportDirective, GridSortPipe, GridFilterListPipe, GridFilterFnPipe, downloadBlob } from '@shared';
import { QrBill } from '@domain/models/qr-bill.model';
import { QrBillStore } from '../../state/qr-bill.store';
import { QrBillPreviewComponent } from '../qr-bill-preview/qr-bill-preview.component';

@Component({
  selector: 'app-swiss-qr-bill',
  styleUrl: './swiss-qr-bill.component.scss',
  imports: [
    GridExportDirective,
    GridSortPipe, GridFilterListPipe, GridFilterFnPipe,
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
    QrBillPreviewComponent,
  ],
  templateUrl: './swiss-qr-bill.component.html',
})
export class SwissQrBillComponent implements OnInit {
  readonly store = inject(QrBillStore);
  private readonly qrApi = inject(SwissQrBillApiService);

  readonly validating = signal(false);
  readonly downloadingPdf = signal(false);
  readonly referenceCheckResult = signal<QrReferenceCheck | null>(null);

  readonly billForm = new FormGroup({
    iban: new FormControl('CH4431999123000889012', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    reference: new FormControl('210000000003139471430009017', {
      nonNullable: true,
    }),
    rawAmount: new FormControl<number>(1450.83, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0.05)],
    }),
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

  onValidateReference(): void {
    this.billForm.markAllAsTouched();
    if (this.billForm.invalid) {
      return;
    }
    const { iban, reference } = this.billForm.getRawValue();
    this.validating.set(true);
    this.qrApi.validateReference(iban.trim(), reference.trim() || null).subscribe({
      next: (res) => {
        this.validating.set(false);
        this.referenceCheckResult.set(res.data);
      },
      error: () => {
        this.validating.set(false);
        this.referenceCheckResult.set(null);
      },
    });
  }

  downloadInvoiceQrPdf(bill: QrBill): void {
    this.downloadingPdf.set(true);
    this.qrApi.generatePdf({ invoice_id: bill.id, mode: 'A4_ATTACHED' }).subscribe({
      next: (blob) => {
        this.downloadingPdf.set(false);
        downloadBlob(blob, `qr-bill-${bill.billNumber || bill.id}.pdf`);
      },
      error: () => {
        this.downloadingPdf.set(false);
      },
    });
  }
}
