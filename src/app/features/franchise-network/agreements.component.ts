import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  FRN_AGREEMENT_STATUSES,
  FRN_GUARANTEE_TYPES,
  FRN_JURISDICTIONS,
  FRN_PAYMENT_METHODS,
  FrnAgreement,
  FrnAgreementPayload,
  PermissionsService,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { AgreementsStore } from './agreements.store';
import {
  agreementStatusColor,
  FRANCHISE_NETWORK_MANAGE_MODULE,
  findingColor,
  FrnOutcome,
  toNumber,
} from './franchise-network.util';

/**
 * Affiliation agreements: term and the L. 129/2004 findings, exclusivity zone, entry fee and its deferral (risconto), minimum
 * purchases from the central warehouse, the bank guarantee and its expiry, and the SEPA SDD / LSV+ collection mandate.
 */
@Component({
  selector: 'app-frn-agreements',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCheckboxModule,
    NzDrawerModule,
    NzEmptyModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    ReactiveFormsModule,
    TranslatePipe,
  ],
  providers: [AgreementsStore],
  styleUrl: './franchise-network.scss',
  template: `
    <app-page-header [title]="'PAGE_TITLE.FRANCHISE_NETWORK_AGREEMENTS' | translate"></app-page-header>

    <div class="toolbar">
      <label class="field" for="frn-a-status">
        <span>{{ 'franchiseNetwork.field.status' | translate }}</span>
        <nz-select
          nzId="frn-a-status"
          nzAllowClear
          [ngModel]="store.statusFilter()"
          (ngModelChange)="store.setStatusFilter($event)"
        >
          @for (status of statuses; track status) {
            <nz-option [nzValue]="status" [nzLabel]="'franchiseNetwork.agreementStatus.' + status | translate"></nz-option>
          }
        </nz-select>
      </label>
      <span class="spacer"></span>
      @if (canManage) {
        <button nz-button nzType="primary" type="button" (click)="openCreate()">
          {{ 'franchiseNetwork.action.newAgreement' | translate }}
        </button>
      }
    </div>

    @if (store.error(); as error) {
      <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="error | translate"></nz-alert>
    }
    @if (feedback(); as failure) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        nzCloseable
        [nzMessage]="failure.errorKey ?? 'franchiseNetwork.error.generic' | translate: failure.params"
        [nzDescription]="failure.detail ?? null"
        (nzOnClose)="feedback.set(null)"
      ></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      <nz-table #table nzSize="small" [nzData]="store.agreements()" [nzShowPagination]="false" [nzScroll]="{ x: '1100px' }">
        <thead>
          <tr>
            <th scope="col">{{ 'franchiseNetwork.field.agreementNumber' | translate }}</th>
            <th scope="col">{{ 'franchiseNetwork.field.store' | translate }}</th>
            <th scope="col">{{ 'franchiseNetwork.field.status' | translate }}</th>
            <th scope="col">{{ 'franchiseNetwork.field.term' | translate }}</th>
            <th scope="col">{{ 'franchiseNetwork.field.guarantee' | translate }}</th>
            <th scope="col">{{ 'franchiseNetwork.field.paymentMethod' | translate }}</th>
            <th scope="col">{{ 'franchiseNetwork.section.findings' | translate }}</th>
            <th scope="col">{{ 'franchiseNetwork.field.actions' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <th scope="row">{{ row.agreement_number }}</th>
              <td>{{ row.store_code }} <small class="muted">{{ row.store_name }}</small></td>
              <td>
                <nz-tag [nzColor]="statusColor(row.status)">{{
                  'franchiseNetwork.agreementStatus.' + row.status | translate
                }}</nz-tag>
              </td>
              <td>
                {{ row.start_date }} → {{ row.end_date }}
                <small class="muted">{{ row.term_months }} {{ 'franchiseNetwork.field.months' | translate }}</small>
              </td>
              <td>
                {{ 'franchiseNetwork.guaranteeType.' + row.guarantee_type | translate }}
                @if (row.guarantee_expires_on) {
                  <small class="muted">{{ row.guarantee_expires_on }}</small>
                }
              </td>
              <td>{{ 'franchiseNetwork.paymentMethod.' + row.payment_method | translate }}</td>
              <td class="tags">
                @for (finding of row.findings; track finding.code) {
                  <nz-tag [nzColor]="findingColor(finding)">{{
                    'franchiseNetwork.finding.' + finding.code | translate: finding.params
                  }}</nz-tag>
                }
                @for (alert of row.alerts; track alert.code) {
                  <nz-tag [nzColor]="findingColor(alert)">{{
                    'franchiseNetwork.finding.' + alert.code | translate: alert.params
                  }}</nz-tag>
                }
              </td>
              <td class="row-actions">
                <button nz-button nzSize="small" type="button" (click)="store.openDetail(row.id)">
                  {{ 'franchiseNetwork.action.schedule' | translate }}
                </button>
                @if (canManage) {
                  @if (row.status === 'draft') {
                    <button nz-button nzSize="small" type="button" (click)="openEdit(row)">
                      {{ 'franchiseNetwork.action.edit' | translate }}
                    </button>
                    <button nz-button nzSize="small" nzType="primary" type="button" (click)="run(store.activate(row.id))">
                      {{ 'franchiseNetwork.action.activate' | translate }}
                    </button>
                    <button
                      nz-button
                      nzSize="small"
                      nzDanger
                      type="button"
                      nz-popconfirm
                      [nzPopconfirmTitle]="'franchiseNetwork.confirm.deleteAgreement' | translate"
                      (nzOnConfirm)="run(store.remove(row.id))"
                    >
                      {{ 'franchiseNetwork.action.delete' | translate }}
                    </button>
                  }
                  @if (row.status === 'active') {
                    <button nz-button nzSize="small" type="button" (click)="openEdit(row)">
                      {{ 'franchiseNetwork.action.edit' | translate }}
                    </button>
                    <button nz-button nzSize="small" type="button" (click)="openRenew(row)">
                      {{ 'franchiseNetwork.action.renew' | translate }}
                    </button>
                    <button
                      nz-button
                      nzSize="small"
                      nzDanger
                      type="button"
                      nz-popconfirm
                      [nzPopconfirmTitle]="'franchiseNetwork.confirm.terminateAgreement' | translate"
                      (nzOnConfirm)="run(store.terminate(row.id))"
                    >
                      {{ 'franchiseNetwork.action.terminate' | translate }}
                    </button>
                  }
                }
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="8">
                <nz-empty [nzNotFoundContent]="'franchiseNetwork.empty.agreements' | translate"></nz-empty>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-spin>

    <nz-modal
      [nzVisible]="store.detail() !== null"
      [nzTitle]="'franchiseNetwork.section.entryFeeSchedule' | translate"
      [nzFooter]="null"
      (nzOnCancel)="store.closeDetail()"
    >
      <ng-container *nzModalContent>
        @if (store.detail(); as detail) {
          <p>
            {{ 'franchiseNetwork.field.entryFee' | translate }}: {{ detail.entry_fee }} {{ detail.currency }}
            · {{ detail.entry_fee_deferral_months }} {{ 'franchiseNetwork.field.months' | translate }}
          </p>
          <nz-table #schedule nzSize="small" [nzData]="detail.deferrals ?? []" [nzShowPagination]="false">
            <thead>
              <tr>
                <th scope="col">{{ 'franchiseNetwork.field.period' | translate }}</th>
                <th scope="col" class="num">{{ 'franchiseNetwork.field.amount' | translate }}</th>
                <th scope="col">{{ 'franchiseNetwork.field.recognized' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (line of schedule.data; track line.period) {
                <tr>
                  <th scope="row">{{ line.period }}</th>
                  <td class="num">{{ line.amount }}</td>
                  <td>
                    <nz-tag [nzColor]="line.recognized ? 'green' : 'default'">{{
                      (line.recognized ? 'franchiseNetwork.field.yes' : 'franchiseNetwork.field.no') | translate
                    }}</nz-tag>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="3">
                    <nz-empty [nzNotFoundContent]="'franchiseNetwork.empty.schedule' | translate"></nz-empty>
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        }
      </ng-container>
    </nz-modal>

    <nz-modal
      [nzVisible]="renewing() !== null"
      [nzTitle]="'franchiseNetwork.action.renew' | translate"
      [nzOkText]="'franchiseNetwork.action.renew' | translate"
      [nzCancelText]="'franchiseNetwork.action.cancel' | translate"
      (nzOnOk)="submitRenew()"
      (nzOnCancel)="renewing.set(null)"
    >
      <ng-container *nzModalContent>
        <label class="field" for="frn-a-renew">
          <span>{{ 'franchiseNetwork.field.newEndDate' | translate }}</span>
          <input nz-input id="frn-a-renew" type="date" [ngModel]="renewEnd()" (ngModelChange)="renewEnd.set($event)" />
        </label>
      </ng-container>
    </nz-modal>

    <nz-drawer
      [nzVisible]="drawerOpen()"
      [nzWidth]="640"
      [nzTitle]="'franchiseNetwork.section.agreement' | translate"
      (nzOnClose)="close()"
    >
      <ng-container *nzDrawerContent>
        @if (formError(); as failure) {
          <nz-alert
            class="feedback"
            nzType="error"
            nzShowIcon
            [nzMessage]="failure.errorKey ?? 'franchiseNetwork.error.generic' | translate: failure.params"
            [nzDescription]="failure.detail ?? null"
          ></nz-alert>
        }
        <form [formGroup]="form" class="form" (ngSubmit)="submit()">
          <label class="field" for="frn-a-store">
            <span>{{ 'franchiseNetwork.field.store' | translate }}</span>
            <nz-select nzId="frn-a-store" formControlName="store_id" nzShowSearch>
              @for (option of franchiseeStores(); track option.id) {
                <nz-option [nzValue]="option.id" [nzLabel]="option.code + ' ' + option.name"></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="frn-a-formula">
            <span>{{ 'franchiseNetwork.field.formula' | translate }}</span>
            <nz-select nzId="frn-a-formula" formControlName="formula_id" nzAllowClear>
              @for (formula of store.formulas(); track formula.id) {
                <nz-option [nzValue]="formula.id" [nzLabel]="formula.label"></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="frn-a-jur">
            <span>{{ 'franchiseNetwork.field.jurisdiction' | translate }}</span>
            <nz-select nzId="frn-a-jur" formControlName="jurisdiction">
              @for (jurisdiction of jurisdictions; track jurisdiction) {
                <nz-option [nzValue]="jurisdiction" [nzLabel]="jurisdiction"></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="frn-a-disclosure">
            <span>{{ 'franchiseNetwork.field.disclosureDeliveredOn' | translate }}</span>
            <input nz-input id="frn-a-disclosure" type="date" formControlName="disclosure_delivered_on" />
          </label>
          <label class="field" for="frn-a-signed">
            <span>{{ 'franchiseNetwork.field.signedOn' | translate }}</span>
            <input nz-input id="frn-a-signed" type="date" formControlName="signed_on" />
          </label>
          <label class="field" for="frn-a-start">
            <span>{{ 'franchiseNetwork.field.startDate' | translate }}</span>
            <input nz-input id="frn-a-start" type="date" formControlName="start_date" />
          </label>
          <label class="field" for="frn-a-end">
            <span>{{ 'franchiseNetwork.field.endDate' | translate }}</span>
            <input nz-input id="frn-a-end" type="date" formControlName="end_date" />
          </label>
          <label nz-checkbox for="frn-a-auto" nzId="frn-a-auto" formControlName="auto_renew">{{
            'franchiseNetwork.field.autoRenew' | translate
          }}</label>
          <label class="field" for="frn-a-notice">
            <span>{{ 'franchiseNetwork.field.renewalNoticeDays' | translate }}</span>
            <nz-input-number nzId="frn-a-notice" formControlName="renewal_notice_days" [nzMin]="0" [nzMax]="730"></nz-input-number>
          </label>

          <label class="field" for="frn-a-zone">
            <span>{{ 'franchiseNetwork.field.zoneLabel' | translate }}</span>
            <input nz-input id="frn-a-zone" formControlName="zone_label" maxlength="200" />
          </label>
          <label class="field" for="frn-a-postal">
            <span>{{ 'franchiseNetwork.field.zonePostalCodes' | translate }}</span>
            <input nz-input id="frn-a-postal" formControlName="zone_postal_codes" />
          </label>

          <label class="field" for="frn-a-fee">
            <span>{{ 'franchiseNetwork.field.entryFee' | translate }}</span>
            <nz-input-number nzId="frn-a-fee" formControlName="entry_fee" [nzMin]="0"></nz-input-number>
          </label>
          <label class="field" for="frn-a-deferral">
            <span>{{ 'franchiseNetwork.field.entryFeeDeferralMonths' | translate }}</span>
            <nz-input-number nzId="frn-a-deferral" formControlName="entry_fee_deferral_months" [nzMin]="0" [nzMax]="120"></nz-input-number>
          </label>
          <label class="field" for="frn-a-minpurchase">
            <span>{{ 'franchiseNetwork.field.minPurchaseAmount' | translate }}</span>
            <nz-input-number nzId="frn-a-minpurchase" formControlName="min_purchase_amount" [nzMin]="0"></nz-input-number>
          </label>
          <label class="field" for="frn-a-source">
            <span>{{ 'franchiseNetwork.field.minPurchaseSource' | translate }}</span>
            <nz-select nzId="frn-a-source" formControlName="min_purchase_source">
              <nz-option nzValue="central_warehouse" [nzLabel]="'franchiseNetwork.purchaseSource.central_warehouse' | translate"></nz-option>
              <nz-option nzValue="approved_suppliers" [nzLabel]="'franchiseNetwork.purchaseSource.approved_suppliers' | translate"></nz-option>
            </nz-select>
          </label>

          <label class="field" for="frn-a-gtype">
            <span>{{ 'franchiseNetwork.field.guaranteeType' | translate }}</span>
            <nz-select nzId="frn-a-gtype" formControlName="guarantee_type">
              @for (type of guaranteeTypes; track type) {
                <nz-option [nzValue]="type" [nzLabel]="'franchiseNetwork.guaranteeType.' + type | translate"></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="frn-a-gamount">
            <span>{{ 'franchiseNetwork.field.guaranteeAmount' | translate }}</span>
            <nz-input-number nzId="frn-a-gamount" formControlName="guarantee_amount" [nzMin]="0"></nz-input-number>
          </label>
          <label class="field" for="frn-a-gref">
            <span>{{ 'franchiseNetwork.field.guaranteeReference' | translate }}</span>
            <input nz-input id="frn-a-gref" formControlName="guarantee_reference" maxlength="80" />
          </label>
          <label class="field" for="frn-a-gexp">
            <span>{{ 'franchiseNetwork.field.guaranteeExpiresOn' | translate }}</span>
            <input nz-input id="frn-a-gexp" type="date" formControlName="guarantee_expires_on" />
          </label>

          <label class="field" for="frn-a-pay">
            <span>{{ 'franchiseNetwork.field.paymentMethod' | translate }}</span>
            <nz-select nzId="frn-a-pay" formControlName="payment_method">
              @for (method of paymentMethods; track method) {
                <nz-option [nzValue]="method" [nzLabel]="'franchiseNetwork.paymentMethod.' + method | translate"></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="frn-a-mandate">
            <span>{{ 'franchiseNetwork.field.mandateReference' | translate }}</span>
            <input nz-input id="frn-a-mandate" formControlName="mandate_reference" maxlength="60" />
          </label>
          <label class="field" for="frn-a-mandate-date">
            <span>{{ 'franchiseNetwork.field.mandateSignedOn' | translate }}</span>
            <input nz-input id="frn-a-mandate-date" type="date" formControlName="mandate_signed_on" />
          </label>
          <label class="field" for="frn-a-currency">
            <span>{{ 'franchiseNetwork.field.currency' | translate }}</span>
            <nz-select nzId="frn-a-currency" formControlName="currency">
              <nz-option nzValue="EUR" nzLabel="EUR"></nz-option>
              <nz-option nzValue="CHF" nzLabel="CHF"></nz-option>
            </nz-select>
          </label>
          <label nz-checkbox for="frn-a-nonbinding" nzId="frn-a-nonbinding" formControlName="non_binding_pricing">{{
            'franchiseNetwork.field.nonBindingPricing' | translate
          }}</label>
          <label class="field" for="frn-a-notes">
            <span>{{ 'franchiseNetwork.field.notes' | translate }}</span>
            <textarea nz-input id="frn-a-notes" rows="3" formControlName="notes"></textarea>
          </label>
          <div class="actions">
            <button nz-button nzType="primary" type="submit" [nzLoading]="store.saving()" [disabled]="form.invalid">
              {{ 'franchiseNetwork.action.save' | translate }}
            </button>
            <button nz-button type="button" (click)="close()">
              {{ 'franchiseNetwork.action.cancel' | translate }}
            </button>
          </div>
        </form>
      </ng-container>
    </nz-drawer>
  `,
})
export class AgreementsComponent implements OnInit {
  protected readonly store = inject(AgreementsStore);
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly canManage = inject(PermissionsService).canWrite(FRANCHISE_NETWORK_MANAGE_MODULE);
  protected readonly statuses = FRN_AGREEMENT_STATUSES;
  protected readonly jurisdictions = FRN_JURISDICTIONS;
  protected readonly guaranteeTypes = FRN_GUARANTEE_TYPES;
  protected readonly paymentMethods = FRN_PAYMENT_METHODS;
  protected readonly statusColor = agreementStatusColor;
  protected readonly findingColor = findingColor;

