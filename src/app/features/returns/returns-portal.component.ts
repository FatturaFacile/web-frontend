import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  CustomerReturn,
  CustomerReturnChannel,
  ReturnEligibilityResult,
  ReturnsApiService,
  ReturnShippingLabel,
  ReturnsSource,
  ReverseLogisticsConfig,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { ReturnsLookupsService } from './returns-lookups.service';
import { apiErrorText, todayIso } from './returns.util';

/** Customer Self-Service RMA Request & Eligibility Flow (B2B/B2C) with restocking fee & barcode label. */
@Component({
  selector: 'app-returns-portal',
  styleUrl: './returns.scss',
  imports: [
    DecimalPipe,
    FormsModule,
    ReactiveFormsModule,
    PageHeaderComponent,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'RETURNS_RL.PORTAL_TITLE' | translate" [subtitle]="'RETURNS_RL.PORTAL_SUBTITLE' | translate">
      <button nz-button (click)="checkEligibility()" [disabled]="form.invalid || !hasLines()">
        {{ 'RETURNS_RL.CHECK_ELIGIBILITY' | translate }}
      </button>
      <button nz-button nzType="primary" (click)="submitRma()" [disabled]="form.invalid || !hasLines()">
        {{ 'RETURNS_RL.SUBMIT_RMA' | translate }}
      </button>
    </app-page-header>

    <nz-card class="main-card">
      <form nz-form [formGroup]="form" nzLayout="vertical">
        <div class="form-row">
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'RETURNS.CUSTOMER' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="contact_id" nzShowSearch nzServerSearch (nzOnSearch)="lookups.searchCustomers($event)">
                @for (customer of lookups.customers(); track customer.id) {
                  <nz-option [nzValue]="customer.id" [nzLabel]="customer.label"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>

          <nz-form-item>
            <nz-form-label nzRequired>{{ 'RETURNS.SOURCE_DOCUMENT' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="source_id" [nzPlaceHolder]="'RETURNS.SOURCE_HINT' | translate">
                @for (source of sources(); track source.id) {
                  <nz-option [nzValue]="source.id" [nzLabel]="source.number + ' (' + source.date + ')'"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>

          <nz-form-item>
            <nz-form-label nzRequired>{{ 'RETURNS_RL.CHANNEL' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="channel">
                @for (ch of channels; track ch) {
                  <nz-option [nzValue]="ch" [nzLabel]="('RETURNS_RL.CHANNEL_' + ch.toUpperCase()) | translate"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
        </div>

        <div class="form-row">
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'RETURNS.REASON' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="reason_code">
                @for (reason of reasons(); track reason.code) {
                  <nz-option [nzValue]="reason.code" [nzLabel]="reason.label"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>

          <nz-form-item>
            <nz-form-label nzRequired>{{ 'RETURNS.REQUESTED_ON' | translate }}</nz-form-label>
            <nz-form-control><input nz-input type="date" formControlName="requested_on" /></nz-form-control>
          </nz-form-item>

          <nz-form-item>
            <nz-form-label>{{ 'RETURNS_RL.PHOTO_EVIDENCE' | translate }}</nz-form-label>
            <nz-form-control><input nz-input formControlName="photo_urls_text" /></nz-form-control>
          </nz-form-item>
        </div>

        @if (selectedSource(); as source) {
          <h4>{{ 'RETURNS.LINES' | translate }}</h4>
          @for (line of source.lines; track line.source_item_id) {
            <div class="line-row">
              <div>
                <strong>{{ line.description }}</strong>
                <div class="muted">{{ 'RETURNS.AVAILABLE' | translate }}: {{ line.quantity_available }} / {{ line.quantity_sold }}</div>
              </div>
              <input
                #qty
                nz-input
                type="number"
                min="0"
                step="any"
                [max]="line.quantity_available"
                [value]="quantities()[line.source_item_id] ?? ''"
                (input)="setQuantity(line.source_item_id, qty.value)"
              />
            </div>
          }
        }
      </form>
    </nz-card>

    @if (eligibility(); as evalResult) {
      <nz-card class="main-card">
        <nz-alert
          [nzType]="evalResult.eligible ? 'success' : 'warning'"
          [nzMessage]="(evalResult.eligible ? 'RETURNS_RL.ELIGIBLE_YES' : 'RETURNS_RL.ELIGIBLE_NO') | translate"
          nzShowIcon
        ></nz-alert>
        <dl class="detail-grid" style="margin-top: 16px;">
          <div>
            <dt>{{ 'RETURNS_RL.DAYS_SINCE_PURCHASE' | translate }}</dt>
            <dd>{{ evalResult.days_since_purchase }}</dd>
          </div>
          <div>
            <dt>{{ 'RETURNS_RL.GROSS_AMOUNT' | translate }}</dt>
            <dd>{{ evalResult.gross_return_amount | number: '1.2-2' }}</dd>
          </div>
          <div>
            <dt>{{ 'RETURNS_RL.RESTOCKING_FEE' | translate }}</dt>
            <dd>{{ evalResult.restocking_fee_percent }}% ({{ evalResult.restocking_fee_amount | number: '1.2-2' }})</dd>
          </div>
          <div>
            <dt>{{ 'RETURNS_RL.NET_REFUNDABLE' | translate }}</dt>
            <dd><strong>{{ evalResult.net_refundable_amount | number: '1.2-2' }}</strong></dd>
          </div>
        </dl>
      </nz-card>
    }

    <nz-card class="main-card" [nzTitle]="'RETURNS.RMAS_TITLE' | translate">
      <nz-table #table [nzData]="returnsList()" [nzLoading]="loading()" nzSize="small">
        <thead>
          <tr>
            <th>{{ 'RETURNS.RMA_NUMBER' | translate }}</th>
            <th>{{ 'RETURNS_RL.BARCODE' | translate }}</th>
            <th>{{ 'RETURNS.CUSTOMER' | translate }}</th>
            <th>{{ 'RETURNS_RL.CHANNEL' | translate }}</th>
            <th>{{ 'RETURNS.STATUS' | translate }}</th>
            <th class="num">{{ 'RETURNS_RL.NET_REFUNDABLE' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <td>{{ row.rma_number }}</td>
              <td><code>{{ row.rma_barcode }}</code></td>
              <td>{{ row.customer_name }}</td>
              <td><nz-tag>{{ ('RETURNS_RL.CHANNEL_' + row.channel.toUpperCase()) | translate }}</nz-tag></td>
              <td><nz-tag>{{ ('RETURNS.STATUS_' + row.status.toUpperCase()) | translate }}</nz-tag></td>
              <td class="num">{{ row.net_refundable_amount }}</td>
              <td>
                <button nz-button nzSize="small" (click)="openLabel(row)">
                  {{ 'RETURNS_RL.PRINT_LABEL' | translate }}
                </button>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && returnsList().length === 0) {
        <nz-empty [nzNotFoundContent]="'RETURNS.NO_RMAS' | translate"></nz-empty>
      }
    </nz-card>

    <nz-modal
      [(nzVisible)]="labelModalVisible"
      [nzTitle]="'RETURNS_RL.SHIPPING_LABEL' | translate"
      (nzOnCancel)="labelModalVisible.set(false)"
      (nzOnOk)="labelModalVisible.set(false)"
    >
      <ng-container *nzModalContent>
        @if (activeLabel(); as lbl) {
          <dl class="detail-grid">
            <div><dt>{{ 'RETURNS.RMA_NUMBER' | translate }}</dt><dd><strong>{{ lbl.rma_number }}</strong></dd></div>
            <div><dt>{{ 'RETURNS_RL.BARCODE' | translate }}</dt><dd><code>{{ lbl.rma_barcode }}</code> ({{ lbl.barcode_format }})</dd></div>
            <div><dt>{{ 'RETURNS.CARRIER' | translate }}</dt><dd>{{ lbl.carrier }}</dd></div>
            <div><dt>{{ 'RETURNS.TRACKING' | translate }}</dt><dd>{{ lbl.tracking_number }}</dd></div>
          </dl>
        }
      </ng-container>
    </nz-modal>
  `,
})
export class ReturnsPortalComponent implements OnInit {
  private readonly api = inject(ReturnsApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly lookups = inject(ReturnsLookupsService);

  readonly channels: readonly CustomerReturnChannel[] = ['portal_b2b', 'portal_b2c', 'backoffice'];
  readonly config = signal<ReverseLogisticsConfig | null>(null);
  readonly sources = signal<ReturnsSource[]>([]);
  readonly quantities = signal<Record<string, string>>({});
  readonly eligibility = signal<ReturnEligibilityResult | null>(null);
  readonly returnsList = signal<CustomerReturn[]>([]);
  readonly loading = signal(false);
  readonly labelModalVisible = signal(false);
  readonly activeLabel = signal<ReturnShippingLabel | null>(null);
  private readonly sourceId = signal('');

  readonly form = this.fb.group({
    contact_id: ['', [Validators.required]],
    source_id: ['', [Validators.required]],
    channel: ['portal_b2c' as CustomerReturnChannel, [Validators.required]],
    reason_code: ['', [Validators.required]],
    requested_on: [todayIso(), [Validators.required]],
    photo_urls_text: [''],
  });

  readonly reasons = computed(() => this.config()?.reason_codes ?? []);
  readonly selectedSource = computed(() => this.sources().find((s) => s.id === this.sourceId()) ?? null);
  readonly hasLines = computed(() => this.requestedLines().length > 0);

  constructor() {
    this.form.controls.contact_id.valueChanges.subscribe((contactId) => {
      this.sources.set([]);
      this.form.controls.source_id.setValue('');
      if (contactId) {
        this.api.getSources(contactId).subscribe({
          next: (res) => this.sources.set(res.data),
        });
      }
    });
    this.form.controls.source_id.valueChanges.subscribe((id) => {
      this.sourceId.set(id);
      this.quantities.set({});
      this.eligibility.set(null);
    });
  }

  ngOnInit(): void {
    this.lookups.searchCustomers();
    this.api.getReverseLogisticsConfig().subscribe({
      next: (res) => this.config.set(res.data),
    });
    this.loadReturns();
  }

  setQuantity(sourceItemId: string, value: string): void {
    this.quantities.update((q) => ({ ...q, [sourceItemId]: value }));
  }

  loadReturns(): void {
    this.loading.set(true);
    this.api.getCustomerReturns({ per_page: 50 }).subscribe({
      next: (res) => {
        this.returnsList.set(res.data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  checkEligibility(): void {
    const source = this.selectedSource();
    if (!source) {
      return;
    }
    const val = this.form.getRawValue();
    this.api.checkEligibility({
      contact_id: val.contact_id,
      invoice_id: source.type === 'invoice' ? source.id : null,
      reason_code: val.reason_code,
      requested_on: val.requested_on,
      lines: this.requestedLines(),
    }).subscribe({
      next: (res) => this.eligibility.set(res.data),
      error: (err: unknown) => this.message.error(apiErrorText(err) ?? this.translate.instant('RETURNS.ACTION_ERROR')),
    });
  }

  submitRma(): void {
    const source = this.selectedSource();
    if (!source) {
      return;
    }
    const val = this.form.getRawValue();
    const photos = val.photo_urls_text.split(',').map((u) => u.trim()).filter((u) => u !== '');
    this.api.createCustomerReturn({
      contact_id: val.contact_id,
      invoice_id: source.type === 'invoice' ? source.id : null,
      sales_order_id: source.type === 'sales_order' ? source.id : null,
      reason_code: val.reason_code,
      channel: val.channel,
      requested_on: val.requested_on,
      photo_urls: photos,
      lines: this.requestedLines(),
    }).subscribe({
      next: (res) => {
        this.message.success(this.translate.instant('RETURNS_RL.RMA_CREATED'));
        this.returnsList.update((list) => [res.data, ...list]);
        this.openLabel(res.data);
      },
      error: (err: unknown) => this.message.error(apiErrorText(err) ?? this.translate.instant('RETURNS.ACTION_ERROR')),
    });
  }

  openLabel(record: CustomerReturn): void {
    this.api.getReturnLabel(record.id).subscribe({
      next: (res) => {
        this.activeLabel.set(res.data);
        this.labelModalVisible.set(true);
      },
    });
  }

  private requestedLines() {
    const source = this.selectedSource();
    if (!source) {
      return [];
    }
    const lines: { invoice_item_id?: string | null; product_id?: string | null; quantity: number }[] = [];
    for (const line of source.lines) {
      const qty = Number(this.quantities()[line.source_item_id] ?? 0);
      if (qty > 0) {
        lines.push({
          invoice_item_id: source.type === 'invoice' ? line.source_item_id : null,
          product_id: line.product_id,
          quantity: qty,
        });
      }
    }
    return lines;
  }
}
