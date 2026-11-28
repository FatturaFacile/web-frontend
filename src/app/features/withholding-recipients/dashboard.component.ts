import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  PermissionsService,
  WR_CU_CAUSALS,
  WR_JURISDICTIONS,
  WR_REGIMES,
  WrDashboardRow,
} from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { DashboardStore } from './dashboard.store';
import { RecipientDrawerComponent } from './recipient-drawer.component';
import { ThresholdBarsComponent } from './threshold-bars.component';
import {
  alertColor,
  alertKey,
  selectableYears,
  WITHHOLDING_RECIPIENTS_MODULE,
} from './withholding-recipients.util';

/**
 * Recipients dashboard (Mod 356): every recipient of commissions, royalties, occasional work and amateur sports fees with
 * the year-to-date gross and withheld amounts, the progress against the statutory thresholds and the compliance alerts.
 * A row opens the profile drawer.
 */
@Component({
  selector: 'app-wr-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MoneyPipe,
    PageHeaderComponent,
    RecipientDrawerComponent,
    ThresholdBarsComponent,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
    NzEmptyModule,
    NzInputModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
  ],
  providers: [DashboardStore],
  template: `
    <app-page-header
      [title]="'PAGE_TITLE.WITHHOLDING_RECIPIENTS_DASHBOARD' | translate"
    ></app-page-header>

    @if (store.meta(); as meta) {
      <div class="summary">
        <nz-card nzSize="small" class="stat">
          <span class="stat-label">{{
            'withholdingRecipients.summary.recipients' | translate
          }}</span>
          <strong class="stat-value">{{ meta.recipients }}</strong>
        </nz-card>
        <nz-card nzSize="small" class="stat" [class.warn]="meta.with_alerts > 0">
          <span class="stat-label">{{
            'withholdingRecipients.summary.withAlerts' | translate
          }}</span>
          <strong class="stat-value">{{ meta.with_alerts }}</strong>
        </nz-card>
        <nz-card nzSize="small" class="stat">
          <span class="stat-label">{{ 'withholdingRecipients.summary.grossEur' | translate }}</span>
          <strong class="stat-value">{{ meta.ytd_gross_eur | money: 'EUR' }}</strong>
        </nz-card>
        <nz-card nzSize="small" class="stat">
          <span class="stat-label">{{ 'withholdingRecipients.summary.grossChf' | translate }}</span>
          <strong class="stat-value">{{ meta.ytd_gross_chf | money: 'CHF' }}</strong>
        </nz-card>
        <nz-card nzSize="small" class="stat" [class.warn]="meta.pending_inl > 0">
          <span class="stat-label">{{
            'withholdingRecipients.summary.pendingInl' | translate
          }}</span>
          <strong class="stat-value">{{ meta.pending_inl }}</strong>
        </nz-card>
      </div>
    }

    <div class="toolbar">
      <label class="field" for="wr-filter-year">
        <span>{{ 'withholdingRecipients.field.year' | translate }}</span>
        <nz-select
          nzId="wr-filter-year"
          [ngModel]="store.year()"
          (ngModelChange)="store.setFilters({ year: $event })"
        >
          @for (year of years; track year) {
            <nz-option [nzValue]="year" [nzLabel]="'' + year"></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="wr-filter-regime">
        <span>{{ 'withholdingRecipients.field.regime' | translate }}</span>
        <nz-select
          nzId="wr-filter-regime"
          nzAllowClear
          [nzPlaceHolder]="'withholdingRecipients.action.all' | translate"
          [ngModel]="store.regime()"
          (ngModelChange)="store.setFilters({ regime: $event ?? null })"
        >
          @for (regime of regimes; track regime) {
            <nz-option
              [nzValue]="regime"
              [nzLabel]="'withholdingRecipients.regime.' + regime | translate"
            ></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="wr-filter-jurisdiction">
        <span>{{ 'withholdingRecipients.field.jurisdiction' | translate }}</span>
        <nz-select
          nzId="wr-filter-jurisdiction"
          nzAllowClear
          [nzPlaceHolder]="'withholdingRecipients.action.all' | translate"
          [ngModel]="store.jurisdiction()"
          (ngModelChange)="store.setFilters({ jurisdiction: $event ?? null })"
        >
          @for (jurisdiction of jurisdictions; track jurisdiction) {
            <nz-option
              [nzValue]="jurisdiction"
              [nzLabel]="'withholdingRecipients.jurisdiction.' + jurisdiction | translate"
            ></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="wr-filter-causal">
        <span>{{ 'withholdingRecipients.field.cuCausal' | translate }}</span>
        <nz-select
          nzId="wr-filter-causal"
          nzAllowClear
          [nzPlaceHolder]="'withholdingRecipients.action.all' | translate"
          [ngModel]="store.cuCausal()"
          (ngModelChange)="store.setFilters({ cuCausal: $event ?? null })"
        >
          @for (causal of causals(); track causal) {
            <nz-option
              [nzValue]="causal"
              [nzLabel]="'withholdingRecipients.causal.' + causal | translate"
            ></nz-option>
          }
        </nz-select>
      </label>
      <label class="field search" for="wr-filter-search">
        <span>{{ 'withholdingRecipients.field.search' | translate }}</span>
        <input
          nz-input
          id="wr-filter-search"
          [ngModel]="store.search()"
          (change)="applySearch($any($event.target).value)"
          (keyup.enter)="applySearch($any($event.target).value)"
        />
      </label>
      <label
        for="wr-filter-alerts"
        nzId="wr-filter-alerts"
        nz-checkbox
        [ngModel]="store.onlyAlerts()"
        (ngModelChange)="store.setFilters({ onlyAlerts: $event })"
        >{{ 'withholdingRecipients.field.onlyAlerts' | translate }}</label
      >
      <button nz-button type="button" (click)="store.resetFilters()">
        {{ 'withholdingRecipients.action.reset' | translate }}
      </button>
      <button nz-button type="button" (click)="store.load()">
        {{ 'withholdingRecipients.action.refresh' | translate }}
      </button>
      @if (canWrite) {
        <button nz-button nzType="primary" type="button" (click)="openNew()">
          {{ 'withholdingRecipients.action.new' | translate }}
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

    <nz-spin [nzSpinning]="store.loading()">
      <nz-table #table nzSize="small" [nzData]="store.rows()" [nzPageSize]="20">
        <thead>
          <tr>
            <th scope="col">{{ 'withholdingRecipients.field.name' | translate }}</th>
            <th scope="col">{{ 'withholdingRecipients.field.regime' | translate }}</th>
            <th scope="col">{{ 'withholdingRecipients.field.jurisdiction' | translate }}</th>
            <th scope="col">{{ 'withholdingRecipients.field.cuCausal' | translate }}</th>
            <th scope="col" class="num">
              {{ 'withholdingRecipients.column.ytdGross' | translate }}
            </th>
            <th scope="col" class="num">
              {{ 'withholdingRecipients.column.ytdWithheld' | translate }}
            </th>
            <th scope="col" class="num">
              {{ 'withholdingRecipients.column.payments' | translate }}
            </th>
            <th scope="col" class="thresholds">
              {{ 'withholdingRecipients.column.thresholds' | translate }}
            </th>
            <th scope="col">{{ 'withholdingRecipients.column.alerts' | translate }}</th>
            <th scope="col"></th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr class="row" tabindex="0" (click)="openRow(row)" (keydown.enter)="openRow(row)">
              <th scope="row">
                {{ row.display_name }}
                @if (row.tax_code) {
                  <small class="muted">{{ row.tax_code }}</small>
                }
                @if (!row.is_active) {
                  <nz-tag>{{ 'withholdingRecipients.status.inactive' | translate }}</nz-tag>
                }
              </th>
              <td>{{ 'withholdingRecipients.regime.' + row.regime | translate }}</td>
              <td>{{ 'withholdingRecipients.jurisdiction.' + row.jurisdiction | translate }}</td>
              <td>{{ 'withholdingRecipients.causal.' + row.cu_causal | translate }}</td>
              <td class="num">{{ row.ytd_gross | money: row.currency }}</td>
              <td class="num">{{ row.ytd_withheld | money: row.currency }}</td>
              <td class="num">{{ row.payments }}</td>
              <td class="thresholds">
                <app-wr-threshold-bars
                  [thresholds]="row.thresholds"
                  [currency]="row.currency"
                  [compact]="true"
                ></app-wr-threshold-bars>
              </td>
              <td>
                @for (code of row.alerts; track code) {
                  <nz-tag [nzColor]="alertColor(code)">{{ alertKey(code) | translate }}</nz-tag>
                }
              </td>
              <td class="actions">
                <button
                  nz-button
                  nzSize="small"
                  type="button"
                  (click)="$event.stopPropagation(); openRow(row)"
                >
                  {{ 'withholdingRecipients.action.open' | translate }}
                </button>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!store.loading() && !store.hasRows()) {
        <nz-empty
          [nzNotFoundContent]="'withholdingRecipients.dashboard.empty' | translate"
        ></nz-empty>
      }
    </nz-spin>

    <app-wr-recipient-drawer
      [visible]="drawerOpen()"
      [recipientId]="selectedId()"
      (closed)="closeDrawer()"
      (changed)="store.load()"
    ></app-wr-recipient-drawer>
  `,
  styles: `
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }

    .stat {
      display: block;
    }

    .stat.warn {
      border-color: var(--ant-warning-color, #faad14);
    }

    .stat-label {
      display: block;
      font-size: 12px;
      color: var(--ant-text-color-secondary, #595959);
    }

    .stat-value {
      font-size: 18px;
    }

    .toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 12px;
      margin-bottom: 16px;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 140px;
      font-size: 12px;
    }

    .field.search {
      min-width: 200px;
    }

    .feedback {
      margin-bottom: 12px;
    }

    .row {
      cursor: pointer;
    }

    .num {
      text-align: right;
      white-space: nowrap;
    }

    .thresholds {
      min-width: 200px;
    }

    .muted {
      display: block;
      font-weight: normal;
      color: var(--ant-text-color-secondary, #595959);
    }

    .actions {
      text-align: right;
    }
  `,
})
export class DashboardComponent implements OnInit {
  readonly store = inject(DashboardStore);

  /** The registry is maintained by owners, administrators, accountants and HR. */
  readonly canWrite = inject(PermissionsService).canWrite(WITHHOLDING_RECIPIENTS_MODULE);

  readonly years = selectableYears();
  readonly regimes = WR_REGIMES;
  readonly jurisdictions = WR_JURISDICTIONS;
  readonly alertKey = alertKey;
  readonly alertColor = alertColor;

  readonly drawerOpen = signal(false);
  readonly selectedId = signal<string | null>(null);

  ngOnInit(): void {
    void this.store.loadLookups();
    void this.store.load();
  }

  causals(): readonly string[] {
    return this.store.lookups()?.cu_causals ?? WR_CU_CAUSALS;
  }

  applySearch(value: string): void {
    if (value.trim() !== this.store.search().trim()) {
      void this.store.setFilters({ search: value });
    }
  }

  openNew(): void {
    this.selectedId.set(null);
    this.drawerOpen.set(true);
  }

  openRow(row: WrDashboardRow): void {
    this.selectedId.set(row.id);
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }
}
