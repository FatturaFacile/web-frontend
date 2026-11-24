import { DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
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
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  CREDIT_INSURANCE_COVER_STATUSES,
  CREDIT_INSURANCE_POLICY_STATUSES,
  CreditInsuranceCover,
  CreditInsuranceCoverStatus,
  CreditInsurancePolicy,
  CreditInsurancePolicyStatus,
  CreditManagementApiService,
  CrmApiService,
  TranslateService,
} from '@core';
import { IconActionDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText, blankToNull, CreditCustomerOption, decimalOrNull, loadCustomers, statusColor, todayIso } from './credit.util';

type InsuranceDialog = 'policy' | 'cover' | null;

/** Credit insurance policies and the insured limit granted per customer under each policy. */
@Component({
  selector: 'app-credit-insurance',
  styleUrl: './credit-management.scss',
  imports: [
    DecimalPipe,
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
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'CREDIT.INSURANCE_TITLE' | translate" [subtitle]="'CREDIT.INSURANCE_SUBTITLE' | translate"></app-page-header>

    <nz-card class="main-card" [nzTitle]="'CREDIT.POLICIES' | translate">
      <div class="toolbar">
        <span class="spacer"></span>
        <button nz-button nzType="primary" (click)="openPolicy()" appIconAction="create"></button>
      </div>
      <nz-table #policyTable [nzData]="policies()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="25">
        <thead>
          <tr>
            <th>{{ 'CREDIT.INSURER' | translate }}</th>
            <th>{{ 'CREDIT.POLICY_NUMBER' | translate }}</th>
            <th>{{ 'CREDIT.VALIDITY' | translate }}</th>
            <th class="num">{{ 'CREDIT.COVERAGE_PERCENTAGE' | translate }}</th>
            <th class="num">{{ 'CREDIT.MAX_TOTAL_COVER' | translate }}</th>
            <th class="num">{{ 'CREDIT.GRANTED_TOTAL' | translate }}</th>
            <th>{{ 'CREDIT.STATUS' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of policyTable.data; track row.id) {
            <tr>
              <td>{{ row.insurer }}</td>
              <td>{{ row.policy_number }}</td>
              <td>{{ row.starts_on }} - {{ row.ends_on }}</td>
              <td class="num">{{ +row.coverage_percentage | number: '1.0-2' }}%</td>
              <td class="num">{{ row.max_total_cover === null ? '-' : (+row.max_total_cover | number: '1.2-2') + ' ' + row.currency }}</td>
              <td class="num">{{ row.granted_total === null ? '-' : (+row.granted_total | number: '1.2-2') + ' ' + row.currency }}</td>
              <td><nz-tag [nzColor]="color(row.status)">{{ ('CREDIT.POLICY_' + row.status.toUpperCase()) | translate }}</nz-tag></td>
              <td>
                <div class="row-actions">
                  <button nz-button nzSize="small" (click)="openCover(row)">{{ 'CREDIT.ADD_COVER' | translate }}</button>
                  <button nz-button nzType="text" appIconAction="edit" (click)="openPolicy(row)"></button>
                  <button nz-button nzType="text" nzDanger appIconAction="delete" nz-popconfirm [nzPopconfirmTitle]="'CREDIT.DELETE_CONFIRM' | translate" (nzOnConfirm)="removePolicy(row)"></button>
                </div>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && policies().length === 0) {
        <nz-empty [nzNotFoundContent]="'CREDIT.NO_POLICIES' | translate"></nz-empty>
      }
    </nz-card>

    <nz-card class="main-card" [nzTitle]="'CREDIT.COVERS' | translate">
      <nz-table #coverTable [nzData]="covers()" nzSize="small" [nzPageSize]="25">
        <thead>
          <tr>
            <th>{{ 'CREDIT.CUSTOMER' | translate }}</th>
            <th>{{ 'CREDIT.POLICY_NUMBER' | translate }}</th>
            <th class="num">{{ 'CREDIT.INSURED_LIMIT' | translate }}</th>
            <th>{{ 'CREDIT.GRANTED_ON' | translate }}</th>
            <th>{{ 'CREDIT.EXPIRES_ON' | translate }}</th>
            <th>{{ 'CREDIT.STATUS' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of coverTable.data; track row.id) {
            <tr>
              <td>{{ row.customer_name }}</td>
              <td>{{ policyNumber(row.policy_id) }}</td>
              <td class="num">{{ +row.insured_limit | number: '1.2-2' }}</td>
              <td>{{ row.granted_on ?? '-' }}</td>
              <td>{{ row.expires_on ?? '-' }}</td>
              <td><nz-tag [nzColor]="color(row.status)">{{ ('CREDIT.COVER_' + row.status.toUpperCase()) | translate }}</nz-tag></td>
              <td>
                <div class="row-actions">
                  <button nz-button nzType="text" appIconAction="edit" (click)="openCover(null, row)"></button>
                  <button nz-button nzType="text" nzDanger appIconAction="delete" nz-popconfirm [nzPopconfirmTitle]="'CREDIT.DELETE_CONFIRM' | translate" (nzOnConfirm)="removeCover(row)"></button>
                </div>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (covers().length === 0) {
        <nz-empty [nzNotFoundContent]="'CREDIT.NO_COVERS' | translate"></nz-empty>
      }
    </nz-card>

    <nz-modal [nzVisible]="dialog() === 'policy'" [nzTitle]="(editingPolicy() ? 'CREDIT.EDIT_POLICY' : 'CREDIT.NEW_POLICY') | translate" (nzOnCancel)="dialog.set(null)" (nzOnOk)="savePolicy()" okAction="save" [nzOkDisabled]="policyForm.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="policyForm" nzLayout="vertical">
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="policy-insurer">{{ 'CREDIT.INSURER' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="policy-insurer" formControlName="insurer" maxlength="160" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="policy-number">{{ 'CREDIT.POLICY_NUMBER' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="policy-number" formControlName="policy_number" maxlength="80" /></nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="policy-start">{{ 'CREDIT.STARTS_ON' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="policy-start" type="date" formControlName="starts_on" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="policy-end">{{ 'CREDIT.ENDS_ON' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="policy-end" type="date" formControlName="ends_on" /></nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="policy-percent">{{ 'CREDIT.COVERAGE_PERCENTAGE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="policy-percent" type="number" min="0.01" max="100" step="any" formControlName="coverage_percentage" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="policy-max">{{ 'CREDIT.MAX_TOTAL_COVER' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="policy-max" type="number" min="0.01" step="any" formControlName="max_total_cover" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="policy-currency">{{ 'CREDIT.CURRENCY' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="policy-currency" formControlName="currency" maxlength="3" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'CREDIT.STATUS' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="status">
                  @for (value of policyStatuses; track value) {
                    <nz-option [nzValue]="value" [nzLabel]="('CREDIT.POLICY_' + value.toUpperCase()) | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-label nzFor="policy-notes">{{ 'CREDIT.NOTES' | translate }}</nz-form-label>
            <nz-form-control><textarea nz-input id="policy-notes" rows="2" maxlength="2000" formControlName="notes"></textarea></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal [nzVisible]="dialog() === 'cover'" [nzTitle]="(editingCover() ? 'CREDIT.EDIT_COVER' : 'CREDIT.NEW_COVER') | translate" (nzOnCancel)="dialog.set(null)" (nzOnOk)="saveCover()" okAction="save" [nzOkDisabled]="coverForm.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="coverForm" nzLayout="vertical">
          @if (!editingCover()) {
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
          }
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="cover-limit">{{ 'CREDIT.INSURED_LIMIT' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="cover-limit" type="number" min="0.01" step="any" formControlName="insured_limit" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'CREDIT.STATUS' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="status">
                  @for (value of coverStatuses; track value) {
                    <nz-option [nzValue]="value" [nzLabel]="('CREDIT.COVER_' + value.toUpperCase()) | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzFor="cover-granted">{{ 'CREDIT.GRANTED_ON' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="cover-granted" type="date" formControlName="granted_on" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="cover-expires">{{ 'CREDIT.EXPIRES_ON' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="cover-expires" type="date" formControlName="expires_on" /></nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-label nzFor="cover-notes">{{ 'CREDIT.NOTES' | translate }}</nz-form-label>
            <nz-form-control><textarea nz-input id="cover-notes" rows="2" maxlength="2000" formControlName="notes"></textarea></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class CreditInsuranceComponent implements OnInit {
  private readonly api = inject(CreditManagementApiService);
  private readonly crm = inject(CrmApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly policyStatuses = CREDIT_INSURANCE_POLICY_STATUSES;
  readonly coverStatuses = CREDIT_INSURANCE_COVER_STATUSES;
  readonly policies = signal<CreditInsurancePolicy[]>([]);
  readonly covers = signal<CreditInsuranceCover[]>([]);
  readonly customers = signal<CreditCustomerOption[]>([]);
  readonly loading = signal(false);
  readonly dialog = signal<InsuranceDialog>(null);
  readonly editingPolicy = signal<CreditInsurancePolicy | null>(null);
  readonly editingCover = signal<CreditInsuranceCover | null>(null);
  readonly coverPolicyId = signal<string | null>(null);

  readonly policyForm = this.fb.group({
    insurer: ['', [Validators.required, Validators.maxLength(160)]],
    policy_number: ['', [Validators.required, Validators.maxLength(80)]],
    starts_on: [todayIso(), [Validators.required]],
    ends_on: ['', [Validators.required]],
    currency: ['EUR', [Validators.required, Validators.minLength(3), Validators.maxLength(3)]],
    coverage_percentage: this.fb.control<number | null>(90, [Validators.required, Validators.min(0.01), Validators.max(100)]),
    max_total_cover: this.fb.control<number | null>(null, [Validators.min(0.01)]),
    status: ['active' as CreditInsurancePolicyStatus],
    notes: [''],
  });

  readonly coverForm = this.fb.group({
    customer_id: [''],
    insured_limit: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
    status: ['granted' as CreditInsuranceCoverStatus],
    granted_on: [todayIso()],
    expires_on: [''],
    notes: [''],
  });

  ngOnInit(): void {
    this.load();
    loadCustomers(this.crm).subscribe((customers) => this.customers.set(customers));
  }

  color(status: string): string {
    return statusColor(status);
  }

  policyNumber(policyId: string): string {
    return this.policies().find((policy) => policy.id === policyId)?.policy_number ?? '';
  }

  load(): void {
    this.loading.set(true);
    this.api.getInsurancePolicies().subscribe({
      next: (response) => {
        this.policies.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('CREDIT.ACTION_ERROR'));
      },
    });
    this.api.getInsuranceCovers().subscribe({ next: (response) => this.covers.set(response.data), error: () => undefined });
  }

  openPolicy(policy: CreditInsurancePolicy | null = null): void {
    this.editingPolicy.set(policy);
    this.policyForm.reset({
      insurer: policy?.insurer ?? '',
      policy_number: policy?.policy_number ?? '',
      starts_on: policy?.starts_on ?? todayIso(),
      ends_on: policy?.ends_on ?? '',
      currency: policy?.currency ?? 'EUR',
      coverage_percentage: policy ? Number(policy.coverage_percentage) : 90,
      max_total_cover: policy?.max_total_cover != null ? Number(policy.max_total_cover) : null,
      status: policy?.status ?? 'active',
      notes: policy?.notes ?? '',
    });
    this.dialog.set('policy');
  }

  savePolicy(): void {
    const value = this.policyForm.getRawValue();
    const payload = {
      insurer: value.insurer,
      policy_number: value.policy_number,
      starts_on: value.starts_on,
      ends_on: value.ends_on,
      currency: value.currency.toUpperCase(),
      coverage_percentage: String(value.coverage_percentage),
      max_total_cover: decimalOrNull(value.max_total_cover),
      status: value.status,
      notes: blankToNull(value.notes),
    };
    const current = this.editingPolicy();
    this.finish(current ? this.api.updateInsurancePolicy(current.id, payload) : this.api.createInsurancePolicy(payload), 'CREDIT.POLICY_SAVED');
  }

  removePolicy(policy: CreditInsurancePolicy): void {
    this.finish(this.api.deleteInsurancePolicy(policy.id), 'CREDIT.DELETED');
  }

  openCover(policy: CreditInsurancePolicy | null, cover: CreditInsuranceCover | null = null): void {
    this.editingCover.set(cover);
    this.coverPolicyId.set(policy?.id ?? cover?.policy_id ?? null);
    this.coverForm.reset({
      customer_id: cover?.customer_id ?? '',
      insured_limit: cover ? Number(cover.insured_limit) : null,
      status: cover?.status ?? 'granted',
      granted_on: cover?.granted_on ?? todayIso(),
      expires_on: cover?.expires_on ?? '',
      notes: cover?.notes ?? '',
    });
    this.dialog.set('cover');
  }

  saveCover(): void {
    const value = this.coverForm.getRawValue();
    const base = {
      insured_limit: String(value.insured_limit),
      status: value.status,
      granted_on: blankToNull(value.granted_on),
      expires_on: blankToNull(value.expires_on),
      notes: blankToNull(value.notes),
    };
    const current = this.editingCover();
    const policyId = this.coverPolicyId();
    if (current) {
      this.finish(this.api.updateInsuranceCover(current.id, base), 'CREDIT.COVER_SAVED');
    } else if (policyId && value.customer_id) {
      this.finish(this.api.createInsuranceCover(policyId, { ...base, customer_id: value.customer_id }), 'CREDIT.COVER_SAVED');
    }
  }

  removeCover(cover: CreditInsuranceCover): void {
    this.finish(this.api.deleteInsuranceCover(cover.id), 'CREDIT.DELETED');
  }

  private finish(request: Observable<unknown>, successKey: string): void {
    request.subscribe({
      next: () => {
        this.message.success(this.translate.instant(successKey));
        this.dialog.set(null);
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('CREDIT.ACTION_ERROR')),
    });
  }
}
