import { DecimalPipe } from '@angular/common';
import { Component, effect, inject, input, OnInit, output, signal } from '@angular/core';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AccountingApiService,
  BUDGET_SPREAD_METHODS,
  BudgetDriver,
  BudgetingApiService,
  BudgetSpreadMethod,
  GeneralLedgerApiService,
  TranslateService,
} from '@core';
import { IconActionDirective, ModalActionsDirective, TranslatePipe } from '@shared';
import { apiErrorText, DimensionOption, loadAccounts, loadCostCenters, parseWeights } from './budgeting.util';

function percentagesValidator(control: AbstractControl): ValidationErrors | null {
  const values = parseWeights(control.value as string);
  return values === null || values.every((value) => Number.isFinite(value) && value >= 0) ? null : { percentages: true };
}

/** Planning drivers (quantity times rate) that write the budget lines of a draft version. */
@Component({
  selector: 'app-budgeting-drivers',
  styleUrl: './budgeting.scss',
  imports: [
    DecimalPipe,
    ReactiveFormsModule,
    IconActionDirective,
    ModalActionsDirective,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    @if (editable()) {
      <div class="toolbar">
        <span class="spacer"></span>
        <button nz-button (click)="generateAll()">{{ 'BUDGETING.GENERATE_ALL' | translate }}</button>
        <button nz-button nzType="primary" (click)="openModal()" appIconAction="create"></button>
      </div>
    }

    <nz-card class="main-card">
      <nz-table #table [nzData]="drivers()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="25">
        <thead>
          <tr>
            <th>{{ 'BUDGETING.NAME' | translate }}</th>
            <th>{{ 'BUDGETING.ACCOUNT' | translate }}</th>
            <th class="num">{{ 'BUDGETING.QUANTITY' | translate }}</th>
            <th class="num">{{ 'BUDGETING.RATE' | translate }}</th>
            <th class="num">{{ 'BUDGETING.TOTAL_AMOUNT' | translate }}</th>
            <th>{{ 'BUDGETING.SPREAD_METHOD' | translate }}</th>
            <th>{{ 'BUDGETING.PERIODS' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <td>{{ row.name }} @if (!row.is_active) { <nz-tag>{{ 'BUDGETING.INACTIVE' | translate }}</nz-tag> }</td>
              <td>{{ accountLabel(row.account_id) }}</td>
              <td class="num">{{ row.quantity | number: '1.0-3' }}</td>
              <td class="num">{{ row.rate | number: '1.2-4' }}</td>
              <td class="num">{{ row.total_amount | number: '1.2-2' }}</td>
              <td>{{ ('BUDGETING.METHOD_' + row.spread_method.toUpperCase()) | translate }}</td>
              <td>{{ row.start_period }} - {{ row.end_period }}</td>
              <td>
                @if (editable()) {
                  <div class="row-actions">
                    <button nz-button nzType="text" (click)="generate(row)">{{ 'BUDGETING.GENERATE' | translate }}</button>
                    <button nz-button nzType="text" appIconAction="edit" (click)="openModal(row)"></button>
                    <button nz-button nzType="text" nzDanger appIconAction="delete" nz-popconfirm [nzPopconfirmTitle]="'BUDGETING.DELETE_DRIVER_CONFIRM' | translate" (nzOnConfirm)="remove(row)"></button>
                  </div>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && drivers().length === 0) {
        <nz-empty [nzNotFoundContent]="'BUDGETING.NO_DRIVERS' | translate"></nz-empty>
      }
    </nz-card>

    <nz-modal [(nzVisible)]="modalVisible" [nzTitle]="(editing() ? 'BUDGETING.EDIT_DRIVER' : 'BUDGETING.NEW_DRIVER') | translate" (nzOnCancel)="modalVisible.set(false)" (nzOnOk)="save()" okAction="save" [nzOkDisabled]="form.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="form" nzLayout="vertical">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="driver-name">{{ 'BUDGETING.NAME' | translate }}</nz-form-label>
            <nz-form-control><input nz-input id="driver-name" formControlName="name" maxlength="160" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'BUDGETING.ACCOUNT' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="account_id" nzShowSearch>
                @for (account of accounts(); track account.id) {
                  <nz-option [nzValue]="account.id" [nzLabel]="account.label"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>{{ 'BUDGETING.COST_CENTER' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="cost_center_id" nzAllowClear nzShowSearch>
                @for (center of costCenters(); track center.id) {
                  <nz-option [nzValue]="center.id" [nzLabel]="center.label"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="driver-quantity">{{ 'BUDGETING.QUANTITY' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="driver-quantity" type="number" min="0" step="any" formControlName="quantity" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="driver-rate">{{ 'BUDGETING.RATE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="driver-rate" type="number" min="0" step="any" formControlName="rate" /></nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="driver-start">{{ 'BUDGETING.START_PERIOD' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="driver-start" type="number" min="1" max="12" formControlName="start_period" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="driver-end">{{ 'BUDGETING.END_PERIOD' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="driver-end" type="number" min="1" max="12" formControlName="end_period" /></nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'BUDGETING.SPREAD_METHOD' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="spread_method">
                @for (value of methods; track value) {
                  <nz-option [nzValue]="value" [nzLabel]="('BUDGETING.METHOD_' + value.toUpperCase()) | translate"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          @if (form.controls.spread_method.value === 'percentage') {
            <nz-form-item>
              <nz-form-label nzRequired nzFor="driver-percentages">{{ 'BUDGETING.PERCENTAGES' | translate }}</nz-form-label>
              <nz-form-control [nzExtra]="'BUDGETING.PERCENTAGES_HINT' | translate"><input nz-input id="driver-percentages" formControlName="percentages" /></nz-form-control>
            </nz-form-item>
          }
          <nz-form-item>
            <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
            <nz-form-control><label nz-checkbox formControlName="is_active">{{ 'BUDGETING.ACTIVE' | translate }}</label></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class BudgetingDriversComponent implements OnInit {
  private readonly api = inject(BudgetingApiService);
  private readonly accounting = inject(AccountingApiService);
  private readonly ledger = inject(GeneralLedgerApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly versionId = input.required<string>();
  readonly editable = input(false);
  readonly changed = output<void>();

  readonly methods = BUDGET_SPREAD_METHODS;
  readonly drivers = signal<BudgetDriver[]>([]);
  readonly accounts = signal<DimensionOption[]>([]);
  readonly costCenters = signal<DimensionOption[]>([]);
  readonly loading = signal(false);
  readonly modalVisible = signal(false);
  readonly editing = signal<BudgetDriver | null>(null);

  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(160)]],
    account_id: ['', [Validators.required]],
    cost_center_id: this.fb.control<string | null>(null),
    quantity: this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
    rate: this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
    spread_method: ['even' as BudgetSpreadMethod, [Validators.required]],
    percentages: ['', [percentagesValidator]],
    start_period: [1, [Validators.required, Validators.min(1), Validators.max(12)]],
    end_period: [12, [Validators.required, Validators.min(1), Validators.max(12)]],
    is_active: [true],
  });

  constructor() {
    effect(() => {
      this.versionId();
      this.load();
    });
  }

  ngOnInit(): void {
    loadAccounts(this.accounting).subscribe((accounts) => this.accounts.set(accounts));
    loadCostCenters(this.ledger).subscribe((centers) => this.costCenters.set(centers));
  }

  accountLabel(id: string): string {
    return this.accounts().find((account) => account.id === id)?.label ?? id;
  }

  load(): void {
    this.loading.set(true);
    this.api.getDrivers(this.versionId()).subscribe({
      next: (response) => {
        this.drivers.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('BUDGETING.ACTION_ERROR'));
      },
    });
  }

  openModal(driver: BudgetDriver | null = null): void {
    this.editing.set(driver);
    this.form.reset({
      name: driver?.name ?? '',
      account_id: driver?.account_id ?? '',
      cost_center_id: driver?.cost_center_id ?? null,
      quantity: driver ? Number(driver.quantity) : null,
      rate: driver ? Number(driver.rate) : null,
      spread_method: driver?.spread_method ?? 'even',
      percentages: driver?.percentages?.join(', ') ?? '',
      start_period: driver?.start_period ?? 1,
      end_period: driver?.end_period ?? 12,
      is_active: driver?.is_active ?? true,
    });
    this.modalVisible.set(true);
  }

  save(): void {
    const value = this.form.getRawValue();
    const payload = {
      name: value.name,
      account_id: value.account_id,
      cost_center_id: value.cost_center_id,
      project_id: this.editing()?.project_id ?? null,
      quantity: String(value.quantity),
      rate: String(value.rate),
      spread_method: value.spread_method,
      percentages: value.spread_method === 'percentage' ? parseWeights(value.percentages) : null,
      start_period: value.start_period,
      end_period: value.end_period,
      is_active: value.is_active,
    };
    const current = this.editing();
    const request = current ? this.api.updateDriver(current.id, payload) : this.api.createDriver(this.versionId(), payload);

    request.subscribe({
      next: () => {
        this.message.success(this.translate.instant('BUDGETING.DRIVER_SAVED'));
        this.modalVisible.set(false);
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('BUDGETING.ACTION_ERROR')),
    });
  }

  generate(driver: BudgetDriver): void {
    this.api.generateDriver(driver.id).subscribe({
      next: (response) => {
        this.message.success(this.translate.instant('BUDGETING.GENERATED', { lines: response.data.length }));
        this.changed.emit();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('BUDGETING.ACTION_ERROR')),
    });
  }

  generateAll(): void {
    this.api.generateDrivers(this.versionId()).subscribe({
      next: (response) => {
        this.message.success(this.translate.instant('BUDGETING.GENERATED_ALL', { drivers: response.data.drivers, lines: response.data.lines }));
        this.changed.emit();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('BUDGETING.ACTION_ERROR')),
    });
  }

  remove(driver: BudgetDriver): void {
    this.api.deleteDriver(driver.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('BUDGETING.DELETED'));
        this.load();
        this.changed.emit();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('BUDGETING.ACTION_ERROR')),
    });
  }
}
