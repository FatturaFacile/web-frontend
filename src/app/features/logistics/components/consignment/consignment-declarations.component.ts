import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AuthStore, ConsumptionReport, LOGISTICS_PERMISSIONS, LogisticsApiService, LookupProduct, LookupWarehouse, TranslateService, VendorReceiptPayload } from '@core';
import { ModalActionsDirective, TranslatePipe } from '@shared';
import { apiErrorMessage } from '../../logistics.ui';

type ReceiptLineGroup = FormGroup<{ product_id: FormControl<string>; quantity: FormControl<number> }>;

/** History of the consumption declarations and receipt of vendor-owned consignment goods. */
@Component({
  selector: 'app-consignment-declarations',
  imports: [
    CurrencyPipe,
    DatePipe,
    ReactiveFormsModule,
    NzButtonModule,
    NzFormModule,
    NzInputNumberModule,
    NzModalModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    ModalActionsDirective,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .toolbar {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 12px;
    }
    .line {
      display: flex;
      gap: 8px;
      margin-bottom: 8px;
    }
    .line nz-select {
      flex: 1;
    }
  `,
  template: `
    @if (canManage()) {
      <div class="toolbar">
        <button nz-button type="button" (click)="openReceipt()">{{ 'LOGISTICS.CONSIGNMENT.VENDOR_RECEIPT' | translate }}</button>
      </div>
    }

    <nz-table #table [nzData]="declarations()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="15">
      <thead>
        <tr>
          <th>{{ 'LOGISTICS.CONSIGNMENT.DECLARATION_PERIOD' | translate }}</th>
          <th>{{ 'LOGISTICS.CONSIGNMENT.DECLARATION_DIRECTION' | translate }}</th>
          <th>{{ 'LOGISTICS.CONSIGNMENT.DECLARATION_DOCUMENT' | translate }}</th>
          <th>{{ 'COMMON.STATUS' | translate }}</th>
          <th>{{ 'LOGISTICS.CONSIGNMENT.DECLARATION_TOTAL' | translate }}</th>
        </tr>
      </thead>
      <tbody>
        @for (row of table.data; track row.id) {
          <tr>
            <td>{{ row.period_start | date: 'dd/MM/yyyy' }} - {{ row.period_end | date: 'dd/MM/yyyy' }}</td>
            <td>{{ row.direction }}</td>
            <td>{{ row.generated_document_type ?? '-' }}</td>
            <td><nz-tag>{{ row.status }}</nz-tag></td>
            <td>{{ row.total_amount | currency: 'EUR' }}</td>
          </tr>
        }
      </tbody>
    </nz-table>

    <nz-modal appModalActions
      [nzVisible]="receiptOpen()"
      [nzTitle]="'LOGISTICS.CONSIGNMENT.VENDOR_RECEIPT' | translate"
      okAction="save"
      [nzOkDisabled]="receiptForm.invalid"
      (nzOnCancel)="receiptOpen.set(false)"
      (nzOnOk)="saveReceipt()"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="receiptForm">
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'LOGISTICS.CONSIGNMENT.RECEIPT_WAREHOUSE' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="warehouse_id" nzShowSearch>
                @for (w of warehouses(); track w.id) {
                  <nz-option [nzValue]="w.id" [nzLabel]="w.code + ' - ' + w.name"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <div formArrayName="lines">
            @for (line of lines.controls; track line; let i = $index) {
              <div class="line" [formGroupName]="i">
                <nz-select formControlName="product_id" nzShowSearch [nzPlaceHolder]="'LOGISTICS.DDT.LINE_PRODUCT' | translate">
                  @for (p of products(); track p.id) {
                    <nz-option [nzValue]="p.id" [nzLabel]="p.sku + ' - ' + p.name"></nz-option>
                  }
                </nz-select>
                <nz-input-number formControlName="quantity" [nzMin]="0.0001" />
                <button nz-button type="button" nzDanger [disabled]="lines.length === 1" (click)="removeLine(i)" [attr.aria-label]="'COMMON.DELETE' | translate">
                  <i class="fa-solid fa-trash" aria-hidden="true"></i>
                </button>
              </div>
            }
          </div>
          <button nz-button type="button" (click)="addLine()">{{ 'LOGISTICS.CONSIGNMENT.ADD_LINE' | translate }}</button>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class ConsignmentDeclarationsComponent implements OnInit {
  private readonly api = inject(LogisticsApiService);
  private readonly auth = inject(AuthStore);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly products = input<LookupProduct[]>([]);

  protected readonly declarations = signal<ConsumptionReport[]>([]);
  protected readonly warehouses = signal<LookupWarehouse[]>([]);
  protected readonly loading = signal(false);
  protected readonly receiptOpen = signal(false);

  protected readonly receiptForm = this.fb.group({
    warehouse_id: this.fb.control('', Validators.required),
    lines: this.fb.array<ReceiptLineGroup>([this.newLine()]),
  });

  protected get lines(): FormArray<ReceiptLineGroup> {
    return this.receiptForm.controls.lines;
  }

  ngOnInit(): void {
    this.load();
  }

  protected canManage(): boolean {
    return this.auth.can(LOGISTICS_PERMISSIONS.consignment);
  }

  protected load(): void {
    this.loading.set(true);
    this.api.listDeclarations().subscribe({
      next: (res) => {
        this.declarations.set(res.data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected openReceipt(): void {
    this.receiptForm.reset({ warehouse_id: '' });
    this.lines.clear();
    this.lines.push(this.newLine());
    this.api.warehouses('vendor_consignment').subscribe((res) => this.warehouses.set(res.data));
    this.receiptOpen.set(true);
  }

  protected addLine(): void {
    this.lines.push(this.newLine());
  }

  protected removeLine(index: number): void {
    this.lines.removeAt(index);
  }

  protected saveReceipt(): void {
    if (this.receiptForm.invalid) {
      this.receiptForm.markAllAsTouched();
      return;
    }
    const raw = this.receiptForm.getRawValue();
    const payload: VendorReceiptPayload = { warehouse_id: raw.warehouse_id, lines: raw.lines };
    this.api.receiveVendorConsignment(payload).subscribe({
      next: () => {
        this.receiptOpen.set(false);
        this.message.success(this.translate.instant('LOGISTICS.CONSIGNMENT.RECEIPT_SAVED'));
      },
      error: (error: unknown) => this.message.error(apiErrorMessage(error) ?? this.translate.instant('COMMON.ERROR')),
    });
  }

  private newLine(): ReceiptLineGroup {
    return this.fb.group({
      product_id: this.fb.control('', Validators.required),
      quantity: this.fb.control(1, [Validators.required, Validators.min(0.0001)]),
    });
  }
}
