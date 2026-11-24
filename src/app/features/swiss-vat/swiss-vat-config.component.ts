import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  I18nService,
  PermissionsService,
  SwissVatConsiderationBasis,
  SwissVatExemptionType,
  SwissVatFrequency,
  SwissVatMethod,
  SwissVatRateType,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { SwissVatStore } from './swiss-vat.store';
import { isValidSwissUidMwst } from './swiss-vat.util';

/** Swiss VAT regime configuration (Effective vs Saldosteuersatz) & effective-dated tax codes (8.1%, 2.6%, 3.8%, 0%). */
@Component({
  selector: 'app-swiss-vat-config',
  imports: [
    FormsModule,
    RouterLink,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzSelectModule,
    NzSwitchModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  template: `
    <app-page-header [title]="'NAV.SWISS_VAT_CONFIG' | translate" [subtitle]="'swissVat.subtitle' | translate" />

    <div class="mb-4 flex flex-wrap gap-2">
      <a nz-button routerLink="/swiss-vat/returns">{{ 'swissVat.tab.returns' | translate }}</a>
      <a nz-button routerLink="/swiss-vat/config" nzType="primary">{{ 'swissVat.tab.config' | translate }}</a>
      <a nz-button routerLink="/swiss-vat/bezugsteuer">{{ 'swissVat.tab.bezugsteuer' | translate }}</a>
      <a nz-button routerLink="/swiss-vat/adjustments">{{ 'swissVat.tab.adjustments' | translate }}</a>
    </div>

    <nz-card [nzTitle]="'swissVat.tab.config' | translate" class="mb-4">
      <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
        <label class="flex flex-col gap-1">
          <span>{{ 'swissVat.field.uidMwst' | translate }}</span>
          <input
            nz-input
            data-testid="ch-uid-input"
            placeholder="CHE-116.281.710 MWST"
            [ngModel]="uidMwst()"
            (ngModelChange)="uidMwst.set($event)"
          />
          @if (uidMwst() && !uidValid()) {
            <span class="text-xs text-red-500">CHE-XXX.XXX.XXX MWST (Mod-11)</span>
          }
        </label>

        <label for="swiss-vat-config-ctl-1" class="flex flex-col gap-1">
          <span>{{ 'swissVat.field.method' | translate }}</span>
          <nz-select nzId="swiss-vat-config-ctl-1" [ngModel]="method()" (ngModelChange)="onMethodChange($event)">
            <nz-option nzValue="effective" [nzLabel]="'swissVat.method.effective' | translate" />
            <nz-option nzValue="saldosteuersatz" [nzLabel]="'swissVat.method.saldosteuersatz' | translate" />
          </nz-select>
        </label>

        <label for="swiss-vat-config-ctl-2" class="flex flex-col gap-1">
          <span>{{ 'swissVat.field.basis' | translate }}</span>
          <nz-select nzId="swiss-vat-config-ctl-2" [ngModel]="basis()" (ngModelChange)="basis.set($event)">
            <nz-option nzValue="agreed" [nzLabel]="'swissVat.basis.agreed' | translate" />
            <nz-option nzValue="received" [nzLabel]="'swissVat.basis.received' | translate" />
          </nz-select>
        </label>

        <label for="swiss-vat-config-ctl-3" class="flex flex-col gap-1">
          <span>{{ 'swissVat.field.frequency' | translate }}</span>
          <nz-select nzId="swiss-vat-config-ctl-3" [ngModel]="frequency()" (ngModelChange)="frequency.set($event)">
            <nz-option nzValue="quarterly" [nzLabel]="'swissVat.freq.quarterly' | translate" />
            <nz-option nzValue="semiannual" [nzLabel]="'swissVat.freq.semiannual' | translate" />
            <nz-option nzValue="monthly" [nzLabel]="'swissVat.freq.monthly' | translate" />
          </nz-select>
        </label>

        <label for="swiss-vat-config-ctl-4" class="flex flex-col gap-1">
          <span>{{ 'swissVat.field.rounding' | translate }}</span>
          <nz-select nzId="swiss-vat-config-ctl-4" [ngModel]="roundingMode()" (ngModelChange)="roundingMode.set($event)">
            <nz-option nzValue="chf_005" nzLabel="0.05 CHF (Commercial)" />
            <nz-option nzValue="standard_001" nzLabel="0.01 CHF" />
          </nz-select>
        </label>

        <label for="swiss-vat-config-ctl-5" class="flex items-center gap-2 pt-6">
          <nz-switch nzId="swiss-vat-config-ctl-5" [ngModel]="autoDetectBezugsteuer()" (ngModelChange)="autoDetectBezugsteuer.set($event)" />
          <span>{{ 'swissVat.action.detectBezugsteuer' | translate }}</span>
        </label>
      </div>

      @if (method() === 'saldosteuersatz') {
        <div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <label for="swiss-vat-config-ctl-6" class="flex flex-col gap-1">
            <span>{{ 'swissVat.field.sssPrimary' | translate }}</span>
            <nz-select nzId="swiss-vat-config-ctl-6" [ngModel]="sssRatePrimary()" (ngModelChange)="sssRatePrimary.set($event)">
              @for (s of store.sssSectors(); track s.sector_code) {
                <nz-option [nzValue]="s.rate_percent" [nzLabel]="s.label" />
              }
            </nz-select>
          </label>
          <label for="swiss-vat-config-ctl-7" class="flex flex-col gap-1">
            <span>{{ 'swissVat.field.sssSecondary' | translate }}</span>
            <nz-select nzId="swiss-vat-config-ctl-7" nzAllowClear [ngModel]="sssRateSecondary()" (ngModelChange)="sssRateSecondary.set($event)">
              @for (s of store.sssSectors(); track s.sector_code) {
                <nz-option [nzValue]="s.rate_percent" [nzLabel]="s.label" />
              }
            </nz-select>
          </label>
        </div>
      }

      @if (canWrite()) {
        <div class="mt-4">
          <button
            nz-button
            nzType="primary"
            type="button"
            data-testid="ch-save-config-btn"
            [nzLoading]="store.saving()"
            (click)="saveConfig()"
          >
            {{ 'swissVat.action.saveConfig' | translate }}
          </button>
        </div>
      }
    </nz-card>

    <nz-card [nzTitle]="'Swiss VAT Rates & Tax Codes (8.1% / 2.6% / 3.8% / 0%)'">
      @if (canWrite()) {
        <div class="mb-3 flex justify-end">
          <button nz-button type="button" (click)="codeModalOpen.set(true)">+ Tax Code</button>
        </div>
      }

      <nz-table #codeTable [nzData]="store.taxCodes()" [nzLoading]="store.loading()" [nzPageSize]="12">
        <thead>
          <tr>
            <th>Code</th>
            <th>Name</th>
            <th>Rate %</th>
            <th>{{ 'swissVat.field.afcBox' | translate }}</th>
            <th>Exemption</th>
            <th>Effective</th>
            <th>Scope</th>
          </tr>
        </thead>
        <tbody>
          @for (c of codeTable.data; track c.id) {
            <tr>
              <td><strong>{{ c.code }}</strong></td>
              <td>{{ c.name }}</td>
              <td>{{ c.rate_percent }}%</td>
              <td><nz-tag>{{ c.afc_box }}</nz-tag></td>
              <td>{{ c.exemption_type }}</td>
              <td>{{ c.effective_from }} → {{ c.effective_to ?? '∞' }}</td>
              <td>
                <nz-tag [nzColor]="c.is_global ? 'blue' : 'purple'">
                  {{ c.is_global ? 'ESTV Statutory' : 'Custom' }}
                </nz-tag>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    <nz-modal
      [nzVisible]="codeModalOpen()"
      nzTitle="New Swiss VAT Tax Code"
      (nzOnCancel)="codeModalOpen.set(false)"
      (nzOnOk)="createTaxCode()"
    >
      <ng-container *nzModalContent>
        <div class="flex flex-col gap-3">
          <input nz-input placeholder="Code (e.g. CH_CUSTOM_81)" [ngModel]="newCode()" (ngModelChange)="newCode.set($event)" />
          <input nz-input placeholder="Name" [ngModel]="newName()" (ngModelChange)="newName.set($event)" />
          <nz-select [ngModel]="newRateType()" (ngModelChange)="newRateType.set($event)">
            <nz-option nzValue="standard" nzLabel="Standard (8.1%)" />
            <nz-option nzValue="reduced" nzLabel="Reduced (2.6%)" />
            <nz-option nzValue="accommodation" nzLabel="Accommodation (3.8%)" />
            <nz-option nzValue="zero_exempt" nzLabel="Zero / Exempt (0.0%)" />
            <nz-option nzValue="bezugsteuer" nzLabel="Bezugsteuer" />
          </nz-select>
          <nz-select [ngModel]="newExemption()" (ngModelChange)="newExemption.set($event)">
            <nz-option nzValue="none" nzLabel="Taxable (none)" />
            <nz-option nzValue="exempt_with_deduction" nzLabel="Exempt WITH input tax deduction (Art. 23)" />
            <nz-option nzValue="exempt_without_deduction" nzLabel="Exempt WITHOUT input tax deduction (Art. 21)" />
            <nz-option nzValue="out_of_scope" nzLabel="Out of scope (Art. 18(2))" />
          </nz-select>
          <nz-input-number [nzMin]="0" [nzMax]="100" [nzStep]="0.1" [ngModel]="newRatePercent()" (ngModelChange)="newRatePercent.set($event ?? 0)" />
          <input nz-input placeholder="AFC Box (e.g. 303, 220, 230)" [ngModel]="newAfcBox()" (ngModelChange)="newAfcBox.set($event)" />
        </div>
      </ng-container>
    </nz-modal>
  `,
})
export class SwissVatConfigComponent implements OnInit {
  readonly store = inject(SwissVatStore);
  private readonly message = inject(NzMessageService);
  private readonly permissions = inject(PermissionsService);
  private readonly i18n = inject(I18nService);

  readonly uidMwst = signal('');
  readonly method = signal<SwissVatMethod>('effective');
  readonly basis = signal<SwissVatConsiderationBasis>('agreed');
  readonly frequency = signal<SwissVatFrequency>('quarterly');
  readonly roundingMode = signal<'chf_005' | 'standard_001'>('chf_005');
  readonly autoDetectBezugsteuer = signal(true);
  readonly sssRatePrimary = signal<string | null>('6.20');
  readonly sssRateSecondary = signal<string | null>(null);

  readonly codeModalOpen = signal(false);
  readonly newCode = signal('');
  readonly newName = signal('');
  readonly newRateType = signal<SwissVatRateType>('standard');
  readonly newExemption = signal<SwissVatExemptionType>('none');
  readonly newRatePercent = signal(8.1);
  readonly newAfcBox = signal('303');

  readonly uidValid = computed(() => !this.uidMwst() || isValidSwissUidMwst(this.uidMwst()));
  readonly canWrite = computed(() => this.permissions.hasAccess('swiss_vat', 'write'));

  async ngOnInit(): Promise<void> {
    await this.store.loadConfigAndCatalog();
    const cfg = this.store.config();
    if (cfg) {
      this.uidMwst.set(cfg.uid_mwst ?? '');
      this.method.set(cfg.accounting_method);
      this.basis.set(cfg.consideration_basis);
      this.frequency.set(cfg.reporting_frequency);
      this.roundingMode.set(cfg.rounding_mode);
      this.autoDetectBezugsteuer.set(cfg.auto_detect_bezugsteuer);
      this.sssRatePrimary.set(cfg.sss_rate_primary ?? '6.20');
      this.sssRateSecondary.set(cfg.sss_rate_secondary);
    }
  }

  onMethodChange(m: SwissVatMethod): void {
    this.method.set(m);
    if (m === 'saldosteuersatz') {
      this.frequency.set('semiannual');
    }
  }

  async saveConfig(): Promise<void> {
    await this.store.saveConfig({
      uid_mwst: this.uidMwst() || null,
      accounting_method: this.method(),
      consideration_basis: this.basis(),
      reporting_frequency: this.frequency(),
      rounding_mode: this.roundingMode(),
      auto_detect_bezugsteuer: this.autoDetectBezugsteuer(),
      sss_rate_primary: this.method() === 'saldosteuersatz' ? this.sssRatePrimary() : null,
      sss_rate_secondary: this.method() === 'saldosteuersatz' ? this.sssRateSecondary() : null,
    });
    this.message.success(this.i18n.translate('swissVat.action.saveConfig'));
  }

  async createTaxCode(): Promise<void> {
    await this.store.createTaxCode({
      code: this.newCode(),
      name: this.newName(),
      rate_type: this.newRateType(),
      exemption_type: this.newExemption(),
      rate_percent: this.newRatePercent(),
      afc_box: this.newAfcBox(),
      effective_from: '2024-01-01',
    });
    this.codeModalOpen.set(false);
  }
}
