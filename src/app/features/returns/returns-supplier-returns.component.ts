import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  RETURNS_SUPPLIER_RETURN_STATUSES,
  ReturnsApiService,
  ReturnsSupplierReturn,
  ReturnsSupplierReturnLineRequest,
  ReturnsSupplierReturnStatus,
  TranslateService,
} from '@core';
import { IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { ReturnsLookupsService } from './returns-lookups.service';
import { apiErrorText, SUPPLIER_RETURN_STATUS_COLORS } from './returns.util';

type SupplierReturnDialog = 'ship' | 'credit';

/** A line being typed in the form of a supplier return. */
export interface SupplierLineDraft {
  product_id: string;
  quantity: string;
  unit_cost: string;
}

/** Returns to the supplier (RTV): draft, shipment with tracking and stock exit, credit and closing. */
@Component({
  selector: 'app-returns-supplier-returns',
  styleUrl: './returns.scss',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    IconActionDirective,
    ModalActionsDirective,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'RETURNS.SUPPLIER_TITLE' | translate" [subtitle]="'RETURNS.SUPPLIER_SUBTITLE' | translate">
      <button nz-button nzType="primary" (click)="openCreate()" appIconAction="create"></button>
    </app-page-header>

    <div class="toolbar">
      <nz-select style="width: 200px" nzAllowClear [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event); load()" [nzPlaceHolder]="'RETURNS.STATUS' | translate">
        @for (status of statuses; track status) {
          <nz-option [nzValue]="status" [nzLabel]="('RETURNS.RTV_' + status.toUpperCase()) | translate"></nz-option>
        }
      </nz-select>
      <input nz-input style="width: 240px" [ngModel]="search()" (ngModelChange)="search.set($event)" (keyup.enter)="load()" [placeholder]="'RETURNS.SEARCH_RTV' | translate" />
    </div>

    <nz-card class="main-card">
      <nz-table #table [nzData]="returns()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="25">
        <thead>
          <tr>
            <th>{{ 'RETURNS.RTV_NUMBER' | translate }}</th>
            <th>{{ 'RETURNS.SUPPLIER' | translate }}</th>
            <th>{{ 'RETURNS.TRACKING' | translate }}</th>
            <th class="num">{{ 'RETURNS.CREDIT_EXPECTED' | translate }}</th>
            <th class="num">{{ 'RETURNS.CREDIT_RECEIVED' | translate }}</th>
            <th>{{ 'RETURNS.STATUS' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <td>{{ row.return_number }}</td>
              <td>{{ row.supplier_name }}</td>
              <td>{{ row.carrier ? row.carrier + ' ' : '' }}{{ row.tracking_number || '-' }}</td>
              <td class="num">{{ row.credit_expected }} {{ row.currency }}</td>
              <td class="num">{{ row.credit_received ?? '-' }}</td>
              <td><nz-tag [nzColor]="statusColor(row.status)">{{ ('RETURNS.RTV_' + row.status.toUpperCase()) | translate }}</nz-tag></td>
              <td>
                @if (row.status === 'draft') {
                  <button nz-button nzType="text" (click)="openEdit(row)">{{ 'RETURNS.EDIT' | translate }}</button>
                }
                @if (allows(row, 'shipped')) {
                  <button nz-button nzType="text" (click)="openDialog('ship', row)">{{ 'RETURNS.SHIP' | translate }}</button>
                }
                @if (allows(row, 'credited')) {
                  <button nz-button nzType="text" (click)="openDialog('credit', row)">{{ 'RETURNS.RECORD_CREDIT' | translate }}</button>
                }
                @if (allows(row, 'closed')) {
                  <button nz-button nzType="text" (click)="close(row)">{{ 'RETURNS.CLOSE' | translate }}</button>
                }
                @if (allows(row, 'cancelled')) {
                  <button nz-button nzType="text" nzDanger nz-popconfirm [nzPopconfirmTitle]="'RETURNS.CANCEL_RTV_CONFIRM' | translate" (nzOnConfirm)="cancel(row)">
                    {{ 'RETURNS.CANCEL' | translate }}
                  </button>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && returns().length === 0) {
        <nz-empty [nzNotFoundContent]="'RETURNS.NO_SUPPLIER_RETURNS' | translate"></nz-empty>
      }
    </nz-card>

    <nz-modal appModalActions
      [(nzVisible)]="createVisible"
      [nzTitle]="(editingId() ? 'RETURNS.EDIT_SUPPLIER_RETURN' : 'RETURNS.NEW_SUPPLIER_RETURN') | translate"
      (nzOnCancel)="createVisible.set(false)"
      (nzOnOk)="save()"
      okAction="save"
      [nzOkDisabled]="form.invalid || !hasLines()"
      nzWidth="760px"
    >
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="form" nzLayout="vertical">
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'RETURNS.SUPPLIER' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="supplier_id" nzShowSearch>
                  @for (supplier of lookups.suppliers(); track supplier.id) {
                    <nz-option [nzValue]="supplier.id" [nzLabel]="supplier.label"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'RETURNS.REASON' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="reason_code" nzAllowClear>
                  @for (reason of lookups.reasons(); track reason.code) {
                    <nz-option [nzValue]="reason.code" [nzLabel]="reason.label"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label>{{ 'RETURNS.CARRIER' | translate }}</nz-form-label>
              <nz-form-control><input nz-input formControlName="carrier" maxlength="100" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'RETURNS.TRACKING' | translate }}</nz-form-label>
              <nz-form-control><input nz-input formControlName="tracking_number" maxlength="100" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'RETURNS.CREDIT_EXPECTED' | translate }}</nz-form-label>
              <nz-form-control><input nz-input type="number" min="0" step="any" formControlName="credit_expected" /></nz-form-control>
            </nz-form-item>
          </div>

          <h4>{{ 'RETURNS.LINES' | translate }}</h4>
          @for (line of lines(); track $index; let index = $index) {
            <div class="supplier-line-row">
              <nz-select
                [ngModel]="line.product_id"
                (ngModelChange)="setLine(index, 'product_id', $event)"
                nzShowSearch
                nzServerSearch
                (nzOnSearch)="lookups.searchProducts($event)"
                [nzPlaceHolder]="'RETURNS.PRODUCT' | translate"
                [ngModelOptions]="{ standalone: true }"
              >
                @for (product of lookups.products(); track product.id) {
                  <nz-option [nzValue]="product.id" [nzLabel]="product.label"></nz-option>
                }
              </nz-select>
              <input
                #quantity
                nz-input
                type="number"
                min="0"
                step="any"
                [attr.aria-label]="'RETURNS.QUANTITY' | translate"
                [value]="line.quantity"
                (input)="setLine(index, 'quantity', quantity.value)"
              />
              <input
                #cost
                nz-input
                type="number"
                min="0"
                step="any"
                [attr.aria-label]="'RETURNS.UNIT_COST' | translate"
                [placeholder]="'RETURNS.UNIT_COST' | translate"
                [value]="line.unit_cost"
                (input)="setLine(index, 'unit_cost', cost.value)"
              />
              <button nz-button nzType="text" nzDanger type="button" appIconAction="delete" (click)="removeLine(index)"></button>
            </div>
          }
          <button nz-button type="button" (click)="addLine()" appIconAction="add"></button>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal appModalActions
      [nzVisible]="dialog() !== null"
      [nzTitle]="(dialog() === 'ship' ? 'RETURNS.SHIP_RTV' : 'RETURNS.RECORD_CREDIT') | translate"
      (nzOnCancel)="dialog.set(null)"
      (nzOnOk)="submitDialog()"
      okAction="confirm"
      [nzOkDisabled]="dialog() === 'credit' && creditReceived() === ''"
    >
      <ng-container *nzModalContent>
        @if (dialog() === 'ship') {
          <nz-form-item>
            <nz-form-label>{{ 'RETURNS.WAREHOUSE' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select [ngModel]="shipWarehouse()" (ngModelChange)="shipWarehouse.set($event)" nzAllowClear>
                @for (warehouse of lookups.warehouses(); track warehouse.id) {
                  <nz-option [nzValue]="warehouse.id" [nzLabel]="warehouse.label"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>{{ 'RETURNS.CARRIER' | translate }}</nz-form-label>
            <nz-form-control><input nz-input [ngModel]="shipCarrier()" (ngModelChange)="shipCarrier.set($event)" maxlength="100" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>{{ 'RETURNS.TRACKING' | translate }}</nz-form-label>
            <nz-form-control><input nz-input [ngModel]="shipTracking()" (ngModelChange)="shipTracking.set($event)" maxlength="100" /></nz-form-control>
          </nz-form-item>
          <p class="muted">{{ 'RETURNS.SHIP_HINT' | translate }}</p>
        } @else {
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'RETURNS.CREDIT_RECEIVED' | translate }}</nz-form-label>
            <nz-form-control><input nz-input type="number" min="0" step="any" [ngModel]="creditReceived()" (ngModelChange)="creditReceived.set($event)" /></nz-form-control>
          </nz-form-item>
        }
      </ng-container>
    </nz-modal>
  `,
})
export class ReturnsSupplierReturnsComponent implements OnInit {
  private readonly api = inject(ReturnsApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly lookups = inject(ReturnsLookupsService);

  readonly statuses = RETURNS_SUPPLIER_RETURN_STATUSES;
  readonly returns = signal<ReturnsSupplierReturn[]>([]);
  readonly loading = signal(false);
  readonly statusFilter = signal<ReturnsSupplierReturnStatus | null>(null);
  readonly search = signal('');
  readonly createVisible = signal(false);
  /** Id of the draft being edited, null while creating. */
  readonly editingId = signal<string | null>(null);
  readonly lines = signal<SupplierLineDraft[]>([]);
  readonly dialog = signal<SupplierReturnDialog | null>(null);
  readonly shipWarehouse = signal('');
  readonly shipCarrier = signal('');
  readonly shipTracking = signal('');
  readonly creditReceived = signal('');
  private acting: ReturnsSupplierReturn | null = null;

  readonly form = this.fb.group({
    supplier_id: ['', [Validators.required]],
    reason_code: [''],
    carrier: [''],
    tracking_number: [''],
    credit_expected: [''],
  });

  readonly hasLines = computed(() => this.lines().length > 0 && this.lines().every((line) => line.product_id !== '' && Number(line.quantity) > 0));

  ngOnInit(): void {
    this.load();
  }

  statusColor(status: ReturnsSupplierReturnStatus): string {
    return SUPPLIER_RETURN_STATUS_COLORS[status];
  }

  /** Whether the status machine of the API lets the supplier return move to the status. */
  allows(record: ReturnsSupplierReturn, status: ReturnsSupplierReturnStatus): boolean {
    return record.allowed_transitions.includes(status);
  }

  load(): void {
    this.loading.set(true);
    this.api.getSupplierReturns({ status: this.statusFilter() ?? undefined, search: this.search() || undefined, per_page: 100 }).subscribe({
      next: (response) => {
        this.returns.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('RETURNS.ACTION_ERROR'));
      },
    });
  }

  openEdit(record: ReturnsSupplierReturn): void {
    this.editingId.set(record.id);
    this.form.reset({
      supplier_id: record.supplier_id,
      reason_code: record.reason_code ?? '',
      carrier: record.carrier ?? '',
      tracking_number: record.tracking_number ?? '',
      credit_expected: record.credit_expected ?? '',
    });
    this.lines.set(record.lines.map((line) => ({ product_id: line.product_id, quantity: String(line.quantity), unit_cost: line.unit_cost ?? '' })));
    this.lookups.loadSuppliers();
    this.lookups.loadReasons();
    this.lookups.searchProducts();
    this.createVisible.set(true);
  }

  openCreate(): void {
    this.editingId.set(null);
    this.form.reset({ supplier_id: '', reason_code: '', carrier: '', tracking_number: '', credit_expected: '' });
    this.lines.set([{ product_id: '', quantity: '1', unit_cost: '' }]);
    this.lookups.loadSuppliers();
    this.lookups.loadReasons();
    this.lookups.searchProducts();
    this.createVisible.set(true);
  }

  addLine(): void {
    this.lines.update((lines) => [...lines, { product_id: '', quantity: '1', unit_cost: '' }]);
  }

  removeLine(index: number): void {
    this.lines.update((lines) => lines.filter((_, position) => position !== index));
  }

  setLine(index: number, field: keyof SupplierLineDraft, value: string): void {
    this.lines.update((lines) => lines.map((line, position) => (position === index ? { ...line, [field]: value } : line)));
  }

  save(): void {
    const value = this.form.getRawValue();
    const lines: ReturnsSupplierReturnLineRequest[] = this.lines().map((line) => ({
      product_id: line.product_id,
      quantity: Number(line.quantity),
      unit_cost: line.unit_cost === '' ? null : Number(line.unit_cost),
    }));

    const payload = {
      supplier_id: value.supplier_id,
      reason_code: value.reason_code || null,
      carrier: value.carrier || null,
      tracking_number: value.tracking_number || null,
      credit_expected: value.credit_expected === '' ? null : Number(value.credit_expected),
      lines,
    };
    const editingId = this.editingId();
    (editingId === null ? this.api.createSupplierReturn(payload) : this.api.updateSupplierReturn(editingId, payload))
      .subscribe({
        next: () => {
          this.message.success(this.translate.instant('RETURNS.SUPPLIER_RETURN_SAVED'));
          this.createVisible.set(false);
          this.load();
        },
        error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('RETURNS.ACTION_ERROR')),
      });
  }

  openDialog(dialog: SupplierReturnDialog, record: ReturnsSupplierReturn): void {
    this.acting = record;
    this.shipWarehouse.set(record.warehouse_id ?? '');
    this.shipCarrier.set(record.carrier ?? '');
    this.shipTracking.set(record.tracking_number ?? '');
    this.creditReceived.set(record.credit_expected);
    this.lookups.loadWarehouses();
    this.dialog.set(dialog);
  }

  submitDialog(): void {
    if (this.acting === null) {
      return;
    }

    if (this.dialog() === 'ship') {
      this.run(
        this.api.shipSupplierReturn(this.acting.id, {
          warehouse_id: this.shipWarehouse() || null,
          carrier: this.shipCarrier() || null,
          tracking_number: this.shipTracking() || null,
        }),
        'RETURNS.SUPPLIER_RETURN_SHIPPED',
      );
    } else {
      this.run(this.api.creditSupplierReturn(this.acting.id, Number(this.creditReceived())), 'RETURNS.SUPPLIER_RETURN_CREDITED');
    }
  }

  close(record: ReturnsSupplierReturn): void {
    this.run(this.api.closeSupplierReturn(record.id), 'RETURNS.SUPPLIER_RETURN_CLOSED');
  }

  cancel(record: ReturnsSupplierReturn): void {
    this.run(this.api.cancelSupplierReturn(record.id), 'RETURNS.SUPPLIER_RETURN_CANCELLED');
  }

  private run(request: ReturnType<ReturnsApiService['closeSupplierReturn']>, successKey: string): void {
    request.subscribe({
      next: () => {
        this.message.success(this.translate.instant(successKey));
        this.dialog.set(null);
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('RETURNS.ACTION_ERROR')),
    });
  }
}