  protected readonly drawerOpen = signal(false);
  protected readonly editing = signal<FrnAgreement | null>(null);
  protected readonly renewing = signal<FrnAgreement | null>(null);
  protected readonly renewEnd = signal('');
  protected readonly feedback = signal<FrnOutcome | null>(null);
  protected readonly formError = signal<FrnOutcome | null>(null);

  protected readonly form = this.fb.group({
    store_id: ['', Validators.required],
    formula_id: [null as string | null],
    jurisdiction: ['IT' as FrnAgreementPayload['jurisdiction'], Validators.required],
    disclosure_delivered_on: [''],
    signed_on: [''],
    start_date: ['', Validators.required],
    end_date: ['', Validators.required],
    auto_renew: [false],
    renewal_notice_days: [180],
    zone_label: [''],
    zone_postal_codes: [''],
    entry_fee: [0],
    entry_fee_deferral_months: [0],
    min_purchase_amount: [0],
    min_purchase_source: ['central_warehouse'],
    guarantee_type: ['none' as FrnAgreementPayload['guarantee_type']],
    guarantee_amount: [0],
    guarantee_reference: [''],
    guarantee_expires_on: [''],
    payment_method: ['bank_transfer' as FrnAgreementPayload['payment_method']],
    mandate_reference: [''],
    mandate_signed_on: [''],
    currency: ['EUR'],
    non_binding_pricing: [false],
    notes: [''],
  });

