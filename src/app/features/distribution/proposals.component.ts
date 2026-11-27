import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  DST_PROPOSAL_STATUSES,
  DST_PROPOSAL_TYPES,
  DstProposal,
  DstProposalStatus,
  DstProposalType,
  PermissionsService,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import {
  DISTRIBUTION_MODULE,
  DstOutcome,
  formatQuantity,
  proposalStatusColor,
  toNumber,
} from './distribution.util';
import { ProposalsStore } from './proposals.store';

/** Workbench of replenishment and balancing proposals: calculation drawer, quantity adjustment and bulk approval into transfers. */
@Component({
  selector: 'app-dst-proposals',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCheckboxModule,
    NzDrawerModule,
    NzEmptyModule,
    NzInputNumberModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  providers: [ProposalsStore],
  styleUrl: './distribution.scss',
  template: `
    <app-page-header [title]="'PAGE_TITLE.DISTRIBUTION_PROPOSALS' | translate"></app-page-header>

    <div class="toolbar">
      <label class="field" for="dst-p-type">
        <span>{{ 'distribution.field.proposalType' | translate }}</span>
        <nz-select
          nzId="dst-p-type"
          nzAllowClear
          [ngModel]="store.filters().proposal_type ?? null"
          (ngModelChange)="filter({ proposal_type: $event })"
        >
          @for (type of types; track type) {
            <nz-option
              [nzValue]="type"
              [nzLabel]="'distribution.proposalType.' + type | translate"
            ></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="dst-p-status">
        <span>{{ 'distribution.field.status' | translate }}</span>
        <nz-select
          nzId="dst-p-status"
          nzAllowClear
          [ngModel]="store.filters().status ?? null"
          (ngModelChange)="filter({ status: $event })"
        >
          @for (status of statuses; track status) {
            <nz-option
              [nzValue]="status"
              [nzLabel]="'distribution.proposalStatus.' + status | translate"
            ></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="dst-p-warehouse">
        <span>{{ 'distribution.field.warehouse' | translate }}</span>
        <nz-select
          nzId="dst-p-warehouse"
          nzAllowClear
          nzShowSearch
          [ngModel]="store.filters().warehouse_id ?? null"
          (ngModelChange)="filter({ warehouse_id: $event })"
        >
          @for (warehouse of store.lookups()?.warehouses ?? []; track warehouse.id) {
            <nz-option
              [nzValue]="warehouse.id"
              [nzLabel]="warehouse.code + ' ' + warehouse.name"
            ></nz-option>
          }
        </nz-select>
      </label>
      <span class="spacer"></span>
      @if (canWrite) {
        <button nz-button type="button" [nzLoading]="store.saving()" (click)="generate()">
          {{ 'distribution.action.generateProposals' | translate }}
        </button>
        <button
          nz-button
          type="button"
          [disabled]="store.selectedIds().length === 0"
          [nzLoading]="store.saving()"
          (click)="approve('draft')"
        >
          {{ 'distribution.action.approveAsDraft' | translate }}
        </button>
        <button
          nz-button
          nzType="primary"
          type="button"
          [disabled]="store.selectedIds().length === 0"
          [nzLoading]="store.saving()"
          (click)="approve('approved')"
        >
          {{
            'distribution.action.approveAsApproved'
              | translate: { count: store.selectedIds().length }
          }}
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
    @if (store.lastGenerated(); as result) {
      <nz-alert
        class="feedback"
        nzType="success"
        nzShowIcon
        nzCloseable
        [nzMessage]="
          'distribution.notification.generated'
            | translate
              : {
                  created: result.created,
                  balancing: result.balancing,
                  shortfalls: result.shortfalls,
                }
        "
      ></nz-alert>
    }
    @if (store.lastTransfers().length > 0) {
      <nz-alert
        class="feedback"
        nzType="success"
        nzShowIcon
        [nzMessage]="
          'distribution.notification.transfersCreated'
            | translate: { count: store.lastTransfers().length }
        "
        [nzDescription]="transferNumbers()"
      ></nz-alert>
    }
    @if (store.lastShortfalls().length > 0) {
      <nz-alert
        class="feedback"
        nzType="warning"
        nzShowIcon
        [nzMessage]="
          'distribution.notification.shortfalls'
            | translate: { count: store.lastShortfalls().length }
        "
        [nzDescription]="'distribution.hint.shortfallProcurement' | translate"
      ></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      <nz-table
        #table
        nzSize="small"
        [nzData]="store.proposals()"
        [nzShowPagination]="false"
        [nzScroll]="{ x: '1100px' }"
      >
        <thead>
          <tr>
            <th scope="col">
              <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
              <label
                nz-checkbox
                [ngModel]="allSelected()"
                (ngModelChange)="store.toggleAll($event)"
              ></label>
            </th>
            <th scope="col">{{ 'distribution.field.proposalType' | translate }}</th>
            <th scope="col">{{ 'distribution.field.item' | translate }}</th>
            <th scope="col">{{ 'distribution.field.destination' | translate }}</th>
            <th scope="col">{{ 'distribution.field.source' | translate }}</th>
            <th scope="col" class="num">
              {{ 'distribution.field.suggestedQuantity' | translate }}
            </th>
            <th scope="col">{{ 'distribution.field.stockoutDate' | translate }}</th>
            <th scope="col">{{ 'distribution.field.status' | translate }}</th>
            <th scope="col">{{ 'distribution.field.actions' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <td>
                <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
                <label
                  nz-checkbox
                  [nzDisabled]="row.status !== 'pending'"
                  [ngModel]="store.selectedIds().includes(row.id)"
                  (ngModelChange)="store.toggle(row.id, $event)"
                ></label>
              </td>
              <td>
                <nz-tag [nzColor]="row.proposal_type === 'balancing' ? 'purple' : 'blue'">{{
                  'distribution.proposalType.' + row.proposal_type | translate
                }}</nz-tag>
              </td>
              <td>
                {{ row.item?.sku }} <small class="muted">{{ row.item?.name }}</small>
              </td>
              <td>{{ row.warehouse?.code }}</td>
              <td>
                {{ row.source_warehouse?.code ?? '—' }}
                @if (row.source_available_quantity !== null) {
                  <small class="muted"
                    >{{ 'distribution.field.sourceAvailable' | translate }}:
                    {{ quantity(row.source_available_quantity) }}</small
                  >
                }
              </td>
              <td class="num">
                @if (row.status === 'pending') {
                  <nz-input-number
                    [nzMin]="0"
                    [ngModel]="toNumber(row.suggested_quantity)"
                    [nzDisabled]="!canWrite"
                    (ngModelChange)="edited.set({ id: row.id, value: $event })"
                    (nzBlur)="commit(row)"
                  ></nz-input-number>
                } @else {
                  {{ quantity(row.suggested_quantity) }}
                }
                {{ row.uom }}
                @if (toNumber(row.original_quantity) !== toNumber(row.suggested_quantity)) {
                  <small class="muted"
                    >{{ 'distribution.field.originalQuantity' | translate }}:
                    {{ quantity(row.original_quantity) }}</small
                  >
                }
              </td>
              <td>{{ row.projected_stockout_date ?? '—' }}</td>
              <td>
                <nz-tag [nzColor]="statusColor(row.status)">{{
                  'distribution.proposalStatus.' + row.status | translate
                }}</nz-tag>
                @if (row.shortfall_quantity !== null && toNumber(row.shortfall_quantity) > 0) {
                  <small class="muted"
                    >{{ 'distribution.field.shortfall' | translate }}:
                    {{ quantity(row.shortfall_quantity) }}</small
                  >
                }
              </td>
              <td class="row-actions">
                <button nz-button nzSize="small" type="button" (click)="inspect(row)">
                  {{ 'distribution.action.inspectCalculation' | translate }}
                </button>
                @if (canWrite && row.status === 'pending') {
                  <button
                    nz-button
                    nzSize="small"
                    nzDanger
                    type="button"
                    nz-popconfirm
                    [nzPopconfirmTitle]="'distribution.confirm.rejectProposal' | translate"
                    [nzOkText]="'distribution.action.confirm' | translate"
                    [nzCancelText]="'distribution.action.cancel' | translate"
                    (nzOnConfirm)="reject(row)"
                  >
                    {{ 'distribution.action.reject' | translate }}
                  </button>
                }
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="9">
                <nz-empty
                  [nzNotFoundContent]="'distribution.empty.proposals' | translate"
                ></nz-empty>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-spin>

    <nz-drawer
      [nzVisible]="detail() !== null"
      [nzWidth]="520"
      [nzTitle]="'distribution.section.calculation' | translate"
      (nzOnClose)="detail.set(null)"
    >
      <ng-container *nzDrawerContent>
        @if (detail(); as proposal) {
          <p>
            <strong>{{ proposal.item?.sku }}</strong> {{ proposal.item?.name }} →
            {{ proposal.warehouse?.code }}
          </p>
          @if (proposal.calculation.policy; as policy) {
            <p>
              {{ 'distribution.field.policy' | translate }}:
              {{ 'distribution.policy.' + policy | translate }}
            </p>
          }
          @if (proposal.calculation.trigger_reason) {
            <nz-alert
              nzType="info"
              nzShowIcon
              [nzMessage]="proposal.calculation.trigger_reason"
            ></nz-alert>
          }
          <nz-table #steps nzSize="small" [nzData]="calcRows()" [nzShowPagination]="false">
            <tbody>
              @for (row of steps.data; track row.label) {
                <tr>
                  <th scope="row">{{ row.label }}</th>
                  <td class="num">{{ row.value }}</td>
                </tr>
              }
            </tbody>
          </nz-table>
        }
      </ng-container>
    </nz-drawer>
  `,
})
export class ProposalsComponent implements OnInit {
  protected readonly store = inject(ProposalsStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly canWrite = inject(PermissionsService).canWrite(DISTRIBUTION_MODULE);
  protected readonly types = DST_PROPOSAL_TYPES;
  protected readonly statuses = DST_PROPOSAL_STATUSES;
  protected readonly statusColor = proposalStatusColor;
  protected readonly toNumber = toNumber;

  protected readonly feedback = signal<DstOutcome | null>(null);
  protected readonly detail = signal<DstProposal | null>(null);
  protected readonly edited = signal<{ id: string; value: number } | null>(null);

  protected readonly allSelected = computed(() => {
    const pending = this.store.proposals().filter((proposal) => proposal.status === 'pending');
    return (
      pending.length > 0 &&
      pending.every((proposal) => this.store.selectedIds().includes(proposal.id))
    );
  });

  protected readonly transferNumbers = computed(() =>
    this.store
      .lastTransfers()
      .map((transfer) => transfer.transfer_number)
      .join(', '),
  );

  /** The calculation of the open proposal as label / value rows: the stock position, then the engine's own steps. */
  protected readonly calcRows = computed(() => {
    const calc = this.detail()?.calculation;
    if (!calc) {
      return [];
    }
    const base = [
      ['onHand', calc.on_hand],
      ['inTransitInbound', calc.in_transit_inbound],
      ['reserved', calc.reserved],
      ['safetyStock', calc.safety_stock],
      ['reorderPoint', calc.reorder_point],
      ['maxStock', calc.max_stock],
      ['projectedDemand', calc.projected_demand],
      ['netPosition', calc.net_position],
    ] as const;
    return [
      ...base
        .filter(([, value]) => value !== null)
        .map(([key, value]) => ({
          label: this.i18n.instant(`distribution.calc.${key}`),
          value: formatQuantity(value),
        })),
      ...calc.steps.map((step) => ({ label: step.label, value: String(step.value) })),
    ];
  });

  ngOnInit(): void {
    void this.store.init();
  }

  protected quantity(value: string | number | null): string {
    return formatQuantity(value);
  }

  protected filter(change: {
    proposal_type?: DstProposalType | null;
    status?: DstProposalStatus | null;
    warehouse_id?: string | null;
  }): void {
    void this.store.setFilters({ ...this.store.filters(), ...change });
  }

  protected async generate(): Promise<void> {
    const outcome = await this.store.generate();
    this.feedback.set(outcome.ok ? null : outcome);
  }

  protected async approve(transferStatus: 'draft' | 'approved'): Promise<void> {
    const outcome = await this.store.approveSelected(transferStatus);
    this.feedback.set(outcome.ok ? null : outcome);
  }

  protected async reject(row: DstProposal): Promise<void> {
    const outcome = await this.store.reject(row.id);
    this.feedback.set(outcome.ok ? null : outcome);
  }

  /** The quantity edited in the row is saved when the field loses focus. */
  protected async commit(row: DstProposal): Promise<void> {
    const edit = this.edited();
    this.edited.set(null);
    if (!edit || edit.id !== row.id || edit.value === toNumber(row.suggested_quantity)) {
      return;
    }
    const outcome = await this.store.adjust(row.id, edit.value);
    if (outcome.ok) {
      this.message.success(this.i18n.instant('distribution.notification.saved'));
    }
    this.feedback.set(outcome.ok ? null : outcome);
  }

  protected async inspect(row: DstProposal): Promise<void> {
    this.detail.set((await this.store.detail(row.id)) ?? row);
  }
}
