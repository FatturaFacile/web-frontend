import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateService } from '@core';
import { TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { SelfInvoiceSetting } from '../../core/models/esterometro.model';
import { EsterometroStore } from './esterometro.store';
import { SELF_INVOICE_DOC_TYPES, docTypeColor, statusColor, urgencyColor } from './esterometro.util';
import { SelfInvoiceDetailDrawerComponent } from './self-invoice-detail-drawer.component';
import { SelfInvoiceFormModalComponent } from './self-invoice-form-modal.component';

@Component({
  selector: 'app-esterometro-workspace',
  providers: [EsterometroStore],
  styleUrl: './esterometro.scss',
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
    NzInputModule,
    NzSelectModule,
    NzStatisticModule,
    NzSwitchModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    SelfInvoiceDetailDrawerComponent,
    SelfInvoiceFormModalComponent,
  ],
  template: `
    <div class="esterometro-page">
      <div class="esterometro-header">
        <div>
          <h2 style="margin:0;">{{ 'ESTEROMETRO.TITLE' | translate }}</h2>
          <p style="margin:4px 0 0;color:#64748b;">{{ 'ESTEROMETRO.SUBTITLE' | translate }}</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button nz-button (click)="store.refreshList()">
            {{ 'ESTEROMETRO.ACTIONS.REFRESH' | translate }}
          </button>
          <button
            nz-button
            [disabled]="store.selectedCount() === 0"
            [nzLoading]="store.submitting()"
            (click)="onBatchSend()"
          >
            {{ 'ESTEROMETRO.ACTIONS.BATCH_SEND' | translate }} ({{ store.selectedCount() }})
          </button>
          <button nz-button nzType="primary" (click)="formModalVisible.set(true)">
            {{ 'ESTEROMETRO.ACTIONS.NEW_MANUAL' | translate }}
          </button>
        </div>
      </div>

      @if (store.dashboard(); as dash) {
        <nz-alert
          [nzType]="store.hasOverdue() ? 'error' : 'info'"
          nzShowIcon
          [nzMessage]="'ESTEROMETRO.DEADLINE_BANNER.TITLE' | translate"
          [nzDescription]="
            store.hasOverdue()
              ? ('ESTEROMETRO.DEADLINE_BANNER.OVERDUE_ALERT' | translate: { count: dash.counts.overdue })
              : ('ESTEROMETRO.DEADLINE_BANNER.DESC' | translate: { date: dash.next_monthly_deadline, days: dash.days_to_next_monthly_deadline })
          "
        />

        <div class="esterometro-kpi-grid">
          <nz-card nzSize="small">
            <nz-statistic [nzTitle]="'ESTEROMETRO.KPI.TOTAL' | translate" [nzValue]="dash.counts.total" />
          </nz-card>
          <nz-card nzSize="small">
            <nz-statistic
              [nzTitle]="'ESTEROMETRO.KPI.OVERDUE' | translate"
              [nzValue]="dash.counts.overdue"
              [nzValueStyle]="{ color: dash.counts.overdue > 0 ? '#dc2626' : '#0f172a' }"
            />
          </nz-card>
          <nz-card nzSize="small">
            <nz-statistic [nzTitle]="'ESTEROMETRO.KPI.DUE_SOON' | translate" [nzValue]="dash.counts.due_soon" />
          </nz-card>
          <nz-card nzSize="small">
            <nz-statistic [nzTitle]="'ESTEROMETRO.KPI.TRANSMITTED' | translate" [nzValue]="dash.counts.transmitted" />
          </nz-card>
          <nz-card nzSize="small">
            <nz-statistic
              [nzTitle]="'ESTEROMETRO.KPI.REJECTED' | translate"
              [nzValue]="dash.counts.rejected"
              [nzValueStyle]="{ color: dash.counts.rejected > 0 ? '#dc2626' : '#0f172a' }"
            />
          </nz-card>
          <nz-card nzSize="small">
            <nz-statistic [nzTitle]="'ESTEROMETRO.KPI.VAT_EUR' | translate" [nzValue]="dash.totals_eur.vat_eur" nzSuffix="EUR" />
          </nz-card>
        </div>

        <div class="esterometro-breakdown-grid">
          @for (bucket of dash.by_document_type; track bucket.document_type) {
            <nz-card nzSize="small">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <nz-tag [nzColor]="docTypeColor(bucket.document_type)">{{ bucket.document_type }}</nz-tag>
                <strong>{{ bucket.count }}</strong>
              </div>
              <div style="margin-top:6px;font-size:12px;color:#64748b;">
                {{ bucket.vat_eur | number: '1.2-2' }} EUR
              </div>
            </nz-card>
          }
        </div>
      }

      <nz-tabs>
        <nz-tab [nzTitle]="'ESTEROMETRO.TABS.WORKSPACE' | translate">
          <nz-card nzSize="small">
            <div class="esterometro-filters">
              <input
                nz-input
                style="max-width:280px;"
                [placeholder]="'ESTEROMETRO.FILTERS.SEARCH' | translate"
                [(ngModel)]="searchInput"
                (ngModelChange)="applyFilters()"
              />
              <nz-select
                style="min-width:180px;"
                nzAllowClear
                [nzPlaceHolder]="'ESTEROMETRO.FILTERS.DOC_TYPE' | translate"
                [(ngModel)]="selectedDocType"
                (ngModelChange)="applyFilters()"
              >
                @for (t of docTypes; track t) {
                  <nz-option [nzValue]="t" [nzLabel]="'ESTEROMETRO.TYPES.' + t | translate" />
                }
              </nz-select>
            </div>

            <nz-table
              [nzData]="store.selfInvoices()"
              [nzLoading]="store.loading()"
              [nzPageSize]="20"
              nzSize="small"
            >
              <thead>
                <tr>
                  <th nzWidth="40px"></th>
                  <th>{{ 'ESTEROMETRO.TABLE.NUMBER' | translate }}</th>
                  <th>{{ 'ESTEROMETRO.TABLE.TYPE' | translate }}</th>
                  <th>{{ 'ESTEROMETRO.TABLE.SUPPLIER' | translate }}</th>
                  <th>{{ 'ESTEROMETRO.TABLE.ORIGINAL_DOC' | translate }}</th>
                  <th>{{ 'ESTEROMETRO.TABLE.DEADLINE' | translate }}</th>
                  <th>{{ 'ESTEROMETRO.TABLE.TAXABLE_EUR' | translate }}</th>
                  <th>{{ 'ESTEROMETRO.TABLE.VAT_EUR' | translate }}</th>
                  <th>{{ 'ESTEROMETRO.TABLE.SDI_STATUS' | translate }}</th>
                  <th>{{ 'ESTEROMETRO.TABLE.ACTIONS' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (row of store.selfInvoices(); track row.id) {
                  <tr>
                    <td>
                      <label
                        nz-checkbox
                        [ngModel]="store.selectedIds().includes(row.id)"
                        (ngModelChange)="store.toggleSelection(row.id, $event)"
                      ></label>
                    </td>
                    <td>
                      <a (click)="openDetail(row.id)">{{ row.document_number }}</a>
                    </td>
                    <td>
                      <nz-tag [nzColor]="docTypeColor(row.document_type)">{{ row.document_type }}</nz-tag>
                    </td>
                    <td>{{ row.supplier_name }} ({{ row.supplier_country_code }})</td>
                    <td>{{ row.original_invoice_number || '-' }}</td>
                    <td>
                      <nz-tag [nzColor]="urgencyColor(row.deadline_urgency)">
                        {{ row.transmission_deadline_date }}
                      </nz-tag>
                    </td>
                    <td>{{ row.taxable_amount_eur | number: '1.2-2' }}</td>
                    <td>{{ row.vat_amount_eur | number: '1.2-2' }}</td>
                    <td>
                      <nz-tag [nzColor]="statusColor(row.sdi_status)">
                        {{ 'ESTEROMETRO.STATUS.' + row.sdi_status | translate }}
                      </nz-tag>
                    </td>
                    <td>
                      <button nz-button nzType="link" nzSize="small" (click)="openDetail(row.id)">
                        {{ 'ESTEROMETRO.DRAWER.TITLE' | translate }}
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </nz-table>
          </nz-card>
        </nz-tab>

        <nz-tab [nzTitle]="'ESTEROMETRO.TABS.RULES' | translate">
          <nz-card nzSize="small">
            <nz-table [nzData]="store.rules()" [nzFrontPagination]="false" nzSize="small">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Region</th>
                  <th>Nature</th>
                  <th>VAT %</th>
                  <th>Legal Reference</th>
                </tr>
              </thead>
              <tbody>
                @for (rule of store.rules(); track rule.id) {
                  <tr>
                    <td><code>{{ rule.code }}</code></td>
                    <td>{{ rule.name }}</td>
                    <td><nz-tag [nzColor]="docTypeColor(rule.document_type)">{{ rule.document_type }}</nz-tag></td>
                    <td>{{ rule.supplier_region }}</td>
                    <td>{{ rule.transaction_nature }}</td>
                    <td>{{ rule.default_vat_rate }}%</td>
                    <td>{{ rule.legal_reference }}</td>
                  </tr>
                }
              </tbody>
            </nz-table>
          </nz-card>
        </nz-tab>

        <nz-tab [nzTitle]="'ESTEROMETRO.TABS.SETTINGS' | translate">
          @if (settingsDraft(); as s) {
            <nz-card nzSize="small">
              <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;max-width:840px;">
                <div>
                  <label for="est-auto-mode">{{ 'ESTEROMETRO.SETTINGS.AUTO_MODE' | translate }}</label>
                  <nz-select nzId="est-auto-mode" style="width:100%;" [(ngModel)]="s.auto_generate_mode">
                    <nz-option nzValue="auto_draft" nzLabel="Auto Draft" />
                    <nz-option nzValue="auto_validate" nzLabel="Auto Validate & Reconcile" />
                    <nz-option nzValue="manual" nzLabel="Manual Only" />
                  </nz-select>
                </div>
                <div>
                  <label for="est-prefix">{{ 'ESTEROMETRO.SETTINGS.PREFIX' | translate }}</label>
                  <input id="est-prefix" nz-input [(ngModel)]="s.numbering_prefix" />
                </div>
                <div>
                  <label for="est-sales-sec">{{ 'ESTEROMETRO.SETTINGS.SALES_SECTION' | translate }}</label>
                  <input id="est-sales-sec" nz-input [(ngModel)]="s.sales_vat_section_code" />
                </div>
                <div>
                  <label for="est-purch-sec">{{ 'ESTEROMETRO.SETTINGS.PURCHASE_SECTION' | translate }}</label>
                  <input id="est-purch-sec" nz-input [(ngModel)]="s.purchase_vat_section_code" />
                </div>
                <div>
                  <label for="est-rcp-code">{{ 'ESTEROMETRO.SETTINGS.RECIPIENT_CODE' | translate }}</label>
                  <input id="est-rcp-code" nz-input maxlength="7" [(ngModel)]="s.default_recipient_code" />
                </div>
                <div>
                  <label for="est-sig">{{ 'ESTEROMETRO.SETTINGS.SIGNATURE' | translate }}</label>
                  <nz-select nzId="est-sig" style="width:100%;" [(ngModel)]="s.signature_format">
                    <nz-option nzValue="none" nzLabel="None (XML)" />
                    <nz-option nzValue="cades" nzLabel="CAdES (.p7m)" />
                    <nz-option nzValue="xades" nzLabel="XAdES" />
                  </nz-select>
                </div>
                <div style="display:flex;align-items:center;gap:8px;">
                  <nz-switch [(ngModel)]="s.auto_post_vat_registers" />
                  <span>{{ 'ESTEROMETRO.SETTINGS.AUTO_VAT' | translate }}</span>
                </div>
                <div style="display:flex;align-items:center;gap:8px;">
                  <nz-switch [(ngModel)]="s.auto_post_journal" />
                  <span>{{ 'ESTEROMETRO.SETTINGS.AUTO_JOURNAL' | translate }}</span>
                </div>
              </div>
              <div style="margin-top:16px;">
                <button nz-button nzType="primary" [nzLoading]="store.submitting()" (click)="saveSettings(s)">
                  {{ 'ESTEROMETRO.ACTIONS.SAVE' | translate }}
                </button>
              </div>
            </nz-card>
          }
        </nz-tab>
      </nz-tabs>

      <app-self-invoice-detail-drawer
        [visible]="store.selectedSelfInvoice() !== null"
        [selfInvoice]="store.selectedSelfInvoice()"
        [submitting]="store.submitting()"
        (closed)="store.clearSelected()"
        (validateRequested)="onValidate($event)"
        (sendRequested)="onSend($event)"
      />

      <app-self-invoice-form-modal
        [visible]="formModalVisible()"
        (closed)="formModalVisible.set(false)"
        (created)="store.refreshList()"
      />
    </div>
  `,
})
export class EsterometroWorkspaceComponent implements OnInit {
  protected readonly store = inject(EsterometroStore);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  protected readonly docTypes = SELF_INVOICE_DOC_TYPES;
  protected readonly docTypeColor = docTypeColor;
  protected readonly statusColor = statusColor;
  protected readonly urgencyColor = urgencyColor;

