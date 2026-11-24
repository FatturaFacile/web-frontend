import { Component, computed, inject, signal, TemplateRef, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  FetchGridModel,
  I18nService,
  LEASE_ASSET_CLASSES,
  LEASE_CURRENCIES,
  LEASE_STATUSES,
  LeaseAccountingApiService,
  LeaseContract,
  LeaseStatus,
  PermissionsService,
  QueryFilterParams,
} from '@core';
import { BaseTableComponent, IconActionDirective, MoneyPipe, PageHeaderComponent, TableColumnDef, TranslatePipe } from '@shared';
import { ModalActionsDirective } from '@shared';
import { LeaseFormComponent } from './lease-form.component';

type LeaseFilterParams = QueryFilterParams & { status?: string; asset_class?: string; currency?: string };

/** Ant Design colour of each lease status. */
const STATUS_COLORS: Record<LeaseStatus, string> = { draft: 'default', active: 'green', expired: 'blue', cancelled: 'red' };

/** List of the leases of the company, with the entry to the maturity report and the run that posts every lease. */
@Component({
  selector: 'app-lease-list',
  imports: [
    FormsModule,
    BaseTableComponent,
    IconActionDirective,
    ModalActionsDirective,
    MoneyPipe,
    NzButtonModule,
    NzCardModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
    LeaseFormComponent,
  ],
  template: `
    <app-page-header [title]="'LEASES.TITLE' | translate" [subtitle]="'LEASES.SUBTITLE' | translate" />

    <nz-card>
      <div class="toolbar">
        <nz-select class="filter" nzAllowClear [nzPlaceHolder]="'LEASES.FILTER_STATUS' | translate" [attr.aria-label]="'LEASES.FILTER_STATUS' | translate" [(ngModel)]="statusFilter" (ngModelChange)="applyFilters()">
          @for (value of statuses; track value) {
            <nz-option [nzValue]="value" [nzLabel]="'LEASES.STATUS_' + value | translate"></nz-option>
          }
        </nz-select>
        <nz-select class="filter" nzAllowClear [nzPlaceHolder]="'LEASES.FILTER_ASSET_CLASS' | translate" [attr.aria-label]="'LEASES.FILTER_ASSET_CLASS' | translate" [(ngModel)]="assetClassFilter" (ngModelChange)="applyFilters()">
          @for (value of assetClasses; track value) {
            <nz-option [nzValue]="value" [nzLabel]="'LEASES.ASSET_CLASS_' + value | translate"></nz-option>
          }
        </nz-select>
        <nz-select class="filter" nzAllowClear [nzPlaceHolder]="'LEASES.FILTER_CURRENCY' | translate" [attr.aria-label]="'LEASES.FILTER_CURRENCY' | translate" [(ngModel)]="currencyFilter" (ngModelChange)="applyFilters()">
          @for (value of currencies; track value) {
            <nz-option [nzValue]="value" [nzLabel]="value"></nz-option>
          }
        </nz-select>
        <span class="spacer"></span>
        @if (canWrite()) {
          <button nz-button type="button" (click)="openRun()">{{ 'LEASES.POST_ALL' | translate }}</button>
          <button nz-button nzType="primary" type="button" appIconAction="create" (click)="openForm()"></button>
        }
      </div>

      <app-base-table [grid]="grid" [columns]="columns()" [actionsTemplate]="actionsTpl" exportFileName="leases" />

      <ng-template #numberTpl let-lease>
        <a role="link" tabindex="0" (click)="open(lease)" (keydown.enter)="open(lease)">{{ lease.number }}</a>
      </ng-template>
      <ng-template #paymentTpl let-lease>{{ lease.payment_amount | money: lease.currency }} / {{ 'LEASES.FREQUENCY_' + lease.payment_frequency | translate }}</ng-template>
      <ng-template #statusTpl let-lease>
        <nz-tag [nzColor]="statusColor(lease.status)">{{ 'LEASES.STATUS_' + lease.status | translate }}</nz-tag>
        @if (lease.exemption !== 'none') {
          <nz-tag>{{ 'LEASES.EXEMPTION_' + lease.exemption | translate }}</nz-tag>
        }
      </ng-template>
      <ng-template #actionsTpl let-lease>
        <button nz-button nzType="text" nzSize="small" type="button" (click)="open(lease)">{{ 'LEASES.OPEN' | translate }}</button>
      </ng-template>
    </nz-card>

    <app-lease-form [(visible)]="formVisible" [lease]="null" (saved)="open($event)" />

    <nz-modal appModalActions
      [(nzVisible)]="runVisible"
      [nzTitle]="'LEASES.POST_ALL' | translate"
      (nzOnCancel)="runVisible.set(false)"
      (nzOnOk)="run()"
      [nzOkDisabled]="!throughDate"
      [nzOkLoading]="running()"
    >
      <ng-container *nzModalContent>
        <p>{{ 'LEASES.POST_ALL_HINT' | translate }}</p>
        <label for="lease-run-through">{{ 'LEASES.FIELD.through_date' | translate }}</label>
        <input nz-input id="lease-run-through" type="date" [(ngModel)]="throughDate" [max]="today" />
        @if (results().length > 0) {
          <ul class="results">
            @for (result of results(); track result.contract_id) {
              <li>
                <strong>{{ result.number }}</strong>:
                @if (result.error) {
                  <span class="error">{{ result.error }}</span>
                } @else {
                  {{ 'LEASES.RUN_POSTED' | translate: { count: result.posted_periods } }}
                }
              </li>
            }
          </ul>
        }
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 16px;
    }
    .filter {
      min-width: 160px;
    }
    .spacer {
      flex: 1;
    }
    .results {
      margin-top: 12px;
      padding-left: 20px;
    }
    .error {
      color: var(--ff-color-danger);
    }
  `,
})
export class LeaseListComponent {
  private readonly api = inject(LeaseAccountingApiService);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly permissions = inject(PermissionsService);

