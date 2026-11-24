import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AuthStore,
  BillingApiService,
  ContactResource,
  CrmApiService,
  DeclarationOfIntentPayload,
  I18nService,
  PlafondRow,
} from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { reportProblem } from './italian-vat-feedback';
import { ItalianVatStore } from './italian-vat.store';
import {
  currentYear,
  DeclarationIssue,
  PLAFOND_ALERT_COLORS,
  PLAFOND_STATUS_COLORS,
  plafondRevocable,
  plafondUsage,
  todayIso,
  validateDeclaration,
} from './italian-vat.util';

function contactLabel(contact: ContactResource): string {
  const company = (contact.company_name ?? '').trim();
  return company !== '' ? company : `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim();
}

/** Plafond of the habitual exporters: declarations of intent, consumption monitor, guard simulation and revocation. */
@Component({
  selector: 'app-italian-vat-plafond',
  styleUrl: '../general-ledger/localization/gl-localization.scss',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzPopconfirmModule,
    NzProgressModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    MoneyPipe,
    PageHeaderComponent,
    TranslatePipe,
  ],
  template: `
    <app-page-header
      [title]="'PAGE_TITLE.ITALIAN_VAT_PLAFOND' | translate"
      [subtitle]="'italianVat.ui.plafondLaw' | translate"
    />

    <nz-card>
      <div class="filters">
        <div class="field">
          <span>{{ 'GL.VAT_YEAR' | translate }}</span>
          <nz-input-number
            data-testid="plafond-year"
            [nzMin]="2000"
            [nzMax]="2100"
            [ngModel]="year()"
            (ngModelChange)="year.set($event ?? year())"
          />
        </div>
        <button
          nz-button
          nzType="primary"
          type="button"
          data-testid="plafond-load"
          [nzLoading]="store.loading()"
          (click)="load()"
        >
          {{ 'GL.RUN_REPORT' | translate }}
        </button>
        <button nz-button type="button" data-testid="declaration-new" (click)="openForm(null)">
          {{ 'italianVat.ui.newDeclaration' | translate }}
        </button>
      </div>

      @if (store.blockedDeclarations().length > 0) {
        <nz-alert
          nzType="error"
          nzShowIcon
          data-testid="blocked-alert"
          [nzMessage]="
            'italianVat.ui.declarationsBlocked'
              | translate: { count: store.blockedDeclarations().length }
          "
          [nzDescription]="'italianVat.ui.plafondLaw' | translate"
        />
      }

      @if (store.plafond(); as monitor) {
        <nz-table
          nzSize="small"
          [nzData]="monitor.declarations"
          [nzPageSize]="25"
          data-testid="declarations"
        >
          <thead>
            <tr>
              <th>{{ 'italianVat.ui.customer' | translate }}</th>
              <th>{{ 'italianVat.ui.protocolAde' | translate }}</th>
              <th>{{ 'italianVat.ui.validity' | translate }}</th>
              <th nzAlign="right">{{ 'italianVat.plafond.title' | translate }}</th>
              <th nzAlign="right">{{ 'italianVat.plafond.consumed' | translate }}</th>
              <th>{{ 'italianVat.plafond.residual' | translate }}</th>
              <th>{{ 'italianVat.ui.status' | translate }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (row of monitor.declarations; track row.id) {
              <tr>
                <td>{{ row.contact_name }}</td>
                <td>{{ row.protocol_number }}</td>
                <td>{{ row.valid_from }} - {{ row.valid_to }}</td>
                <td nzAlign="right">{{ row.plafond | money: currency() }}</td>
                <td nzAlign="right">{{ row.consumed | money: currency() }}</td>
                <td>
                  <nz-progress
                    nzSize="small"
                    [nzPercent]="usage(row)"
                    [nzStatus]="
                      row.alert === 'critical'
                        ? 'exception'
                        : row.alert === 'warning'
                          ? 'active'
                          : 'success'
                    "
                    [nzFormat]="residual(row)"
                  />
                </td>
                <td>
                  <nz-tag [nzColor]="statusColor(row)">{{
                    'italianVat.plafond.status.' + row.status | translate
                  }}</nz-tag>
                  <nz-tag [nzColor]="alertColor(row)" [attr.data-testid]="'alert-' + row.id">{{
                    'italianVat.plafond.alert.' + row.alert | translate
                  }}</nz-tag>
                </td>
                <td>
                  <button
                    nz-button
                    nzSize="small"
                    type="button"
                    [attr.data-testid]="'edit-' + row.id"
                    (click)="openForm(row)"
                  >
                    {{ 'COMMON.EDIT' | translate }}
                  </button>
                  @if (revocable(row)) {
                    <button
                      nz-button
                      nzSize="small"
                      nzDanger
                      type="button"
                      nz-popconfirm
                      [nzPopconfirmTitle]="'italianVat.ui.revokeConfirm' | translate"
                      (nzOnConfirm)="revoke(row)"
                    >
                      {{ 'italianVat.plafond.revoke' | translate }}
                    </button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
        <p class="totals" data-testid="plafond-totals">
          <strong>
            {{ 'italianVat.plafond.title' | translate }}:
            {{ monitor.totals.plafond | money: currency() }} -
            {{ 'italianVat.plafond.consumed' | translate }}:
            {{ monitor.totals.consumed | money: currency() }} -
            {{ 'italianVat.plafond.residual' | translate }}:
            {{ monitor.totals.residual | money: currency() }}
          </strong>
        </p>
      }
    </nz-card>

    <nz-card [nzTitle]="'italianVat.ui.guardCheck' | translate">
      <div class="filters">
        <nz-select
          class="select-sm"
          nzShowSearch
          data-testid="check-contact"
          [nzPlaceHolder]="'italianVat.ui.customer' | translate"
          [ngModel]="checkContact()"
          (ngModelChange)="checkContact.set($event)"
        >
          @for (contact of contacts(); track contact.id) {
            <nz-option [nzValue]="contact.id" [nzLabel]="label(contact)" />
          }
        </nz-select>
        <input
          class="date-input"
          nz-input
          type="date"
          [attr.aria-label]="'GL.COL_DATE' | translate"
          [ngModel]="checkDate()"
          (ngModelChange)="checkDate.set($event)"
        />
        <nz-input-number
          data-testid="check-amount"
          [nzMin]="0"
          [nzPrecision]="2"
          [ngModel]="checkAmount()"
          (ngModelChange)="checkAmount.set($event ?? 0)"
        />
        <button
          nz-button
          type="button"
          data-testid="check"
          [disabled]="!checkContact() || checkAmount() <= 0"
          [nzLoading]="store.loading()"
          (click)="check()"
        >
          {{ 'italianVat.ui.check' | translate }}
        </button>
      </div>
      @if (store.assessment(); as result) {
        <nz-alert
          data-testid="assessment"
          [nzType]="result.covered ? 'success' : 'error'"
          nzShowIcon
          [nzMessage]="
            (result.covered ? 'italianVat.ui.covered' : 'italianVat.error.' + result.error_code)
              | translate
          "
          [nzDescription]="
            result.residual
              ? ('italianVat.plafond.residual' | translate) + ': ' + result.residual
              : ''
          "
        />
      }
    </nz-card>

    <nz-modal
      [nzVisible]="formOpen()"
      [nzTitle]="'italianVat.ui.declaration' | translate"
      [nzOkLoading]="saving()"
      [nzOkDisabled]="!!formIssues().length || !formContact()"
      (nzOnOk)="saveDeclaration()"
      (nzOnCancel)="formOpen.set(false)"
    >
      <ng-container *nzModalContent>
        <div class="declaration-form">
          <label for="iv-dec-contact">{{ 'italianVat.ui.customer' | translate }}</label>
          <nz-select
            id="iv-dec-contact"
            nzShowSearch
            [ngModel]="formContact()"
            (ngModelChange)="formContact.set($event)"
          >
            @for (contact of contacts(); track contact.id) {
              <nz-option [nzValue]="contact.id" [nzLabel]="label(contact)" />
            }
          </nz-select>
          <label for="iv-dec-protocol">{{ 'italianVat.ui.protocolAde' | translate }}</label>
          <input
            id="iv-dec-protocol"
            nz-input
            placeholder="12345678901234567-000001"
            [ngModel]="formProtocol()"
            (ngModelChange)="formProtocol.set($event)"
          />
          <label for="iv-dec-receipt">{{ 'italianVat.ui.receiptDate' | translate }}</label>
          <input
            id="iv-dec-receipt"
            nz-input
            type="date"
            [ngModel]="formReceipt()"
            (ngModelChange)="formReceipt.set($event)"
          />
          <label for="iv-dec-from">{{ 'italianVat.ui.validFrom' | translate }}</label>
          <input
            id="iv-dec-from"
            nz-input
            type="date"
            [ngModel]="formFrom()"
            (ngModelChange)="formFrom.set($event)"
          />
          <label for="iv-dec-to">{{ 'italianVat.ui.validTo' | translate }}</label>
          <input
            id="iv-dec-to"
            nz-input
            type="date"
            [ngModel]="formTo()"
            (ngModelChange)="formTo.set($event)"
          />
          <label for="iv-dec-plafond">{{ 'italianVat.plafond.title' | translate }}</label>
          <nz-input-number
            id="iv-dec-plafond"
            [nzMin]="0"
            [nzPrecision]="2"
            [ngModel]="formPlafond()"
            (ngModelChange)="formPlafond.set($event ?? 0)"
          />
        </div>
        @for (issue of formIssues(); track issue) {
          <div class="ant-form-item-explain-error" role="alert" data-testid="declaration-issue">
            {{ 'italianVat.ui.declarationIssue_' + issue | translate }}
          </div>
        }
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .declaration-form {
      display: grid;
      gap: 8px;
    }
  `,
})
export class ItalianVatPlafondComponent implements OnInit {
  protected readonly store = inject(ItalianVatStore);
  private readonly billing = inject(BillingApiService);
  private readonly crm = inject(CrmApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  protected readonly currency = inject(AuthStore).activeCurrency;

  protected readonly year = signal(currentYear());
  protected readonly contacts = signal<ContactResource[]>([]);

  protected readonly checkContact = signal<string | null>(null);
  protected readonly checkDate = signal(todayIso());
  protected readonly checkAmount = signal(0);

  protected readonly formOpen = signal(false);
  protected readonly saving = signal(false);
  private readonly editingId = signal<string | null>(null);
  protected readonly formContact = signal<string | null>(null);
  protected readonly formProtocol = signal('');
  protected readonly formReceipt = signal(todayIso());
  protected readonly formFrom = signal(`${currentYear()}-01-01`);
  protected readonly formTo = signal(`${currentYear()}-12-31`);
  protected readonly formPlafond = signal(0);
  protected readonly formIssues = computed<DeclarationIssue[]>(() =>
    validateDeclaration({
      protocol_number: this.formProtocol(),
      receipt_date: this.formReceipt(),
      valid_from: this.formFrom(),
      valid_to: this.formTo(),
      plafond_amount: this.formPlafond(),
    }),
  );

  ngOnInit(): void {
    this.crm
      .getClients({ per_page: 100 })
      .subscribe({ next: (response) => this.contacts.set(response.data) });
    void this.load();
  }

  protected load(): Promise<void> {
    return this.store.loadPlafond(this.year());
  }

  protected label(contact: ContactResource): string {
    return contactLabel(contact);
  }

  protected usage(row: PlafondRow): number {
    return plafondUsage(row);
  }

  protected residual(row: PlafondRow): () => string {
    return () => row.residual;
  }

  protected statusColor(row: PlafondRow): string {
    return PLAFOND_STATUS_COLORS[row.status];
  }

  protected alertColor(row: PlafondRow): string {
    return PLAFOND_ALERT_COLORS[row.alert];
  }

  protected revocable(row: PlafondRow): boolean {
    return plafondRevocable(row);
  }

  protected async check(): Promise<void> {
    const contactId = this.checkContact();
    if (contactId) {
      await this.store.checkPlafond({
        contact_id: contactId,
        date: this.checkDate(),
        amount: this.checkAmount(),
      });
    }
  }

  protected async revoke(row: PlafondRow): Promise<void> {
    if (await this.store.revokeDeclaration(row.id, this.year(), null)) {
      this.message.success(this.i18n.translate('italianVat.ui.declarationRevoked'));
    } else {
      reportProblem(this.store.error(), this.i18n, this.message);
    }
  }

  protected openForm(row: PlafondRow | null): void {
    this.editingId.set(row?.id ?? null);
    this.formContact.set(row?.contact_id ?? null);
    this.formProtocol.set(row?.protocol_number ?? '');
    this.formReceipt.set(todayIso());
    this.formFrom.set(row?.valid_from ?? `${this.year()}-01-01`);
    this.formTo.set(row?.valid_to ?? `${this.year()}-12-31`);
    this.formPlafond.set(row ? Number(row.plafond) : 0);
    this.formOpen.set(true);
    if (row) {
      this.billing
        .getDeclarationOfIntent(row.id)
        .subscribe((response) => this.formReceipt.set(response.data.receipt_date ?? todayIso()));
    }
  }

  protected saveDeclaration(): void {
    const contactId = this.formContact();
    if (!contactId || this.formIssues().length > 0) {
      return;
    }
    const payload: DeclarationOfIntentPayload = {
      contact_id: contactId,
      direction: 'received',
      protocol_number: this.formProtocol(),
      receipt_date: this.formReceipt(),
      year: Number(this.formFrom().slice(0, 4)),
      plafond_amount: this.formPlafond(),
      valid_from: this.formFrom(),
      valid_to: this.formTo(),
    };
    const id = this.editingId();
    const request = id
      ? this.billing.updateDeclarationOfIntent(id, payload)
      : this.billing.createDeclarationOfIntent(payload);
    this.saving.set(true);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.message.success(this.i18n.translate('italianVat.ui.declarationSaved'));
        void this.load();
      },
      error: () => this.saving.set(false),
    });
  }
}
