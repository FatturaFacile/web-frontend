import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { BezugsteuerCategory, PermissionsService } from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { SwissVatStore } from './swiss-vat.store';
import { BEZUGSTEUER_STATUS_COLORS } from './swiss-vat.util';

/** Swiss Bezugsteuer (acquisition tax on cross-border foreign services, Box 382/383). */
@Component({
  selector: 'app-swiss-vat-bezugsteuer',
  imports: [
    FormsModule,
    RouterLink,
    NzBadgeModule,
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
    <app-page-header [title]="'NAV.SWISS_VAT_BEZUGSTEUER' | translate" [subtitle]="'swissVat.subtitle' | translate" />

    <div class="mb-4 flex flex-wrap gap-2">
      <a nz-button routerLink="/swiss-vat/returns">{{ 'swissVat.tab.returns' | translate }}</a>
      <a nz-button routerLink="/swiss-vat/config">{{ 'swissVat.tab.config' | translate }}</a>
      <a nz-button routerLink="/swiss-vat/bezugsteuer" nzType="primary">
        {{ 'swissVat.tab.bezugsteuer' | translate }}
        @if (store.pendingBezugsteuerCount() > 0) {
          <nz-badge class="ml-1" [nzCount]="store.pendingBezugsteuerCount()" />
        }
      </a>
      <a nz-button routerLink="/swiss-vat/adjustments">{{ 'swissVat.tab.adjustments' | translate }}</a>
    </div>

    <nz-card class="mb-4">
      <div class="flex flex-wrap items-end gap-3">
        <label class="flex flex-col gap-1">
          <span>From</span>
          <input nz-input type="date" [ngModel]="scanFrom()" (ngModelChange)="scanFrom.set($event)" />
        </label>
        <label class="flex flex-col gap-1">
          <span>To</span>
          <input nz-input type="date" [ngModel]="scanTo()" (ngModelChange)="scanTo.set($event)" />
        </label>
        @if (canWrite()) {
          <button
            nz-button
            nzType="primary"
            type="button"
            data-testid="ch-detect-bez-btn"
            [nzLoading]="store.saving()"
            (click)="detect()"
          >
            {{ 'swissVat.action.detectBezugsteuer' | translate }}
          </button>
          <button nz-button type="button" (click)="modalOpen.set(true)">
            {{ 'swissVat.action.addBezugsteuer' | translate }}
          </button>
        }
      </div>
    </nz-card>

    <nz-card>
      <nz-table #bezTable [nzData]="store.bezugsteuer()" [nzLoading]="store.loading()" [nzPageSize]="10">
        <thead>
          <tr>
            <th>Date</th>
            <th>{{ 'swissVat.field.supplier' | translate }}</th>
            <th>{{ 'swissVat.field.country' | translate }}</th>
            <th>{{ 'swissVat.field.serviceCategory' | translate }}</th>
            <th>{{ 'swissVat.field.netChf' | translate }}</th>
            <th>{{ 'swissVat.field.taxChf' | translate }}</th>
            <th>{{ 'swissVat.field.afcBox' | translate }}</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          @for (row of bezTable.data; track row.id) {
            <tr>
              <td>{{ row.invoice_date }}</td>
              <td>
                <strong>{{ row.supplier_name }}</strong>
                <div class="text-xs opacity-70">{{ row.description }}</div>
              </td>
              <td><nz-tag>{{ row.supplier_country }}</nz-tag></td>
              <td>{{ row.service_category }}</td>
              <td>{{ row.net_amount_chf | money: 'CHF' }}</td>
              <td>{{ row.tax_amount_chf | money: 'CHF' }} ({{ row.vat_rate_percent }}%)</td>
              <td><nz-tag nzColor="blue">{{ row.afc_box }}</nz-tag></td>
              <td>
                <nz-tag [nzColor]="statusColors[row.status]">
                  {{ ('swissVat.status.' + row.status) | translate }}
                </nz-tag>
              </td>
              <td>
                @if (canWrite() && row.status === 'detected') {
                  <div class="flex gap-1">
                    <button nz-button nzSize="small" nzType="primary" type="button" (click)="store.confirmBezugsteuer(row.id)">
                      {{ 'swissVat.action.confirm' | translate }}
                    </button>
                    <button nz-button nzSize="small" type="button" (click)="store.excludeBezugsteuer(row.id)">
                      {{ 'swissVat.action.exclude' | translate }}
                    </button>
                  </div>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    <nz-modal
      [nzVisible]="modalOpen()"
      [nzTitle]="'swissVat.action.addBezugsteuer' | translate"
      (nzOnCancel)="modalOpen.set(false)"
      (nzOnOk)="createManual()"
    >
      <ng-container *nzModalContent>
        <div class="flex flex-col gap-3">
          <input nz-input placeholder="Supplier Name (e.g. AWS EMEA SARL)" [ngModel]="supplierName()" (ngModelChange)="supplierName.set($event)" />
          <input nz-input placeholder="Country ISO (e.g. DE, US, IE)" maxlength="2" [ngModel]="supplierCountry()" (ngModelChange)="supplierCountry.set($event)" />
          <input nz-input type="date" [ngModel]="invoiceDate()" (ngModelChange)="invoiceDate.set($event)" />
          <nz-select [ngModel]="category()" (ngModelChange)="category.set($event)">
            <nz-option nzValue="software_cloud" nzLabel="Software / Cloud SaaS" />
            <nz-option nzValue="consulting" nzLabel="Consulting & Advisory" />
            <nz-option nzValue="it_services" nzLabel="IT Services" />
            <nz-option nzValue="marketing" nzLabel="Marketing & Ads" />
            <nz-option nzValue="royalties" nzLabel="Royalties & Licenses" />
            <nz-option nzValue="other_cross_border_service" nzLabel="Other Cross-Border Service" />
          </nz-select>
          <input nz-input placeholder="Description" [ngModel]="description()" (ngModelChange)="description.set($event)" />
          <nz-input-number [nzMin]="0.01" [nzStep]="100" [ngModel]="amount()" (ngModelChange)="amount.set($event ?? 0)" />
        </div>
      </ng-container>
    </nz-modal>
  `,
})
export class SwissVatBezugsteuerComponent implements OnInit {
  readonly store = inject(SwissVatStore);
  private readonly message = inject(NzMessageService);
  private readonly permissions = inject(PermissionsService);

  readonly statusColors = BEZUGSTEUER_STATUS_COLORS;
  readonly scanFrom = signal(`${new Date().getFullYear()}-01-01`);
  readonly scanTo = signal(`${new Date().getFullYear()}-03-31`);

  readonly modalOpen = signal(false);
  readonly supplierName = signal('');
  readonly supplierCountry = signal('DE');
  readonly invoiceDate = signal(`${new Date().getFullYear()}-02-01`);
  readonly category = signal<BezugsteuerCategory>('software_cloud');
  readonly description = signal('');
  readonly amount = signal(1000);

  readonly canWrite = computed(() => this.permissions.hasAccess('swiss_vat', 'write'));

  async ngOnInit(): Promise<void> {
    await this.store.loadBezugsteuer();
  }

  async detect(): Promise<void> {
    const found = await this.store.detectBezugsteuer(this.scanFrom(), this.scanTo());
    this.message.info(`${found.length} detected`);
  }

  async createManual(): Promise<void> {
    await this.store.createBezugsteuer({
      supplier_name: this.supplierName(),
      supplier_country: this.supplierCountry().toUpperCase(),
      invoice_date: this.invoiceDate(),
      service_category: this.category(),
      description: this.description(),
      original_net_amount: this.amount(),
      currency: 'CHF',
    });
    this.modalOpen.set(false);
  }
}
