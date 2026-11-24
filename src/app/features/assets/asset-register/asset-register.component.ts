import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AssetLedgerType,
  AssetRegisterCategorySubtotal,
  AssetRegisterComplianceHeader,
  AssetRegisterRow,
  AssetRegisterTotals,
  AuthStore,
  EamOpsApiService,
  I18nService,
} from '@core';
import { downloadBlob, MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';

@Component({
  selector: 'app-asset-register',
  styleUrl: './asset-register.component.scss',
  imports: [
    RouterLink,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzDescriptionsModule,
    NzDividerModule,
    NzIconModule,
    NzInputNumberModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
    MoneyPipe,
  ],
  templateUrl: './asset-register.component.html',
})
export class AssetRegisterComponent implements OnInit {
  private readonly opsApi = inject(EamOpsApiService);
  private readonly i18n = inject(I18nService, { optional: true });
  protected readonly authStore = inject(AuthStore);

  readonly year = signal(new Date().getFullYear());
  readonly ledgerType = signal<AssetLedgerType>('statutory');
  readonly jurisdiction = signal<'CH' | 'IT'>('CH');

  readonly loading = signal(false);
  readonly exportingPdf = signal(false);
  readonly exportingCsv = signal(false);

  readonly totalAssets = signal(0);
  readonly rows = signal<AssetRegisterRow[]>([]);
  readonly complianceHeader = signal<AssetRegisterComplianceHeader | null>(null);
  readonly categorySubtotals = signal<AssetRegisterCategorySubtotal[]>([]);
  readonly totals = signal<AssetRegisterTotals | null>(null);

  readonly currency = computed(() => this.authStore.activeCurrency() || 'CHF');

  ngOnInit(): void {
    const initialJurisdiction: 'CH' | 'IT' = this.currency() === 'EUR' ? 'IT' : 'CH';
    this.jurisdiction.set(initialJurisdiction);
    this.loadRegister();
  }

  label(key: string): string {
    return this.i18n?.translate(key) ?? key;
  }

  loadRegister(): void {
    this.loading.set(true);
    this.opsApi
      .getAssetRegister({
        year: this.year(),
        ledger_type: this.ledgerType(),
        jurisdiction: this.jurisdiction(),
        per_page: 200,
      })
      .subscribe({
        next: (res) => {
          this.rows.set(res.data || []);
          this.totalAssets.set(res.meta?.total ?? res.data?.length ?? 0);
          this.complianceHeader.set(res.meta?.compliance_header ?? null);
          this.categorySubtotals.set(res.meta?.category_subtotals ?? []);
          this.totals.set(res.meta?.totals ?? null);
          this.loading.set(false);
        },
        error: () => {
          this.rows.set([]);
          this.loading.set(false);
        },
      });
  }

  downloadPdf(): void {
    this.exportingPdf.set(true);
    const locale = this.i18n?.dictionaryLocale?.() ?? this.i18n?.currentLanguage?.() ?? 'en';
    this.opsApi
      .exportAssetRegisterPdf({
        year: this.year(),
        ledger_type: this.ledgerType(),
        jurisdiction: this.jurisdiction(),
        locale,
      })
      .subscribe({
        next: (blob) => {
          downloadBlob(blob, `libro-cespiti-${this.year()}-${this.ledgerType()}-${this.jurisdiction()}.pdf`);
          this.exportingPdf.set(false);
        },
        error: () => {
          this.exportingPdf.set(false);
        },
      });
  }

  downloadCsv(): void {
    this.exportingCsv.set(true);
    this.opsApi
      .exportAssetRegister({
        year: this.year(),
        ledger_type: this.ledgerType(),
        jurisdiction: this.jurisdiction(),
      })
      .subscribe({
        next: (blob) => {
          downloadBlob(blob, `asset-register-${this.year()}-${this.ledgerType()}-${this.jurisdiction()}.csv`);
          this.exportingCsv.set(false);
        },
        error: () => {
          this.exportingCsv.set(false);
        },
      });
  }

  printRegister(): void {
    window.print();
  }
}
