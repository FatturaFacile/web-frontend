import { Component, computed, inject, OnInit, signal } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { DstConsignmentDirection, PermissionsService, TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import {
  DISTRIBUTION_MODULE,
  DstOutcome,
  formatQuantity,
  nullable,
  numberOrNull,
} from './distribution.util';
import { ConsignmentStore } from './consignment.store';

type Panel = 'settlement' | 'return' | 'reconciliation';

/** Consignment stock (at third parties / from third parties): consumption settlements, returns and the 3PL stock reconciliation. */
@Component({
  selector: 'app-dst-consignment',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzDrawerModule,
    NzEmptyModule,
    NzInputModule,
    NzInputNumberModule,
    NzRadioModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    PageHeaderComponent,
    ReactiveFormsModule,
    TranslatePipe,
  ],
  providers: [ConsignmentStore],
  styleUrl: './distribution.scss',
  template: `
    <app-page-header [title]="'PAGE_TITLE.DISTRIBUTION_CONSIGNMENT' | translate"></app-page-header>

    @if (store.error(); as error) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        [nzMessage]="error | translate"
      ></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      <nz-tabs>
        <nz-tab [nzTitle]="'distribution.section.consignmentStock' | translate">
          <div class="toolbar">
            <nz-radio-group [ngModel]="store.direction()" (ngModelChange)="direction($event)">
              <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
              <label nz-radio-button nzValue="out">{{
                'distribution.direction.out' | translate
              }}</label>
              <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
              <label nz-radio-button nzValue="in">{{
                'distribution.direction.in' | translate
              }}</label>
            </nz-radio-group>
            <span class="spacer"></span>
            @if (canWrite) {
              @if (store.direction() === 'out') {
                <button nz-button type="button" (click)="openPanel('return')">
                  {{ 'distribution.action.returnConsignment' | translate }}
                </button>
              }
              <button nz-button nzType="primary" type="button" (click)="openPanel('settlement')">
                {{ 'distribution.action.recordSettlement' | translate }}
              </button>
            }
          </div>
          <p class="muted">
            {{ 'distribution.kpi.consignmentValue' | translate }}:
            <strong>{{ store.totalValue().toFixed(2) }}</strong>
          </p>
          <nz-table
            #stockTable
            nzSize="small"
            [nzData]="store.stock()"
            [nzShowPagination]="false"
            [nzScroll]="{ x: '800px' }"
          >
            <thead>
              <tr>
                <th scope="col">{{ 'distribution.field.warehouse' | translate }}</th>
                <th scope="col">{{ 'distribution.field.item' | translate }}</th>
                <th scope="col" class="num">{{ 'distribution.field.quantity' | translate }}</th>
                <th scope="col" class="num">{{ 'distribution.field.unitCost' | translate }}</th>
                <th scope="col" class="num">{{ 'distribution.field.value' | translate }}</th>
                <th scope="col" class="num">{{ 'distribution.field.daysHeld' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (row of stockTable.data; track row.warehouse.id + row.stock_item.id) {
                <tr>
                  <th scope="row">{{ row.warehouse.code }} {{ row.warehouse.name }}</th>
                  <td>
                    {{ row.stock_item.sku }} <small class="muted">{{ row.stock_item.name }}</small>
                  </td>
                  <td class="num">{{ quantity(row.quantity) }} {{ row.stock_item.uom }}</td>
                  <td class="num">{{ row.unit_cost }}</td>
                  <td class="num">{{ row.value }}</td>
                  <td class="num">
                    <nz-tag [nzColor]="row.is_overdue ? 'red' : 'default'"
                      >{{ row.days_held
                      }}{{
                        row.max_consignment_days ? ' / ' + row.max_consignment_days : ''
                      }}</nz-tag
                    >
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6">
                    <nz-empty
                      [nzNotFoundContent]="'distribution.empty.consignment' | translate"
                    ></nz-empty>
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-tab>

        <nz-tab [nzTitle]="'distribution.section.settlements' | translate">
          <nz-table
            #setTable
            nzSize="small"
            [nzData]="store.settlements()"
            [nzShowPagination]="false"
            [nzScroll]="{ x: '800px' }"
          >
            <thead>
              <tr>
                <th scope="col">{{ 'distribution.field.settlementNumber' | translate }}</th>
                <th scope="col">{{ 'distribution.field.warehouse' | translate }}</th>
                <th scope="col">{{ 'distribution.field.direction' | translate }}</th>
                <th scope="col" class="num">{{ 'distribution.field.quantity' | translate }}</th>
                <th scope="col" class="num">{{ 'distribution.field.value' | translate }}</th>
                <th scope="col">{{ 'distribution.field.settledAt' | translate }}</th>
                <th scope="col">{{ 'distribution.field.status' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (row of setTable.data; track row.id) {
                <tr>
                  <th scope="row">{{ row.settlement_number }}</th>
                  <td>{{ row.warehouse.code }}</td>
                  <td>{{ 'distribution.direction.' + row.direction | translate }}</td>
                  <td class="num">{{ quantity(row.total_quantity) }}</td>
                  <td class="num">{{ row.total_value }}</td>
                  <td>{{ row.settled_at }}</td>
                  <td>
                    <nz-tag [nzColor]="row.status === 'invoiced' ? 'green' : 'blue'">{{
                      'distribution.settlementStatus.' + row.status | translate
                    }}</nz-tag>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7">
                    <nz-empty
                      [nzNotFoundContent]="'distribution.empty.settlements' | translate"
                    ></nz-empty>
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-tab>

        <nz-tab [nzTitle]="'distribution.section.reconciliation' | translate">
          <div class="toolbar">
            <span class="spacer"></span>
            @if (canWrite) {
              <button
                nz-button
                nzType="primary"
                type="button"
                (click)="openPanel('reconciliation')"
              >
                {{ 'distribution.action.reconcile3pl' | translate }}
              </button>
            }
          </div>
          <nz-table
            #recTable
            nzSize="small"
            [nzData]="store.reconciliations()"
            [nzShowPagination]="false"
            [nzScroll]="{ x: '800px' }"
          >
            <thead>
              <tr>
                <th scope="col">{{ 'distribution.field.warehouse' | translate }}</th>
                <th scope="col">{{ 'distribution.field.externalReference' | translate }}</th>
                <th scope="col">{{ 'distribution.field.status' | translate }}</th>
                <th scope="col">{{ 'distribution.field.differences' | translate }}</th>
                <th scope="col">{{ 'distribution.field.reconciledAt' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (row of recTable.data; track row.id) {
                <tr>
                  <th scope="row">{{ row.warehouse.code }} {{ row.warehouse.name }}</th>
                  <td>{{ row.external_reference ?? '—' }}</td>
                  <td>
                    <nz-tag [nzColor]="row.status === 'balanced' ? 'green' : 'red'">{{
                      'distribution.reconciliationStatus.' + row.status | translate
                    }}</nz-tag>
                  </td>
                  <td>
                    @for (line of row.lines; track line.stock_item_id) {
                      @if (quantity(line.difference) !== '0') {
                        <small class="muted"
                          >{{ line.sku }}: {{ quantity(line.system_quantity) }} →
                          {{ quantity(line.external_quantity) }} ({{
                            quantity(line.difference)
                          }})</small
                        >
                      }
                    }
                  </td>
                  <td>{{ row.reconciled_at }}</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="5">
                    <nz-empty
                      [nzNotFoundContent]="'distribution.empty.reconciliations' | translate"
                    ></nz-empty>
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-tab>
      </nz-tabs>
    </nz-spin>

    <nz-drawer
      [nzVisible]="panel() !== null"
      [nzWidth]="640"
      [nzTitle]="'distribution.section.' + (panel() ?? 'settlement') | translate"
      (nzOnClose)="panel.set(null)"
    >
      <ng-container *nzDrawerContent>
        @if (formError(); as failure) {
          <nz-alert
            class="feedback"
            nzType="error"
            nzShowIcon
            [nzMessage]="
              failure.errorKey ?? 'distribution.error.generic' | translate: failure.params
            "
            [nzDescription]="failure.detail ?? null"
          ></nz-alert>
        }
        <form [formGroup]="form" class="form" (ngSubmit)="submit()">
          <label class="field" for="dst-c-warehouse">
            <span>{{ 'distribution.field.warehouse' | translate }}</span>
            <nz-select nzId="dst-c-warehouse" formControlName="warehouse_id" nzShowSearch>
              @for (warehouse of warehouseOptions(); track warehouse.id) {
                <nz-option
                  [nzValue]="warehouse.id"
                  [nzLabel]="warehouse.code + ' ' + warehouse.name"
                ></nz-option>
              }
            </nz-select>
          </label>
          @if (panel() === 'return') {
            <label class="field" for="dst-c-destination">
              <span>{{ 'distribution.field.destination' | translate }}</span>
              <nz-select
                nzId="dst-c-destination"
                formControlName="destination_warehouse_id"
                nzShowSearch
              >
                @for (warehouse of internalWarehouses(); track warehouse.id) {
                  <nz-option
                    [nzValue]="warehouse.id"
                    [nzLabel]="warehouse.code + ' ' + warehouse.name"
                  ></nz-option>
                }
              </nz-select>
            </label>
          }
          @if (panel() !== 'return') {
            <label class="field" for="dst-c-reference">
              <span>{{
                (panel() === 'reconciliation'
                  ? 'distribution.field.externalReference'
                  : 'distribution.field.reference'
                ) | translate
              }}</span>
              <input nz-input id="dst-c-reference" formControlName="reference" maxlength="120" />
            </label>
          }
          @if (panel() === 'settlement') {
            <label class="field" for="dst-c-date">
              <span>{{ 'distribution.field.settledAt' | translate }}</span>
              <input nz-input id="dst-c-date" type="date" formControlName="settled_at" />
            </label>
          }
          <div formArrayName="lines">
            @for (line of lines.controls; track line; let index = $index) {
              <div class="line-grid" [formGroupName]="index">
                <label class="field">
                  <span>{{ 'distribution.field.item' | translate }}</span>
                  <nz-select formControlName="stock_item_id" nzShowSearch>
                    @for (item of store.lookups()?.items ?? []; track item.id) {
                      <nz-option
                        [nzValue]="item.id"
                        [nzLabel]="item.sku + ' ' + item.name"
                      ></nz-option>
                    }
                  </nz-select>
                </label>
                <label class="field">
                  <span>{{
                    (panel() === 'reconciliation'
                      ? 'distribution.field.externalQuantity'
                      : 'distribution.field.quantity'
                    ) | translate
                  }}</span>
                  <nz-input-number
                    formControlName="quantity"
                    [nzMin]="0"
                    [nzStep]="1"
                  ></nz-input-number>
                </label>
                @if (panel() === 'settlement') {
                  <label class="field">
                    <span>{{ 'distribution.field.unitPrice' | translate }}</span>
                    <nz-input-number
                      formControlName="unit_price"
                      [nzMin]="0"
                      [nzStep]="0.01"
                    ></nz-input-number>
                  </label>
                } @else {
                  <span></span>
                }
                <span></span>
                <button
                  nz-button
                  nzDanger
                  type="button"
                  [disabled]="lines.length < 2"
                  (click)="lines.removeAt(index)"
                >
                  {{ 'distribution.action.removeLine' | translate }}
                </button>
              </div>
            }
          </div>
          <button nz-button type="button" (click)="addLine()">
            {{ 'distribution.action.addLine' | translate }}
          </button>
          <div class="actions">
            <button
              nz-button
              nzType="primary"
              type="submit"
              [nzLoading]="store.saving()"
              [disabled]="form.invalid"
            >
              {{ 'distribution.action.save' | translate }}
            </button>
            <button nz-button type="button" (click)="panel.set(null)">
              {{ 'distribution.action.cancel' | translate }}
            </button>
          </div>
        </form>
      </ng-container>
    </nz-drawer>
  `,
})
export class ConsignmentComponent implements OnInit {
  protected readonly store = inject(ConsignmentStore);
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly canWrite = inject(PermissionsService).canWrite(DISTRIBUTION_MODULE);
  protected readonly panel = signal<Panel | null>(null);
  protected readonly formError = signal<DstOutcome | null>(null);

