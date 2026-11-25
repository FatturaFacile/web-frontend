import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { DC_LEVELS, DcNotice, DcNoticeFilters, DcReceiptKind, PermissionsService } from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';
import { ArCustomerSelectComponent } from '../receivables/ar-customer-select.component';
import { DcFeedback } from './dc-feedback.service';
import {
  canCancelNotice,
  canRegisterReceipt,
  canSendNotice,
  DEBT_COLLECTION_MODULE,
  levelColor,
  noticeStatusColor,
} from './debt-collection.util';
import { DcLookupsStore } from './lookups.store';
import { NoticesStore } from './notices.store';

/**
 * Notices (reminders and messa in mora): status, resend, cancel, the PDF and the PEC export package, and the
 * PEC receipts panel (acceptance, delivery, failures) with the form that registers a receipt.
 */
@Component({
  selector: 'app-dc-notices',
  imports: [
    FormsModule,
    MoneyPipe,
    TranslatePipe,
    ArCustomerSelectComponent,
    NzAlertModule,
    NzButtonModule,
    NzDescriptionsModule,
    NzDrawerModule,
    NzEmptyModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
  ],
  providers: [NoticesStore],
  styleUrl: './debt-collection.scss',
  template: `
    <div class="toolbar">
      <label class="field" for="dc-n-status">
        <span>{{ 'debtCollection.field.status' | translate }}</span>
        <nz-select
          nzId="dc-n-status"
          nzAllowClear
          [nzPlaceHolder]="'debtCollection.action.all' | translate"
          [ngModel]="store.filters().status ?? null"
          (ngModelChange)="setFilter({ status: $event ?? undefined })"
        >
          @for (value of lookups.lookups().notice_statuses; track value) {
            <nz-option
              [nzValue]="value"
              [nzLabel]="'debtCollection.noticeStatus.' + value | translate"
            />
          }
        </nz-select>
      </label>
      <label class="field" for="dc-n-level">
        <span>{{ 'debtCollection.field.level' | translate }}</span>
        <nz-select
          nzId="dc-n-level"
          nzAllowClear
          [nzPlaceHolder]="'debtCollection.action.all' | translate"
          [ngModel]="store.filters().level ?? null"
          (ngModelChange)="setFilter({ level: $event ?? undefined })"
        >
          @for (value of levels; track value) {
            <nz-option [nzValue]="value" [nzLabel]="'debtCollection.level.' + value | translate" />
          }
        </nz-select>
      </label>
      <label class="field" for="dc-n-kind">
        <span>{{ 'debtCollection.field.kind' | translate }}</span>
        <nz-select
          nzId="dc-n-kind"
          nzAllowClear
          [nzPlaceHolder]="'debtCollection.action.all' | translate"
          [ngModel]="store.filters().kind ?? null"
          (ngModelChange)="setFilter({ kind: $event ?? undefined })"
        >
          @for (value of lookups.lookups().notice_kinds; track value) {
            <nz-option
              [nzValue]="value"
              [nzLabel]="'debtCollection.noticeKind.' + value | translate"
            />
          }
        </nz-select>
      </label>
      <div class="field wide">
        <span>{{ 'debtCollection.field.customer' | translate }}</span>
        <app-ar-customer-select
          [customerId]="store.filters().customer_id ?? null"
          (customerChange)="setFilter({ customer_id: $event?.id })"
        />
      </div>
      <button nz-button type="button" (click)="store.load()">
        {{ 'debtCollection.action.refresh' | translate }}
      </button>
    </div>

    @if (store.error(); as error) {
      <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="error | translate" />
    }

    <nz-spin [nzSpinning]="store.loading()">
      <nz-table
        #table
        nzSize="small"
        [nzData]="store.notices()"
        [nzTotal]="store.total()"
        [nzPageIndex]="store.page()"
        [nzPageSize]="store.pageSize()"
        [nzFrontPagination]="false"
        (nzPageIndexChange)="store.setPage($event)"
      >
        <thead>
          <tr>
            <th scope="col">{{ 'debtCollection.field.number' | translate }}</th>
            <th scope="col">{{ 'debtCollection.field.kind' | translate }}</th>
            <th scope="col">{{ 'debtCollection.field.customer' | translate }}</th>
            <th scope="col">{{ 'debtCollection.field.level' | translate }}</th>
            <th scope="col">{{ 'debtCollection.field.channel' | translate }}</th>
            <th scope="col" class="num">{{ 'debtCollection.field.total' | translate }}</th>
            <th scope="col">{{ 'debtCollection.field.issuedOn' | translate }}</th>
            <th scope="col">{{ 'debtCollection.field.status' | translate }}</th>
            <th scope="col"></th>
          </tr>
        </thead>
        <tbody>
          @for (notice of table.data; track notice.id) {
            <tr>
              <th scope="row">{{ notice.number }}</th>
              <td>{{ 'debtCollection.noticeKind.' + notice.kind | translate }}</td>
              <td>{{ notice.customer_name }}</td>
              <td>
                <nz-tag [nzColor]="levelTag(notice.level)">{{
                  'debtCollection.level.' + notice.level | translate
                }}</nz-tag>
              </td>
              <td>{{ 'debtCollection.channel.' + notice.channel | translate }}</td>
              <td class="num">{{ notice.total | money: notice.currency }}</td>
              <td>{{ notice.issued_on }}</td>
              <td>
                <nz-tag [nzColor]="statusTag(notice.status)">{{
                  'debtCollection.noticeStatus.' + notice.status | translate
                }}</nz-tag>
                @if (notice.error) {
                  <small class="error-text">{{ notice.error }}</small>
                }
              </td>
              <td>
                <div class="row-actions">
                  <button
                    nz-button
                    nzSize="small"
                    type="button"
                    (click)="store.openDetail(notice.id)"
                  >
                    {{ 'debtCollection.action.details' | translate }}
                  </button>
                  @if (notice.has_pdf) {
                    <button
                      nz-button
                      nzSize="small"
                      type="button"
                      [disabled]="store.busyId() === notice.id"
                      (click)="pdf(notice)"
                    >
                      {{ 'debtCollection.action.pdf' | translate }}
                    </button>
                  }
                  @if (canWrite && sendable(notice.status)) {
                    <button
                      nz-button
                      nzSize="small"
                      nzType="primary"
                      type="button"
                      [nzLoading]="store.busyId() === notice.id"
                      (click)="send(notice)"
                    >
                      {{
                        (notice.status === 'failed'
                          ? 'debtCollection.action.resend'
                          : 'debtCollection.action.send'
                        ) | translate
                      }}
                    </button>
                  }
                  @if (canWrite && cancellable(notice.status)) {
                    <button
                      nz-button
                      nzSize="small"
                      nzDanger
                      type="button"
                      nz-popconfirm
                      [nzPopconfirmTitle]="'debtCollection.notices.cancelConfirm' | translate"
                      (nzOnConfirm)="cancel(notice)"
                    >
                      {{ 'debtCollection.action.cancelNotice' | translate }}
                    </button>
                  }
                </div>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!store.loading() && store.notices().length === 0) {
        <nz-empty [nzNotFoundContent]="'debtCollection.notices.empty' | translate" />
      }
    </nz-spin>

    <nz-drawer
      [nzVisible]="store.detail() !== null || store.loadingDetail()"
      [nzWidth]="640"
      [nzTitle]="'debtCollection.notices.detail' | translate"
      (nzOnClose)="store.closeDetail()"
    >
      <ng-container *nzDrawerContent>
        <nz-spin [nzSpinning]="store.loadingDetail()">
          @if (store.detail(); as notice) {
            <nz-descriptions nzBordered nzSize="small" [nzColumn]="1">
              <nz-descriptions-item [nzTitle]="'debtCollection.field.number' | translate">
                {{ notice.number }}
              </nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'debtCollection.field.customer' | translate">
                {{ notice.customer_name }}
              </nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'debtCollection.field.status' | translate">
                <nz-tag [nzColor]="statusTag(notice.status)">{{
                  'debtCollection.noticeStatus.' + notice.status | translate
                }}</nz-tag>
              </nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'debtCollection.field.channel' | translate">
                {{ 'debtCollection.channel.' + notice.channel | translate }}
              </nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'debtCollection.field.locale' | translate">
                {{ 'debtCollection.locale.' + notice.locale | translate }}
              </nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'debtCollection.field.principal' | translate">
                {{ notice.principal | money: notice.currency }}
              </nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'debtCollection.field.interest' | translate">
                {{ notice.interest | money: notice.currency }}
              </nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'debtCollection.field.fee' | translate">
                {{ notice.fee | money: notice.currency }}
              </nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'debtCollection.field.total' | translate">
                <strong>{{ notice.total | money: notice.currency }}</strong>
              </nz-descriptions-item>
              @if (notice.new_due_date) {
                <nz-descriptions-item [nzTitle]="'debtCollection.field.newDueDate' | translate">
                  {{ notice.new_due_date }}
                </nz-descriptions-item>
              }
              @if (notice.pec_message_id) {
                <nz-descriptions-item [nzTitle]="'debtCollection.field.pecMessageId' | translate">
                  <span class="mono">{{ notice.pec_message_id }}</span>
                </nz-descriptions-item>
              }
              @if (notice.sent_at) {
                <nz-descriptions-item [nzTitle]="'debtCollection.field.sentAt' | translate">
                  {{ notice.sent_at }}
                </nz-descriptions-item>
              }
              <nz-descriptions-item [nzTitle]="'debtCollection.field.attempts' | translate">
                {{ notice.attempts }}
              </nz-descriptions-item>
            </nz-descriptions>

            <h4 class="section-title">{{ 'debtCollection.notices.lines' | translate }}</h4>
            <nz-table nzSize="small" [nzData]="notice.lines" [nzShowPagination]="false">
              <thead>
                <tr>
                  <th scope="col">{{ 'debtCollection.field.document' | translate }}</th>
                  <th scope="col">{{ 'debtCollection.field.dueDate' | translate }}</th>
                  <th scope="col" class="num">
                    {{ 'debtCollection.field.principal' | translate }}
                  </th>
                  <th scope="col" class="num">{{ 'debtCollection.field.interest' | translate }}</th>
                  <th scope="col" class="num">{{ 'debtCollection.field.days' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (line of notice.lines; track line.receivable_item_id) {
                  <tr>
                    <th scope="row">{{ line.document_number }}</th>
                    <td>{{ line.due_date }}</td>
                    <td class="num">{{ line.principal | money: notice.currency }}</td>
                    <td class="num">{{ line.interest | money: notice.currency }}</td>
                    <td class="num">{{ line.interest_days }}</td>
                  </tr>
                }
              </tbody>
            </nz-table>

            <h4 class="section-title">{{ 'debtCollection.notices.receipts' | translate }}</h4>
            @for (receipt of notice.receipts; track receipt.id) {
              <p>
                <nz-tag [nzColor]="receiptTag(receipt.kind)">{{
                  'debtCollection.receiptKind.' + receipt.kind | translate
                }}</nz-tag>
                {{ receipt.received_at }}
                @if (receipt.message_id) {
                  <span class="mono">{{ receipt.message_id }}</span>
                }
                @if (receipt.notes) {
                  <small class="muted">{{ receipt.notes }}</small>
                }
              </p>
            } @empty {
              <p class="muted">{{ 'debtCollection.notices.noReceipts' | translate }}</p>
            }

            <div class="row-actions">
              @if (canWrite && receiptAllowed(notice)) {
                <button nz-button type="button" (click)="openReceipt(notice)">
                  {{ 'debtCollection.action.registerReceipt' | translate }}
                </button>
              }
              @if (notice.channel === 'pec') {
                <button
                  nz-button
                  type="button"
                  [disabled]="store.busyId() === notice.id"
                  (click)="exportPackage(notice)"
                >
                  {{ 'debtCollection.action.exportPackage' | translate }}
                </button>
              }
            </div>
          }
        </nz-spin>
      </ng-container>
    </nz-drawer>

    <nz-modal
      [nzVisible]="receiptNotice() !== null"
      [nzTitle]="'debtCollection.receipt.title' | translate"
      [nzOkText]="'debtCollection.action.save' | translate"
      [nzCancelText]="'debtCollection.action.cancel' | translate"
      [nzOkDisabled]="!receiptValid()"
      [nzOkLoading]="saving()"
      (nzOnOk)="saveReceipt()"
      (nzOnCancel)="receiptNotice.set(null)"
    >
      <ng-container *nzModalContent>
        <div class="stack">
          <label class="field" for="dc-r-kind">
            <span>{{ 'debtCollection.receipt.kind' | translate }}</span>
            <nz-select
              nzId="dc-r-kind"
              [ngModel]="receiptKind()"
              (ngModelChange)="receiptKind.set($event)"
            >
              @for (value of lookups.lookups().receipt_kinds; track value) {
                <nz-option
                  [nzValue]="value"
                  [nzLabel]="'debtCollection.receiptKind.' + value | translate"
                />
              }
            </nz-select>
          </label>
          <label class="field" for="dc-r-msg">
            <span>{{ 'debtCollection.field.pecMessageId' | translate }}</span>
            <input
              nz-input
              id="dc-r-msg"
              maxlength="255"
              [ngModel]="receiptMessageId()"
              (ngModelChange)="receiptMessageId.set($event)"
            />
          </label>
          <label class="field" for="dc-r-at">
            <span>{{ 'debtCollection.receipt.receivedAt' | translate }}</span>
            <input
              nz-input
              id="dc-r-at"
              type="datetime-local"
              [ngModel]="receiptAt()"
              (ngModelChange)="receiptAt.set($event)"
            />
          </label>
          <label class="field" for="dc-r-notes">
            <span>{{ 'debtCollection.field.notes' | translate }}</span>
            <textarea
              nz-input
              id="dc-r-notes"
              rows="3"
              maxlength="500"
              [ngModel]="receiptNotes()"
              (ngModelChange)="receiptNotes.set($event)"
            ></textarea>
          </label>
        </div>
      </ng-container>
    </nz-modal>
  `,
})
export class DcNoticesComponent implements OnInit {
  protected readonly store = inject(NoticesStore);
  protected readonly lookups = inject(DcLookupsStore);
  private readonly feedback = inject(DcFeedback);

