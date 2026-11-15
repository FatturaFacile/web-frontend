import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import {
  GeneralLedgerApiService,
  GlFiscalYear,
  I18nService,
  PermissionsService,
  SiiBookType,
  VatCodePack,
  VatCodePackCountry,
} from '@core';
import { TranslatePipe } from '@shared';
import {
  currentYearEnd,
  currentYearStart,
  downloadBlob,
  rangeEndsBeforeStart,
} from '../shared/gl-dates';

/** VAT code packs (France, Spain, Germany), the French FEC export and the Spanish SII VAT books. */
@Component({
  selector: 'app-gl-localization-packs',
  styleUrl: './gl-localization.scss',
  imports: [
    FormsModule,
    NzButtonModule,
    NzCardModule,
    NzInputModule,
    NzSelectModule,
    NzTableModule,
    TranslatePipe,
  ],
  template: `
    <nz-card
      class="section"
      [nzTitle]="'GL.LOC_VAT_PACKS' | translate"
      [nzLoading]="loadingPacks()"
    >
      <p>{{ 'GL.LOC_VAT_PACKS_HINT' | translate }}</p>
      <nz-table nzSize="small" [nzData]="packs()" [nzShowPagination]="false">
        <thead>
          <tr>
            <th>{{ 'GL.LOC_COUNTRY' | translate }}</th>
            <th>{{ 'GL.LOC_PACK_NAME' | translate }}</th>
            <th class="num">{{ 'GL.LOC_PACK_CODES' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (pack of packs(); track pack.country) {
            <tr>
              <td>{{ pack.country }}</td>
              <td>{{ pack.name }}</td>
              <td class="num">{{ pack.codes }}</td>
              <td>
                @if (canWrite) {
                  <button
                    nz-button
                    nzSize="small"
                    type="button"
                    [nzLoading]="importing() === pack.country"
                    (click)="importPack(pack.country)"
                  >
                    {{ 'GL.LOC_IMPORT' | translate }}
                  </button>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    <nz-card class="section" [nzTitle]="'GL.LOC_FEC' | translate">
      <p>{{ 'GL.LOC_FEC_HINT' | translate }}</p>
      <div class="filters">
        <nz-select
          class="select-sm"
          [attr.aria-label]="'GL.LOC_FISCAL_YEAR' | translate"
          [(ngModel)]="fiscalYearId"
          [nzPlaceHolder]="'GL.LOC_FISCAL_YEAR' | translate"
        >
          @for (year of fiscalYears(); track year.id) {
            <nz-option [nzValue]="year.id" [nzLabel]="year.year_code" />
          }
        </nz-select>
        <button
          nz-button
          nzType="primary"
          type="button"
          [disabled]="!fiscalYearId"
          [nzLoading]="exportingFec()"
          (click)="exportFec()"
        >
          {{ 'GL.LOC_EXPORT_FEC' | translate }}
        </button>
      </div>
    </nz-card>

    <nz-card class="section" [nzTitle]="'GL.LOC_SII' | translate">
      <p>{{ 'GL.LOC_SII_HINT' | translate }}</p>
      <div class="filters">
        <nz-select
          class="select-sm"
          [attr.aria-label]="'GL.VAT_REGISTER_TYPE' | translate"
          [(ngModel)]="siiType"
        >
          <nz-option nzValue="sales" [nzLabel]="'GL.LOC_SII_SALES' | translate" />
          <nz-option nzValue="purchases" [nzLabel]="'GL.LOC_SII_PURCHASES' | translate" />
        </nz-select>
        <label for="sii-from">{{ 'GL.FROM' | translate }}</label>
        <input class="date-input" id="sii-from" nz-input type="date" [(ngModel)]="siiFrom" />
        <label for="sii-to">{{ 'GL.TO' | translate }}</label>
        <input class="date-input" id="sii-to" nz-input type="date" [(ngModel)]="siiTo" />
        <button
          nz-button
          nzType="primary"
          type="button"
          [disabled]="siiRangeInvalid()"
          [nzLoading]="exportingSii()"
          (click)="exportSii()"
        >
          {{ 'GL.LOC_EXPORT_SII' | translate }}
        </button>
        @if (siiRangeInvalid()) {
          <span class="ant-form-item-explain-error" role="alert">{{
            'COMMON.VALIDATION.END_AFTER_START' | translate
          }}</span>
        }
      </div>
    </nz-card>
  `,
})
export class GlLocalizationPacksComponent implements OnInit {
  private readonly api = inject(GeneralLedgerApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  protected readonly canWrite = inject(PermissionsService).canWrite('ledger');

  protected readonly packs = signal<VatCodePack[]>([]);
  protected readonly fiscalYears = signal<GlFiscalYear[]>([]);
  protected readonly loadingPacks = signal(false);
  protected readonly importing = signal<VatCodePackCountry | null>(null);
  protected readonly exportingFec = signal(false);
  protected readonly exportingSii = signal(false);

  protected fiscalYearId: string | null = null;
  protected siiType: SiiBookType = 'sales';
  protected siiFrom = currentYearStart();
  protected siiTo = currentYearEnd();

  ngOnInit(): void {
    this.loadingPacks.set(true);
    this.api.getVatCodePacks().subscribe({
      next: (res) => {
        this.packs.set(res.data);
        this.loadingPacks.set(false);
      },
      error: () => this.loadingPacks.set(false),
    });
    this.api
      .getFiscalYears({ per_page: 100 })
      .subscribe({ next: (res) => this.fiscalYears.set(res.data) });
  }

  protected siiRangeInvalid(): boolean {
    return rangeEndsBeforeStart(this.siiFrom, this.siiTo);
  }

  protected importPack(country: VatCodePackCountry): void {
    this.importing.set(country);
    this.api.importVatCodePack(country).subscribe({
      next: (res) => {
        this.importing.set(null);
        this.message.success(
          this.i18n.translate('GL.LOC_IMPORT_DONE', {
            created: res.data.created,
            updated: res.data.updated,
          }),
        );
      },
      error: () => this.importing.set(null),
    });
  }

  protected exportFec(): void {
    if (!this.fiscalYearId) {
      return;
    }
    const year = this.fiscalYears().find((item) => item.id === this.fiscalYearId);
    this.exportingFec.set(true);
    this.api.exportFec({ fiscal_year_id: this.fiscalYearId }).subscribe({
      next: (blob) => {
        this.exportingFec.set(false);
        downloadBlob(blob, `fec-${year?.year_code ?? this.fiscalYearId}.txt`);
      },
      error: () => this.exportingFec.set(false),
    });
  }

  protected exportSii(): void {
    if (this.siiRangeInvalid()) {
      return;
    }
    this.exportingSii.set(true);
    this.api.exportSiiVatBook(this.siiType, { from: this.siiFrom, to: this.siiTo }).subscribe({
      next: (blob) => {
        this.exportingSii.set(false);
        downloadBlob(blob, `sii-${this.siiType}-${this.siiFrom}-${this.siiTo}.csv`);
      },
      error: () => this.exportingSii.set(false),
    });
  }
}