  ngOnInit(): void {
    void this.store.load();
  }

  protected franchiseeStores() {
    return this.store.stores().filter((option) => option.store_type === 'franchisee');
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.form.reset();
    this.formError.set(null);
    this.drawerOpen.set(true);
  }

  protected openEdit(row: FrnAgreement): void {
    this.editing.set(row);
    this.form.reset({
      store_id: row.store_id,
      formula_id: row.formula_id,
      jurisdiction: row.jurisdiction,
      disclosure_delivered_on: row.disclosure_delivered_on ?? '',
      signed_on: row.signed_on ?? '',
      start_date: row.start_date,
      end_date: row.end_date,
      auto_renew: row.auto_renew,
      renewal_notice_days: row.renewal_notice_days,
      zone_label: row.exclusivity_zone?.label ?? '',
      zone_postal_codes: (row.exclusivity_zone?.postal_codes ?? []).join(', '),
      entry_fee: toNumber(row.entry_fee),
      entry_fee_deferral_months: row.entry_fee_deferral_months,
      min_purchase_amount: toNumber(row.min_purchase_amount),
      min_purchase_source: row.min_purchase_source,
      guarantee_type: row.guarantee_type,
      guarantee_amount: toNumber(row.guarantee_amount),
      guarantee_reference: row.guarantee_reference ?? '',
      guarantee_expires_on: row.guarantee_expires_on ?? '',
      payment_method: row.payment_method,
      mandate_reference: row.mandate_reference ?? '',
      mandate_signed_on: row.mandate_signed_on ?? '',
      currency: row.currency,
      non_binding_pricing: row.non_binding_pricing,
      notes: row.notes ?? '',
    });
    this.formError.set(null);
    this.drawerOpen.set(true);
  }