  protected readonly canWrite = inject(PermissionsService).canWrite(DEBT_COLLECTION_MODULE);
  protected readonly levels = DC_LEVELS;

  protected readonly receiptNotice = signal<DcNotice | null>(null);
  protected readonly receiptKind = signal<DcReceiptKind>('consegna');
  protected readonly receiptMessageId = signal('');
  protected readonly receiptAt = signal('');
  protected readonly receiptNotes = signal('');
  protected readonly saving = signal(false);

  protected readonly levelTag = levelColor;
  protected readonly statusTag = noticeStatusColor;
  protected readonly sendable = canSendNotice;
  protected readonly cancellable = canCancelNotice;
  protected readonly receiptAllowed = canRegisterReceipt;

  ngOnInit(): void {
    void this.lookups.ensureLoaded();
    void this.store.load();
  }

  protected receiptTag(kind: DcReceiptKind): string {
    return kind === 'consegna' || kind === 'accettazione' ? 'green' : 'red';
  }

  protected receiptValid(): boolean {
    return this.receiptAt() !== '';
  }

  protected setFilter(patch: Partial<DcNoticeFilters>): void {
    void this.store.setFilters(patch);
  }

  protected async pdf(notice: DcNotice): Promise<void> {
    this.feedback.report(await this.store.downloadPdf(notice));
  }

