import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  RMA_DISPOSITIONS,
  RMA_RESOLUTION_TYPES,
  ReturnsApiService,
  ReturnsRma,
  ReturnsRmaInspectLineRequest,
  ReturnsRmaResolveRequest,
  RmaDisposition,
  RmaResolutionType,
  RmaStatus,
  TranslateService,
} from '@core';
import { ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { ReturnsLookupsService } from './returns-lookups.service';
import { apiErrorText, RMA_STATUS_COLORS } from './returns.util';

type RmaDialog = 'edit' | 'approve' | 'reject' | 'receive' | 'inspect' | 'resolve';

/** What the inspector decided for one received line, edited in the inspection dialog. */
export interface InspectRow {
  id: string;
  description: string;
  received: string;
  quantity_inspected: string;
  disposition: RmaDisposition;
  warehouse_id: string;
  supplier_id: string;
  notes: string;
}

/** One customer return with its lines and the workflow actions its status allows. */
@Component({
  selector: 'app-returns-rma-detail',
  styleUrl: './returns.scss',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    ModalActionsDirective,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    @if (rma(); as record) {
      <app-page-header [title]="record.rma_number" [subtitle]="record.customer_name">
        <a nz-button routerLink="/returns/rmas">{{ 'RETURNS.BACK_TO_LIST' | translate }}</a>
        @if (record.status === 'requested') {
          <button nz-button (click)="openDialog('edit')">{{ 'RETURNS.EDIT' | translate }}</button>
        }
        @if (can('approved')) {
          <button nz-button nzType="primary" (click)="openDialog('approve')">{{ 'RETURNS.APPROVE' | translate }}</button>
        }
        @if (can('received')) {
          <button nz-button nzType="primary" (click)="openDialog('receive')">{{ 'RETURNS.RECEIVE' | translate }}</button>
        }
        @if (can('inspected')) {
          <button nz-button nzType="primary" (click)="openDialog('inspect')">{{ 'RETURNS.INSPECT' | translate }}</button>
        }
        @if (can('resolved')) {
          <button nz-button nzType="primary" (click)="openDialog('resolve')">{{ 'RETURNS.RESOLVE' | translate }}</button>
        }
        @if (can('closed')) {
          <button nz-button nzType="primary" (click)="close()">{{ 'RETURNS.CLOSE' | translate }}</button>
        }
        @if (can('rejected')) {
          <button nz-button nzDanger (click)="openDialog('reject')">{{ 'RETURNS.REJECT' | translate }}</button>
        }
      </app-page-header>

      <nz-card class="main-card">
        <dl class="detail-grid">
          <div>
            <dt>{{ 'RETURNS.STATUS' | translate }}</dt>
            <dd><nz-tag [nzColor]="statusColor(record.status)">{{ ('RETURNS.STATUS_' + record.status.toUpperCase()) | translate }}</nz-tag></dd>
          </div>
          <div>
            <dt>{{ 'RETURNS.REASON' | translate }}</dt>
            <dd>{{ record.reason_code }}</dd>
          </div>
          <div>
            <dt>{{ 'RETURNS.REQUESTED_ON' | translate }}</dt>
            <dd>
              {{ record.requested_on }}
              @if (record.window_overridden) {
                <nz-tag nzColor="orange">{{ 'RETURNS.WINDOW_OVERRIDDEN' | translate }}</nz-tag>
              }
            </dd>
          </div>
          @if (record.invoice_number) {
            <div>
              <dt>{{ 'RETURNS.SOURCE_INVOICE' | translate }}</dt>
              <dd>{{ record.invoice_number }}</dd>
            </div>
          }
          @if (record.resolution_type) {
            <div>
              <dt>{{ 'RETURNS.RESOLUTION' | translate }}</dt>
              <dd>{{ ('RETURNS.RESOLUTION_' + record.resolution_type.toUpperCase()) | translate }}</dd>
            </div>
          }
          @if (record.refund_amount !== null) {
            <div>
              <dt>{{ 'RETURNS.REFUND_AMOUNT' | translate }}</dt>
              <dd>{{ record.refund_amount }}</dd>
            </div>
          }
          @if (record.credit_note_reference) {
            <div>
              <dt>{{ 'RETURNS.CREDIT_NOTE_REFERENCE' | translate }}</dt>
              <dd>{{ record.credit_note_reference }}</dd>
            </div>
          }
          @if (record.rejection_reason) {
            <div>
              <dt>{{ 'RETURNS.REJECTION_REASON' | translate }}</dt>
              <dd>{{ record.rejection_reason }}</dd>
            </div>
          }
          @if (record.notes) {
            <div>
              <dt>{{ 'RETURNS.NOTES' | translate }}</dt>
              <dd>{{ record.notes }}</dd>
            </div>
          }
        </dl>
      </nz-card>

      <nz-card class="main-card" [nzTitle]="'RETURNS.LINES' | translate">
        <nz-table #table [nzData]="record.lines" [nzShowPagination]="false" nzSize="small">
          <thead>
            <tr>
              <th>{{ 'RETURNS.PRODUCT' | translate }}</th>
              <th>{{ 'RETURNS.SERIAL_OR_LOT' | translate }}</th>
              <th class="num">{{ 'RETURNS.QUANTITY' | translate }}</th>
              <th class="num">{{ 'RETURNS.RECEIVED' | translate }}</th>
              <th class="num">{{ 'RETURNS.INSPECTED' | translate }}</th>
              <th class="num">{{ 'RETURNS.UNIT_PRICE' | translate }}</th>
              <th>{{ 'RETURNS.DISPOSITION' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (line of table.data; track line.id) {
              <tr>
                <td>{{ line.description }}</td>
                <td>{{ line.serial_number || line.lot_number || '-' }}</td>
                <td class="num">{{ line.quantity }}</td>
                <td class="num">{{ line.quantity_received }}</td>
                <td class="num">{{ line.quantity_inspected }}</td>
                <td class="num">{{ line.unit_price }}</td>
                <td>
                  @if (line.disposition) {
                    <nz-tag>{{ ('RETURNS.DISPOSITION_' + line.disposition.toUpperCase()) | translate }}</nz-tag>
                  } @else {
                    -
                  }
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-card>
    } @else if (!loading()) {
      <nz-empty [nzNotFoundContent]="'RETURNS.NOT_FOUND' | translate"></nz-empty>
    }

    <nz-modal appModalActions
      [nzVisible]="dialog() !== null"
      [nzTitle]="dialogTitle() | translate"
      (nzOnCancel)="dialog.set(null)"
      (nzOnOk)="submit()"
      okAction="confirm"
      [nzOkDisabled]="!dialogValid()"
      nzWidth="760px"
    >
      <ng-container *nzModalContent>
        @switch (dialog()) {
          @case ('edit') {
            <form nz-form [formGroup]="editForm" nzLayout="vertical">
              <nz-form-item>
                <nz-form-label>{{ 'RETURNS.REASON' | translate }}</nz-form-label>
                <nz-form-control>
                  <nz-select formControlName="reason_code">
                    @for (reason of lookups.reasons(); track reason.code) {
                      <nz-option [nzValue]="reason.code" [nzLabel]="reason.label"></nz-option>
                    }
                  </nz-select>
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label>{{ 'RETURNS.REQUESTED_ON' | translate }}</nz-form-label>
                <nz-form-control><input nz-input type="date" formControlName="requested_on" /></nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label>{{ 'RETURNS.NOTES' | translate }}</nz-form-label>
                <nz-form-control><textarea nz-input rows="3" formControlName="notes"></textarea></nz-form-control>
              </nz-form-item>
            </form>
          }
          @case ('approve') {
            <form nz-form [formGroup]="approveForm" nzLayout="vertical">
              <nz-form-item>
                <nz-form-label>{{ 'RETURNS.WAREHOUSE' | translate }}</nz-form-label>
                <nz-form-control>
                  <nz-select formControlName="warehouse_id" nzAllowClear>
                    @for (warehouse of lookups.warehouses(); track warehouse.id) {
                      <nz-option [nzValue]="warehouse.id" [nzLabel]="warehouse.label"></nz-option>
                    }
                  </nz-select>
                </nz-form-control>
              </nz-form-item>
            </form>
          }
          @case ('reject') {
            <form nz-form [formGroup]="rejectForm" nzLayout="vertical">
              <nz-form-item>
                <nz-form-label nzRequired>{{ 'RETURNS.REJECTION_REASON' | translate }}</nz-form-label>
                <nz-form-control><textarea nz-input rows="3" formControlName="reason"></textarea></nz-form-control>
              </nz-form-item>
            </form>
          }
          @case ('receive') {
            <form nz-form [formGroup]="receiveForm" nzLayout="vertical">
              <nz-form-item>
                <nz-form-label>{{ 'RETURNS.WAREHOUSE' | translate }}</nz-form-label>
                <nz-form-control>
                  <nz-select formControlName="warehouse_id" nzAllowClear>
                    @for (warehouse of lookups.warehouses(); track warehouse.id) {
                      <nz-option [nzValue]="warehouse.id" [nzLabel]="warehouse.label"></nz-option>
                    }
                  </nz-select>
                </nz-form-control>
              </nz-form-item>
            </form>
            @for (line of rma()?.lines ?? []; track line.id) {
              <div class="line-row">
                <div>
                  <strong>{{ line.description }}</strong>
                  <div class="muted">{{ 'RETURNS.AUTHORISED' | translate }}: {{ line.quantity }}</div>
                </div>
                <input
                  #received
                  nz-input
                  type="number"
                  min="0"
                  step="any"
                  [max]="line.quantity"
                  [attr.aria-label]="line.description"
                  [value]="receivedQuantities()[line.id] ?? line.quantity"
                  (input)="setReceived(line.id, received.value)"
                />
              </div>
            }
          }
          @case ('inspect') {
            @for (row of inspectRows(); track row.id) {
              <div class="inspect-row">
                <div>
                  <strong>{{ row.description }}</strong>
                  <div class="muted">{{ 'RETURNS.RECEIVED' | translate }}: {{ row.received }}</div>
                </div>
                <input
                  #inspected
                  nz-input
                  type="number"
                  min="0"
                  step="any"
                  [max]="row.received"
                  [attr.aria-label]="'RETURNS.INSPECTED' | translate"
                  [value]="row.quantity_inspected"
                  (input)="setInspect(row.id, 'quantity_inspected', inspected.value)"
                />
                <nz-select [ngModel]="row.disposition" (ngModelChange)="setInspect(row.id, 'disposition', $event)" [attr.aria-label]="'RETURNS.DISPOSITION' | translate">
                  @for (disposition of dispositions; track disposition) {
                    <nz-option [nzValue]="disposition" [nzLabel]="('RETURNS.DISPOSITION_' + disposition.toUpperCase()) | translate"></nz-option>
                  }
                </nz-select>
                @if (row.disposition === 'return_to_supplier') {
                  <nz-select [ngModel]="row.supplier_id" (ngModelChange)="setInspect(row.id, 'supplier_id', $event)" [nzPlaceHolder]="'RETURNS.SUPPLIER' | translate" nzShowSearch>
                    @for (supplier of lookups.suppliers(); track supplier.id) {
                      <nz-option [nzValue]="supplier.id" [nzLabel]="supplier.label"></nz-option>
                    }
                  </nz-select>
                } @else if (row.disposition === 'restock') {
                  <nz-select [ngModel]="row.warehouse_id" (ngModelChange)="setInspect(row.id, 'warehouse_id', $event)" [nzPlaceHolder]="'RETURNS.WAREHOUSE' | translate" nzAllowClear>
                    @for (warehouse of lookups.warehouses(); track warehouse.id) {
                      <nz-option [nzValue]="warehouse.id" [nzLabel]="warehouse.label"></nz-option>
                    }
                  </nz-select>
                } @else {
                  <span></span>
                }
              </div>
            }
            <p class="muted">{{ 'RETURNS.INSPECT_HINT' | translate }}</p>
          }
          @case ('resolve') {
            <form nz-form [formGroup]="resolveForm" nzLayout="vertical">
              <nz-form-item>
                <nz-form-label nzRequired>{{ 'RETURNS.RESOLUTION' | translate }}</nz-form-label>
                <nz-form-control>
                  <nz-select formControlName="resolution_type">
                    @for (type of resolutionTypes; track type) {
                      <nz-option [nzValue]="type" [nzLabel]="('RETURNS.RESOLUTION_' + type.toUpperCase()) | translate"></nz-option>
                    }
                  </nz-select>
                </nz-form-control>
              </nz-form-item>
              @if (resolutionType() === 'refund' || resolutionType() === 'credit_note') {
                <nz-form-item>
                  <nz-form-label>{{ 'RETURNS.REFUND_AMOUNT' | translate }}</nz-form-label>
                  <nz-form-control>
                    <input nz-input type="number" min="0" step="any" formControlName="refund_amount" />
                    <div class="muted">{{ 'RETURNS.REFUND_DEFAULT_HINT' | translate }}</div>
                  </nz-form-control>
                </nz-form-item>
              }
              @if (resolutionType() === 'credit_note') {
                <nz-form-item>
                  <nz-form-label nzRequired>{{ 'RETURNS.CREDIT_NOTE_REFERENCE' | translate }}</nz-form-label>
                  <nz-form-control><input nz-input formControlName="credit_note_reference" maxlength="100" /></nz-form-control>
                </nz-form-item>
              }
              @if (resolutionType() === 'replacement') {
                <nz-form-item>
                  <nz-form-label>{{ 'RETURNS.WAREHOUSE' | translate }}</nz-form-label>
                  <nz-form-control>
                    <nz-select formControlName="warehouse_id" nzAllowClear>
                      @for (warehouse of lookups.warehouses(); track warehouse.id) {
                        <nz-option [nzValue]="warehouse.id" [nzLabel]="warehouse.label"></nz-option>
                      }
                    </nz-select>
                  </nz-form-control>
                </nz-form-item>
              }
              <nz-form-item>
                <nz-form-label>{{ 'RETURNS.NOTES' | translate }}</nz-form-label>
                <nz-form-control><textarea nz-input rows="2" formControlName="notes"></textarea></nz-form-control>
              </nz-form-item>
            </form>
          }
        }
      </ng-container>
    </nz-modal>
  `,
})
export class ReturnsRmaDetailComponent implements OnInit {
  private readonly api = inject(ReturnsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly lookups = inject(ReturnsLookupsService);

  readonly dispositions = RMA_DISPOSITIONS;
  readonly resolutionTypes = RMA_RESOLUTION_TYPES;
  readonly rma = signal<ReturnsRma | null>(null);
  readonly loading = signal(false);
  readonly dialog = signal<RmaDialog | null>(null);
  readonly receivedQuantities = signal<Record<string, string>>({});
  readonly inspectRows = signal<InspectRow[]>([]);

  readonly editForm = this.fb.group({ reason_code: [''], requested_on: [''], notes: [''] });
  readonly approveForm = this.fb.group({ warehouse_id: [''] });
  readonly rejectForm = this.fb.group({ reason: ['', [Validators.required, Validators.maxLength(2000)]] });
  readonly receiveForm = this.fb.group({ warehouse_id: [''] });
  readonly resolveForm = this.fb.group({
    resolution_type: ['refund' as RmaResolutionType, [Validators.required]],
    refund_amount: [''],
    credit_note_reference: [''],
    warehouse_id: [''],
    notes: [''],
  });

  private readonly resolutionTypeValue = signal<RmaResolutionType>('refund');
  private readonly creditNoteReference = signal('');
  private readonly rejectReason = signal('');

  readonly resolutionType = computed(() => this.resolutionTypeValue());
  readonly dialogTitle = computed(() => `RETURNS.DIALOG_${(this.dialog() ?? 'approve').toUpperCase()}`);
  readonly dialogValid = computed(() => {
    switch (this.dialog()) {
      case 'reject':
        return this.rejectReason().trim() !== '';
      case 'inspect':
        return this.inspectRows().every((row) => Number(row.quantity_inspected) > 0 && (row.disposition !== 'return_to_supplier' || row.supplier_id !== ''));
      case 'resolve':
        return this.resolutionTypeValue() !== 'credit_note' || this.creditNoteReference().trim() !== '';
      default:
        return true;
    }
  });

  constructor() {
    this.resolveForm.controls.resolution_type.valueChanges.subscribe((type) => this.resolutionTypeValue.set(type));
    this.resolveForm.controls.credit_note_reference.valueChanges.subscribe((reference) => this.creditNoteReference.set(reference));
    this.rejectForm.controls.reason.valueChanges.subscribe((reason) => this.rejectReason.set(reason));
  }

  ngOnInit(): void {
    this.load();
  }

  statusColor(status: RmaStatus): string {
    return RMA_STATUS_COLORS[status];
  }

  /** Whether the status machine of the API lets the return move to the status. */
  can(status: RmaStatus): boolean {
    return this.rma()?.allowed_transitions.includes(status) ?? false;
  }

  load(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.loading.set(true);
    this.api.getRma(id).subscribe({
      next: (response) => {
        this.rma.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.rma.set(null);
      },
    });
  }

  openDialog(dialog: RmaDialog): void {
    const record = this.rma();
    if (record === null) {
      return;
    }

    this.lookups.loadWarehouses();
    switch (dialog) {
      case 'edit':
        this.lookups.loadReasons();
        this.editForm.reset({ reason_code: record.reason_code, requested_on: record.requested_on.slice(0, 10), notes: record.notes ?? '' });
        break;
      case 'approve':
        this.approveForm.reset({ warehouse_id: record.warehouse_id ?? '' });
        break;
      case 'reject':
        this.rejectForm.reset({ reason: '' });
        break;
      case 'receive':
        this.receiveForm.reset({ warehouse_id: record.warehouse_id ?? '' });
        this.receivedQuantities.set({});
        break;
      case 'inspect':
        this.lookups.loadSuppliers();
        this.inspectRows.set(
          record.lines
            .filter((line) => Number(line.quantity_received) > 0)
            .map((line) => ({
              id: line.id,
              description: line.description,
              received: line.quantity_received,
              quantity_inspected: line.quantity_received,
              disposition: 'restock' as RmaDisposition,
              warehouse_id: '',
              supplier_id: '',
              notes: '',
            })),
        );
        break;
      case 'resolve':
        this.resolveForm.reset({ resolution_type: 'refund', refund_amount: '', credit_note_reference: '', warehouse_id: '', notes: '' });
        break;
    }

    this.dialog.set(dialog);
  }

  setReceived(lineId: string, value: string): void {
    this.receivedQuantities.update((quantities) => ({ ...quantities, [lineId]: value }));
  }

  setInspect(lineId: string, field: 'quantity_inspected' | 'disposition' | 'warehouse_id' | 'supplier_id' | 'notes', value: string): void {
    this.inspectRows.update((rows) => rows.map((row) => (row.id === lineId ? { ...row, [field]: value } : row)));
  }

  submit(): void {
    const record = this.rma();
    const dialog = this.dialog();
    if (record === null || dialog === null) {
      return;
    }

    switch (dialog) {
      case 'edit': {
        const value = this.editForm.getRawValue();
        this.run(
          this.api.updateRma(record.id, {
            reason_code: value.reason_code || undefined,
            requested_on: value.requested_on || undefined,
            notes: value.notes || null,
          }),
          'RETURNS.RMA_UPDATED',
        );
        break;
      }
      case 'approve':
        this.run(this.api.approveRma(record.id, this.approveForm.getRawValue().warehouse_id || null), 'RETURNS.RMA_APPROVED');
        break;
      case 'reject':
        this.run(this.api.rejectRma(record.id, this.rejectForm.getRawValue().reason), 'RETURNS.RMA_REJECTED');
        break;
      case 'receive':
        this.run(
          this.api.receiveRma(record.id, {
            warehouse_id: this.receiveForm.getRawValue().warehouse_id || null,
            lines: record.lines.map((line) => ({ id: line.id, quantity_received: Number(this.receivedQuantities()[line.id] ?? line.quantity) })),
          }),
          'RETURNS.RMA_RECEIVED',
        );
        break;
      case 'inspect':
        this.run(this.api.inspectRma(record.id, this.inspectPayload()), 'RETURNS.RMA_INSPECTED');
        break;
      case 'resolve':
        this.run(this.api.resolveRma(record.id, this.resolvePayload()), 'RETURNS.RMA_RESOLVED');
        break;
    }
  }

  close(): void {
    const record = this.rma();
    if (record !== null) {
      this.run(this.api.closeRma(record.id), 'RETURNS.RMA_CLOSED');
    }
  }

  private inspectPayload(): ReturnsRmaInspectLineRequest[] {
    return this.inspectRows().map((row) => ({
      id: row.id,
      quantity_inspected: Number(row.quantity_inspected),
      disposition: row.disposition,
      warehouse_id: row.disposition === 'restock' ? row.warehouse_id || null : null,
      supplier_id: row.disposition === 'return_to_supplier' ? row.supplier_id : null,
      notes: row.notes || null,
    }));
  }

  private resolvePayload(): ReturnsRmaResolveRequest {
    const value = this.resolveForm.getRawValue();
    const type = value.resolution_type;
    const money = type === 'refund' || type === 'credit_note';

    return {
      resolution_type: type,
      refund_amount: money && value.refund_amount !== '' ? Number(value.refund_amount) : null,
      credit_note_reference: type === 'credit_note' ? value.credit_note_reference : null,
      warehouse_id: type === 'replacement' ? value.warehouse_id || null : null,
      notes: value.notes || null,
    };
  }

  private run(request: ReturnType<ReturnsApiService['approveRma']>, successKey: string): void {
    request.subscribe({
      next: (response) => {
        this.message.success(this.translate.instant(successKey));
        this.dialog.set(null);
        this.rma.set(response.data);
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('RETURNS.ACTION_ERROR')),
    });
  }
}