  protected readonly canWrite = computed(() => this.permissions.canWrite('leases'));
  protected readonly statuses = LEASE_STATUSES;
  protected readonly assetClasses = LEASE_ASSET_CLASSES;
  protected readonly currencies = LEASE_CURRENCIES;
  protected readonly grid = new FetchGridModel<LeaseContract, LeaseFilterParams>((query) => this.api.getContracts(query));
  protected readonly formVisible = signal(false);
  protected readonly runVisible = signal(false);
  protected readonly running = signal(false);
  protected readonly results = signal<{ contract_id: string; number: string; posted_periods: number; error: string | null }[]>([]);
  protected readonly today = new Date().toISOString().slice(0, 10);
  protected statusFilter: LeaseStatus | null = null;
  protected assetClassFilter: string | null = null;
  protected currencyFilter: string | null = null;
  protected throughDate = this.today;

  private readonly numberTpl = viewChild<TemplateRef<unknown>>('numberTpl');
  private readonly paymentTpl = viewChild<TemplateRef<unknown>>('paymentTpl');
  private readonly statusTpl = viewChild<TemplateRef<unknown>>('statusTpl');

  protected readonly columns = computed<TableColumnDef<LeaseContract>[]>(() => {
    this.i18n.currentLanguage();
    return [
      { key: 'number', header: this.i18n.translate('LEASES.COL_NUMBER'), customCellTemplate: this.numberTpl() },
      { key: 'title', header: this.i18n.translate('LEASES.COL_TITLE') },
      { key: 'lessor_name', header: this.i18n.translate('LEASES.COL_LESSOR') },
      {
        key: 'asset_class',
        header: this.i18n.translate('LEASES.COL_ASSET_CLASS'),
        valueGetter: (lease) => this.i18n.translate(`LEASES.ASSET_CLASS_${lease.asset_class}`),
        valueLabel: (value) => this.i18n.translate(`LEASES.ASSET_CLASS_${value}`),
      },
      { key: 'commencement_date', header: this.i18n.translate('LEASES.COL_COMMENCEMENT') },
      { key: 'term_months', header: this.i18n.translate('LEASES.COL_TERM') },
      { key: 'payment_amount', header: this.i18n.translate('LEASES.COL_PAYMENT'), customCellTemplate: this.paymentTpl() },
      {
        key: 'status',
        header: this.i18n.translate('LEASES.COL_STATUS'),
        valueGetter: (lease) => this.i18n.translate(`LEASES.STATUS_${lease.status}`),
        valueLabel: (value) => this.i18n.translate(`LEASES.STATUS_${value}`),
        customCellTemplate: this.statusTpl(),
      },
    ];
  });

  protected statusColor(status: LeaseStatus): string {
    return STATUS_COLORS[status];
  }

  protected applyFilters(): void {
    this.grid.setFilter({
      status: this.statusFilter ?? undefined,
      asset_class: this.assetClassFilter ?? undefined,
      currency: this.currencyFilter ?? undefined,
    });
  }

  protected openForm(): void {
    this.formVisible.set(true);
  }

  protected open(lease: LeaseContract): void {
    void this.router.navigate(['/leases', lease.id]);
  }

  protected openRun(): void {
    this.results.set([]);
    this.runVisible.set(true);
  }

  protected run(): void {
    this.running.set(true);
    this.api.runPostings(this.throughDate).subscribe({
      next: (res) => {
        this.running.set(false);
        this.results.set(res.data);
        this.message.success(this.i18n.translate('LEASES.MSG_RUN_DONE', { count: res.data.reduce((sum, result) => sum + result.posted_periods, 0) }));
        this.grid.reload();
      },
      error: () => {
        this.running.set(false);
        this.message.error(this.i18n.translate('LEASES.MSG_ERROR'));
      },
    });
  }
}
