import { CommonModule } from '@angular/common';
import { Component, inject, input, output } from '@angular/core';
import { TranslateService } from '@core';
import { TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTimelineModule } from 'ng-zorro-antd/timeline';
import { firstValueFrom } from 'rxjs';
import { EsterometroApiService } from '../../core/api/esterometro-api.service';
import { SelfInvoice } from '../../core/models/esterometro.model';
import { docTypeColor, statusColor, urgencyColor } from './esterometro.util';

@Component({
  selector: 'app-self-invoice-detail-drawer',
  imports: [
    CommonModule,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzDescriptionsModule,
    NzDividerModule,
    NzDrawerModule,
    NzTableModule,
    NzTagModule,
    NzTimelineModule,
  ],
  template: `
    <nz-drawer
      [nzVisible]="visible()"
      [nzTitle]="('ESTEROMETRO.DRAWER.TITLE' | translate) + (selfInvoice()?.document_number ? ' — ' + selfInvoice()!.document_number : '')"
      [nzWidth]="760"
      (nzOnClose)="closed.emit()"
    >
      <ng-container *nzDrawerContent>
        @if (selfInvoice(); as si) {
          <div style="display:flex;flex-direction:column;gap:16px;">
            <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;">
              <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <nz-tag [nzColor]="docTypeColor(si.document_type)">{{ si.document_type }}</nz-tag>
                <nz-tag [nzColor]="statusColor(si.sdi_status)">
                  {{ 'ESTEROMETRO.STATUS.' + si.sdi_status | translate }}
                </nz-tag>
                <nz-tag [nzColor]="urgencyColor(si.deadline_urgency)">
                  {{ 'ESTEROMETRO.URGENCY.' + si.deadline_urgency | translate }} ({{ si.transmission_deadline_date }})
                </nz-tag>
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <button
                  nz-button
                  nzSize="small"
                  [nzLoading]="submitting()"
                  (click)="validateRequested.emit(si.id)"
                >
                  {{ 'ESTEROMETRO.ACTIONS.VALIDATE_XML' | translate }}
                </button>
                <button
                  nz-button
                  nzType="primary"
                  nzSize="small"
                  [nzLoading]="submitting()"
                  [disabled]="si.sdi_status === 'SENT_TO_SDI' || si.sdi_status === 'DELIVERED_RC'"
                  (click)="sendRequested.emit(si.id)"
                >
                  {{
                    (si.sdi_status === 'REJECTED_NS'
                      ? 'ESTEROMETRO.ACTIONS.RETRANSMIT_SDI'
                      : 'ESTEROMETRO.ACTIONS.SEND_SDI'
                    ) | translate
                  }}
                </button>
                @if (si.xml_content) {
                  <button nz-button nzSize="small" (click)="downloadXml(si)">
                    {{ 'ESTEROMETRO.ACTIONS.DOWNLOAD_XML' | translate }}
                  </button>
                }
              </div>
            </div>

            @if (si.sdi_status === 'REJECTED_NS' && si.rejection_description) {
              <nz-alert
                nzType="error"
                nzShowIcon
                [nzMessage]="('ESTEROMETRO.DRAWER.REJECTION_ALERT' | translate) + (si.rejection_code ? ' [' + si.rejection_code + ']' : '')"
                [nzDescription]="si.rejection_description"
              />
            }

            @for (warn of si.compliance_warnings; track warn.code) {
              <nz-alert nzType="warning" nzShowIcon [nzMessage]="warn.message" />
            }

            <nz-card nzSize="small" [nzTitle]="'ESTEROMETRO.DRAWER.ROLE_INVERSION' | translate">
              <div class="esterometro-role-grid">
                <div>
                  <strong>{{ 'ESTEROMETRO.DRAWER.CEDENTE' | translate }}</strong>
                  <p style="margin:4px 0 0;">{{ si.supplier_name }}</p>
                  <small>{{ si.supplier_country_code }} · {{ si.supplier_vat_number || si.supplier_fiscal_code || 'N/D' }}</small>
                </div>
                <div>
                  <strong>{{ 'ESTEROMETRO.DRAWER.CESSIONARIO' | translate }}</strong>
                  <p style="margin:4px 0 0;">SoggettoEmittente: <code>{{ si.soggetto_emittente }}</code></p>
                  <small>CodiceDestinatario: <code>{{ si.recipient_code }}</code></small>
                </div>
              </div>
            </nz-card>

            <nz-descriptions nzBordered nzSize="small" [nzColumn]="2">
              <nz-descriptions-item [nzTitle]="'ESTEROMETRO.TABLE.ORIGINAL_DOC' | translate">
                {{ si.original_invoice_number || '-' }} ({{ si.original_invoice_date || '-' }})
              </nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'ESTEROMETRO.TABLE.INTEGRATION_DATE' | translate">
                {{ si.integration_date }}
              </nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'ESTEROMETRO.FORM.CURRENCY' | translate">
                {{ si.original_currency }} (FX: {{ si.exchange_rate }})
              </nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'ESTEROMETRO.TABLE.TAXABLE_EUR' | translate">
                {{ si.taxable_amount_eur | number: '1.2-2' }} EUR
              </nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'ESTEROMETRO.TABLE.VAT_EUR' | translate">
                {{ si.vat_amount_eur | number: '1.2-2' }} EUR
              </nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'ESTEROMETRO.FORM.DEDUCTIBILITY' | translate">
                {{ si.deductible_vat_eur | number: '1.2-2' }} EUR / {{ si.non_deductible_vat_eur | number: '1.2-2' }} EUR
              </nz-descriptions-item>
            </nz-descriptions>

            <nz-card nzSize="small" [nzTitle]="'ESTEROMETRO.DRAWER.DUAL_VAT' | translate">
              <nz-descriptions nzSize="small" [nzColumn]="1">
                <nz-descriptions-item [nzTitle]="'ESTEROMETRO.DRAWER.SALES_REGISTER' | translate">
                  {{ si.sales_vat_entry_id || '—' }}
                </nz-descriptions-item>
                <nz-descriptions-item [nzTitle]="'ESTEROMETRO.DRAWER.PURCHASES_REGISTER' | translate">
                  {{ si.purchase_vat_entry_id || '—' }}
                </nz-descriptions-item>
                <nz-descriptions-item [nzTitle]="'ESTEROMETRO.DRAWER.JOURNAL_ENTRY' | translate">
                  {{ si.journal_entry_id || '—' }}
                </nz-descriptions-item>
              </nz-descriptions>
            </nz-card>

            @if (si.sdi_logs?.length) {
              <nz-card nzSize="small" [nzTitle]="'ESTEROMETRO.DRAWER.SDI_TIMELINE' | translate">
                <nz-timeline>
                  @for (log of si.sdi_logs; track log.id) {
                    <nz-timeline-item [nzColor]="log.error_code ? 'red' : 'blue'">
                      <strong>{{ log.event_type }}</strong>
                      @if (log.to_status) {
                        <span> → {{ log.to_status }}</span>
                      }
                      @if (log.sdi_identificativo) {
                        <span> (SDI: {{ log.sdi_identificativo }})</span>
                      }
                      @if (log.error_description) {
                        <div style="color:#dc2626;">{{ log.error_code }}: {{ log.error_description }}</div>
                      }
                      <div><small>{{ log.created_at }}</small></div>
                    </nz-timeline-item>
                  }
                </nz-timeline>
              </nz-card>
            }

            @if (si.xml_content) {
              <nz-card nzSize="small" [nzTitle]="'ESTEROMETRO.DRAWER.XML_INSPECTOR' | translate">
                <pre class="esterometro-xml-pre">{{ si.xml_content }}</pre>
              </nz-card>
            }
          </div>
        }
      </ng-container>
    </nz-drawer>
  `,
})
export class SelfInvoiceDetailDrawerComponent {
  private readonly api = inject(EsterometroApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly visible = input<boolean>(false);
  readonly selfInvoice = input<SelfInvoice | null>(null);
  readonly submitting = input<boolean>(false);

  readonly closed = output<void>();
  readonly validateRequested = output<string>();
  readonly sendRequested = output<string>();

  protected readonly docTypeColor = docTypeColor;
  protected readonly statusColor = statusColor;
  protected readonly urgencyColor = urgencyColor;

  async downloadXml(si: SelfInvoice): Promise<void> {
    try {
      const blob = await firstValueFrom(this.api.downloadXml(si.id));
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = si.sdi_filename ?? `${si.document_number}.xml`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      this.message.error(this.translate.instant('ESTEROMETRO.ERRORS.DOWNLOAD_FAILED'));
    }
  }
}
