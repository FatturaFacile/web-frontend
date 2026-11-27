import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  SCT_DEADLINE_STATUSES,
  SCT_DIRECTIONS,
  SCT_EXPORT_FORMATS,
  SCT_MOVEMENT_TYPES,
  SctDeadlineStatus,
  SctDirection,
  SctExportFormat,
  SctMovementType,
  SctRegisterFilters,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { RegisterStore } from './register.store';
import {
  countdownOf,
  deadlineColor,
  directionColor,
  isoDay,
  movementColor,
  SctOutcome,
} from './subcontracting.util';

/**
 * The statutory register of the goods in conto lavoro / lavorazione / deposito (Art. 53 DPR 633/72, DPR 441/1997): the DDT references,
 * the causals, the quantities still at the partner, the countdown to the one-year return deadline (green, warning, expired) and the
 * customs declarations; beside it the IT/CH TPP / TPA summary. Exports to CSV, Excel and PDF.
 */
@Component({
  selector: 'app-sct-register',
  imports: [
    DatePipe,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzDatePickerModule,
    NzEmptyModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    PageHeaderComponent,
    RouterLink,
    TranslatePipe,
  ],
  providers: [RegisterStore],
  styleUrl: './subcontracting.scss',
  template: `
    <app-page-header
      [title]="'PAGE_TITLE.SUBCONTRACTING_REGISTER' | translate"
      [subtitle]="'subcontracting.register.subtitle' | translate"
    ></app-page-header>

    @if (store.error(); as error) {
      <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="error | translate"></nz-alert>
    }
    @if (feedback(); as failure) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        nzCloseable
        [nzMessage]="failure.errorKey ?? 'subcontracting.error.generic' | translate: failure.params"
        [nzDescription]="failure.detail ?? null"
        (nzOnClose)="feedback.set(null)"
      ></nz-alert>
    }

    <nz-tabs (nzSelectedIndexChange)="tabChanged($event)">
      <nz-tab [nzTitle]="'subcontracting.tab.register' | translate">
        <div class="toolbar">
          <label class="field" for="sct-g-direction">
            <span>{{ 'subcontracting.field.direction' | translate }}</span>
            <nz-select nzId="sct-g-direction" nzAllowClear [(ngModel)]="direction" (ngModelChange)="reload()">
              @for (item of directions; track item) {
                <nz-option [nzValue]="item" [nzLabel]="'subcontracting.direction.' + item | translate"></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="sct-g-movement">
            <span>{{ 'subcontracting.field.movement' | translate }}</span>
            <nz-select nzId="sct-g-movement" nzAllowClear [(ngModel)]="movementType" (ngModelChange)="reload()">
              @for (item of movementTypes; track item) {
                <nz-option [nzValue]="item" [nzLabel]="'subcontracting.movementType.' + item | translate"></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="sct-g-deadline">
            <span>{{ 'subcontracting.field.deadlineStatus' | translate }}</span>
            <nz-select nzId="sct-g-deadline" nzAllowClear [(ngModel)]="deadlineStatus" (ngModelChange)="reload()">
              @for (item of deadlineStatuses; track item) {
                <nz-option [nzValue]="item" [nzLabel]="'subcontracting.deadlineStatus.' + item | translate"></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="sct-g-range">
            <span>{{ 'subcontracting.field.period' | translate }}</span>
            <nz-range-picker nzId="sct-g-range" [(ngModel)]="range" (ngModelChange)="reload()"></nz-range-picker>
          </label>
          <span class="spacer"></span>
          @for (format of exportFormats; track format) {
            <button
              nz-button
              type="button"
              [attr.data-test]="'export-' + format"
              [nzLoading]="store.exporting()"
              (click)="export(format)"
            >
              {{ 'subcontracting.export.' + format | translate }}
            </button>
          }
        </div>

        <nz-spin [nzSpinning]="store.loading()">
          <nz-table
            #table
            nzSize="small"
            [nzFrontPagination]="false"
            [nzData]="store.lines()"
            [nzTotal]="store.meta()?.total ?? 0"
            [nzPageSize]="store.filters().per_page ?? 50"
            [nzPageIndex]="store.meta()?.current_page ?? 1"
            (nzPageIndexChange)="goTo($event)"
            [nzScroll]="{ x: '1400px' }"
          >
            <thead>
              <tr>
                <th scope="col">{{ 'subcontracting.field.entryDate' | translate }}</th>
                <th scope="col">{{ 'subcontracting.field.movement' | translate }}</th>
                <th scope="col">{{ 'subcontracting.field.order' | translate }}</th>
                <th scope="col">{{ 'subcontracting.field.partner' | translate }}</th>
                <th scope="col">{{ 'subcontracting.field.product' | translate }}</th>
                <th scope="col" class="num">{{ 'subcontracting.field.quantity' | translate }}</th>
                <th scope="col" class="num">{{ 'subcontracting.field.remaining' | translate }}</th>
                <th scope="col">{{ 'subcontracting.field.ddt' | translate }}</th>
                <th scope="col">{{ 'subcontracting.field.causal' | translate }}</th>
                <th scope="col">{{ 'subcontracting.field.deadline' | translate }}</th>
                <th scope="col">{{ 'subcontracting.field.customsDeclaration' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (line of table.data; track line.id) {
                <tr [attr.data-test]="'line-' + line.id">
                  <td>{{ line.entry_date | date: 'mediumDate' }}</td>
                  <td>
                    <nz-tag [nzColor]="movementColor(line.movement_type)">{{ 'subcontracting.movementType.' + line.movement_type | translate }}</nz-tag>
                  </td>
                  <td>
                    <a [routerLink]="['/subcontracting/orders', line.order_id]">{{ line.order_number }}</a>
                    <nz-tag [nzColor]="directionColor(line.direction)">{{ 'subcontracting.direction.' + line.direction | translate }}</nz-tag>
                  </td>
                  <td>{{ line.partner_name ?? line.partner_id }}</td>
                  <td>
                    {{ line.product_name ?? line.product_id }}
                    <small class="muted">{{ line.sku }}</small>
                  </td>
                  <td class="num">{{ movedOf(line) }}</td>
                  <td class="num">{{ line.remaining_at_subcontractor_qty }}</td>
                  <td>
                    {{ line.ddt_number ?? '—' }}
                    <small class="muted">{{ line.ddt_date | date: 'mediumDate' }}</small>
                  </td>
                  <td>
                    @if (line.transport_reason) {
                      {{ 'subcontracting.causal.' + line.transport_reason | translate }}
                    }
                  </td>
                  <td>
                    <nz-tag [nzColor]="deadlineColor(line.deadline_status)" data-test="deadline-badge">{{
                      'subcontracting.deadlineStatus.' + line.deadline_status | translate
                    }}</nz-tag>
                    @if (line.deadline_status !== 'closed') {
                      <small class="muted">
                        {{ line.statutory_return_deadline | date: 'mediumDate' }}
                        @if (countdown(line.days_to_deadline); as left) {
                          · {{ left.key | translate: { days: left.days } }}
                        }
                      </small>
                    }
                  </td>
                  <td>{{ line.customs_declaration_id ?? '—' }}</td>
                </tr>
              }
            </tbody>
          </nz-table>
          @if (!store.loading() && store.lines().length === 0) {
            <nz-empty [nzNotFoundContent]="'subcontracting.empty.register' | translate"></nz-empty>
          }
        </nz-spin>
      </nz-tab>

      <nz-tab [nzTitle]="'subcontracting.tab.crossBorder' | translate">
        @if (store.crossBorder(); as summary) {
          <div class="kpi-grid">
            @for (regime of summary.regimes; track regime.customs_regime) {
              <div class="kpi" [attr.data-test]="'regime-' + regime.customs_regime">
                <div class="kpi-label">{{ 'subcontracting.customsRegime.' + regime.customs_regime | translate }}</div>
                <div class="kpi-value">{{ regime.open_orders }} / {{ regime.orders }}</div>
                <small class="muted">
                  {{ 'subcontracting.field.materialOut' | translate }} {{ regime.material_out_qty }} ·
                  {{ 'subcontracting.field.goodsBack' | translate }} {{ regime.goods_back_qty }} ·
                  {{ 'subcontracting.field.balance' | translate }} {{ regime.balance_qty }}
                </small>
              </div>
            }
          </div>
          <nz-table nzSize="small" [nzData]="summary.orders" [nzShowPagination]="false" [nzScroll]="{ x: '1100px' }">
            <thead>
              <tr>
                <th scope="col">{{ 'subcontracting.field.order' | translate }}</th>
                <th scope="col">{{ 'subcontracting.field.customsRegime' | translate }}</th>
                <th scope="col">{{ 'subcontracting.field.partner' | translate }}</th>
                <th scope="col" class="num">{{ 'subcontracting.field.materialOut' | translate }}</th>
                <th scope="col" class="num">{{ 'subcontracting.field.goodsBack' | translate }}</th>
                <th scope="col" class="num">{{ 'subcontracting.field.balance' | translate }}</th>
                <th scope="col">{{ 'subcontracting.field.declaration' | translate }}</th>
                <th scope="col">{{ 'subcontracting.field.expiry' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (order of summary.orders; track order.order_id) {
                <tr [attr.data-test]="'cross-' + order.order_id">
                  <td><a [routerLink]="['/subcontracting/orders', order.order_id]">{{ order.order_number }}</a></td>
                  <td>
                    <nz-tag nzColor="magenta">{{ 'subcontracting.customsRegime.' + order.customs_regime | translate }}</nz-tag>
                  </td>
                  <td>{{ order.partner_name }}</td>
                  <td class="num">{{ order.material_out_qty }}</td>
                  <td class="num">{{ order.goods_back_qty }}</td>
                  <td class="num">{{ order.balance_qty }}</td>
                  <td>
                    {{ order.declaration_number ?? '—' }}
                    <small class="muted">{{ order.declaration_mrn }}</small>
                  </td>
                  <td>
                    <span [class]="'deadline ' + (order.expired ? 'expired' : 'ok')">
                      {{ order.customs_expiry_date | date: 'mediumDate' }}
                      @if (countdown(order.days_to_expiry); as left) {
                        · {{ left.key | translate: { days: left.days } }}
                      }
                    </span>
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
          @if (summary.orders.length === 0) {
            <nz-empty [nzNotFoundContent]="'subcontracting.empty.crossBorder' | translate"></nz-empty>
          }
        }
      </nz-tab>
    </nz-tabs>
  `,
})
export class RegisterComponent implements OnInit {
  protected readonly store = inject(RegisterStore);

