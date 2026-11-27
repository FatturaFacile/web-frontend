import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  DST_RECEIPT_RESOLUTIONS,
  DstAvailability,
  DstLookups,
  DstTransfer,
  PermissionsService,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import {
  DISTRIBUTION_MODULE,
  DstOutcome,
  expectedArrival,
  formatQuantity,
  needsResolution,
  nullable,
  outstandingQuantity,
  shortageOf,
  transferActions,
  transferStatusColor,
  TRANSFER_TABS,
} from './distribution.util';
import { TransfersStore } from './transfers.store';

type ModalKind = 'dispatch' | 'receive';

/** Transfers between warehouses: status tabs, creation with a live availability preview and the approve / dispatch / receive / cancel actions. */
@Component({
  selector: 'app-dst-transfers',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCheckboxModule,
    NzDrawerModule,
    NzEmptyModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    PageHeaderComponent,
    ReactiveFormsModule,
    TranslatePipe,
  ],
  providers: [TransfersStore],
  styleUrl: './distribution.scss',
  template: `
    <app-page-header [title]="'PAGE_TITLE.DISTRIBUTION_TRANSFERS' | translate"></app-page-header>

    <div class="toolbar">
      <label class="field" for="dst-t-q">
        <span>{{ 'distribution.field.search' | translate }}</span>
        <input nz-input id="dst-t-q" [ngModel]="store.query()" (ngModelChange)="onSearch($event)" />
      </label>
      <span class="spacer"></span>
      @if (canWrite) {
        <button nz-button nzType="primary" type="button" (click)="openCreate()">
          {{ 'distribution.action.newTransfer' | translate }}
        </button>
      }
    </div>

    @if (store.error(); as error) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        [nzMessage]="error | translate"
      ></nz-alert>
    }
    @if (feedback(); as failure) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        nzCloseable
        [nzMessage]="failure.errorKey ?? 'distribution.error.generic' | translate: failure.params"
        [nzDescription]="failure.detail ?? null"
        (nzOnClose)="feedback.set(null)"
      ></nz-alert>
    }

    <nz-tabs [nzSelectedIndex]="tabIndex()" (nzSelectedIndexChange)="onTab($any($event))">
      @for (tab of tabs; track tab ?? 'all') {
        <nz-tab [nzTitle]="tabTitle">
          <ng-template #tabTitle>
            {{
              (tab === null ? 'distribution.tab.all' : 'distribution.transferStatus.' + tab)
                | translate
            }}
            @if (tab !== null && store.statusCounts()[tab]; as count) {
              <nz-tag>{{ count }}</nz-tag>
            }
          </ng-template>
        </nz-tab>
      }
    </nz-tabs>

    <nz-spin [nzSpinning]="store.loading()">
      <nz-table
        #table
        nzSize="small"
        nzFrontPagination="false"
        [nzData]="store.transfers()"
        [nzTotal]="store.total()"
        [nzPageSize]="25"
        [nzPageIndex]="store.page()"
        [nzScroll]="{ x: '1000px' }"
        (nzPageIndexChange)="store.setPage($event)"
      >
        <thead>
          <tr>
            <th scope="col">{{ 'distribution.field.transfer' | translate }}</th>
            <th scope="col">{{ 'distribution.field.route' | translate }}</th>
            <th scope="col">{{ 'distribution.field.status' | translate }}</th>
            <th scope="col">{{ 'distribution.field.lines' | translate }}</th>
            <th scope="col">{{ 'distribution.field.expectedArrival' | translate }}</th>
            <th scope="col">{{ 'distribution.field.tracking' | translate }}</th>
            <th scope="col">{{ 'distribution.field.actions' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <th scope="row">{{ row.transfer_number }}</th>
              <td>{{ row.source_warehouse.code }} → {{ row.destination_warehouse.code }}</td>
              <td>
                <nz-tag [nzColor]="statusColor(row.status)">{{
                  'distribution.transferStatus.' + row.status | translate
                }}</nz-tag>
                @if (row.is_overdue) {
                  <nz-tag nzColor="red">{{ 'distribution.field.overdue' | translate }}</nz-tag>
                }
              </td>
              <td>
                @for (line of row.lines; track line.id) {
                  <small class="muted"
                    >{{ line.sku }} × {{ quantity(line.quantity) }}
                    @if (line.quantity_received !== '0' && line.quantity_received !== 0) {
                      ({{ quantity(line.quantity_received) }}
                      {{ 'distribution.field.received' | translate }})
                    }
                  </small>
                }
              </td>
              <td>{{ row.expected_arrival_date ?? '—' }}</td>
              <td>
                {{ row.carrier ?? '' }} {{ row.tracking_number ?? '' }}
                <small class="muted">{{ row.ddt_reference ?? '' }}</small>
              </td>
              <td class="row-actions">
                @if (canWrite) {
                  @let actions = actionsOf(row.status);
                  @if (actions.approve) {
                    <button
                      nz-button
                      nzSize="small"
                      type="button"
                      nz-popconfirm
                      [nzPopconfirmTitle]="'distribution.confirm.approveTransfer' | translate"
                      [nzOkText]="'distribution.action.confirm' | translate"
                      [nzCancelText]="'distribution.action.cancel' | translate"
                      (nzOnConfirm)="approve(row)"
                    >
                      {{ 'distribution.action.approve' | translate }}
                    </button>
                  }
                  @if (actions.dispatch) {
                    <button
                      nz-button
                      nzSize="small"
                      nzType="primary"
                      type="button"
                      (click)="openDispatch(row)"
                    >
                      {{ 'distribution.action.dispatch' | translate }}
                    </button>
                  }
                  @if (actions.receive) {
                    <button
                      nz-button
                      nzSize="small"
                      nzType="primary"
                      type="button"
                      (click)="openReceive(row)"
                    >
                      {{ 'distribution.action.receive' | translate }}
                    </button>
                  }
                  @if (actions.cancel) {
                    <button
                      nz-button
                      nzSize="small"
                      nzDanger
                      type="button"
                      nz-popconfirm
                      [nzPopconfirmTitle]="'distribution.confirm.cancelTransfer' | translate"
                      [nzOkText]="'distribution.action.confirm' | translate"
                      [nzCancelText]="'distribution.action.cancel' | translate"
                      (nzOnConfirm)="cancel(row)"
                    >
                      {{ 'distribution.action.cancelTransfer' | translate }}
                    </button>
                  }
                }
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="7">
                <nz-empty
                  [nzNotFoundContent]="'distribution.empty.transfers' | translate"
                ></nz-empty>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-spin>

    <nz-drawer
      [nzVisible]="createOpen()"
      [nzWidth]="860"
      [nzTitle]="'distribution.section.newTransfer' | translate"
      (nzOnClose)="createOpen.set(false)"
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
          <label class="field" for="dst-t-source">
            <span>{{ 'distribution.field.source' | translate }}</span>
            <nz-select nzId="dst-t-source" formControlName="source_warehouse_id" nzShowSearch>
              @for (warehouse of warehouses(); track warehouse.id) {
                <nz-option
                  [nzValue]="warehouse.id"
                  [nzLabel]="warehouse.code + ' ' + warehouse.name"
                ></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="dst-t-destination">
            <span>{{ 'distribution.field.destination' | translate }}</span>
            <nz-select
              nzId="dst-t-destination"
              formControlName="destination_warehouse_id"
              nzShowSearch
            >
              @for (warehouse of warehouses(); track warehouse.id) {
                <nz-option
                  [nzValue]="warehouse.id"
                  [nzLabel]="warehouse.code + ' ' + warehouse.name"
                ></nz-option>
              }
            </nz-select>
          </label>
          @if (laneHint(); as lane) {
            <nz-alert
              nzType="info"
              nzShowIcon
              [nzMessage]="
                'distribution.hint.laneLeadTime' | translate: { days: lane.days, hours: lane.hours }
              "
            ></nz-alert>
          }
          <label class="field" for="dst-t-date">
            <span>{{ 'distribution.field.requestedDate' | translate }}</span>
            <input nz-input id="dst-t-date" type="date" formControlName="requested_date" />
          </label>

          <div formArrayName="lines">
            @for (line of lines.controls; track line; let index = $index) {
              <div class="line-grid" [formGroupName]="index">
                <label class="field">
                  <span>{{ 'distribution.field.item' | translate }}</span>
                  <nz-select formControlName="stock_item_id" nzShowSearch>
                    @for (item of items(); track item.id) {
                      <nz-option
                        [nzValue]="item.id"
                        [nzLabel]="item.sku + ' ' + item.name"
                      ></nz-option>
                    }
                  </nz-select>
                  @if (availabilityOf(index); as stock) {
                    <span class="availability">{{
                      'distribution.hint.availability'
                        | translate
                          : {
                              available: quantity(stock.available),
                              onHand: quantity(stock.on_hand),
                              reserved: quantity(stock.reserved),
                            }
                    }}</span>
                  }
                </label>
                <label class="field">
                  <span>{{ 'distribution.field.lot' | translate }}</span>
                  <input nz-input formControlName="lot_id" maxlength="64" />
                </label>
                <label class="field">
                  <span>{{ 'distribution.field.quantity' | translate }}</span>
                  <nz-input-number
                    formControlName="quantity"
                    [nzMin]="0.0001"
                    [nzStep]="1"
                  ></nz-input-number>
                </label>
                <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
                <label class="field">
                  <span>{{ 'distribution.field.uom' | translate }}</span>
                  <span>{{ uomOf(index) }}</span>
                </label>
                <button
                  nz-button
                  nzDanger
                  type="button"
                  [disabled]="lines.length < 2"
                  (click)="removeLine(index)"
                >
                  {{ 'distribution.action.removeLine' | translate }}
                </button>
              </div>
            }
          </div>
          <button nz-button type="button" (click)="addLine()">
            {{ 'distribution.action.addLine' | translate }}
          </button>

          <label class="field" for="dst-t-notes">
            <span>{{ 'distribution.field.notes' | translate }}</span>
            <textarea
              nz-input
              id="dst-t-notes"
              rows="2"
              formControlName="notes"
              maxlength="2000"
            ></textarea>
          </label>
          <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
          <label nz-checkbox formControlName="auto_approve">{{
            'distribution.field.autoApprove' | translate
          }}</label>

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
            <button nz-button type="button" (click)="createOpen.set(false)">
              {{ 'distribution.action.cancel' | translate }}
            </button>
          </div>
        </form>
      </ng-container>
    </nz-drawer>

    <nz-modal
      [nzVisible]="modal() === 'dispatch'"
      [nzTitle]="'distribution.section.dispatch' | translate"
      [nzFooter]="null"
      (nzOnCancel)="closeModal()"
    >
      <ng-container *nzModalContent>
        @if (modalError(); as failure) {
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
        <form [formGroup]="dispatchForm" class="form" (ngSubmit)="submitDispatch()">
          <label class="field" for="dst-d-carrier">
            <span>{{ 'distribution.field.carrier' | translate }}</span>
            <input nz-input id="dst-d-carrier" formControlName="carrier" maxlength="120" />
          </label>
          <label class="field" for="dst-d-tracking">
            <span>{{ 'distribution.field.trackingNumber' | translate }}</span>
            <input nz-input id="dst-d-tracking" formControlName="tracking_number" maxlength="120" />
          </label>
          <label class="field" for="dst-d-ddt">
            <span>{{ 'distribution.field.ddtReference' | translate }}</span>
            <input nz-input id="dst-d-ddt" formControlName="ddt_reference" maxlength="120" />
          </label>
          <label class="field" for="dst-d-eta">
            <span>{{ 'distribution.field.expectedArrival' | translate }}</span>
            <input nz-input id="dst-d-eta" type="date" formControlName="expected_arrival_date" />
          </label>
          <div class="actions">
            <button nz-button nzType="primary" type="submit" [nzLoading]="store.saving()">
              {{ 'distribution.action.dispatch' | translate }}
            </button>
            <button nz-button type="button" (click)="closeModal()">
              {{ 'distribution.action.cancel' | translate }}
            </button>
          </div>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal
      [nzVisible]="modal() === 'receive'"
      [nzTitle]="'distribution.section.receive' | translate"
      [nzWidth]="760"
      [nzFooter]="null"
      (nzOnCancel)="closeModal()"
    >
      <ng-container *nzModalContent>
        @if (modalError(); as failure) {
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
        <form [formGroup]="receiveForm" class="form" (ngSubmit)="submitReceive()">
          <div formArrayName="lines">
            @for (line of receiveLines.controls; track line; let index = $index) {
              <div class="line-grid" [formGroupName]="index">
                <span>
                  <strong>{{ receiveRows()[index]?.sku }}</strong>
                  <small class="muted">{{ receiveRows()[index]?.name }}</small>
                  <small class="muted"
                    >{{ 'distribution.field.outstanding' | translate }}:
                    {{ quantity(receiveRows()[index]?.outstanding ?? 0) }}</small
                  >
                </span>
                <label class="field">
                  <span>{{ 'distribution.field.receivedGood' | translate }}</span>
                  <nz-input-number
                    formControlName="quantity"
                    [nzMin]="0"
                    [nzStep]="1"
                  ></nz-input-number>
                </label>
                <label class="field">
                  <span>{{ 'distribution.field.damaged' | translate }}</span>
                  <nz-input-number
                    formControlName="damaged_quantity"
                    [nzMin]="0"
                    [nzStep]="1"
                  ></nz-input-number>
                </label>
                <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
                <label class="field">
                  <span>{{ 'distribution.field.shortage' | translate }}</span>
                  <span [class.atp-low]="shortageAt(index) > 0">{{
                    quantity(shortageAt(index))
                  }}</span>
                </label>
              </div>
            }
          </div>
          <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
          <label nz-checkbox formControlName="final">{{
            'distribution.field.finalReceipt' | translate
          }}</label>
          @if (receiveNeedsResolution()) {
            <label class="field" for="dst-r-resolution">
              <span>{{ 'distribution.field.resolution' | translate }}</span>
              <nz-select nzId="dst-r-resolution" formControlName="resolution">
                @for (resolution of resolutions; track resolution) {
                  <nz-option
                    [nzValue]="resolution"
                    [nzLabel]="'distribution.resolution.' + resolution | translate"
                  ></nz-option>
                }
              </nz-select>
            </label>
            <nz-alert
              nzType="warning"
              nzShowIcon
              [nzMessage]="'distribution.hint.resolution' | translate"
            ></nz-alert>
          }
          <div class="actions">
            <button nz-button nzType="primary" type="submit" [nzLoading]="store.saving()">
              {{ 'distribution.action.receive' | translate }}
            </button>
            <button nz-button type="button" (click)="closeModal()">
              {{ 'distribution.action.cancel' | translate }}
            </button>
          </div>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class TransfersComponent implements OnInit {
  protected readonly store = inject(TransfersStore);
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly canWrite = inject(PermissionsService).canWrite(DISTRIBUTION_MODULE);
  protected readonly tabs = TRANSFER_TABS;
  protected readonly resolutions = DST_RECEIPT_RESOLUTIONS;
  protected readonly statusColor = transferStatusColor;
  protected readonly actionsOf = transferActions;

  protected readonly feedback = signal<DstOutcome | null>(null);
  protected readonly formError = signal<DstOutcome | null>(null);
  protected readonly modalError = signal<DstOutcome | null>(null);
  protected readonly createOpen = signal(false);
  protected readonly modal = signal<ModalKind | null>(null);
  protected readonly current = signal<DstTransfer | null>(null);
  protected readonly stock = signal<Record<string, DstAvailability>>({});

  protected readonly tabIndex = computed(() => this.tabs.indexOf(this.store.status()));
  protected readonly lookups = computed<DstLookups | null>(() => this.store.lookups());
  protected readonly warehouses = computed(() => this.lookups()?.warehouses ?? []);
  protected readonly items = computed(() => this.lookups()?.items ?? []);
  protected readonly laneHint = signal<{ days: number; hours: number } | null>(null);

  protected readonly form = this.fb.group({
    source_warehouse_id: ['', Validators.required],
    destination_warehouse_id: ['', Validators.required],
    requested_date: [''],
    notes: [''],
    auto_approve: [false],
    lines: this.fb.array([this.newLine()]),
  });

  protected readonly dispatchForm = this.fb.group({
    carrier: [''],
    tracking_number: [''],
    ddt_reference: [''],
    expected_arrival_date: [''],
  });

  protected readonly receiveForm = this.fb.group({
    lines: this.fb.array([] as FormGroup[]),
    final: [false],
    resolution: ['write_off' as (typeof DST_RECEIPT_RESOLUTIONS)[number]],
  });

  protected readonly receiveRows = signal<
    { id: string; sku: string; name: string; outstanding: number }[]
  >([]);
  private readonly receiveTick = signal(0);

  protected get lines(): FormArray {
    return this.form.controls.lines;
  }

  protected get receiveLines(): FormArray {
    return this.receiveForm.controls.lines as unknown as FormArray;
  }

  constructor() {
    this.form.controls.source_warehouse_id.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.refreshLane();
        this.refreshAllAvailability();
      });
    this.form.controls.destination_warehouse_id.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.refreshLane());
    this.receiveForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.receiveTick.update((n) => n + 1));
  }

  ngOnInit(): void {
    void this.store.load();
    void this.store.loadReferences();
  }

  protected quantity(value: string | number): string {
    return formatQuantity(value);
  }

  protected onTab(index: number): void {
    void this.store.setStatus(this.tabs[index] ?? null);
  }

  protected onSearch(value: string): void {
    void this.store.setQuery(value);
  }

  // --- Create ---

  private newLine() {
    return this.fb.group({
      stock_item_id: ['', Validators.required],
      lot_id: [''],
      quantity: [1, [Validators.required, Validators.min(0.0001)]],
    });
  }

  protected openCreate(): void {
    this.form.reset({
      source_warehouse_id: '',
      destination_warehouse_id: '',
      requested_date: '',
      notes: '',
      auto_approve: false,
    });
    this.lines.clear();
    this.addLine();
    this.stock.set({});
    this.laneHint.set(null);
    this.formError.set(null);
    this.createOpen.set(true);
  }

  protected addLine(): void {
    const group = this.newLine();
    group.controls.stock_item_id.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((itemId) => void this.loadAvailability(itemId));
    this.lines.push(group);
  }

  protected removeLine(index: number): void {
    this.lines.removeAt(index);
  }

  protected uomOf(index: number): string {
    const id = this.lines.at(index)?.value.stock_item_id;
    return this.items().find((item) => item.id === id)?.uom ?? '—';
  }

  protected availabilityOf(index: number): DstAvailability | null {
    const source = this.form.controls.source_warehouse_id.value;
    const item = this.lines.at(index)?.value.stock_item_id;
    return source && item ? (this.stock()[`${source}:${item}`] ?? null) : null;
  }

  private async loadAvailability(itemId: string): Promise<void> {
    const source = this.form.controls.source_warehouse_id.value;
    if (!source || !itemId) {
      return;
    }
    const availability = await this.store.availability(source, itemId);
    if (availability) {
      this.stock.update((current) => ({ ...current, [`${source}:${itemId}`]: availability }));
    }
  }

  private refreshAllAvailability(): void {
    for (const line of this.lines.controls) {
      void this.loadAvailability(line.value.stock_item_id);
    }
  }

  private refreshLane(): void {
    const lane = this.store.laneBetween(
      this.form.controls.source_warehouse_id.value || null,
      this.form.controls.destination_warehouse_id.value || null,
    );
    if (lane === null) {
      this.laneHint.set(null);
      return;
    }
    this.laneHint.set({ days: lane.lead_time_days, hours: lane.lead_time_hours });
    if (!this.form.controls.requested_date.value) {
      this.form.controls.requested_date.setValue(
        expectedArrival(new Date(), lane.lead_time_days, lane.lead_time_hours),
      );
    }
  }

  protected async submit(): Promise<void> {
    const value = this.form.getRawValue();
    const outcome = await this.store.create({
      source_warehouse_id: value.source_warehouse_id,
      destination_warehouse_id: value.destination_warehouse_id,
      requested_date: nullable(value.requested_date),
      notes: nullable(value.notes),
      auto_approve: value.auto_approve,
      lines: value.lines.map(
        (line: { stock_item_id: string; lot_id: string; quantity: number }) => ({
          stock_item_id: line.stock_item_id,
          lot_id: nullable(line.lot_id),
          quantity: Number(line.quantity),
        }),
      ),
    });
    if (outcome.ok) {
      this.message.success(this.i18n.instant('distribution.notification.transferCreated'));
      this.createOpen.set(false);
    } else {
      this.formError.set(outcome);
    }
  }

  // --- Workflow ---

  protected async approve(row: DstTransfer): Promise<void> {
    const outcome = await this.store.approve(row.id);
    this.feedback.set(outcome.ok ? null : outcome);
  }

  protected async cancel(row: DstTransfer): Promise<void> {
    const outcome = await this.store.cancel(row.id);
    this.feedback.set(outcome.ok ? null : outcome);
  }

  protected openDispatch(row: DstTransfer): void {
    this.current.set(row);
    const lane = this.store.laneBetween(row.source_warehouse.id, row.destination_warehouse.id);
    this.dispatchForm.reset({
      carrier: row.carrier ?? '',
      tracking_number: row.tracking_number ?? '',
      ddt_reference: row.ddt_reference ?? '',
      expected_arrival_date:
        row.expected_arrival_date ??
        (lane ? expectedArrival(new Date(), lane.lead_time_days, lane.lead_time_hours) : ''),
    });
    this.modalError.set(null);
    this.modal.set('dispatch');
  }

  protected async submitDispatch(): Promise<void> {
    const row = this.current();
    if (!row) {
      return;
    }
    const value = this.dispatchForm.getRawValue();
    const outcome = await this.store.dispatch(row.id, {
      carrier: nullable(value.carrier),
      tracking_number: nullable(value.tracking_number),
      ddt_reference: nullable(value.ddt_reference),
      expected_arrival_date: nullable(value.expected_arrival_date),
    });
    if (outcome.ok) {
      this.message.success(this.i18n.instant('distribution.notification.dispatched'));
      this.closeModal();
    } else {
      this.modalError.set(outcome);
    }
  }

  private newReceiptLine(outstanding = 0) {
    return this.fb.group({ quantity: [outstanding], damaged_quantity: [0] });
  }

  protected openReceive(row: DstTransfer): void {
    this.current.set(row);
    const rows = row.lines
      .map((line) => ({
        id: line.id,
        sku: line.sku,
        name: line.name,
        outstanding: outstandingQuantity(line),
      }))
      .filter((line) => line.outstanding > 0);
    this.receiveRows.set(rows);
    this.receiveLines.clear();
    for (const line of rows) {
      this.receiveLines.push(this.newReceiptLine(line.outstanding));
    }
    this.receiveForm.controls.final.setValue(true);
    this.receiveForm.controls.resolution.setValue('write_off');
    this.modalError.set(null);
    this.modal.set('receive');
  }

  protected shortageAt(index: number): number {
    this.receiveTick();
    const row = this.receiveRows()[index];
    const value = this.receiveLines.at(index)?.value as
      { quantity: number; damaged_quantity: number } | undefined;
    return row && value
      ? shortageOf(
          row.outstanding,
          Number(value.quantity) || 0,
          Number(value.damaged_quantity) || 0,
        )
      : 0;
  }

  protected receiveNeedsResolution(): boolean {
    this.receiveTick();
    return this.receiveRows().some((_, index) => {
      const value = this.receiveLines.at(index)?.value as { damaged_quantity: number } | undefined;
      return needsResolution(this.shortageAt(index), Number(value?.damaged_quantity) || 0);
    });
  }

  protected async submitReceive(): Promise<void> {
    const row = this.current();
    if (!row) {
      return;
    }
    const rows = this.receiveRows();
    const value = this.receiveForm.getRawValue();
    const lines = (value.lines as { quantity: number; damaged_quantity: number }[])
      .map((line: { quantity: number; damaged_quantity: number }, index: number) => ({
        line_id: rows[index].id,
        quantity: Number(line.quantity) || 0,
        damaged_quantity: Number(line.damaged_quantity) || 0,
      }))
      .filter(
        (line: { quantity: number; damaged_quantity: number }) =>
          line.quantity > 0 || line.damaged_quantity > 0,
      );
    const outcome = await this.store.receive(row.id, {
      lines,
      final: value.final,
      ...(this.receiveNeedsResolution() ? { resolution: value.resolution } : {}),
    });
    if (outcome.ok) {
      this.message.success(this.i18n.instant('distribution.notification.received'));
      this.closeModal();
    } else {
      this.modalError.set(outcome);
    }
  }

  protected closeModal(): void {
    this.modal.set(null);
    this.current.set(null);
  }
}
