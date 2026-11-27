import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateService } from '@core';
import { TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { firstValueFrom } from 'rxjs';
import { EsterometroApiService } from '../../core/api/esterometro-api.service';
import {
  ClassificationPreviewResult,
  SelfInvoice,
  SelfInvoiceDocumentType,
} from '../../core/models/esterometro.model';
import { SELF_INVOICE_DOC_TYPES } from './esterometro.util';

@Component({
  selector: 'app-self-invoice-form-modal',
  imports: [
    FormsModule,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzSelectModule,
  ],
  template: `
    <nz-modal
      [nzVisible]="visible()"
      [nzTitle]="'ESTEROMETRO.FORM.TITLE' | translate"
      [nzOkText]="'ESTEROMETRO.ACTIONS.SAVE' | translate"
      [nzCancelText]="'ESTEROMETRO.ACTIONS.CANCEL' | translate"
      [nzOkLoading]="saving()"
      [nzWidth]="680"
      (nzOnCancel)="closed.emit()"
      (nzOnOk)="submit()"
    >
      <ng-container *nzModalContent>
        <div style="display:flex;flex-direction:column;gap:12px;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div>
              <label for="si-doc-type">{{ 'ESTEROMETRO.FORM.DOCUMENT_TYPE' | translate }}</label>
              <nz-select
                nzId="si-doc-type"
                style="width:100%;"
                [(ngModel)]="documentType"
                (ngModelChange)="runPreview()"
              >
                @for (t of docTypes; track t) {
                  <nz-option [nzValue]="t" [nzLabel]="'ESTEROMETRO.TYPES.' + t | translate" />
                }
              </nz-select>
            </div>
            <div>
              <label for="si-integration-date">{{ 'ESTEROMETRO.FORM.INTEGRATION_DATE' | translate }}</label>
              <input id="si-integration-date" nz-input type="date" [(ngModel)]="integrationDate" />
            </div>
          </div>

          <div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:12px;">
            <div>
              <label for="si-supplier-name">{{ 'ESTEROMETRO.FORM.SUPPLIER_NAME' | translate }}</label>
              <input id="si-supplier-name" nz-input [(ngModel)]="supplierName" />
            </div>
            <div>
              <label for="si-supplier-country">{{ 'ESTEROMETRO.FORM.SUPPLIER_COUNTRY' | translate }}</label>
              <input
                id="si-supplier-country"
                nz-input
                maxlength="2"
                [(ngModel)]="supplierCountry"
                (ngModelChange)="runPreview()"
              />
            </div>
            <div>
              <label for="si-supplier-vat">{{ 'ESTEROMETRO.FORM.SUPPLIER_VAT' | translate }}</label>
              <input id="si-supplier-vat" nz-input [(ngModel)]="supplierVat" />
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
            <div>
              <label for="si-orig-num">{{ 'ESTEROMETRO.FORM.ORIGINAL_NUMBER' | translate }}</label>
              <input id="si-orig-num" nz-input [(ngModel)]="originalNumber" />
            </div>
            <div>
              <label for="si-orig-date">{{ 'ESTEROMETRO.FORM.ORIGINAL_DATE' | translate }}</label>
              <input id="si-orig-date" nz-input type="date" [(ngModel)]="originalDate" />
            </div>
            <div>
              <label for="si-currency">{{ 'ESTEROMETRO.FORM.CURRENCY' | translate }}</label>
              <input id="si-currency" nz-input maxlength="3" [(ngModel)]="originalCurrency" />
            </div>
          </div>

          @if (documentType === 'TD20') {
            <div>
              <label for="si-reg-trigger">{{ 'ESTEROMETRO.FORM.REGULARIZATION_TRIGGER' | translate }}</label>
              <nz-select nzId="si-reg-trigger" style="width:100%;" [(ngModel)]="regularizationTrigger">
                <nz-option nzValue="omitted_4_months" nzLabel="Omessa fattura oltre 4 mesi" />
                <nz-option nzValue="irregular_30_days" nzLabel="Fattura irregolare entro 30 giorni" />
                <nz-option nzValue="manual" nzLabel="Regolarizzazione manuale" />
              </nz-select>
            </div>
          }

          @if (previewResult(); as prev) {
            @for (warn of prev.compliance_warnings; track warn.code) {
              <nz-alert nzType="warning" nzShowIcon [nzMessage]="warn.message" />
            }
          }

          <div>
            <label for="si-line-desc">{{ 'ESTEROMETRO.FORM.LINE_DESCRIPTION' | translate }}</label>
            <input id="si-line-desc" nz-input [(ngModel)]="lineDescription" />
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
            <div>
              <label for="si-taxable">{{ 'ESTEROMETRO.FORM.TAXABLE_ORIGINAL' | translate }}</label>
              <nz-input-number
                nzId="si-taxable"
                style="width:100%;"
                [nzMin]="0"
                [(ngModel)]="taxableOriginal"
              />
            </div>
            <div>
              <label for="si-vat-rate">{{ 'ESTEROMETRO.FORM.VAT_RATE' | translate }}</label>
              <nz-input-number
                nzId="si-vat-rate"
                style="width:100%;"
                [nzMin]="0"
                [nzMax]="100"
                [(ngModel)]="vatRate"
              />
            </div>
            <div>
              <label for="si-deduct">{{ 'ESTEROMETRO.FORM.DEDUCTIBILITY' | translate }}</label>
              <nz-input-number
                nzId="si-deduct"
                style="width:100%;"
                [nzMin]="0"
                [nzMax]="100"
                [(ngModel)]="deductibility"
              />
            </div>
          </div>
        </div>
      </ng-container>
    </nz-modal>
  `,
})
export class SelfInvoiceFormModalComponent {
  private readonly api = inject(EsterometroApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly visible = input<boolean>(false);
  readonly closed = output<void>();
  readonly created = output<SelfInvoice>();

  protected readonly docTypes = SELF_INVOICE_DOC_TYPES;
  readonly saving = signal(false);
  readonly previewResult = signal<ClassificationPreviewResult | null>(null);

  documentType: SelfInvoiceDocumentType = 'TD17';
  integrationDate = new Date().toISOString().slice(0, 10);
  supplierName = '';
  supplierCountry = 'DE';
  supplierVat = '';
  originalNumber = '';
  originalDate = new Date().toISOString().slice(0, 10);
  originalCurrency = 'EUR';
  regularizationTrigger: string | null = null;
  lineDescription = '';
  taxableOriginal = 0;
  vatRate = 22;
  deductibility = 100;

  async runPreview(): Promise<void> {
    if (!this.supplierCountry || this.supplierCountry.length !== 2) return;
    try {
      const res = await firstValueFrom(
        this.api.classifyPreview({
          supplier_country_code: this.supplierCountry.toUpperCase(),
          override_document_type: this.documentType,
          regularization_trigger: this.documentType === 'TD20' ? (this.regularizationTrigger ?? 'manual') : null,
        }),
      );
      this.previewResult.set(res.data);
    } catch {
      this.previewResult.set(null);
    }
  }

  async submit(): Promise<void> {
    if (!this.supplierName.trim() || !this.lineDescription.trim()) {
      return;
    }
    this.saving.set(true);
    try {
      const res = await firstValueFrom(
        this.api.createSelfInvoice({
          document_type: this.documentType,
          integration_date: this.integrationDate,
          supplier_country_code: this.supplierCountry.toUpperCase(),
          supplier_name: this.supplierName.trim(),
          supplier_vat_number: this.supplierVat || null,
          original_invoice_number: this.originalNumber || null,
          original_invoice_date: this.originalDate || null,
          original_currency: this.originalCurrency.toUpperCase() || 'EUR',
          regularization_trigger: this.documentType === 'TD20' ? (this.regularizationTrigger ?? 'manual') : null,
          validate_and_reconcile: true,
          lines: [
            {
              description: this.lineDescription.trim(),
              quantity: 1,
              unit_price_original: this.taxableOriginal,
              taxable_amount_original: this.taxableOriginal,
              vat_rate: this.vatRate,
              deductibility_percent: this.deductibility,
            },
          ],
        }),
      );
      this.message.success(this.translate.instant('ESTEROMETRO.MESSAGES.CREATED'));
      this.created.emit(res.data);
      this.closed.emit();
    } catch (err: unknown) {
      this.message.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      this.saving.set(false);
    }
  }
}