  /** The warehouses the open panel works on: third-party sites for a settlement or a return, 3PL sites for a reconciliation. */
  protected readonly warehouseOptions = computed(() => {
    const roles =
      this.panel() === 'reconciliation'
        ? ['third_party_3pl']
        : this.store.direction() === 'in'
          ? ['consignment_in']
          : ['consignment_out', 'consignment_in'];
    return (this.store.lookups()?.warehouses ?? []).filter(
      (warehouse) => warehouse.role !== null && roles.includes(warehouse.role),
    );
  });
  protected readonly internalWarehouses = computed(() =>
    (this.store.lookups()?.warehouses ?? []).filter(
      (warehouse) => warehouse.role === 'internal' || warehouse.role === null,
    ),
  );

  protected readonly form = this.fb.group({
    warehouse_id: ['', Validators.required],
    destination_warehouse_id: [''],
    reference: [''],
    settled_at: [''],
    lines: this.fb.array([this.newLine()]),
  });

  protected get lines(): FormArray {
    return this.form.controls.lines;
  }

  ngOnInit(): void {
    void this.store.init();
  }

  protected quantity(value: string | number): string {
    return formatQuantity(value);
  }

  protected direction(value: DstConsignmentDirection): void {
    void this.store.setDirection(value);
  }

  private newLine(): FormGroup {
    return this.fb.group({
      stock_item_id: ['', Validators.required],
      quantity: [1, [Validators.required, Validators.min(0)]],
      unit_price: [null as number | null],
    });
  }

