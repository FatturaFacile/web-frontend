import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AuthStore,
  ContactResource,
  CrmApiService,
  GOODS_MOVEMENT_TYPES,
  GoodsMovementPayload,
  GoodsMovementType,
  I18nService,
} from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';
import { rangeEndsBeforeStart } from '../general-ledger/shared/gl-dates';
import { reportProblem } from './italian-vat-feedback';
import { ItalianVatStore } from './italian-vat.store';
import { currentYear, todayIso, toCents } from './italian-vat.util';

function contactLabel(contact: ContactResource): string {
  const company = (contact.company_name ?? '').trim();
  return company !== '' ? company : `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim();
}

/** Register of goods held on account of third parties (merci c/conto terzi): movements and held balances per counterparty. */
@Component({
  selector: 'app-italian-vat-goods-panel',
  styleUrl: '../general-ledger/localization/gl-localization.scss',
  imports: [
    FormsModule,
    NzButtonModule,
    NzCardModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    MoneyPipe,
    TranslatePipe,
  ],
  template: `
    <nz-card [nzTitle]="'italianVat.registerType.third_party_goods' | translate">
      <div class="filters">
        <label for="iv-goods-from">{{ 'GL.FROM' | translate }}</label>
        <input
          class="date-input"
          id="iv-goods-from"
          nz-input
          type="date"
          [ngModel]="from()"
          (ngModelChange)="from.set($event)"
        />
        <label for="iv-goods-to">{{ 'GL.TO' | translate }}</label>
        <input
          class="date-input"
          id="iv-goods-to"
          nz-input
          type="date"
          [ngModel]="to()"
          (ngModelChange)="to.set($event)"
        />
        <button
          nz-button
          nzType="primary"
          type="button"
          data-testid="goods-load"
          [disabled]="rangeInvalid()"
          [nzLoading]="store.loading()"
          (click)="load()"
        >
          {{ 'GL.RUN_REPORT' | translate }}
        </button>
        <button nz-button type="button" data-testid="goods-new" (click)="open()">
          {{ 'italianVat.ui.newMovement' | translate }}
        </button>
      </div>

      <h3>{{ 'italianVat.goods.balance' | translate }}</h3>
      <nz-table
        nzSize="small"
        [nzData]="store.balances()"
        [nzShowPagination]="false"
        data-testid="balances"
      >
        <thead>
          <tr>
            <th>{{ 'GL.COL_PARTNER' | translate }}</th>
            <th>{{ 'italianVat.ui.description' | translate }}</th>
            <th nzAlign="right">{{ 'italianVat.ui.quantity' | translate }}</th>
            <th nzAlign="right">{{ 'italianVat.ui.value' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of store.balances(); track $index) {
            <tr>
              <td>{{ nameOf(row.contact_id) }}</td>
              <td>{{ row.description }}</td>
              <td nzAlign="right">{{ row.held_quantity }} {{ row.unit }}</td>
              <td nzAlign="right">{{ row.held_value | money: currency() }}</td>
            </tr>
          }
        </tbody>
      </nz-table>

      <h3>{{ 'italianVat.ui.movements' | translate }}</h3>
      <nz-table
        nzSize="small"
        [nzData]="store.movements()"
        [nzPageSize]="25"
        data-testid="movements"
      >
        <thead>
          <tr>
            <th>{{ 'italianVat.register.protocol' | translate }}</th>
            <th>{{ 'GL.COL_DATE' | translate }}</th>
            <th>{{ 'italianVat.ui.movementType' | translate }}</th>
            <th>{{ 'GL.COL_PARTNER' | translate }}</th>
            <th>{{ 'italianVat.ui.description' | translate }}</th>
            <th nzAlign="right">{{ 'italianVat.ui.quantity' | translate }}</th>
            <th nzAlign="right">{{ 'italianVat.ui.value' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (movement of store.movements(); track movement.id) {
            <tr>
              <td>{{ movement.protocol_number }}</td>
              <td>{{ movement.movement_date }}</td>
              <td>
                <nz-tag [nzColor]="movement.movement_type === 'received' ? 'green' : 'orange'">{{
                  'italianVat.goods.' + movement.movement_type | translate
                }}</nz-tag>
              </td>
              <td>{{ nameOf(movement.contact_id) }}</td>
              <td>{{ movement.description }}</td>
              <td nzAlign="right">{{ movement.quantity }} {{ movement.unit }}</td>
              <td nzAlign="right">{{ movement.value | money: currency() }}</td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    <nz-modal
      [nzVisible]="modalOpen()"
      [nzTitle]="'italianVat.ui.newMovement' | translate"
      [nzOkLoading]="store.saving()"
      [nzOkDisabled]="!formValid()"
      (nzOnOk)="save()"
      (nzOnCancel)="modalOpen.set(false)"
    >
      <ng-container *nzModalContent>
        <div class="movement-form">
          <label for="iv-mv-type">{{ 'italianVat.ui.movementType' | translate }}</label>
          <nz-select id="iv-mv-type" [ngModel]="type()" (ngModelChange)="type.set($event)">
            @for (value of types; track value) {
              <nz-option [nzValue]="value" [nzLabel]="'italianVat.goods.' + value | translate" />
            }
          </nz-select>
          <label for="iv-mv-contact">{{ 'GL.COL_PARTNER' | translate }}</label>
          <nz-select
            id="iv-mv-contact"
            nzShowSearch
            [ngModel]="contactId()"
            (ngModelChange)="contactId.set($event)"
          >
            @for (contact of contacts(); track contact.id) {
              <nz-option [nzValue]="contact.id" [nzLabel]="label(contact)" />
            }
          </nz-select>
          <label for="iv-mv-date">{{ 'GL.COL_DATE' | translate }}</label>
          <input
            id="iv-mv-date"
            nz-input
            type="date"
            [ngModel]="date()"
            (ngModelChange)="date.set($event)"
          />
          <label for="iv-mv-description">{{ 'italianVat.ui.description' | translate }}</label>
          <input
            id="iv-mv-description"
            nz-input
            maxlength="200"
            [ngModel]="description()"
            (ngModelChange)="description.set($event)"
          />
          <label for="iv-mv-quantity">{{ 'italianVat.ui.quantity' | translate }}</label>
          <input
            id="iv-mv-quantity"
            nz-input
            inputmode="decimal"
            [ngModel]="quantity()"
            (ngModelChange)="quantity.set($event)"
          />
          <label for="iv-mv-value">{{ 'italianVat.ui.value' | translate }}</label>
          <input
            id="iv-mv-value"
            nz-input
            inputmode="decimal"
            [ngModel]="value()"
            (ngModelChange)="value.set($event)"
          />
        </div>
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .movement-form {
      display: grid;
      gap: 8px;
    }
  `,
})
export class ItalianVatGoodsPanelComponent implements OnInit {
  protected readonly store = inject(ItalianVatStore);
  private readonly crm = inject(CrmApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  protected readonly currency = inject(AuthStore).activeCurrency;

  protected readonly types = GOODS_MOVEMENT_TYPES;
  protected readonly from = signal(`${currentYear()}-01-01`);
  protected readonly to = signal(`${currentYear()}-12-31`);
  protected readonly rangeInvalid = computed(() => rangeEndsBeforeStart(this.from(), this.to()));
  protected readonly contacts = signal<ContactResource[]>([]);

  protected readonly modalOpen = signal(false);
  protected readonly type = signal<GoodsMovementType>('received');
  protected readonly contactId = signal<string | null>(null);
  protected readonly date = signal(todayIso());
  protected readonly description = signal('');
  protected readonly quantity = signal('');
  protected readonly value = signal('');
  protected readonly formValid = computed(
    () =>
      this.contactId() !== null && this.description().trim() !== '' && toCents(this.quantity()) > 0,
  );

  ngOnInit(): void {
    this.crm
      .getClients({ per_page: 100 })
      .subscribe({ next: (response) => this.contacts.update((all) => [...all, ...response.data]) });
    this.crm
      .getSuppliers({ per_page: 100 })
      .subscribe({ next: (response) => this.contacts.update((all) => [...all, ...response.data]) });
    void this.load();
  }

  protected label(contact: ContactResource): string {
    return contactLabel(contact);
  }

  protected nameOf(contactId: string): string {
    const contact = this.contacts().find((c) => c.id === contactId);
    return contact ? contactLabel(contact) : contactId;
  }

  protected load(): Promise<void> {
    return this.store.loadGoods({ from: this.from(), to: this.to() }, this.to());
  }

  protected open(): void {
    this.type.set('received');
    this.contactId.set(null);
    this.date.set(todayIso());
    this.description.set('');
    this.quantity.set('');
    this.value.set('');
    this.modalOpen.set(true);
  }

  protected async save(): Promise<void> {
    const contactId = this.contactId();
    if (!contactId || !this.formValid()) {
      return;
    }
    const payload: GoodsMovementPayload = {
      movement_date: this.date(),
      movement_type: this.type(),
      contact_id: contactId,
      description: this.description().trim(),
      quantity: Number(this.quantity()),
      value: this.value() === '' ? null : Number(this.value()),
    };
    if (await this.store.addMovement(payload, { from: this.from(), to: this.to() })) {
      this.modalOpen.set(false);
      this.message.success(this.i18n.translate('italianVat.ui.movementSaved'));
    } else {
      reportProblem(this.store.error(), this.i18n, this.message);
    }
  }
}
