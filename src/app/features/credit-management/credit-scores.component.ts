import { Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { CreditManagementApiService, CreditScore, CreditScorecardFactor, CrmApiService, TranslateService } from '@core';
import { IconActionDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText, blankToNull, CreditCustomerOption, loadCustomers, statusColor } from './credit.util';

/**
 * Score history per customer. A scoring computes the automatic factors from the receivables and takes a 0-100 value
 * from the user for every active manual factor.
 */
@Component({
  selector: 'app-credit-scores',
  styleUrl: './credit-management.scss',
  imports: [
    FormsModule,
    ReactiveFormsModule,
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
    <app-page-header [title]="'CREDIT.SCORES_TITLE' | translate" [subtitle]="'CREDIT.SCORES_SUBTITLE' | translate">
      <button nz-button nzType="primary" (click)="openModal()" appIconAction="create"></button>
    </app-page-header>

    <div class="toolbar">
      <nz-select style="width: 280px" nzAllowClear nzShowSearch [ngModel]="customerId()" (ngModelChange)="customerId.set($event); load()" [nzPlaceHolder]="'CREDIT.CUSTOMER' | translate">
        @for (customer of customers(); track customer.id) {
          <nz-option [nzValue]="customer.id" [nzLabel]="customer.name"></nz-option>
        }
      </nz-select>
    </div>

    <nz-card class="main-card">
      <nz-table #table [nzData]="scores()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="25">
        <thead>
          <tr>
            <th>{{ 'CREDIT.CUSTOMER' | translate }}</th>
            <th>{{ 'CREDIT.SCORED_ON' | translate }}</th>
            <th class="num">{{ 'CREDIT.SCORE' | translate }}</th>
            <th>{{ 'CREDIT.RATING' | translate }}</th>
            <th>{{ 'CREDIT.RISK_LEVEL' | translate }}</th>
            <th>{{ 'CREDIT.NOTES' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <td>{{ row.customer_name }}</td>
              <td>{{ row.scored_on }}</td>
              <td class="num">{{ row.score }}</td>
              <td>{{ row.rating }}</td>
              <td><nz-tag [nzColor]="color(row.risk_level)">{{ ('CREDIT.RISK_' + row.risk_level.toUpperCase()) | translate }}</nz-tag></td>
              <td>{{ row.notes }}</td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && scores().length === 0) {
        <nz-empty [nzNotFoundContent]="'CREDIT.NO_SCORES' | translate"></nz-empty>
      }
    </nz-card>

    <nz-modal [(nzVisible)]="modalVisible" [nzTitle]="'CREDIT.NEW_SCORE' | translate" (nzOnCancel)="modalVisible.set(false)" (nzOnOk)="save()" okAction="save" [nzOkDisabled]="form.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="form" nzLayout="vertical">
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'CREDIT.CUSTOMER' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="customer_id" nzShowSearch>
                @for (customer of customers(); track customer.id) {
                  <nz-option [nzValue]="customer.id" [nzLabel]="customer.name"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <div formGroupName="manual">
            @for (factor of manualFactors(); track factor.id) {
              <nz-form-item>
                <nz-form-label nzRequired [nzFor]="'factor-' + factor.code">{{ factor.name }} ({{ factor.weight }}%)</nz-form-label>
                <nz-form-control><input nz-input [id]="'factor-' + factor.code" type="number" min="0" max="100" [formControlName]="factor.code" /></nz-form-control>
              </nz-form-item>
            }
          </div>
          @if (factors().length === 0) {
            <p class="muted">{{ 'CREDIT.NO_FACTORS' | translate }}</p>
          }
          <nz-form-item>
            <nz-form-label nzFor="score-notes">{{ 'CREDIT.NOTES' | translate }}</nz-form-label>
            <nz-form-control><textarea nz-input id="score-notes" rows="2" maxlength="2000" formControlName="notes"></textarea></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class CreditScoresComponent implements OnInit {
  private readonly api = inject(CreditManagementApiService);
  private readonly crm = inject(CrmApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly scores = signal<CreditScore[]>([]);
  readonly customers = signal<CreditCustomerOption[]>([]);
  readonly factors = signal<CreditScorecardFactor[]>([]);
  readonly manualFactors = signal<CreditScorecardFactor[]>([]);
  readonly loading = signal(false);
  readonly customerId = signal<string | null>(null);
  readonly modalVisible = signal(false);

  private readonly manualGroup = new FormGroup<Record<string, FormControl<number>>>({});

  readonly form = this.fb.group({
    customer_id: ['', [Validators.required]],
    manual: this.manualGroup,
    notes: [''],
  });

  ngOnInit(): void {
    this.load();
    loadCustomers(this.crm).subscribe((customers) => this.customers.set(customers));
    this.api.getFactors().subscribe({
      next: (response) => {
        const active = response.data.filter((factor) => factor.is_active);
        this.factors.set(active);
        this.manualFactors.set(active.filter((factor) => factor.source === 'manual'));
      },
      error: () => undefined,
    });
  }

  color(level: string): string {
    return statusColor(level);
  }

  load(): void {
    this.loading.set(true);
    this.api.getScores(this.customerId() ?? undefined).subscribe({
      next: (response) => {
        this.scores.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('CREDIT.ACTION_ERROR'));
      },
    });
  }

  openModal(): void {
    const group: FormGroup = this.manualGroup as FormGroup;
    for (const key of Object.keys(group.controls)) {
      group.removeControl(key);
    }
    for (const factor of this.manualFactors()) {
      group.addControl(factor.code, new FormControl(50, { nonNullable: true, validators: [Validators.required, Validators.min(0), Validators.max(100)] }));
    }
    this.form.controls.customer_id.reset('');
    this.form.controls.notes.reset('');
    this.modalVisible.set(true);
  }

  save(): void {
    const value = this.form.getRawValue();
    this.api.createScore({ customer_id: value.customer_id, manual_inputs: value.manual, notes: blankToNull(value.notes) }).subscribe({
      next: () => {
        this.message.success(this.translate.instant('CREDIT.SCORE_SAVED'));
        this.modalVisible.set(false);
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('CREDIT.ACTION_ERROR')),
    });
  }
}
