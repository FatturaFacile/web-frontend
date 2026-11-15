import { DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
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
  COLLECTION_CASE_PRIORITIES,
  COLLECTION_CASE_STATUSES,
  CollectionCase,
  CollectionCasePriority,
  CollectionCaseStatus,
  CreditManagementApiService,
  CrmApiService,
  DunningStrategy,
  TranslateService,
} from '@core';
import { IconActionDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText, blankToNull, CreditCustomerOption, loadCustomers, statusColor } from './credit.util';

/** Collection cases opened on the overdue invoices of a customer. */
@Component({
  selector: 'app-credit-cases',
  styleUrl: './credit-management.scss',
  imports: [
    DecimalPipe,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    IconActionDirective,
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
    <app-page-header [title]="'CREDIT.CASES_TITLE' | translate" [subtitle]="'CREDIT.CASES_SUBTITLE' | translate">
      <button nz-button nzType="primary" (click)="openModal()" appIconAction="create"></button>
    </app-page-header>

    <div class="toolbar">
      <nz-select style="width: 200px" nzAllowClear [ngModel]="status()" (ngModelChange)="status.set($event); load()" [nzPlaceHolder]="'CREDIT.STATUS' | translate">
        @for (value of statuses; track value) {
          <nz-option [nzValue]="value" [nzLabel]="('CREDIT.CASE_STATUS_' + value.toUpperCase()) | translate"></nz-option>
        }
      </nz-select>
      <nz-select style="width: 200px" nzAllowClear [ngModel]="priority()" (ngModelChange)="priority.set($event); load()" [nzPlaceHolder]="'CREDIT.PRIORITY' | translate">
        @for (value of priorities; track value) {
          <nz-option [nzValue]="value" [nzLabel]="('CREDIT.PRIORITY_' + value.toUpperCase()) | translate"></nz-option>
        }
      </nz-select>
    </div>

    <nz-card class="main-card">
      <nz-table #table [nzData]="cases()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="25">
        <thead>
          <tr>
            <th>{{ 'CREDIT.CASE_NUMBER' | translate }}</th>
            <th>{{ 'CREDIT.CUSTOMER' | translate }}</th>
            <th class="num">{{ 'CREDIT.OUTSTANDING' | translate }}</th>
            <th>{{ 'CREDIT.OPENED_ON' | translate }}</th>
            <th>{{ 'CREDIT.NEXT_ACTION_ON' | translate }}</th>
            <th>{{ 'CREDIT.PRIORITY' | translate }}</th>
            <th>{{ 'CREDIT.STATUS' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <td><a [routerLink]="['/credit-management/cases', row.id]">{{ row.case_number }}</a></td>
              <td>{{ row.customer_name }}</td>
              <td class="num">{{ +row.outstanding_amount | number: '1.2-2' }} {{ row.currency }}</td>
              <td>{{ row.opened_on }}</td>
              <td>{{ row.next_action_on ?? '-' }}</td>
              <td><nz-tag [nzColor]="color(row.priority)">{{ ('CREDIT.PRIORITY_' + row.priority.toUpperCase()) | translate }}</nz-tag></td>
              <td><nz-tag [nzColor]="color(row.status)">{{ ('CREDIT.CASE_STATUS_' + row.status.toUpperCase()) | translate }}</nz-tag></td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && cases().length === 0) {
        <nz-empty [nzNotFoundContent]="'CREDIT.NO_CASES' | translate"></nz-empty>
      }
    </nz-card>

    <nz-modal [(nzVisible)]="modalVisible" [nzTitle]="'CREDIT.NEW_CASE' | translate" (nzOnCancel)="modalVisible.set(false)" (nzOnOk)="save()" okAction="save" [nzOkDisabled]="form.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="form" nzLayout="vertical">
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'CREDIT.CUSTOMER' | translate }}</nz-form-label>
            <nz-form-control [nzExtra]="'CREDIT.CASE_ALL_OVERDUE_HINT' | translate">
              <nz-select formControlName="customer_id" nzShowSearch>
                @for (customer of customers(); track customer.id) {
                  <nz-option [nzValue]="customer.id" [nzLabel]="customer.name"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label>{{ 'CREDIT.DUNNING_STRATEGY' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="strategy_id" nzAllowClear>
                  @for (strategy of strategies(); track strategy.id) {
                    <nz-option [nzValue]="strategy.id" [nzLabel]="strategy.name"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'CREDIT.PRIORITY' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="priority">
                  @for (value of priorities; track value) {
                    <nz-option [nzValue]="value" [nzLabel]="('CREDIT.PRIORITY_' + value.toUpperCase()) | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-label nzFor="case-notes">{{ 'CREDIT.NOTES' | translate }}</nz-form-label>
            <nz-form-control><textarea nz-input id="case-notes" rows="2" maxlength="2000" formControlName="notes"></textarea></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class CreditCasesComponent implements OnInit {
  private readonly api = inject(CreditManagementApiService);
  private readonly crm = inject(CrmApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly statuses = COLLECTION_CASE_STATUSES;
  readonly priorities = COLLECTION_CASE_PRIORITIES;
  readonly cases = signal<CollectionCase[]>([]);
  readonly customers = signal<CreditCustomerOption[]>([]);
  readonly strategies = signal<DunningStrategy[]>([]);
  readonly loading = signal(false);
  readonly status = signal<CollectionCaseStatus | null>(null);
  readonly priority = signal<CollectionCasePriority | null>(null);
  readonly modalVisible = signal(false);

  readonly form = this.fb.group({
    customer_id: ['', [Validators.required]],
    strategy_id: this.fb.control<string | null>(null),
    priority: ['normal' as CollectionCasePriority],
    notes: ['', [Validators.maxLength(2000)]],
  });

  ngOnInit(): void {
    this.load();
    loadCustomers(this.crm).subscribe((customers) => this.customers.set(customers));
    this.api.getStrategies().subscribe({ next: (response) => this.strategies.set(response.data.filter((strategy) => strategy.is_active)), error: () => undefined });
  }

  color(status: string): string {
    return statusColor(status);
  }

  load(): void {
    this.loading.set(true);
    this.api.getCases({ status: this.status() ?? undefined, priority: this.priority() ?? undefined, per_page: 100 }).subscribe({
      next: (response) => {
        this.cases.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('CREDIT.ACTION_ERROR'));
      },
    });
  }

  openModal(): void {
    this.form.reset({ customer_id: '', strategy_id: this.strategies().find((strategy) => strategy.is_default)?.id ?? null, priority: 'normal', notes: '' });
    this.modalVisible.set(true);
  }

  save(): void {
    const value = this.form.getRawValue();
    this.api
      .createCase({ customer_id: value.customer_id, invoice_ids: null, strategy_id: value.strategy_id, collector_id: null, priority: value.priority, notes: blankToNull(value.notes) })
      .subscribe({
        next: () => {
          this.message.success(this.translate.instant('CREDIT.CASE_SAVED'));
          this.modalVisible.set(false);
          this.load();
        },
        error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('CREDIT.ACTION_ERROR')),
      });
  }
}