  protected close(): void {
    this.drawerOpen.set(false);
  }

  protected openRenew(row: FrnAgreement): void {
    this.renewing.set(row);
    this.renewEnd.set('');
  }

  protected async submitRenew(): Promise<void> {
    const row = this.renewing();
    if (row === null || this.renewEnd() === '') {
      return;
    }
    await this.run(this.store.renew(row.id, this.renewEnd()));
    this.renewing.set(null);
  }

  protected async run(call: Promise<FrnOutcome>): Promise<void> {
    const outcome = await call;
    this.feedback.set(outcome.ok ? null : outcome);
  }

  protected async submit(): Promise<void> {
    const value = this.form.getRawValue();
    const codes = value.zone_postal_codes
      .split(',')
      .map((code) => code.trim())
      .filter((code) => code !== '');
    const payload: FrnAgreementPayload = {
      store_id: value.store_id,
      formula_id: value.formula_id,
      jurisdiction: value.jurisdiction,
      disclosure_delivered_on: value.disclosure_delivered_on || null,
      signed_on: value.signed_on || null,
      start_date: value.start_date,
      end_date: value.end_date,
      auto_renew: value.auto_renew,
      renewal_notice_days: value.renewal_notice_days,
      exclusivity_zone: codes.length > 0 || value.zone_label ? { label: value.zone_label || null, postal_codes: codes } : null,
      entry_fee: value.entry_fee,
      entry_fee_deferral_months: value.entry_fee_deferral_months,
      min_purchase_amount: value.min_purchase_amount,
      min_purchase_source: value.min_purchase_source,
      guarantee_type: value.guarantee_type,
      guarantee_amount: value.guarantee_amount,
      guarantee_reference: value.guarantee_reference || null,
      guarantee_expires_on: value.guarantee_expires_on || null,
      payment_method: value.payment_method,
      mandate_reference: value.mandate_reference || null,
      mandate_signed_on: value.mandate_signed_on || null,
      currency: value.currency,
      non_binding_pricing: value.non_binding_pricing,
      notes: value.notes || null,
    };
    const outcome = await this.store.save(payload, this.editing()?.id);
    if (outcome.ok) {
      this.message.success(this.i18n.instant('franchiseNetwork.notification.saved'));
      this.close();
    } else {
      this.formError.set(outcome);
    }
  }
}
