import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { DC_LOCALES, DcDossier, DcLocale, PermissionsService } from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';
import { ArCustomerSelectComponent } from '../receivables/ar-customer-select.component';
import { DcFeedback } from './dc-feedback.service';
import {
  DEBT_COLLECTION_MODULE,
  dossierStatusColor,
  noticeStatusColor,
  sumDecimals,
} from './debt-collection.util';
import { LegalStore } from './legal.store';

type Dialog = 'dossier' | 'messa' | null;

/**
 * Legal escalation: the Betreibung dossier of a Swiss customer (Betreibungsbegehren, bundle with the invoice history, the
 * notices and the QR-bill slips) and the messa in mora by PEC of an Italian customer (D.Lgs. 231/2002) with its receipts.
 */
@Component({
  selector: 'app-dc-legal',
  imports: [
    FormsModule,
    MoneyPipe,
    TranslatePipe,
    ArCustomerSelectComponent,
    NzAlertModule,
    NzButtonModule,
    NzCheckboxModule,
    NzEmptyModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSpinModule,
    NzSwitchModule,
    NzTableModule,
    NzTagModule,
  ],
  providers: [LegalStore],
  styleUrl: './debt-collection.scss',
  template: `
    @if (store.error(); as error) {
      <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="error | translate" />
    }

    @if (canWrite) {
      <h3 class="section-title">{{ 'debtCollection.legal.prepare' | translate }}</h3>
      <p class="hint">{{ 'debtCollection.legal.prepareHint' | translate }}</p>
      <div class="toolbar">
        <div class="field wide">
          <span>{{ 'debtCollection.field.customer' | translate }}</span>
          <app-ar-customer-select
            [customerId]="store.customerId()"
            (customerChange)="store.selectCustomer($event?.id ?? null)"
          />
        </div>
        <button nz-button type="button" [disabled]="!canPrepare()" (click)="openDialog('dossier')">
          {{ 'debtCollection.action.generateDossier' | translate }}
        </button>
        <button nz-button type="button" [disabled]="!canPrepare()" (click)="openDialog('messa')">
          {{ 'debtCollection.action.generateMessa' | translate }}
        </button>
      </div>

      @if (store.customerId()) {
        <nz-spin [nzSpinning]="store.loadingItems()">
          <nz-table #itemTable nzSize="small" [nzData]="store.items()" [nzShowPagination]="false">
            <thead>
              <tr>
                <th scope="col"></th>
                <th scope="col">{{ 'debtCollection.field.document' | translate }}</th>
                <th scope="col">{{ 'debtCollection.field.dueDate' | translate }}</th>
                <th scope="col">{{ 'debtCollection.field.jurisdiction' | translate }}</th>
                <th scope="col" class="num">
                  {{ 'debtCollection.field.daysOverdue' | translate }}
                </th>
                <th scope="col" class="num">{{ 'debtCollection.field.openAmount' | translate }}</th>
                <th scope="col" class="num">{{ 'debtCollection.field.total' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (item of itemTable.data; track item.receivable_item_id) {
                <tr>
                  <td>
                    <label
                      nz-checkbox
                      [ngModel]="store.selected().includes(item.receivable_item_id)"
                      [attr.aria-label]="item.document_number"
                      (ngModelChange)="store.toggleItem(item.receivable_item_id, $event)"
                    ></label>
                  </td>
                  <th scope="row">{{ item.document_number }}</th>
                  <td>{{ item.due_date }}</td>
                  <td>{{ 'debtCollection.jurisdiction.' + item.jurisdiction | translate }}</td>
                  <td class="num">{{ item.days_overdue }}</td>
                  <td class="num">{{ item.open_amount | money: item.currency }}</td>
                  <td class="num">{{ item.total | money: item.currency }}</td>
                </tr>
              }
            </tbody>
          </nz-table>
          @if (!store.loadingItems() && store.items().length === 0) {
            <nz-empty [nzNotFoundContent]="'debtCollection.legal.noItems' | translate" />
          }
        </nz-spin>
      }
    }

    <nz-spin [nzSpinning]="store.loading()">
      <h3 class="section-title">{{ 'debtCollection.legal.dossiers' | translate }}</h3>
      <nz-table #dossierTable nzSize="small" [nzData]="store.dossiers()" [nzShowPagination]="false">
        <thead>
          <tr>
            <th scope="col">{{ 'debtCollection.field.number' | translate }}</th>
            <th scope="col">{{ 'debtCollection.field.customer' | translate }}</th>
            <th scope="col">{{ 'debtCollection.field.office' | translate }}</th>
            <th scope="col" class="num">{{ 'debtCollection.field.principal' | translate }}</th>
            <th scope="col" class="num">{{ 'debtCollection.field.interest' | translate }}</th>
            <th scope="col" class="num">{{ 'debtCollection.field.total' | translate }}</th>
            <th scope="col">{{ 'debtCollection.field.status' | translate }}</th>
            <th scope="col"></th>
          </tr>
        </thead>
        <tbody>
          @for (dossier of dossierTable.data; track dossier.id) {
            <tr>
              <th scope="row">{{ dossier.number }}</th>
              <td>{{ dossier.customer_name }}</td>
              <td>{{ dossier.office?.name ?? '' }}</td>
              <td class="num">{{ dossier.principal | money: dossier.currency }}</td>
              <td class="num">{{ dossier.interest | money: dossier.currency }}</td>
              <td class="num">{{ dossier.total | money: dossier.currency }}</td>
              <td>
                <nz-tag [nzColor]="dossierTag(dossier.status)">{{
                  'debtCollection.dossierStatus.' + dossier.status | translate
                }}</nz-tag>
              </td>
              <td>
                <div class="row-actions">
                  <button
                    nz-button
                    nzSize="small"
                    type="button"
                    [disabled]="store.busyId() === dossier.id"
                    (click)="pdf(dossier)"
                  >
                    {{ 'debtCollection.action.begehrenPdf' | translate }}
                  </button>
                  @if (dossier.has_bundle) {
                    <button
                      nz-button
                      nzSize="small"
                      type="button"
                      [disabled]="store.busyId() === dossier.id"
                      (click)="bundle(dossier)"
                    >
                      {{ 'debtCollection.action.bundle' | translate }}
                    </button>
                  }
                  @if (canWrite && dossier.status === 'generated') {
                    <button
                      nz-button
                      nzSize="small"
                      nzType="primary"
                      type="button"
                      nz-popconfirm
                      [nzPopconfirmTitle]="'debtCollection.legal.submitConfirm' | translate"
                      (nzOnConfirm)="submit(dossier)"
                    >
                      {{ 'debtCollection.action.submitDossier' | translate }}
                    </button>
                  }
                </div>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!store.loading() && store.dossiers().length === 0) {
        <nz-empty [nzNotFoundContent]="'debtCollection.legal.noDossiers' | translate" />
      }

      <h3 class="section-title">{{ 'debtCollection.legal.messe' | translate }}</h3>
      <nz-table #messaTable nzSize="small" [nzData]="store.messe()" [nzShowPagination]="false">
        <thead>
          <tr>
            <th scope="col">{{ 'debtCollection.field.number' | translate }}</th>
            <th scope="col">{{ 'debtCollection.field.customer' | translate }}</th>
            <th scope="col" class="num">{{ 'debtCollection.field.total' | translate }}</th>
            <th scope="col">{{ 'debtCollection.field.status' | translate }}</th>
            <th scope="col">{{ 'debtCollection.notices.receipts' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (notice of messaTable.data; track notice.id) {
            <tr>
              <th scope="row">{{ notice.number }}</th>
              <td>{{ notice.customer_name }}</td>
              <td class="num">{{ notice.total | money: notice.currency }}</td>
              <td>
                <nz-tag [nzColor]="noticeTag(notice.status)">{{
                  'debtCollection.noticeStatus.' + notice.status | translate
                }}</nz-tag>
              </td>
              <td>
                <div class="inline-tags">
                  @for (receipt of notice.receipts; track receipt.id) {
                    <nz-tag [nzColor]="receiptTag(receipt.kind)">{{
                      'debtCollection.receiptKind.' + receipt.kind | translate
                    }}</nz-tag>
                  } @empty {
                    <span class="muted">{{ 'debtCollection.notices.noReceipts' | translate }}</span>
                  }
                </div>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!store.loading() && store.messe().length === 0) {
        <nz-empty [nzNotFoundContent]="'debtCollection.legal.noMesse' | translate" />
      }
    </nz-spin>

    <nz-modal
      [nzVisible]="dialog() !== null"
      [nzTitle]="
        (dialog() === 'dossier'
          ? 'debtCollection.legal.dossierTitle'
          : 'debtCollection.legal.messaTitle'
        ) | translate
      "
      [nzOkText]="'debtCollection.action.confirm' | translate"
      [nzCancelText]="'debtCollection.action.cancel' | translate"
      [nzOkLoading]="store.saving()"
      [nzOkDisabled]="store.selected().length === 0"
      (nzOnOk)="confirm()"
      (nzOnCancel)="dialog.set(null)"
    >
      <ng-container *nzModalContent>
        <div class="stack">
          <p>
            {{
              'debtCollection.legal.summary'
                | translate: { count: store.selected().length, total: selectedTotal() }
            }}
          </p>
          @if (dialog() === 'dossier') {
            <label class="field" for="dc-l-office">
              <span>{{ 'debtCollection.field.office' | translate }}</span>
              <nz-select
                nzId="dc-l-office"
                nzAllowClear
                [nzPlaceHolder]="'debtCollection.legal.officeAuto' | translate"
                [ngModel]="officeId()"
                (ngModelChange)="officeId.set($event)"
              >
                @for (office of store.offices(); track office.id) {
                  <nz-option [nzValue]="office.id" [nzLabel]="office.name + ' · ' + office.city" />
                }
              </nz-select>
            </label>
          } @else {
            <label class="field" for="dc-l-pec">
              <span>{{ 'debtCollection.legal.sendPec' | translate }}</span>
              <nz-switch
                nzId="dc-l-pec"
                [ngModel]="sendPec()"
                (ngModelChange)="sendPec.set($event)"
              />
              <small class="hint">{{ 'debtCollection.legal.sendPecHint' | translate }}</small>
            </label>
          }
          <label class="field" for="dc-l-locale">
            <span>{{ 'debtCollection.field.locale' | translate }}</span>
            <nz-select
              nzId="dc-l-locale"
              nzAllowClear
              [nzPlaceHolder]="'debtCollection.generate.customerLocale' | translate"
              [ngModel]="locale()"
              (ngModelChange)="locale.set($event)"
            >
              @for (value of locales; track value) {
                <nz-option
                  [nzValue]="value"
                  [nzLabel]="'debtCollection.locale.' + value | translate"
                />
              }
            </nz-select>
          </label>
        </div>
      </ng-container>
    </nz-modal>
  `,
})
export class DcLegalComponent implements OnInit {
  protected readonly store = inject(LegalStore);
  private readonly feedback = inject(DcFeedback);

