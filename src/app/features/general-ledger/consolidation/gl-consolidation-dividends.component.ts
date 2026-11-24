import { Component, computed, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { applyServerErrors, ConsolidationGroup, GeneralLedgerConsolidationApiService, I18nService, IntragroupDividend, PermissionsService } from '@core';
import { IconActionDirective, ModalActionsDirective, TranslatePipe } from '@shared';
import { GlErrorAlertComponent } from '../shared/gl-error-alert.component';
import { GlConsolidationAccountStore } from './gl-consolidation-account.store';
import { memberName } from './gl-consolidation.util';

/** Dividends paid inside the group: income of the receiver eliminated against the equity of the payer. */
@Component({
  selector: 'app-gl-consolidation-dividends',
  styleUrl: './gl-consolidation.scss',
  imports: [
    IconActionDirective,
    ModalActionsDirective,
    ReactiveFormsModule,
    NzAlertModule,
    NzButtonModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
    GlErrorAlertComponent,
    TranslatePipe,
  ],
  template: `
    <app-gl-error-alert [error]="error()" />
    <div class="toolbar">
      <span class="muted">{{ 'GL.CONS_DIVIDENDS_HINT' | translate }}</span>
      <span class="spacer"></span>
      @if (canWrite) {
        <button nz-button nzType="primary" type="button" (click)="openCreate()" appIconAction="create"></button>
      }
    </div>
    <nz-table #table nzSize="small" [nzData]="dividends()" [nzLoading]="loading()" [nzShowPagination]="false">
      <thead>
        <tr>
          <th>{{ 'GL.COL_DATE' | translate }}</th>
          <th>{{ 'GL.CONS_PAYER' | translate }}</th>
          <th>{{ 'GL.CONS_RECEIVER' | translate }}</th>
          <th class="num">{{ 'GL.CONS_AMOUNT' | translate }}</th>
          <th>{{ 'GL.CONS_INCOME_ACCOUNT_RECEIVER' | translate }}</th>
          <th>{{ 'GL.CONS_EQUITY_ACCOUNT_PAYER' | translate }}</th>
          <th>{{ 'GL.COL_ACTIONS' | translate }}</th>
        </tr>
      </thead>
      <tbody>
        @for (item of table.data; track item.id) {
          <tr>
            <td>{{ item.dividend_date }}</td>
            <td>{{ name(item.payer_tenant_id) }}</td>
            <td>{{ name(item.receiver_tenant_id) }}</td>
            <td class="num">{{ item.amount }}</td>
            <td>{{ accounts.label(item.receiver_tenant_id, item.income_account_id) }}</td>
            <td>{{ accounts.label(item.payer_tenant_id, item.equity_account_id) }}</td>
            <td>
              @if (canWrite) {
                <button
                  nz-button
                  nzSize="small"
                  nzDanger
                  type="button"
                  appIconAction="delete"
                  nz-popconfirm
                  [nzPopconfirmTitle]="'GL.CONFIRM_DELETE' | translate"
                  (nzOnConfirm)="remove(item)"
                ></button>
              }
            </td>
          </tr>
        }
      </tbody>
    </nz-table>

    <nz-modal appModalActions
      [nzVisible]="modalOpen()"
      [nzTitle]="'GL.CONS_DIVIDEND_NEW' | translate"
      nzWidth="640px"
      [nzOkLoading]="saving()"
      (nzOnOk)="save()"
      (nzOnCancel)="modalOpen.set(false)"
      okAction="save"
    >
      <ng-container *nzModalContent>
        <app-gl-error-alert [error]="formError()" />
        @for (message of formErrors(); track message) {
          <nz-alert nzType="error" nzShowIcon [nzMessage]="message" />
        }
        <form nz-form nzLayout="vertical" [formGroup]="form">
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="cd-payer">{{ 'GL.CONS_PAYER' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="form.controls.payer_tenant_id.errors?.['serverError'] ?? ('GL.REQUIRED' | translate)">
                <nz-select id="cd-payer" formControlName="payer_tenant_id">
                  @for (member of members(); track member.id) {
                    <nz-option [nzValue]="member.member_tenant_id" [nzLabel]="member.name" />
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="cd-receiver">{{ 'GL.CONS_RECEIVER' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="form.controls.receiver_tenant_id.errors?.['serverError'] ?? ('GL.REQUIRED' | translate)">
                <nz-select id="cd-receiver" formControlName="receiver_tenant_id">
                  @for (member of members(); track member.id) {
                    <nz-option [nzValue]="member.member_tenant_id" [nzLabel]="member.name" />
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="cd-date">{{ 'GL.COL_DATE' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="form.controls.dividend_date.errors?.['serverError'] ?? ('GL.REQUIRED' | translate)">
                <input id="cd-date" nz-input type="date" formControlName="dividend_date" />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="cd-amount">{{ 'GL.CONS_AMOUNT' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="form.controls.amount.errors?.['serverError'] ?? ('GL.REQUIRED' | translate)">
                <nz-input-number class="w-full" id="cd-amount" formControlName="amount" [nzMin]="0.0001" [nzPrecision]="4" />
              </nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="cd-income">{{ 'GL.CONS_INCOME_ACCOUNT_RECEIVER' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="form.controls.income_account_id.errors?.['serverError'] ?? ('GL.REQUIRED' | translate)">
              <nz-select id="cd-income" formControlName="income_account_id" nzShowSearch>
                @for (account of accounts.accountsOf(receiver()); track account.id) {
                  <nz-option [nzValue]="account.id" [nzLabel]="account.account_code + ' ' + account.name" />
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="cd-equity">{{ 'GL.CONS_EQUITY_ACCOUNT_PAYER' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="form.controls.equity_account_id.errors?.['serverError'] ?? ('GL.REQUIRED' | translate)">
              <nz-select id="cd-equity" formControlName="equity_account_id" nzShowSearch>
                @for (account of accounts.accountsOf(payer()); track account.id) {
                  <nz-option [nzValue]="account.id" [nzLabel]="account.account_code + ' ' + account.name" />
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class GlConsolidationDividendsComponent implements OnInit {
  private readonly api = inject(GeneralLedgerConsolidationApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  protected readonly accounts = inject(GlConsolidationAccountStore);
  protected readonly canWrite = inject(PermissionsService).canWrite('ledger');

  readonly group = input.required<ConsolidationGroup>();

  protected readonly members = computed(() => this.group().members ?? []);
  protected readonly dividends = signal<IntragroupDividend[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<unknown>(null);
  protected readonly formError = signal<unknown>(null);
  protected readonly formErrors = signal<string[]>([]);
  protected readonly saving = signal(false);
  protected readonly modalOpen = signal(false);
  protected readonly payer = signal<string | null>(null);
  protected readonly receiver = signal<string | null>(null);

  protected readonly form = this.fb.group({
    payer_tenant_id: this.fb.control('', Validators.required),
    receiver_tenant_id: this.fb.control('', Validators.required),
    dividend_date: this.fb.control('', Validators.required),
    amount: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.0001)]),
    income_account_id: this.fb.control('', Validators.required),
    equity_account_id: this.fb.control('', Validators.required),
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    this.form.controls.payer_tenant_id.valueChanges.pipe(takeUntilDestroyed(destroyRef)).subscribe((tenantId) => {
      this.payer.set(tenantId || null);
      this.form.controls.equity_account_id.reset('');
      this.accounts.load(tenantId);
    });
    this.form.controls.receiver_tenant_id.valueChanges.pipe(takeUntilDestroyed(destroyRef)).subscribe((tenantId) => {
      this.receiver.set(tenantId || null);
      this.form.controls.income_account_id.reset('');
      this.accounts.load(tenantId);
    });
  }

  ngOnInit(): void {
    this.load();
  }

  protected name(tenantId: string): string {
    return memberName(this.group(), tenantId);
  }

  protected openCreate(): void {
    this.form.reset();
    this.formError.set(null);
    this.formErrors.set([]);
    this.modalOpen.set(true);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.saving.set(true);
    this.api
      .createIntragroupDividend(this.group().id, {
        payer_tenant_id: value.payer_tenant_id,
        receiver_tenant_id: value.receiver_tenant_id,
        dividend_date: value.dividend_date,
        amount: value.amount ?? 0,
        income_account_id: value.income_account_id,
        equity_account_id: value.equity_account_id,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.modalOpen.set(false);
          this.message.success(this.i18n.translate('GL.CONS_SAVED'));
          this.load();
        },
        error: (err: unknown) => {
          this.saving.set(false);
          this.formError.set(err);
          this.formErrors.set(applyServerErrors(this.form, err));
        },
      });
  }

  protected remove(item: IntragroupDividend): void {
    this.api.deleteIntragroupDividend(item.id).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('GL.CONS_DELETED'));
        this.load();
      },
      error: (err: unknown) => this.error.set(err),
    });
  }

  private load(): void {
    this.loading.set(true);
    this.api.getIntragroupDividends(this.group().id).subscribe({
      next: (res) => {
        const rows = res.data ?? [];
        this.dividends.set(rows);
        rows.forEach((row) => {
          this.accounts.load(row.payer_tenant_id);
          this.accounts.load(row.receiver_tenant_id);
        });
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(err);
        this.loading.set(false);
      },
    });
  }
}
