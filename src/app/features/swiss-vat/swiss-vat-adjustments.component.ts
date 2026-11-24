import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { InputTaxAdjustmentType, PermissionsService } from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { SwissVatStore } from './swiss-vat.store';
import { previewInputTaxAdjustment } from './swiss-vat.util';

/** LIVA Art. 30-33 Input Tax Adjustments (Autoconsumo, Degrassazione, Mixed-use, Subsidy reduction). */
@Component({
  selector: 'app-swiss-vat-adjustments',
  imports: [
    FormsModule,
    RouterLink,
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
    <app-page-header [title]="'NAV.SWISS_VAT_ADJUSTMENTS' | translate" [subtitle]="'swissVat.subtitle' | translate" />

    <div class="mb-4 flex flex-wrap gap-2">
      <a nz-button routerLink="/swiss-vat/returns">{{ 'swissVat.tab.returns' | translate }}</a>
      <a nz-button routerLink="/swiss-vat/config">{{ 'swissVat.tab.config' | translate }}</a>
      <a nz-button routerLink="/swiss-vat/bezugsteuer">{{ 'swissVat.tab.bezugsteuer' | translate }}</a>
      <a nz-button routerLink="/swiss-vat/adjustments" nzType="primary">{{ 'swissVat.tab.adjustments' | translate }}</a>
    </div>

    <nz-card>
      @if (canWrite()) {
        <div class="mb-3 flex justify-end">
          <button nz-button nzType="primary" type="button" data-testid="ch-add-adj-btn" (click)="modalOpen.set(true)">
            {{ 'swissVat.action.addAdjustment' | translate }}
          </button>
        </div>
      }

      <nz-table #adjTable [nzData]="store.adjustments()" [nzLoading]="store.loading()" [nzPageSize]="10">
        <thead>
          <tr>
            <th>Date</th>
            <th>{{ 'swissVat.field.adjustmentType' | translate }}</th>
            <th>Description</th>
            <th>{{ 'swissVat.field.afcBox' | translate }}</th>
            <th>{{ 'swissVat.field.legalBasis' | translate }}</th>
            <th>Amount CHF</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          @for (row of adjTable.data; track row.id) {
            <tr>
              <td>{{ row.effective_date }}</td>
              <td>{{ ('swissVat.adj.' + row.adjustment_type) | translate }}</td>
              <td>{{ row.description }}</td>
              <td><nz-tag nzColor="blue">{{ row.afc_box }}</nz-tag></td>
              <td>{{ row.legal_basis }}</td>
              <td><strong>{{ row.adjustment_amount_chf | money: 'CHF' }}</strong></td>
              <td><nz-tag>{{ ('swissVat.status.' + row.status) | translate }}</nz-tag></td>
              <td>
                @if (canWrite() && row.status === 'draft') {
                  <div class="flex gap-1">
                    <button nz-button nzSize="small" nzType="primary" type="button" (click)="store.approveAdjustment(row.id)">
                      {{ 'swissVat.action.approve' | translate }}
                    </button>
                    <button nz-button nzSize="small" nzDanger type="button" (click)="store.deleteAdjustment(row.id)">
                      Delete
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
      [nzTitle]="'swissVat.action.addAdjustment' | translate"
      (nzOnCancel)="modalOpen.set(false)"
      (nzOnOk)="saveAdjustment()"
    >
      <ng-container *nzModalContent>
        <div class="flex flex-col gap-3">
          <nz-select [ngModel]="adjType()" (ngModelChange)="adjType.set($event)">
            <nz-option nzValue="autoconsumo" [nzLabel]="'swissVat.adj.autoconsumo' | translate" />
            <nz-option nzValue="degrassazione" [nzLabel]="'swissVat.adj.degrassazione' | translate" />
            <nz-option nzValue="mixed_use_reduction" [nzLabel]="'swissVat.adj.mixed_use_reduction' | translate" />
            <nz-option nzValue="subsidy_reduction" [nzLabel]="'swissVat.adj.subsidy_reduction' | translate" />
          </nz-select>
          <input nz-input type="date" [ngModel]="effectiveDate()" (ngModelChange)="effectiveDate.set($event)" />
          <input nz-input placeholder="Description" [ngModel]="description()" (ngModelChange)="description.set($event)" />
          <nz-select [ngModel]="assetCategory()" (ngModelChange)="assetCategory.set($event)">
            <nz-option nzValue="movable" nzLabel="Movable Asset (20%/yr, 5 yrs)" />
            <nz-option nzValue="real_estate" nzLabel="Real Estate (5%/yr, 20 yrs)" />
            <nz-option nzValue="general" nzLabel="General" />
          </nz-select>
          <label for="swiss-vat-adjustments-ctl-1" class="flex flex-col gap-1">
            <span>Original Cost CHF</span>
            <nz-input-number nzId="swiss-vat-adjustments-ctl-1" [nzMin]="0" [ngModel]="originalCost()" (ngModelChange)="originalCost.set($event ?? 0)" />
          </label>
          <label for="swiss-vat-adjustments-ctl-2" class="flex flex-col gap-1">
            <span>Years Elapsed</span>
            <nz-input-number nzId="swiss-vat-adjustments-ctl-2" [nzMin]="0" [nzMax]="20" [ngModel]="yearsElapsed()" (ngModelChange)="yearsElapsed.set($event ?? 0)" />
          </label>
          <label for="swiss-vat-adjustments-ctl-3" class="flex flex-col gap-1">
            <span>Private / Exempt Ratio (%)</span>
            <nz-input-number nzId="swiss-vat-adjustments-ctl-3" [nzMin]="0" [nzMax]="100" [ngModel]="ratio()" (ngModelChange)="ratio.set($event ?? 100)" />
          </label>
          <div class="text-sm font-semibold">Preview: {{ computedPreview() | money: 'CHF' }}</div>
        </div>
      </ng-container>
    </nz-modal>
  `,
})
export class SwissVatAdjustmentsComponent implements OnInit {
  readonly store = inject(SwissVatStore);
  private readonly permissions = inject(PermissionsService);

  readonly modalOpen = signal(false);
  readonly adjType = signal<InputTaxAdjustmentType>('autoconsumo');
  readonly effectiveDate = signal(`${new Date().getFullYear()}-03-31`);
  readonly description = signal('');
  readonly assetCategory = signal<'movable' | 'real_estate' | 'service' | 'general'>('movable');
  readonly originalCost = signal(10000);
  readonly yearsElapsed = signal(1);
  readonly ratio = signal(100);

  readonly computedPreview = computed(() =>
    previewInputTaxAdjustment({
      type: this.adjType(),
      originalCostChf: this.originalCost(),
      originalVatRate: 8.1,
      yearsElapsed: this.yearsElapsed(),
      assetCategory: this.assetCategory(),
      privateOrExemptRatio: this.ratio(),
    }),
  );

  readonly canWrite = computed(() => this.permissions.hasAccess('swiss_vat', 'write'));

  async ngOnInit(): Promise<void> {
    await this.store.loadAdjustments();
  }

  async saveAdjustment(): Promise<void> {
    await this.store.createAdjustment({
      adjustment_type: this.adjType(),
      effective_date: this.effectiveDate(),
      asset_category: this.assetCategory(),
      description: this.description(),
      original_cost_chf: this.originalCost(),
      original_vat_rate: 8.1,
      years_elapsed: this.yearsElapsed(),
      private_or_exempt_ratio: this.ratio(),
      adjustment_amount_chf: this.computedPreview(),
    });
    this.modalOpen.set(false);
  }
}