  readonly formModalVisible = signal(false);
  readonly settingsDraft = signal<SelfInvoiceSetting | null>(null);

  searchInput = '';
  selectedDocType: string | null = null;

  async ngOnInit(): Promise<void> {
    await this.store.loadAll();
    const s = this.store.settings();
    if (s) {
      this.settingsDraft.set({ ...s });
    }
  }

  applyFilters(): void {
    this.store.setFilters({
      search: this.searchInput,
      documentType: (this.selectedDocType as any) ?? null,
    });
    void this.store.refreshList();
  }

  openDetail(id: string): void {
    void this.store.selectSelfInvoice(id);
  }

  async onValidate(id: string): Promise<void> {
    const res = await this.store.validateXml(id);
    if (res) {
      this.message.success(this.translate.instant('ESTEROMETRO.MESSAGES.VALIDATED'));
      void this.store.refreshList();
    }
  }

  async onSend(id: string): Promise<void> {
    const res = await this.store.sendToSdi(id);
    if (res) {
      this.message.success(this.translate.instant('ESTEROMETRO.MESSAGES.SENT_SDI'));
      void this.store.refreshList();
    }
  }

  async onBatchSend(): Promise<void> {
    const res = await this.store.batchSendSelected();
    if (res) {
      this.message.success(this.translate.instant('ESTEROMETRO.MESSAGES.SENT_SDI'));
      void this.store.refreshList();
    }
  }

  async saveSettings(draft: SelfInvoiceSetting): Promise<void> {
    const ok = await this.store.saveSettings(draft);
    if (ok) {
      this.message.success(this.translate.instant('ESTEROMETRO.MESSAGES.SETTINGS_SAVED'));
    }
  }
}