  protected readonly directions = SCT_DIRECTIONS;
  protected readonly movementTypes = SCT_MOVEMENT_TYPES;
  protected readonly deadlineStatuses = SCT_DEADLINE_STATUSES;
  protected readonly exportFormats = SCT_EXPORT_FORMATS;
  protected readonly directionColor = directionColor;
  protected readonly deadlineColor = deadlineColor;
  protected readonly movementColor = movementColor;

  protected direction: SctDirection | null = null;
  protected movementType: SctMovementType | null = null;
  protected deadlineStatus: SctDeadlineStatus | null = null;
  protected range: Date[] = [];

  protected readonly feedback = signal<SctOutcome | null>(null);

  ngOnInit(): void {
    void this.store.load();
  }

  protected countdown(days: number | null) {
    return countdownOf(days);
  }

  private filters(page: number): SctRegisterFilters {
    const from = isoDay(this.range[0] ?? null);
    const to = isoDay(this.range[1] ?? null);
    return {
      per_page: this.store.filters().per_page ?? 50,
      page,
      ...(this.direction ? { direction: this.direction } : {}),
      ...(this.movementType ? { movement_type: this.movementType } : {}),
      ...(this.deadlineStatus ? { deadline_status: this.deadlineStatus } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    };
  }

  protected reload(): void {
    void this.store.load(this.filters(1));
  }

  protected goTo(page: number): void {
    void this.store.load(this.filters(page));
  }

  protected tabChanged(index: number): void {
    if (index === 1) {
      void this.store.loadCrossBorder();
    }
  }

  protected async export(format: SctExportFormat): Promise<void> {
    const outcome = await this.store.exportRegister(format);
    this.feedback.set(outcome.ok ? null : outcome);
  }

  /** The quantity a ledger line moves, whichever of its four columns carries it. */
  protected movedOf(line: {
    dispatched_qty: string;
    consumed_in_returned_goods_qty: string;
    scrap_reported_by_subcontractor_qty: string;
    returned_unused_qty: string;
  }): string {
    return (
      [
        line.dispatched_qty,
        line.consumed_in_returned_goods_qty,
        line.scrap_reported_by_subcontractor_qty,
        line.returned_unused_qty,
      ].find((value) => Number(value) > 0) ?? '0.0000'
    );
  }
}
