import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AuthStore, I18nService, ItalianVatApiService, LipeCommunication } from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { downloadBlob } from '../general-ledger/shared/gl-dates';
import { reportProblem } from './italian-vat-feedback';
import { ItalianVatStore } from './italian-vat.store';
import {
  currentYear,
  LIPE_STATUS_COLORS,
  lipeActions,
  LipeActions,
  validTransmissionProtocol,
} from './italian-vat.util';

type LipeDialog = 'sign' | 'transmit' | 'reject';

/** Quarterly LIPE: generation, XSD and Erario c/IVA checks, digital signature, status flow and XML download. */
@Component({
  selector: 'app-italian-vat-lipe',
  styleUrl: '../general-ledger/localization/gl-localization.scss',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    MoneyPipe,
    PageHeaderComponent,
    TranslatePipe,
  ],
  template: `
    <app-page-header [title]="'PAGE_TITLE.ITALIAN_VAT_LIPE' | translate" />
    <nz-card>
      <div class="filters">
        <div class="field">
          <span>{{ 'GL.VAT_YEAR' | translate }}</span>
          <nz-input-number
            data-testid="lipe-year"
            [nzMin]="2017"
            [nzMax]="2100"
            [ngModel]="year()"
            (ngModelChange)="year.set($event ?? year())"
          />
        </div>
        <button
          nz-button
          type="button"
          data-testid="lipe-load"
          [nzLoading]="store.loading()"
          (click)="load()"
        >
          {{ 'GL.RUN_REPORT' | translate }}
        </button>
        <div class="field">
          <span>{{ 'italianVat.lipe.quarter' | translate }}</span>
          <nz-select
            class="select-sm"
            data-testid="lipe-quarter"
            [ngModel]="quarter()"
            (ngModelChange)="quarter.set($event)"
          >
            @for (q of quarters; track q) {
              <nz-option [nzValue]="q" [nzLabel]="'Q' + q" />
            }
          </nz-select>
        </div>
        <button
          nz-button
          nzType="primary"
          type="button"
          data-testid="lipe-generate"
          [nzLoading]="store.saving()"
          (click)="generate()"
        >
          {{ 'italianVat.lipe.generate' | translate }}
        </button>
      </div>

      @for (lipe of store.lipe(); track lipe.id) {
        <nz-card
          nzType="inner"
          [nzTitle]="lipe.year + ' Q' + lipe.quarter + ' - ' + lipe.file_name"
          [attr.data-testid]="'lipe-' + lipe.id"
        >
          <div class="filters">
            <nz-tag [nzColor]="statusColor(lipe)" [attr.data-testid]="'status-' + lipe.id">{{
              'italianVat.lipe.status.' + lipe.status | translate
            }}</nz-tag>
            <nz-tag
              [nzColor]="
                lipe.signature_status === 'signed'
                  ? 'green'
                  : lipe.signature_status === 'invalid'
                    ? 'red'
                    : 'default'
              "
              [attr.data-testid]="'signature-' + lipe.id"
            >
              {{ 'italianVat.ui.signature_' + lipe.signature_status | translate }}
            </nz-tag>
            @if (lipe.transmission_protocol) {
              <span
                >{{ 'italianVat.ui.transmissionProtocol' | translate }}:
                {{ lipe.transmission_protocol }}</span
              >
            }
          </div>

          @if (lipe.xsd_errors.length > 0) {
            <nz-alert
              nzType="error"
              nzShowIcon
              [attr.data-testid]="'xsd-' + lipe.id"
              [nzMessage]="'italianVat.ui.xsdInvalid' | translate"
              [nzDescription]="lipe.xsd_errors.join('; ')"
            />
          } @else {
            <nz-alert
              nzType="success"
              nzShowIcon
              [attr.data-testid]="'xsd-' + lipe.id"
              [nzMessage]="'italianVat.ui.xsdValid' | translate"
            />
          }
          @if (lipe.rejection_reason) {
            <nz-alert nzType="warning" nzShowIcon [nzMessage]="lipe.rejection_reason" />
          }

          <p data-testid="totals">
            {{ 'italianVat.ui.outputVat' | translate }}:
            {{ lipe.totals.output_vat | money: currency() }} -
            {{ 'italianVat.ui.inputVat' | translate }}:
            {{ lipe.totals.input_vat | money: currency() }} -
            {{ 'italianVat.ui.balance' | translate }}:
            <strong>{{ lipe.totals.balance | money: currency() }}</strong>
          </p>

          @if (lipe.reconciliation; as reconciliation) {
            <nz-alert
              [attr.data-testid]="'erario-' + lipe.id"
              [nzType]="reconciliation.status === 'balanced' ? 'success' : 'warning'"
              nzShowIcon
              [nzMessage]="'italianVat.lipe.reconciliation.' + reconciliation.status | translate"
              [nzDescription]="
                ('italianVat.ui.difference' | translate) + ': ' + reconciliation.total_difference
              "
            />
            <nz-table nzSize="small" [nzData]="reconciliation.rows" [nzShowPagination]="false">
              <thead>
                <tr>
                  <th>{{ 'italianVat.ui.period' | translate }}</th>
                  <th nzAlign="right">{{ 'italianVat.ui.expected' | translate }}</th>
                  <th nzAlign="right">{{ 'italianVat.ui.ledger' | translate }}</th>
                  <th nzAlign="right">{{ 'italianVat.ui.difference' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (row of reconciliation.rows; track row.settlement_id) {
                  <tr>
                    <td>{{ row.period }}</td>
                    <td nzAlign="right">{{ row.expected | money: currency() }}</td>
                    <td nzAlign="right">{{ row.ledger | money: currency() }}</td>
                    <td nzAlign="right">{{ row.difference | money: currency() }}</td>
                  </tr>
                }
              </tbody>
            </nz-table>
          }

          @let actions = actionsOf(lipe);
          <div class="filters">
            <button
              nz-button
              type="button"
              [disabled]="!actions.reconcile"
              [attr.data-testid]="'reconcile-' + lipe.id"
              (click)="reconcile(lipe)"
            >
              {{ 'italianVat.lipe.reconcile' | translate }}
            </button>
            <button
              nz-button
              type="button"
              [disabled]="!actions.sign"
              [attr.data-testid]="'sign-' + lipe.id"
              (click)="openDialog('sign', lipe)"
            >
              {{ 'italianVat.lipe.sign' | translate }}
            </button>
            <button
              nz-button
              type="button"
              [disabled]="!actions.markReady"
              [attr.data-testid]="'ready-' + lipe.id"
              (click)="markReady(lipe)"
            >
              {{ 'italianVat.lipe.markReady' | translate }}
            </button>
            <button
              nz-button
              type="button"
              [disabled]="!actions.transmit"
              [attr.data-testid]="'transmit-' + lipe.id"
              (click)="openDialog('transmit', lipe)"
            >
              {{ 'italianVat.ui.recordTransmission' | translate }}
            </button>
            <button
              nz-button
              nzDanger
              type="button"
              [disabled]="!actions.reject"
              (click)="openDialog('reject', lipe)"
            >
              {{ 'italianVat.ui.recordRejection' | translate }}
            </button>
            <button
              nz-button
              type="button"
              [disabled]="!actions.download"
              [attr.data-testid]="'download-' + lipe.id"
              (click)="download(lipe)"
            >
              {{ 'italianVat.lipe.download' | translate }}
            </button>
          </div>
        </nz-card>
      }
    </nz-card>

    <nz-modal
      [nzVisible]="dialog() !== null"
      [nzTitle]="dialogTitle() | translate"
      [nzOkLoading]="store.saving()"
      [nzOkDisabled]="!dialogValid()"
      (nzOnOk)="confirmDialog()"
      (nzOnCancel)="dialog.set(null)"
    >
      <ng-container *nzModalContent>
        @switch (dialog()) {
          @case ('sign') {
            <label for="iv-sig">{{ 'italianVat.ui.signatureValue' | translate }}</label>
            <textarea
              id="iv-sig"
              nz-input
              rows="3"
              [ngModel]="signature()"
              (ngModelChange)="signature.set($event)"
            ></textarea>
            <label for="iv-cert">{{ 'italianVat.ui.certificate' | translate }}</label>
            <textarea
              id="iv-cert"
              nz-input
              rows="3"
              [ngModel]="certificate()"
              (ngModelChange)="certificate.set($event)"
            ></textarea>
          }
          @case ('transmit') {
            <label for="iv-protocol">{{ 'italianVat.ui.transmissionProtocol' | translate }}</label>
            <input
              id="iv-protocol"
              nz-input
              placeholder="12345678901234567-000001"
              [ngModel]="protocol()"
              (ngModelChange)="protocol.set($event)"
            />
            @if (protocol() !== '' && !protocolValid()) {
              <div class="ant-form-item-explain-error" role="alert" data-testid="protocol-issue">
                {{ 'italianVat.ui.protocolFormat' | translate }}
              </div>
            }
          }
          @case ('reject') {
            <label for="iv-reason">{{ 'italianVat.ui.rejectionReason' | translate }}</label>
            <textarea
              id="iv-reason"
              nz-input
              rows="3"
              maxlength="1000"
              [ngModel]="reason()"
              (ngModelChange)="reason.set($event)"
            ></textarea>
          }
        }
      </ng-container>
    </nz-modal>
  `,
})
export class ItalianVatLipeComponent implements OnInit {
  protected readonly store = inject(ItalianVatStore);
  private readonly api = inject(ItalianVatApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  protected readonly currency = inject(AuthStore).activeCurrency;

  protected readonly quarters = [1, 2, 3, 4];
  protected readonly year = signal(currentYear());
  protected readonly quarter = signal(Math.ceil((new Date().getMonth() + 1) / 3));

  protected readonly dialog = signal<LipeDialog | null>(null);
  private readonly target = signal<LipeCommunication | null>(null);
  protected readonly signature = signal('');
  protected readonly certificate = signal('');
  protected readonly protocol = signal('');
  protected readonly reason = signal('');
  protected readonly protocolValid = computed(() => validTransmissionProtocol(this.protocol()));
  protected readonly dialogTitle = computed(
    () => `italianVat.ui.dialog_${this.dialog() ?? 'sign'}`,
  );
  protected readonly dialogValid = computed(() => {
    switch (this.dialog()) {
      case 'sign':
        return this.signature().trim() !== '' && this.certificate().trim() !== '';
      case 'transmit':
        return this.protocolValid();
      case 'reject':
        return this.reason().trim() !== '';
      default:
        return false;
    }
  });

  ngOnInit(): void {
    void this.load();
  }

  protected load(): Promise<void> {
    return this.store.loadLipe(this.year());
  }

  protected statusColor(lipe: LipeCommunication): string {
    return LIPE_STATUS_COLORS[lipe.status];
  }

  protected actionsOf(lipe: LipeCommunication): LipeActions {
    return lipeActions(lipe);
  }

  protected async generate(): Promise<void> {
    if (await this.store.generateLipe(this.year(), this.quarter())) {
      this.message.success(this.i18n.translate('italianVat.ui.lipeGenerated'));
    } else {
      reportProblem(this.store.error(), this.i18n, this.message);
    }
  }

  protected async reconcile(lipe: LipeCommunication): Promise<void> {
    if (!(await this.store.reconcileLipe(lipe.id))) {
      reportProblem(this.store.error(), this.i18n, this.message);
    }
  }

  protected async markReady(lipe: LipeCommunication): Promise<void> {
    if (!(await this.store.markLipeReady(lipe.id))) {
      reportProblem(this.store.error(), this.i18n, this.message);
    }
  }

  protected download(lipe: LipeCommunication): void {
    this.api.downloadLipeXml(lipe.id).subscribe((blob) => downloadBlob(blob, lipe.file_name));
  }

  protected openDialog(dialog: LipeDialog, lipe: LipeCommunication): void {
    this.target.set(lipe);
    this.signature.set('');
    this.certificate.set('');
    this.protocol.set('');
    this.reason.set('');
    this.dialog.set(dialog);
  }

  protected async confirmDialog(): Promise<void> {
    const lipe = this.target();
    const dialog = this.dialog();
    if (!lipe || !dialog || !this.dialogValid()) {
      return;
    }
    const done =
      dialog === 'sign'
        ? await this.store.signLipe(lipe.id, this.signature().trim(), this.certificate().trim())
        : dialog === 'transmit'
          ? await this.store.recordLipeTransmission(lipe.id, this.protocol().trim())
          : await this.store.recordLipeRejection(lipe.id, this.reason().trim());
    if (done) {
      this.dialog.set(null);
    } else {
      reportProblem(this.store.error(), this.i18n, this.message);
    }
  }
}
