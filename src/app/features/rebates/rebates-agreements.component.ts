import { DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, FormsModule, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
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
import { catchError, forkJoin, map, Observable, of, switchMap } from 'rxjs';
import {
  AccountingApiService,
  ChartOfAccount,
  ContactResource,
  CrmApiService,
  REBATE_ACCRUAL_FREQUENCIES,
  REBATE_AGREEMENT_STATUSES,
  REBATE_CONTRIBUTION_KINDS,
  REBATE_DIRECTIONS,
  REBATE_TIER_MODES,
  REBATE_TYPES,
  RebateAgreement,
  RebateAgreementRequest,
  RebateAgreementStatus,
  RebateContribution,
  RebateContributionKind,
  RebateDirection,
  RebatesApiService,
  RebateType,
  TranslateService,
} from '@core';
import { ProcurementExtraApiService } from '@core/api/procurement-extra-api.service';
import { IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import {
  AGREEMENT_STATUS_COLORS,
  apiErrorText,
  blankToNull,
  ContractOption,
  contactLabel,
  ContributionRow,
  decimalOrNull,
  distinctThresholdsValidator,
  loadContacts,
  planContributionSync,
  tierUpperBounds,
  toContractOption,
  todayIso,
} from './rebates.util';

type ContributionGroup = FormGroup<{
  id: FormControl<string>;
  kind: FormControl<RebateContributionKind>;
  description: FormControl<string>;
  amount: FormControl<string>;
  due_on: FormControl<string>;
}>;

/** Group validator: a marketing contribution agreement needs at least one contribution to plan. */
function contributionsRequired(group: AbstractControl): ValidationErrors | null {
  const type = group.get('rebate_type')?.value as RebateType | undefined;
  const contributions = group.get('contributions')?.value as unknown[] | undefined;
  return type === 'marketing_contribution' && (contributions?.length ?? 0) === 0 ? { contributionsRequired: true } : null;
}

/** Volume rebate agreements with customers (sales) and suppliers (purchases) and the scale of their tiers. */
@Component({
  selector: 'app-rebates-agreements',
  styleUrl: './rebates.scss',
  imports: [
    DecimalPipe,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    IconActionDirective,
    ModalActionsDirective,
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
    <app-page-header [title]="'REBATES.AGREEMENTS_TITLE' | translate" [subtitle]="'REBATES.AGREEMENTS_SUBTITLE' | translate">
      <button nz-button nzType="primary" (click)="openModal()" appIconAction="create"></button>
    </app-page-header>

    <div class="toolbar">
      <nz-select style="width: 200px" nzAllowClear [ngModel]="directionFilter()" (ngModelChange)="directionFilter.set($event); load()" [nzPlaceHolder]="'REBATES.DIRECTION' | translate">
        @for (direction of directions; track direction) {
          <nz-option [nzValue]="direction" [nzLabel]="('REBATES.DIRECTION_' + direction.toUpperCase()) | translate"></nz-option>
        }
      </nz-select>
      <nz-select style="width: 200px" nzAllowClear [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event); load()" [nzPlaceHolder]="'REBATES.STATUS' | translate">
        @for (status of statuses; track status) {
          <nz-option [nzValue]="status" [nzLabel]="('REBATES.STATUS_' + status.toUpperCase()) | translate"></nz-option>
        }
      </nz-select>
    </div>

    <nz-card class="main-card">
      <nz-table #table [nzData]="agreements()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="25">
        <thead>
          <tr>
            <th>{{ 'REBATES.CODE' | translate }}</th>
            <th>{{ 'REBATES.NAME' | translate }}</th>
            <th>{{ 'REBATES.DIRECTION' | translate }}</th>
            <th>{{ 'SUPPLIER_REBATES.REBATE_TYPE' | translate }}</th>
            <th>{{ 'REBATES.CONTACT' | translate }}</th>
            <th>{{ 'REBATES.PERIOD' | translate }}</th>
            <th>{{ 'REBATES.STATUS' | translate }}</th>
            <th class="num">{{ 'REBATES.OPEN_REBATE' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <td>
                <a [routerLink]="['/rebates/agreements', row.id]">{{ row.code }}</a>
              </td>
              <td>{{ row.name }}</td>
              <td>{{ ('REBATES.DIRECTION_' + row.direction.toUpperCase()) | translate }}</td>
              <td>{{ ('SUPPLIER_REBATES.TYPE_' + (row.rebate_type ?? 'tiered_volume').toUpperCase()) | translate }}</td>
              <td>{{ row.contact_name }}</td>
              <td>{{ row.starts_on }} - {{ row.ends_on }}</td>
              <td>
                <nz-tag [nzColor]="statusColor(row.status)">{{ ('REBATES.STATUS_' + row.status.toUpperCase()) | translate }}</nz-tag>
              </td>
              <td class="num">{{ row.open_rebate ?? '0' | number: '1.2-2' }} {{ row.currency }}</td>
              <td>
                <div class="row-actions">
                  @if (row.status === 'draft' || row.status === 'active') {
                    <button nz-button nzType="text" appIconAction="edit" (click)="openModal(row)"></button>
                  }
                  @if (row.status === 'draft') {
                    <button nz-button nzType="text" nz-popconfirm [nzPopconfirmTitle]="'REBATES.ACTIVATE_CONFIRM' | translate" (nzOnConfirm)="activate(row)">{{ 'REBATES.ACTIVATE' | translate }}</button>
                    <button nz-button nzType="text" nzDanger appIconAction="delete" nz-popconfirm [nzPopconfirmTitle]="'REBATES.DELETE_CONFIRM' | translate" (nzOnConfirm)="remove(row)"></button>
                  }
                </div>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && agreements().length === 0) {
        <nz-empty [nzNotFoundContent]="'REBATES.NO_AGREEMENTS' | translate"></nz-empty>
      }
    </nz-card>

    <nz-modal appModalActions [(nzVisible)]="modalVisible" [nzTitle]="(editing() ? 'SUPPLIER_REBATES.EDIT_AGREEMENT' : 'SUPPLIER_REBATES.NEW_AGREEMENT') | translate" nzWidth="900px" (nzOnCancel)="modalVisible.set(false)" (nzOnOk)="save()" okAction="save" [nzOkDisabled]="form.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="form" nzLayout="vertical">
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="rb-code">{{ 'REBATES.CODE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="rb-code" formControlName="code" maxlength="40" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="rb-name">{{ 'REBATES.NAME' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="rb-name" formControlName="name" maxlength="160" /></nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'REBATES.DIRECTION' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="direction">
                  @for (direction of directions; track direction) {
                    <nz-option [nzValue]="direction" [nzLabel]="('REBATES.DIRECTION_' + direction.toUpperCase()) | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'REBATES.CONTACT' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="contact_id" nzShowSearch>
                  @for (contact of contacts(); track contact.id) {
                    <nz-option [nzValue]="contact.id" [nzLabel]="label(contact)"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            @if (isPurchase()) {
              <nz-form-item>
                <nz-form-label nzRequired>{{ 'SUPPLIER_REBATES.REBATE_TYPE' | translate }}</nz-form-label>
                <nz-form-control>
                  <nz-select formControlName="rebate_type">
                    @for (type of rebateTypes; track type) {
                      <nz-option [nzValue]="type" [nzLabel]="('SUPPLIER_REBATES.TYPE_' + type.toUpperCase()) | translate"></nz-option>
                    }
                  </nz-select>
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label>{{ 'SUPPLIER_REBATES.BLANKET_AGREEMENT' | translate }}</nz-form-label>
                <nz-form-control>
                  <nz-select formControlName="supplier_contract_id" nzAllowClear nzShowSearch [nzPlaceHolder]="'SUPPLIER_REBATES.NO_BLANKET' | translate">
                    @for (contract of contracts(); track contract.id) {
                      <nz-option [nzValue]="contract.id" [nzLabel]="contract.label"></nz-option>
                    }
                  </nz-select>
                </nz-form-control>
              </nz-form-item>
            }
          </div>
          <div class="form-row">
            @if (showsTiers()) {
              <nz-form-item>
                <nz-form-label nzRequired>{{ 'SUPPLIER_REBATES.TIER_MODE' | translate }}</nz-form-label>
                <nz-form-control>
                  <nz-select formControlName="tier_mode">
                    @for (mode of tierModes; track mode) {
                      <nz-option [nzValue]="mode" [nzLabel]="('SUPPLIER_REBATES.MODE_' + mode.toUpperCase()) | translate"></nz-option>
                    }
                  </nz-select>
                </nz-form-control>
              </nz-form-item>
            }
            <nz-form-item>
              <nz-form-label nzRequired nzFor="rb-start">{{ 'SUPPLIER_REBATES.VALID_FROM' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="rb-start" type="date" formControlName="starts_on" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="rb-end">{{ 'SUPPLIER_REBATES.VALID_TO' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="rb-end" type="date" formControlName="ends_on" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="rb-currency">{{ 'SUPPLIER_REBATES.CURRENCY' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="rb-currency" formControlName="currency" maxlength="3" /></nz-form-control>
            </nz-form-item>
          </div>

          @if (isPurchase()) {
            <div class="form-row">
              <nz-form-item>
                <nz-form-label>{{ 'SUPPLIER_REBATES.FREQUENCY' | translate }}</nz-form-label>
                <nz-form-control>
                  <nz-select formControlName="accrual_frequency">
                    @for (frequency of frequencies; track frequency) {
                      <nz-option [nzValue]="frequency" [nzLabel]="('SUPPLIER_REBATES.FREQ_' + frequency.toUpperCase()) | translate"></nz-option>
                    }
                  </nz-select>
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label>{{ 'SUPPLIER_REBATES.ACCRUAL_ACCOUNT' | translate }}</nz-form-label>
                <nz-form-control>
                  <nz-select formControlName="accrual_account_id" nzAllowClear nzShowSearch>
                    @for (account of accounts(); track account.id) {
                      <nz-option [nzValue]="account.id" [nzLabel]="account.account_code + ' - ' + account.name"></nz-option>
                    }
                  </nz-select>
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label>{{ 'SUPPLIER_REBATES.INCOME_ACCOUNT' | translate }}</nz-form-label>
                <nz-form-control>
                  <nz-select formControlName="income_account_id" nzAllowClear nzShowSearch>
                    @for (account of accounts(); track account.id) {
                      <nz-option [nzValue]="account.id" [nzLabel]="account.account_code + ' - ' + account.name"></nz-option>
                    }
                  </nz-select>
                </nz-form-control>
              </nz-form-item>
            </div>
          }

          @if (showsTiers()) {
            <h4>{{ 'SUPPLIER_REBATES.TIERS' | translate }}</h4>
            <div formArrayName="tiers">
              @for (tier of tiers.controls; track $index; let index = $index) {
                <div class="tier-row tier-row--wide" [formGroupName]="index">
                  <nz-form-item>
                    <nz-form-label nzRequired>{{ 'SUPPLIER_REBATES.THRESHOLD_FROM' | translate }}</nz-form-label>
                    <nz-form-control><input nz-input type="number" min="0" step="any" formControlName="threshold_amount" /></nz-form-control>
                  </nz-form-item>
                  <nz-form-item>
                    <nz-form-label>{{ 'SUPPLIER_REBATES.THRESHOLD_TO' | translate }}</nz-form-label>
                    <nz-form-control>
                      <input nz-input readonly tabindex="-1" [value]="upperBoundText(index)" [attr.aria-label]="'SUPPLIER_REBATES.THRESHOLD_TO' | translate" />
                    </nz-form-control>
                  </nz-form-item>
                  <nz-form-item>
                    <nz-form-label nzRequired>{{ 'SUPPLIER_REBATES.RATE_PERCENT' | translate }}</nz-form-label>
                    <nz-form-control><input nz-input type="number" min="0" max="100" step="any" formControlName="rate_percent" /></nz-form-control>
                  </nz-form-item>
                  <nz-form-item>
                    <nz-form-label>{{ 'SUPPLIER_REBATES.FLAT_AMOUNT' | translate }}</nz-form-label>
                    <nz-form-control><input nz-input type="number" min="0" step="any" formControlName="flat_amount" /></nz-form-control>
                  </nz-form-item>
                  <button nz-button nzType="text" nzDanger type="button" appIconAction="delete" [disabled]="tiers.length === 1" (click)="removeTier(index)"></button>
                </div>
              }
            </div>
            @if (tiers.hasError('distinctThresholds')) {
              <p class="field-error" role="alert">{{ 'SUPPLIER_REBATES.TIERS_DISTINCT' | translate }}</p>
            }
            <button nz-button type="button" (click)="addTier()">{{ 'SUPPLIER_REBATES.ADD_TIER' | translate }}</button>
          }

          @if (form.controls.rebate_type.value === 'fixed_bonus' && isPurchase()) {
            <div class="form-row">
              <nz-form-item>
                <nz-form-label nzRequired nzFor="rb-bonus-target">{{ 'SUPPLIER_REBATES.BONUS_TARGET' | translate }}</nz-form-label>
                <nz-form-control><input nz-input id="rb-bonus-target" type="number" min="0" step="any" formControlName="fixed_bonus_target" /></nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label nzRequired nzFor="rb-bonus-amount">{{ 'SUPPLIER_REBATES.BONUS_AMOUNT' | translate }}</nz-form-label>
                <nz-form-control><input nz-input id="rb-bonus-amount" type="number" min="0" step="any" formControlName="fixed_bonus_amount" /></nz-form-control>
              </nz-form-item>
            </div>
          }

          @if (isPurchase()) {
            <h4>{{ 'SUPPLIER_REBATES.CONTRIBUTIONS' | translate }}</h4>
            <div formArrayName="contributions">
              @for (row of contributions.controls; track $index; let index = $index) {
                <div class="tier-row tier-row--contribution" [formGroupName]="index">
                  <nz-form-item>
                    <nz-form-label nzRequired>{{ 'SUPPLIER_REBATES.KIND' | translate }}</nz-form-label>
                    <nz-form-control>
                      <nz-select formControlName="kind">
                        @for (kind of contributionKinds; track kind) {
                          <nz-option [nzValue]="kind" [nzLabel]="('SUPPLIER_REBATES.KIND_' + kind.toUpperCase()) | translate"></nz-option>
                        }
                      </nz-select>
                    </nz-form-control>
                  </nz-form-item>
                  <nz-form-item>
                    <nz-form-label nzRequired>{{ 'SUPPLIER_REBATES.DESCRIPTION' | translate }}</nz-form-label>
                    <nz-form-control><input nz-input formControlName="description" maxlength="200" /></nz-form-control>
                  </nz-form-item>
                  <nz-form-item>
                    <nz-form-label nzRequired>{{ 'SUPPLIER_REBATES.AMOUNT' | translate }}</nz-form-label>
                    <nz-form-control><input nz-input type="number" min="0" step="any" formControlName="amount" /></nz-form-control>
                  </nz-form-item>
                  <nz-form-item>
                    <nz-form-label nzRequired>{{ 'SUPPLIER_REBATES.DUE_ON' | translate }}</nz-form-label>
                    <nz-form-control><input nz-input type="date" formControlName="due_on" /></nz-form-control>
                  </nz-form-item>
                  <button nz-button nzType="text" nzDanger type="button" appIconAction="delete" (click)="removeContribution(index)"></button>
                </div>
              }
            </div>
            @if (form.hasError('contributionsRequired')) {
              <p class="field-error" role="alert">{{ 'SUPPLIER_REBATES.REQUIRED' | translate }}</p>
            }
            <button nz-button type="button" (click)="addContribution()">{{ 'SUPPLIER_REBATES.ADD_CONTRIBUTION' | translate }}</button>
          }

          <nz-form-item>
            <nz-form-label nzFor="rb-notes">{{ 'SUPPLIER_REBATES.NOTES' | translate }}</nz-form-label>
            <nz-form-control><textarea nz-input id="rb-notes" rows="2" formControlName="notes" maxlength="2000"></textarea></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class RebatesAgreementsComponent implements OnInit {
  private readonly api = inject(RebatesApiService);
  private readonly crm = inject(CrmApiService);
  private readonly accounting = inject(AccountingApiService);
  private readonly procurement = inject(ProcurementExtraApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);

  readonly directions = REBATE_DIRECTIONS;
  readonly statuses = REBATE_AGREEMENT_STATUSES;
  readonly tierModes = REBATE_TIER_MODES;
  readonly rebateTypes = REBATE_TYPES;
  readonly frequencies = REBATE_ACCRUAL_FREQUENCIES;
  readonly contributionKinds = REBATE_CONTRIBUTION_KINDS;

  readonly agreements = signal<RebateAgreement[]>([]);
  readonly contacts = signal<ContactResource[]>([]);
  readonly contracts = signal<ContractOption[]>([]);
  readonly accounts = signal<ChartOfAccount[]>([]);
  readonly loading = signal(false);
  readonly modalVisible = signal(false);
  readonly editing = signal<RebateAgreement | null>(null);
  /** The supplier programs entry of the menu opens the list already filtered on purchase agreements. */
  readonly directionFilter = signal<RebateDirection | null>(this.route.snapshot?.data?.['direction'] === 'purchase' ? 'purchase' : null);
  readonly statusFilter = signal<RebateAgreementStatus | null>(null);
  /** Direction and type of the open form, mirrored in signals so the template reacts to the form values. */
  readonly isPurchase = signal(false);
  readonly showsTiers = signal(true);

  readonly form = this.fb.group(
    {
      code: ['', [Validators.required]],
      name: ['', [Validators.required]],
      direction: ['sales' as RebateDirection, [Validators.required]],
      contact_id: ['', [Validators.required]],
      rebate_type: ['tiered_volume' as RebateType, [Validators.required]],
      supplier_contract_id: [''],
      tier_mode: ['retroactive' as RebateAgreementRequest['tier_mode'], [Validators.required]],
      starts_on: [todayIso(), [Validators.required]],
      ends_on: [todayIso(), [Validators.required]],
      currency: ['EUR', [Validators.required, Validators.minLength(3), Validators.maxLength(3)]],
      accrual_frequency: ['quarterly' as NonNullable<RebateAgreementRequest['accrual_frequency']>],
      accrual_account_id: [''],
      income_account_id: [''],
      fixed_bonus_target: ['', [Validators.required, Validators.min(0)]],
      fixed_bonus_amount: ['', [Validators.required, Validators.min(0)]],
      notes: [''],
      tiers: this.fb.array([this.newTier()], { validators: [distinctThresholdsValidator] }),
      contributions: this.fb.array<ContributionGroup>([]),
    },
    { validators: [contributionsRequired] },
  );

  get tiers() {
    return this.form.controls.tiers;
  }

  get contributions() {
    return this.form.controls.contributions;
  }

  constructor() {
    this.form.controls.direction.valueChanges.pipe(takeUntilDestroyed()).subscribe((direction) => {
      this.form.controls.contact_id.setValue('');
      this.loadContactList(direction);
      if (direction === 'sales') {
        this.form.controls.rebate_type.setValue('tiered_volume');
      }
      this.applyRules();
    });
    this.form.controls.rebate_type.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.applyRules());
    this.applyRules();
  }

  ngOnInit(): void {
    this.load();
    this.loadContactList('sales');
    this.accounting
      .getAccounts({ per_page: 500 })
      .pipe(
        map((response) => response.data),
        catchError(() => of([] as ChartOfAccount[])),
      )
      .subscribe((accounts) => this.accounts.set(accounts));
    this.procurement
      .listContracts({ per_page: 100 })
      .pipe(
        map((response) => response.data.map(toContractOption).filter((option): option is ContractOption => option !== null)),
        catchError(() => of([] as ContractOption[])),
      )
      .subscribe((contracts) => this.contracts.set(contracts));
  }

  load(): void {
    this.loading.set(true);
    this.api.getAgreements({ direction: this.directionFilter() ?? undefined, status: this.statusFilter() ?? undefined, per_page: 100 }).subscribe({
      next: (response) => {
        this.agreements.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('REBATES.ACTION_ERROR'));
      },
    });
  }

  statusColor(status: string): string {
    return AGREEMENT_STATUS_COLORS[status] ?? 'default';
  }

  label(contact: ContactResource): string {
    return contactLabel(contact);
  }

  addTier(): void {
    this.tiers.push(this.newTier());
  }

  removeTier(index: number): void {
    this.tiers.removeAt(index);
  }

  addContribution(): void {
    this.contributions.push(this.newContribution());
  }

  removeContribution(index: number): void {
    this.contributions.removeAt(index);
  }

  /** The read-only upper bound of a tier row: the next higher threshold, or the open-ended label. */
  upperBoundText(index: number): string {
    const bounds = tierUpperBounds(this.tiers.getRawValue().map((tier) => tier.threshold_amount));
    const bound = bounds[index];
    return bound === null || bound === undefined ? this.translate.instant('SUPPLIER_REBATES.OPEN_ENDED') : String(bound);
  }

  openModal(agreement: RebateAgreement | null = null): void {
    this.editing.set(agreement);
    this.tiers.clear();
    const tiers = agreement?.tiers?.length ? agreement.tiers : [{ threshold_amount: '', rate_percent: '', flat_amount: null }];
    for (const tier of tiers) {
      this.tiers.push(this.newTier(tier.threshold_amount, tier.rate_percent, tier.flat_amount ?? ''));
    }
    this.contributions.clear();
    for (const contribution of agreement?.contributions ?? []) {
      this.contributions.push(this.newContribution(contribution));
    }
    this.form.patchValue({
      code: agreement?.code ?? '',
      name: agreement?.name ?? '',
      direction: agreement?.direction ?? 'sales',
      contact_id: agreement?.contact_id ?? '',
      rebate_type: agreement?.rebate_type ?? 'tiered_volume',
      supplier_contract_id: agreement?.supplier_contract_id ?? '',
      tier_mode: agreement?.tier_mode ?? 'retroactive',
      starts_on: agreement?.starts_on ?? todayIso(),
      ends_on: agreement?.ends_on ?? todayIso(),
      currency: agreement?.currency ?? 'EUR',
      accrual_frequency: agreement?.accrual_frequency ?? 'quarterly',
      accrual_account_id: agreement?.accrual_account_id ?? '',
      income_account_id: agreement?.income_account_id ?? '',
      fixed_bonus_target: agreement?.fixed_bonus_target ?? '',
      fixed_bonus_amount: agreement?.fixed_bonus_amount ?? '',
      notes: agreement?.notes ?? '',
    });
    this.applyRules();
    this.modalVisible.set(true);
  }

  save(): void {
    const value = this.form.getRawValue();
    const current = this.editing();
    const locked = current !== null && current.status !== 'draft';
    const type: RebateType = value.direction === 'purchase' ? value.rebate_type : 'tiered_volume';
    const payload: RebateAgreementRequest = {
      code: value.code,
      name: value.name,
      direction: value.direction,
      contact_id: value.contact_id,
      tier_mode: value.tier_mode,
      starts_on: value.starts_on,
      ends_on: value.ends_on,
      currency: value.currency.toUpperCase(),
      notes: blankToNull(value.notes),
      rebate_type: type,
      supplier_contract_id: value.direction === 'purchase' ? blankToNull(value.supplier_contract_id) : null,
      fixed_bonus_target: type === 'fixed_bonus' ? decimalOrNull(value.fixed_bonus_target) : null,
      fixed_bonus_amount: type === 'fixed_bonus' ? decimalOrNull(value.fixed_bonus_amount) : null,
      accrual_frequency: value.accrual_frequency,
      accrual_account_id: blankToNull(value.accrual_account_id),
      income_account_id: blankToNull(value.income_account_id),
      tiers:
        type === 'tiered_volume'
          ? value.tiers.map((tier) => ({ threshold_amount: String(tier.threshold_amount), rate_percent: String(tier.rate_percent), flat_amount: decimalOrNull(tier.flat_amount) }))
          : [],
    };

    let request: Observable<{ data: RebateAgreement }>;
    if (current && locked) {
      // The structure of an active agreement is frozen: only the descriptive and ledger fields are sent.
      request = this.api.updateAgreement(current.id, {
        name: payload.name,
        ends_on: payload.ends_on,
        notes: payload.notes,
        accrual_frequency: payload.accrual_frequency,
        accrual_account_id: payload.accrual_account_id,
        income_account_id: payload.income_account_id,
        version: current.version,
      });
    } else if (current) {
      request = this.api.updateAgreement(current.id, { ...payload, version: current.version });
    } else {
      request = this.api.createAgreement(payload);
    }

    const rows: ContributionRow[] = value.direction === 'purchase' ? value.contributions.map((row) => ({ ...row, id: blankToNull(row.id) })) : [];
    request
      .pipe(switchMap((response) => this.syncContributions(response.data.id, current?.contributions ?? [], rows)))
      .subscribe({
        next: () => {
          this.message.success(this.translate.instant('REBATES.AGREEMENT_SAVED'));
          this.modalVisible.set(false);
          this.load();
        },
        error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('REBATES.ACTION_ERROR')),
      });
  }

  activate(agreement: RebateAgreement): void {
    this.api.activateAgreement(agreement.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('REBATES.AGREEMENT_ACTIVATED'));
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('REBATES.ACTION_ERROR')),
    });
  }

  remove(agreement: RebateAgreement): void {
    this.api.deleteAgreement(agreement.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('REBATES.DELETED'));
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('REBATES.ACTION_ERROR')),
    });
  }

  /**
   * Enables only the controls that apply to the direction and rebate type of the form, so a hidden section never
   * blocks the save: the tiers for a tiered volume rebate, the target and amount for a fixed bonus.
   */
  private applyRules(): void {
    const purchase = this.form.controls.direction.value === 'purchase';
    const type = purchase ? this.form.controls.rebate_type.value : 'tiered_volume';
    const tiered = type === 'tiered_volume';
    const bonus = type === 'fixed_bonus';
    this.isPurchase.set(purchase);
    this.showsTiers.set(tiered);

    const toggle = (control: AbstractControl, enabled: boolean): void => {
      if (enabled && control.disabled) {
        control.enable({ emitEvent: false });
      } else if (!enabled && control.enabled) {
        control.disable({ emitEvent: false });
      }
    };
    toggle(this.form.controls.tier_mode, tiered);
    toggle(this.tiers, tiered);
    toggle(this.form.controls.fixed_bonus_target, bonus);
    toggle(this.form.controls.fixed_bonus_amount, bonus);
    this.form.updateValueAndValidity({ emitEvent: false });
  }

  /** Creates, updates and removes the contributions so the API matches the rows of the editor. */
  private syncContributions(agreementId: string, original: readonly RebateContribution[], rows: readonly ContributionRow[]): Observable<unknown> {
    const plan = planContributionSync(original, rows);
    const calls: Observable<unknown>[] = [
      ...plan.create.map((payload) => this.api.createContribution(agreementId, payload)),
      ...plan.update.map((change) => this.api.updateContribution(change.id, change.payload)),
      ...plan.remove.map((id) => this.api.deleteContribution(id)),
    ];
    return calls.length === 0 ? of(null) : forkJoin(calls);
  }

  private loadContactList(direction: RebateDirection): void {
    loadContacts(this.crm, direction).subscribe((contacts) => this.contacts.set(contacts));
  }

  private newTier(threshold = '', rate = '', flat = '') {
    return this.fb.group({
      threshold_amount: [threshold, [Validators.required]],
      rate_percent: [rate, [Validators.required]],
      flat_amount: [flat],
    });
  }

  private newContribution(contribution?: RebateContribution): ContributionGroup {
    return this.fb.group({
      id: [contribution?.id ?? ''],
      kind: [contribution?.kind ?? ('marketing' as RebateContributionKind), [Validators.required]],
      description: [contribution?.description ?? '', [Validators.required]],
      amount: [contribution?.amount ?? '', [Validators.required, Validators.min(0.01)]],
      due_on: [contribution?.due_on ?? todayIso(), [Validators.required]],
    });
  }
}
