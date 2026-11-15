import { DecimalPipe } from '@angular/common';
import { Component, effect, inject, input, OnInit, output, signal } from '@angular/core';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import {
  AccountingApiService,
  BUDGET_SPREAD_METHODS,
  BudgetingApiService,
  BudgetPlanLine,
  BudgetSpreadMethod,
  GeneralLedgerApiService,
  TranslateService,
} from '@core';
import { IconActionDirective, ModalActionsDirective, TranslatePipe } from '@shared';
import { apiErrorText, blankToNull, DimensionOption, loadAccounts, loadCostCenters, parseWeights } from './budgeting.util';

function percentagesValidator(control: AbstractControl): ValidationErrors | null {
  const values = parseWeights(control.value as string);
  return values === null || values.every((value) => Number.isFinite(value) && value >= 0) ? null : { percentages: true };
}

/** Budget lines of a version and the spread of an amount over periods; read-only once the version left the draft. */
@Component({
  selector: 'app-budgeting-lines',
  styleUrl: './budgeting.scss',
  imports: [
    DecimalPipe,
    ReactiveFormsModule,
    IconActionDirective,
    ModalActionsDirective,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
  ],
  template: `
    @if (editable()) {
      <div class="toolbar">
        <span class="spacer"></span>
        <button nz-button (click)="openSpread()">{{ 'BUDGETING.SPREAD' | translate }}</button>
        <button nz-button nzType="primary" (click)="openModal()" appIconAction="create"></button>
      </div>
    }

    <nz-card class="main-card">
      <nz-table #table [nzData]="lines()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="25">
        <thead>
          <tr>
            <th>{{ 'BUDGETING.ACCOUNT' | translate }}</th>
            <th>{{ 'BUDGETING.COST_CENTER' | translate }}</th>
            <th class="num">{{ 'BUDGETING.PERIOD' | translate }}</th>
            <th class="num">{{ 'BUDGETING.AMOUNT' | translate }}</th>
            <th>{{ 'BUDGETING.SOURCE' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <td>{{ accountLabel(row.account_id) }}</td>
              <td>{{ costCenterLabel(row.cost_center_id) }}</td>
              <td class="num">{{ row.period }}</td>
              <td class="num">{{ row.amount | number: '1.2-2' }}</td>
              <td>{{ ('BUDGETING.SOURCE_' + row.source.toUpperCase()) | translate }}</td>
              <td>
                @if (editable()) {
                  <div class="row-actions">
                    <button nz-button nzType="text" appIconAction="edit" (click)="openModal(row)"></button>
                    <button nz-button nzType="text" nzDanger appIconAction="delete" nz-popconfirm [nzPopconfirmTitle]="'BUDGETING.DELETE_CONFIRM' | translate" (nzOnConfirm)="remove(row)"></button>
                  </div>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && lines().length === 0) {
        <nz-empty [nzNotFoundContent]="'BUDGETING.NO_LINES' | translate"></nz-empty>
      }
    </nz-card>

    <nz-modal [(nzVisible)]="modalVisible" [nzTitle]="(editing() ? 'BUDGETING.EDIT_LINE' : 'BUDGETING.NEW_LINE') | translate" (nzOnCancel)="modalVisible.set(false)" (nzOnOk)="save()" okAction="save" [nzOkDisabled]="form.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="form" nzLayout="vertical">
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
              <nz-form-label nzRequired nzFor="line-period">{{ 'BUDGETING.PERIOD' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="line-period" type="number" min="1" max="12" formControlName="period" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="line-amount">{{ 'BUDGETING.AMOUNT' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="line-amount" type="number" min="0" step="any" formControlName="amount" /></nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-label nzFor="line-project">{{ 'BUDGETING.PROJECT_ID' | translate }}</nz-form-label>
            <nz-form-control><input nz-input id="line-project" formControlName="project_id" /></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal [(nzVisible)]="spreadVisible" [nzTitle]="'BUDGETING.SPREAD' | translate" (nzOnCancel)="spreadVisible.set(false)" (nzOnOk)="saveSpread()" okAction="save" [nzOkDisabled]="spreadForm.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="spreadForm" nzLayout="vertical">
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
              <nz-form-label nzRequired nzFor="spread-total">{{ 'BUDGETING.TOTAL_AMOUNT' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="spread-total" type="number" min="0" step="any" formControlName="total_amount" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'BUDGETING.SPREAD_METHOD' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="method">
                  @for (value of methods; track value) {
                    <nz-option [nzValue]="value" [nzLabel]="('BUDGETING.METHOD_' + value.toUpperCase()) | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="spread-start">{{ 'BUDGETING.START_PERIOD' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="spread-start" type="number" min="1" max="12" formControlName="start_period" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="spread-end">{{ 'BUDGETING.END_PERIOD' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="spread-end" type="number" min="1" max="12" formControlName="end_period" /></nz-form-control>
            </nz-form-item>
          </div>
          @if (spreadForm.controls.method.value === 'percentage') {
            <nz-form-item>
              <nz-form-label nzRequired nzFor="spread-percentages">{{ 'BUDGETING.PERCENTAGES' | translate }}</nz-form-label>
              <nz-form-control [nzExtra]="'BUDGETING.PERCENTAGES_HINT' | translate"><input nz-input id="spread-percentages" formControlName="percentages" /></nz-form-control>
            </nz-form-item>
          }
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class BudgetingLinesComponent implements OnInit {
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
  readonly lines = signal<BudgetPlanLine[]>([]);
  readonly accounts = signal<DimensionOption[]>([]);
  readonly costCenters = signal<DimensionOption[]>([]);
  readonly loading = signal(false);
  readonly modalVisible = signal(false);
  readonly spreadVisible = signal(false);
  readonly editing = signal<BudgetPlanLine | null>(null);

  readonly form = this.fb.group({
    account_id: ['', [Validators.required]],
    cost_center_id: this.fb.control<string | null>(null),
    period: [1, [Validators.required, Validators.min(1), Validators.max(12)]],
    amount: this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
    project_id: ['', [Validators.pattern(/^$|^[0-9a-fA-F-]{36}$/)]],
  });

  readonly spreadForm = this.fb.group({
    account_id: ['', [Validators.required]],
    cost_center_id: this.fb.control<string | null>(null),
    total_amount: this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
    method: ['even' as BudgetSpreadMethod, [Validators.required]],
    start_period: [1, [Validators.required, Validators.min(1), Validators.max(12)]],
    end_period: [12, [Validators.required, Validators.min(1), Validators.max(12)]],
    percentages: ['', [percentagesValidator]],
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

  costCenterLabel(id: string | null): string {
    return id === null ? '' : (this.costCenters().find((center) => center.id === id)?.label ?? id);
  }

  load(): void {
    this.loading.set(true);
    this.api.getLines(this.versionId(), { per_page: 100 }).subscribe({
      next: (response) => {
        this.lines.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('BUDGETING.ACTION_ERROR'));
      },
    });
  }

  openModal(line: BudgetPlanLine | null = null): void {
    this.editing.set(line);
    this.form.reset({
      account_id: line?.account_id ?? '',
      cost_center_id: line?.cost_center_id ?? null,
      period: line?.period ?? 1,
      amount: line ? Number(line.amount) : null,
      project_id: line?.project_id ?? '',
    });
    this.modalVisible.set(true);
  }

  save(): void {
    const value = this.form.getRawValue();
    const payload = { account_id: value.account_id, cost_center_id: value.cost_center_id, project_id: blankToNull(value.project_id), period: value.period, amount: String(value.amount), notes: null };
    const current = this.editing();
    const request = current ? this.api.updateLine(current.id, payload) : this.api.saveLine(this.versionId(), payload);

    request.subscribe({
      next: () => {
        this.message.success(this.translate.instant('BUDGETING.LINE_SAVED'));
        this.modalVisible.set(false);
        this.load();
        this.changed.emit();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('BUDGETING.ACTION_ERROR')),
    });
  }

  remove(line: BudgetPlanLine): void {
    this.api.deleteLine(line.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('BUDGETING.DELETED'));
        this.load();
        this.changed.emit();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('BUDGETING.ACTION_ERROR')),
    });
  }

  openSpread(): void {
    this.spreadForm.reset({ account_id: '', cost_center_id: null, total_amount: null, method: 'even', start_period: 1, end_period: 12, percentages: '' });
    this.spreadVisible.set(true);
  }

  saveSpread(): void {
    const value = this.spreadForm.getRawValue();
    this.api
      .spread(this.versionId(), {
        account_id: value.account_id,
        cost_center_id: value.cost_center_id,
        project_id: null,
        total_amount: String(value.total_amount),
        method: value.method,
        start_period: value.start_period,
        end_period: value.end_period,
        percentages: value.method === 'percentage' ? parseWeights(value.percentages) : null,
        notes: null,
      })
      .subscribe({
        next: () => {
          this.message.success(this.translate.instant('BUDGETING.SPREAD_DONE'));
          this.spreadVisible.set(false);
          this.load();
          this.changed.emit();
        },
        error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('BUDGETING.ACTION_ERROR')),
      });
  }
}