  protected addLine(): void {
    this.lines.push(this.newLine());
  }

  protected openPanel(panel: Panel): void {
    this.form.reset({
      warehouse_id: '',
      destination_warehouse_id: '',
      reference: '',
      settled_at: '',
    });
    this.lines.clear();
    this.addLine();
    this.formError.set(null);
    this.panel.set(panel);
  }

  protected async submit(): Promise<void> {
    const panel = this.panel();
    const value = this.form.getRawValue();
    const lines = value.lines as {
      stock_item_id: string;
      quantity: number;
      unit_price: number | null;
    }[];
    let outcome: DstOutcome;
    if (panel === 'settlement') {
      outcome = await this.store.settle({
        warehouse_id: value.warehouse_id,
        reference: nullable(value.reference),
        settled_at: nullable(value.settled_at),
        lines: lines.map((line) => ({
          stock_item_id: line.stock_item_id,
          quantity: Number(line.quantity),
          unit_price: numberOrNull(line.unit_price),
        })),
      });
    } else if (panel === 'return') {
      outcome = await this.store.giveBack({
        warehouse_id: value.warehouse_id,
        destination_warehouse_id: value.destination_warehouse_id,
        lines: lines.map((line) => ({
          stock_item_id: line.stock_item_id,
          quantity: Number(line.quantity),
        })),
      });
    } else {
      outcome = await this.store.reconcile({
        warehouse_id: value.warehouse_id,
        external_reference: nullable(value.reference),
        lines: lines.map((line) => ({
          stock_item_id: line.stock_item_id,
          external_quantity: Number(line.quantity),
        })),
      });
    }
    if (outcome.ok) {
      this.message.success(this.i18n.instant('distribution.notification.saved'));
      this.panel.set(null);
    } else {
      this.formError.set(outcome);
    }
  }
}
