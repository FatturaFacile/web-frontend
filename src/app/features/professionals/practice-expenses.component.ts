import { DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
  LegalCase,
  PRACTICE_EXPENSE_CATEGORIES,
  PracticeApiService,
  PracticeExpense,
  PracticeExpenseCategory,
  PracticeExpenseRequest,
  ProfessionalsApiService,
  TranslateService,
} from '@core';
import { downloadBlob, IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText, loadCases, todayIso } from './practice-firm.util';

/** Expenses incurred on matters (court fees, travel, experts) with the billable and billed flags. */
@Component({
  selector: 'app-practice-expenses',
  styleUrl: './practice-firm.scss',
  imports: [
    DecimalPipe,
    FormsModule,
    ReactiveFormsModule,
    IconActionDirective,
    ModalActionsDirective,
    PageHeaderComponent,
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
    <app-page-header [title]="'PRACTICEFIRM.EXPENSES_TITLE' | translate" [subtitle]="'PRACTICEFIRM.EXPENSES_SUBTITLE' | translate">
      <button nz-button nzType="primary" (click)="openModal()" appIconAction="create"></button>
    </app-page-header>

    <div class="toolbar">
      <nz-select style="width: 280px" nzAllowClear nzShowSearch [ngModel]="caseId()" (ngModelChange)="caseId.set($event); load()" [nzPlaceHolder]="'PRACTICEFIRM.MATTER' | translate">
        @for (matter of cases(); track matter.id) {
          <nz-option [nzValue]="matter.id" [nzLabel]="matter.case_number + ' - ' + matter.title"></nz-option>
        }
      </nz-select>
    </div>

    <nz-card class="main-card">
      <nz-table #table [nzData]="rows()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="25">
        <thead>
          <tr>
            <th>{{ 'PRACTICEFIRM.DATE' | translate }}</th>
            <th>{{ 'PRACTICEFIRM.MATTER' | translate }}</th>
            <th>{{ 'PRACTICEFIRM.CATEGORY' | translate }}</th>
            <th>{{ 'PRACTICEFIRM.DESCRIPTION' | translate }}</th>
            <th class="num">{{ 'PRACTICEFIRM.AMOUNT' | translate }}</th>
            <th>{{ 'PRACTICEFIRM.STATUS' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <td>{{ row.expense_date.substring(0, 10) }}</td>
              <td>{{ row.legal_case?.case_number }}</td>
              <td>{{ ('PRACTICEFIRM.CATEGORY_' + row.category.toUpperCase()) | translate }}</td>
              <td>{{ row.description }}</td>
              <td class="num">{{ row.amount | number: '1.2-2' }}</td>
              <td>
                @if (row.is_billed) {
                  <nz-tag nzColor="green">{{ 'PRACTICEFIRM.BILLED' | translate }}</nz-tag>
                } @else if (row.is_billable) {
                  <nz-tag nzColor="blue">{{ 'PRACTICEFIRM.BILLABLE' | translate }}</nz-tag>
                } @else {
                  <nz-tag>{{ 'PRACTICEFIRM.NOT_BILLABLE' | translate }}</nz-tag>
                }
              </td>
              <td>
                <div class="row-actions">
                  @if (row.has_receipt) {
                    <button nz-button nzType="link" (click)="downloadReceipt(row)">{{ 'PRACTICEFIRM.RECEIPT' | translate }}</button>
                    <button nz-button nzType="text" nzDanger nz-popconfirm [nzPopconfirmTitle]="'PRACTICEFIRM.DELETE_RECEIPT_CONFIRM' | translate" (nzOnConfirm)="removeReceipt(row)">
                      {{ 'PRACTICEFIRM.DELETE_RECEIPT' | translate }}
                    </button>
                  }
                  <button nz-button nzType="default" (click)="pickReceipt(row, receiptInput)">{{ 'PRACTICEFIRM.ATTACH_RECEIPT' | translate }}</button>
                  @if (!row.is_billed) {
                    <button nz-button nzType="text" appIconAction="edit" (click)="openModal(row)"></button>
                    <button nz-button nzType="text" nzDanger appIconAction="delete" nz-popconfirm [nzPopconfirmTitle]="'PRACTICEFIRM.DELETE_CONFIRM' | translate" (nzOnConfirm)="remove(row)"></button>
                  }
                </div>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && rows().length === 0) {
        <nz-empty [nzNotFoundContent]="'PRACTICEFIRM.NO_EXPENSES' | translate"></nz-empty>
      }
    </nz-card>

    <input #receiptInput type="file" hidden accept=".pdf,.jpg,.jpeg,.png,.webp" (change)="uploadReceipt($event)" />

    <nz-modal appModalActions [(nzVisible)]="modalVisible" [nzTitle]="(editing() ? 'PRACTICEFIRM.EDIT_EXPENSE' : 'PRACTICEFIRM.NEW_EXPENSE') | translate" (nzOnCancel)="modalVisible.set(false)" (nzOnOk)="save()" okAction="save" [nzOkDisabled]="form.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="form" nzLayout="vertical">
          @if (!editing()) {
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'PRACTICEFIRM.MATTER' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="legal_case_id" nzShowSearch>
                  @for (matter of cases(); track matter.id) {
                    <nz-option [nzValue]="matter.id" [nzLabel]="matter.case_number + ' - ' + matter.title"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          }
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="exp-date">{{ 'PRACTICEFIRM.DATE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="exp-date" type="date" formControlName="expense_date" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'PRACTICEFIRM.CATEGORY' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="category">
                  @for (value of categories; track value) {
                    <nz-option [nzValue]="value" [nzLabel]="('PRACTICEFIRM.CATEGORY_' + value.toUpperCase()) | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="exp-amount">{{ 'PRACTICEFIRM.AMOUNT' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="exp-amount" type="number" min="0.01" step="0.01" formControlName="amount" /></nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="exp-description">{{ 'PRACTICEFIRM.DESCRIPTION' | translate }}</nz-form-label>
            <nz-form-control><input nz-input id="exp-description" formControlName="description" maxlength="255" /></nz-form-control>
          </nz-form-item>
          <label for="practice-expenses-is-billable" nzId="practice-expenses-is-billable" nz-checkbox formControlName="is_billable">{{ 'PRACTICEFIRM.BILLABLE' | translate }}</label>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class PracticeExpensesComponent implements OnInit {
  private readonly api = inject(PracticeApiService);
  private readonly professionals = inject(ProfessionalsApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  private receiptTarget: PracticeExpense | null = null;

  readonly categories = PRACTICE_EXPENSE_CATEGORIES;
  readonly rows = signal<PracticeExpense[]>([]);
  readonly cases = signal<LegalCase[]>([]);
  readonly loading = signal(false);
  readonly caseId = signal<string | null>(null);
  readonly modalVisible = signal(false);
  readonly editing = signal<PracticeExpense | null>(null);

  readonly form = this.fb.group({
    legal_case_id: ['', [Validators.required]],
    expense_date: [todayIso(), [Validators.required]],
    category: ['other' as PracticeExpenseCategory],
    description: ['', [Validators.required, Validators.maxLength(255)]],
    amount: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
    is_billable: [true],
  });

  ngOnInit(): void {
    loadCases(this.professionals).subscribe((cases) => this.cases.set(cases));
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.getExpenses({ legal_case_id: this.caseId() ?? undefined, per_page: 100 }).subscribe({
      next: (response) => {
        this.rows.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('PRACTICEFIRM.ACTION_ERROR'));
      },
    });
  }

  openModal(expense: PracticeExpense | null = null): void {
    this.editing.set(expense);
    this.form.reset({
      legal_case_id: expense?.legal_case_id ?? this.caseId() ?? '',
      expense_date: expense?.expense_date.substring(0, 10) ?? todayIso(),
      category: expense?.category ?? 'other',
      description: expense?.description ?? '',
      amount: expense ? Number(expense.amount) : null,
      is_billable: expense?.is_billable ?? true,
    });
    this.modalVisible.set(true);
  }

  save(): void {
    const value = this.form.getRawValue();
    const payload: PracticeExpenseRequest = {
      expense_date: value.expense_date,
      category: value.category,
      description: value.description,
      amount: String(value.amount ?? ''),
      is_billable: value.is_billable,
    };
    const current = this.editing();
    const request = current ? this.api.updateExpense(current.id, payload) : this.api.createExpense({ ...payload, legal_case_id: value.legal_case_id });

    request.subscribe({
      next: () => {
        this.message.success(this.translate.instant('PRACTICEFIRM.EXPENSE_SAVED'));
        this.modalVisible.set(false);
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('PRACTICEFIRM.ACTION_ERROR')),
    });
  }

  pickReceipt(expense: PracticeExpense, input: HTMLInputElement): void {
    this.receiptTarget = expense;
    input.value = '';
    input.click();
  }

  uploadReceipt(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.item(0);
    const expense = this.receiptTarget;
    if (!file || !expense) {
      return;
    }
    this.api.uploadExpenseReceipt(expense.id, file).subscribe({
      next: () => {
        this.message.success(this.translate.instant('PRACTICEFIRM.RECEIPT_SAVED'));
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('PRACTICEFIRM.ACTION_ERROR')),
    });
  }

  downloadReceipt(expense: PracticeExpense): void {
    this.api.downloadExpenseReceipt(expense.id).subscribe({
      next: (blob) => downloadBlob(blob, expense.receipt_name ?? `${expense.id}`),
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('PRACTICEFIRM.ACTION_ERROR')),
    });
  }

  removeReceipt(expense: PracticeExpense): void {
    this.api.deleteExpenseReceipt(expense.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('PRACTICEFIRM.RECEIPT_DELETED'));
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('PRACTICEFIRM.ACTION_ERROR')),
    });
  }

  remove(expense: PracticeExpense): void {
    this.api.deleteExpense(expense.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('PRACTICEFIRM.EXPENSE_DELETED'));
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('PRACTICEFIRM.ACTION_ERROR')),
    });
  }
}
