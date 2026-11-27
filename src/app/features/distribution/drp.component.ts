import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { DST_BUCKET_TYPES, DstBucketType, DstDrpAlert, DstDrpRow, PermissionsService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import {
  alertColor,
  bucketLabel,
  DISTRIBUTION_MODULE,
  DRP_ROWS,
  DstOutcome,
  formatQuantity,
  isStockoutCell,
  refLabel,
} from './distribution.util';
import { DrpStore } from './drp.store';

/** The time-phased DRP matrix: gross requirements, scheduled receipts, projected balance, net requirements and planned orders per bucket. */
@Component({
  selector: 'app-dst-drp',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzEmptyModule,
    NzInputNumberModule,
    NzRadioModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  providers: [DrpStore],
  styleUrl: './distribution.scss',
  template: `
    <app-page-header [title]="'PAGE_TITLE.DISTRIBUTION_DRP' | translate"></app-page-header>

    <div class="toolbar">
      <label class="field" for="dst-drp-warehouse">
        <span>{{ 'distribution.field.warehouse' | translate }}</span>
        <nz-select
          nzId="dst-drp-warehouse"
          nzAllowClear
          nzShowSearch
          [ngModel]="store.warehouseId()"
          (ngModelChange)="scope($event, store.stockItemId())"
        >
          @for (warehouse of store.lookups()?.warehouses ?? []; track warehouse.id) {
            <nz-option
              [nzValue]="warehouse.id"
              [nzLabel]="warehouse.code + ' ' + warehouse.name"
            ></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="dst-drp-item">
        <span>{{ 'distribution.field.item' | translate }}</span>
        <nz-select
          nzId="dst-drp-item"
          nzAllowClear
          nzShowSearch
          [ngModel]="store.stockItemId()"
          (ngModelChange)="scope(store.warehouseId(), $event)"
        >
          @for (item of store.lookups()?.items ?? []; track item.id) {
            <nz-option [nzValue]="item.id" [nzLabel]="item.sku + ' ' + item.name"></nz-option>
          }
        </nz-select>
      </label>
      <div class="field">
        <span>{{ 'distribution.field.bucketType' | translate }}</span>
        <nz-radio-group
          [ngModel]="store.bucketType()"
          (ngModelChange)="bucket($event, store.horizon())"
        >
          @for (type of bucketTypes; track type) {
            <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
            <label nz-radio-button [nzValue]="type">{{
              'distribution.bucketType.' + type | translate
            }}</label>
          }
        </nz-radio-group>
      </div>
      <label class="field" for="dst-drp-horizon">
        <span>{{ 'distribution.field.horizon' | translate }}</span>
        <nz-input-number
          nzId="dst-drp-horizon"
          [nzMin]="1"
          [nzMax]="90"
          [nzStep]="1"
          [ngModel]="store.horizon()"
          (ngModelChange)="bucket(store.bucketType(), $event)"
        ></nz-input-number>
      </label>
      <label class="field" for="dst-drp-run">
        <span>{{ 'distribution.field.run' | translate }}</span>
        <nz-select
          nzId="dst-drp-run"
          [ngModel]="store.run()?.id ?? null"
          (ngModelChange)="selectRun($event)"
        >
          @for (run of store.runs(); track run.id) {
            <nz-option [nzValue]="run.id" [nzLabel]="run.run_number"></nz-option>
          }
        </nz-select>
      </label>
      <span class="spacer"></span>
      @if (canWrite) {
        <button
          nz-button
          nzType="primary"
          type="button"
          [nzLoading]="store.running()"
          (click)="run()"
        >
          {{ 'distribution.action.runDrp' | translate }}
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

    <nz-spin [nzSpinning]="store.loading()">
      @if (store.grid(); as grid) {
        @for (row of grid.rows; track row.warehouse_id + row.stock_item_id) {
          <section class="main-card">
            <h3>
              {{ label(row.item) }} · {{ label(row.warehouse) }}
              <small class="muted"
                >{{ 'distribution.field.leadTimeDays' | translate }}: {{ row.lead_time_days }} ·
                {{ 'distribution.field.openingBalance' | translate }}:
                {{ quantity(row.opening_balance) }} ·
                {{ 'distribution.field.safetyStock' | translate }}:
                {{ quantity(row.safety_stock) }}</small
              >
            </h3>
            <div class="drp-scroll">
              <table class="drp-table">
                <thead>
                  <tr>
                    <th scope="col"></th>
                    @for (bucket of grid.buckets; track bucket.index) {
                      <th scope="col">{{ bucketTitle(bucket) }}</th>
                    }
                  </tr>
                </thead>
                <tbody>
                  @for (key of measures; track key) {
                    <tr>
                      <th scope="row">{{ 'distribution.drpRow.' + key | translate }}</th>
                      @for (cell of row.cells; track cell.index) {
                        <td
                          [class.stockout]="
                            key === 'projected_available' && stockout(row, cell.index)
                          "
                          [class.release]="
                            key === 'planned_releases' && quantity(cell[key]) !== '0'
                          "
                        >
                          {{ quantity(cell[key]) }}
                        </td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>
        } @empty {
          <nz-empty [nzNotFoundContent]="'distribution.empty.drpGrid' | translate"></nz-empty>
        }
      } @else {
        <nz-empty [nzNotFoundContent]="'distribution.empty.drpRuns' | translate"></nz-empty>
      }
    </nz-spin>

    @if (store.alerts().length > 0) {
      <h3>{{ 'distribution.section.alerts' | translate }}</h3>
      <nz-table #alerts nzSize="small" [nzData]="store.alerts()" [nzShowPagination]="false">
        <thead>
          <tr>
            <th scope="col">{{ 'distribution.field.alertType' | translate }}</th>
            <th scope="col">{{ 'distribution.field.warehouse' | translate }}</th>
            <th scope="col">{{ 'distribution.field.item' | translate }}</th>
            <th scope="col">{{ 'distribution.field.bucket' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (alert of alerts.data; track alert.id) {
            <tr>
              <td>
                <nz-tag [nzColor]="color(alert.type)">{{
                  'distribution.alertType.' + alert.type | translate
                }}</nz-tag>
              </td>
              <td>{{ label(alert.warehouse) }}</td>
              <td>{{ label(alert.item) }}</td>
              <td>{{ alertBucket(alert) }}</td>
            </tr>
          }
        </tbody>
      </nz-table>
    }
  `,
})
export class DrpComponent implements OnInit {
  protected readonly store = inject(DrpStore);
  protected readonly canWrite = inject(PermissionsService).canWrite(DISTRIBUTION_MODULE);
  protected readonly bucketTypes = DST_BUCKET_TYPES;
  protected readonly measures = DRP_ROWS;
  protected readonly color = alertColor;
  protected readonly feedback = signal<DstOutcome | null>(null);

  ngOnInit(): void {
    void this.store.init();
  }

  protected label = refLabel;

  protected quantity(value: string | number): string {
    return formatQuantity(value);
  }

  protected bucketTitle(bucket: { index: number; start: string; end: string }): string {
    return bucketLabel(bucket, this.store.run()?.bucket_type ?? this.store.bucketType());
  }

  protected stockout(row: DstDrpRow, index: number): boolean {
    const cell = row.cells.find((candidate) => candidate.index === index);
    return cell ? isStockoutCell(cell, row.safety_stock) : false;
  }

  protected alertBucket(alert: DstDrpAlert): string {
    const bucket = this.store
      .grid()
      ?.buckets.find((candidate) => candidate.index === alert.bucket_index);
    return bucket ? this.bucketTitle(bucket) : '—';
  }

  protected scope(warehouseId: string | null, stockItemId: string | null): void {
    void this.store.setScope(warehouseId ?? null, stockItemId ?? null);
  }

  protected bucket(type: DstBucketType, horizon: number): void {
    this.store.setBucket(type, horizon);
  }

  protected selectRun(id: string | null): void {
    if (id) {
      void this.store.selectRun(id);
    }
  }

  protected async run(): Promise<void> {
    const outcome = await this.store.execute();
    this.feedback.set(outcome.ok ? null : outcome);
  }
}