  protected async exportPackage(notice: DcNotice): Promise<void> {
    this.feedback.report(await this.store.exportPackage(notice));
  }

  protected async send(notice: DcNotice): Promise<void> {
    this.feedback.report(await this.store.send(notice.id), 'debtCollection.msg.sent');
  }

  protected async cancel(notice: DcNotice): Promise<void> {
    this.feedback.report(await this.store.cancel(notice.id), 'debtCollection.msg.cancelled');
  }

  protected openReceipt(notice: DcNotice): void {
    this.receiptKind.set('consegna');
    this.receiptMessageId.set(notice.pec_message_id ?? '');
    this.receiptAt.set(new Date().toISOString().slice(0, 16));
    this.receiptNotes.set('');
    this.receiptNotice.set(notice);
  }

  protected async saveReceipt(): Promise<void> {
    const notice = this.receiptNotice();
    if (!notice) {
      return;
    }
    this.saving.set(true);
    const messageId = this.receiptMessageId().trim();
    const notes = this.receiptNotes().trim();
    const outcome = await this.store.registerReceipt(notice.id, {
      kind: this.receiptKind(),
      received_at: new Date(this.receiptAt()).toISOString(),
      ...(messageId ? { message_id: messageId } : {}),
      ...(notes ? { notes } : {}),
    });
    this.saving.set(false);
    if (this.feedback.report(outcome, 'debtCollection.msg.receiptSaved')) {
      this.receiptNotice.set(null);
    }
  }
}