  protected readonly canWrite = inject(PermissionsService).canWrite(DEBT_COLLECTION_MODULE);
  protected readonly locales: readonly DcLocale[] = DC_LOCALES;
  protected readonly dossierTag = dossierStatusColor;
  protected readonly noticeTag = noticeStatusColor;

  protected readonly dialog = signal<Dialog>(null);
  protected readonly officeId = signal<string | null>(null);
  protected readonly locale = signal<DcLocale | null>(null);
  protected readonly sendPec = signal(true);

  protected readonly canPrepare = computed(
    () => this.store.customerId() !== null && this.store.selected().length > 0,
  );

  /** Display total of the selected items (one currency per dossier: the first selected item's). */
  protected readonly selectedTotal = computed(() => {
    const picked = this.store
      .items()
      .filter((item) => this.store.selected().includes(item.receivable_item_id));
    const currency = picked[0]?.currency ?? '';
    return `${sumDecimals(picked.filter((item) => item.currency === currency).map((item) => item.total))} ${currency}`.trim();
  });

  ngOnInit(): void {
    void this.store.load();
  }

  protected receiptTag(kind: string): string {
    return kind === 'consegna' || kind === 'accettazione' ? 'green' : 'red';
  }

  protected openDialog(dialog: Dialog): void {
    this.dialog.set(dialog);
  }

  protected async confirm(): Promise<void> {
    const isDossier = this.dialog() === 'dossier';
    const outcome = isDossier
      ? await this.store.createDossier(this.officeId(), this.locale())
      : await this.store.createMessaInMora(this.sendPec(), this.locale());
    if (
      this.feedback.report(
        outcome,
        isDossier ? 'debtCollection.msg.dossierCreated' : 'debtCollection.msg.messaCreated',
      )
    ) {
      this.dialog.set(null);
    }
  }

  protected async pdf(dossier: DcDossier): Promise<void> {
    this.feedback.report(await this.store.downloadDossierPdf(dossier));
  }

  protected async bundle(dossier: DcDossier): Promise<void> {
    this.feedback.report(await this.store.downloadDossierBundle(dossier));
  }

  protected async submit(dossier: DcDossier): Promise<void> {
    this.feedback.report(
      await this.store.submitDossier(dossier.id),
      'debtCollection.msg.dossierSubmitted',
    );
  }
}
