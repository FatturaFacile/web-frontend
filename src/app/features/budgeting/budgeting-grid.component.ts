import { DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { BudgetGrid, BudgetGridCellRequest, BudgetGridRow, BudgetingApiService, TranslateService } from '@core';
import { ModalActionsDirective, TranslatePipe } from '@shared';
import { BudgetingDimensionsComponent } from './budgeting-dimensions.component';
import { apiErrorText, blankToNull, OPTIONAL_UUID_PATTERN } from './budgeting.util';

export type GridField = 'amount' | 'quantity' | 'unit_price';

/** The multidimensional grid of a version: account, cost centre and project rows against the months (or quarters). */
@Component({
  selector: 'app-budgeting-grid',
  styleUrl: './budgeting.scss',
  imports: [
    DecimalPipe,
    FormsModule,
    ReactiveFormsModule,
    BudgetingDimensionsComponent,
    ModalActionsDirective,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzSwitchModule,
    NzTableModule,
  ],
  template: `
    <div class="toolbar">
      <span class="muted">{{ grid() ? (('BUDGETING_CONTROL.GRANULARITY_' + grid()!.granularity.toUpperCase()) | translate) : '' }}</span>
      <nz-switch [(ngModel)]="showDetail" [attr.aria-label]="'BUDGETING_CONTROL.SHOW_QUANTITIES' | translate"></nz-switch>
      <span>{{ 'BUDGETING_CONTROL.SHOW_QUANTITIES' | translate }}</span>
      <span class="spacer"></span>
      @if (editable()) {
        <button nz-button (click)="openRow()">{{ 'BUDGETING_CONTROL.ADD_GRID_ROW' | translate }}</button>
        <button nz-button nzType="primary" (click)="save()" [disabled]="dirtyCount() === 0">{{ 'BUDGETING_CONTROL.SAVE_GRID' | translate }} ({{ dirtyCount() }})</button>
      }
    </div>

    @if (grid(); as data) {
      <nz-card class="main-card">
        <div class="grid-scroll">
          <table class="grid-table">
            <thead>
              <tr>
                <th>{{ 'BUDGETING.ACCOUNT' | translate }}</th>
                <th>{{ 'BUDGETING.COST_CENTER' | translate }}</th>
                <th>{{ 'BUDGETING.PROJECT_ID' | translate }}</th>
                @for (slot of data.slots; track slot.slot) {
                  <th class="num">{{ slot.label }}</th>
                }
                <th class="num">{{ 'BUDGETING_CONTROL.TOTAL' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.key) {
                <tr>
                  <td>{{ row.account_code }} <span class="muted">{{ row.account_name }}</span></td>
                  <td>{{ row.cost_center_code }}</td>
                  <td>{{ row.project_code }}</td>
                  @for (slot of data.slots; track slot.slot) {
                    <td class="num">
                      @if (editable()) {
                        <input nz-input nzSize="small" type="number" min="0" step="any" class="cell-input" [attr.aria-label]="slot.label" [ngModel]="value(row, slot.slot, 'amount')" (ngModelChange)="edit(row, slot.slot, 'amount', $event)" />
                        @if (showDetail) {
                          <input nz-input nzSize="small" type="number" min="0" step="any" class="cell-input" [attr.aria-label]="'BUDGETING_CONTROL.QUANTITY' | translate" [ngModel]="value(row, slot.slot, 'quantity')" (ngModelChange)="edit(row, slot.slot, 'quantity', $event)" />
                          <input nz-input nzSize="small" type="number" min="0" step="any" class="cell-input" [attr.aria-label]="'BUDGETING_CONTROL.UNIT_PRICE' | translate" [ngModel]="value(row, slot.slot, 'unit_price')" (ngModelChange)="edit(row, slot.slot, 'unit_price', $event)" />
                        }
                      } @else {
                        {{ row.cells[slot.slot]?.amount ?? '0.00' | number: '1.2-2' }}
                        @if (showDetail && row.cells[slot.slot]?.quantity) {
                          <div class="muted">{{ row.cells[slot.slot]?.quantity | number: '1.0-3' }} &times; {{ row.cells[slot.slot]?.unit_price | number: '1.2-4' }}</div>
                        }
                      }
                    </td>
                  }
                  <td class="num">{{ row.total | number: '1.2-2' }}</td>
                </tr>
              }
            </tbody>
            <tfoot>
              <tr>
                <th colspan="3">{{ 'BUDGETING_CONTROL.TOTAL' | translate }}</th>
                @for (slot of data.slots; track slot.slot) {
                  <th class="num">{{ (data.totals.slots[slot.slot] ?? '0.00') | number: '1.2-2' }}</th>
                }
                <th class="num">{{ data.totals.total | number: '1.2-2' }}</th>
              </tr>
            </tfoot>
          </table>
        </div>
        @if (rows().length === 0) {
          <nz-empty [nzNotFoundContent]="'BUDGETING.NO_LINES' | translate"></nz-empty>
        }
      </nz-card>
    }

    <nz-modal appModalActions [(nzVisible)]="rowVisible" [nzTitle]="'BUDGETING_CONTROL.ADD_GRID_ROW' | translate" (nzOnCancel)="rowVisible.set(false)" (nzOnOk)="addRow()" okAction="save" [nzOkDisabled]="rowForm.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="rowForm" nzLayout="vertical">
          <app-budgeting-dimensions [group]="rowForm" [accountRequired]="true" />
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class BudgetingGridComponent {
  private readonly api = inject(BudgetingApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly versionId = input.required<string>();
  readonly editable = input(false);
  readonly refresh = input(0);
  readonly changed = output<void>();

  readonly grid = signal<BudgetGrid | null>(null);
  readonly extraRows = signal<BudgetGridRow[]>([]);
  /** Edited cells by `rowKey|slot`. */
  readonly edits = signal<Record<string, Partial<Record<GridField, string | null>>>>({});
  readonly rowVisible = signal(false);
  showDetail = false;

  readonly rows = computed(() => [...(this.grid()?.rows ?? []), ...this.extraRows()]);
  readonly dirtyCount = computed(() => Object.keys(this.edits()).length);

  readonly rowForm = this.fb.group({
    account_id: ['', [Validators.required]],
    cost_center_id: this.fb.control<string | null>(null),
    project_id: ['', [Validators.pattern(OPTIONAL_UUID_PATTERN)]],
  });

  constructor() {
    effect(() => {
      this.versionId();
      this.refresh();
      this.load();
    });
  }

  load(): void {
    this.api.getGrid(this.versionId()).subscribe({
      next: (response) => {
        this.grid.set(response.data);
        this.extraRows.set([]);
        this.edits.set({});
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('BUDGETING.ACTION_ERROR')),
    });
  }

  value(row: BudgetGridRow, slot: number, field: GridField): string | null {
    const edited = this.edits()[`${row.key}|${slot}`]?.[field];
    if (edited !== undefined) {
      return edited;
    }

    const cell = row.cells[slot];
    return cell ? (field === 'amount' ? cell.amount : cell[field]) : field === 'amount' ? '0.00' : null;
  }

  edit(row: BudgetGridRow, slot: number, field: GridField, value: string | number | null): void {
    const key = `${row.key}|${slot}`;
    this.edits.update((edits) => ({ ...edits, [key]: { ...edits[key], [field]: value === null || value === '' ? null : String(value) } }));
  }

  openRow(): void {
    this.rowForm.reset({ account_id: '', cost_center_id: null, project_id: '' });
    this.rowVisible.set(true);
  }

  addRow(): void {
    const value = this.rowForm.getRawValue();
    const projectId = blankToNull(value.project_id);
    this.extraRows.update((rows) => [
      ...rows,
      {
        key: `new-${value.account_id}-${value.cost_center_id ?? ''}-${projectId ?? ''}`,
        account_id: value.account_id,
        account_code: null,
        account_name: value.account_id,
        cost_center_id: value.cost_center_id,
        cost_center_code: value.cost_center_id,
        cost_center_name: null,
        project_id: projectId,
        project_code: projectId,
        project_name: null,
        cells: {},
        total: '0.00',
      },
    ]);
    this.rowVisible.set(false);
  }

  save(): void {
    const cells: BudgetGridCellRequest[] = [];

    for (const [key, edit] of Object.entries(this.edits())) {
      const [rowKey, slot] = key.split('|');
      const row = this.rows().find((candidate) => candidate.key === rowKey);
      const amount = edit.amount ?? this.value(row as BudgetGridRow, Number(slot), 'amount');

      if (!row || amount === null) {
        continue;
      }

      cells.push({
        account_id: row.account_id,
        cost_center_id: row.cost_center_id,
        project_id: row.project_id,
        slot: Number(slot),
        amount,
        quantity: edit.quantity ?? this.value(row, Number(slot), 'quantity'),
        unit_price: edit.unit_price ?? this.value(row, Number(slot), 'unit_price'),
      });
    }

    if (cells.length === 0) {
      return;
    }

    this.api.saveGrid(this.versionId(), cells).subscribe({
      next: () => {
        this.message.success(this.translate.instant('BUDGETING_CONTROL.GRID_SAVED'));
        this.changed.emit();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('BUDGETING.ACTION_ERROR')),
    });
  }
}
