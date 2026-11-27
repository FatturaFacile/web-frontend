import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { GC_DOSAGE_UNITS, GcDosageUnit, GcTreatmentFilters, GcTreatmentPayload, PermissionsService, TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { GreenCareCrewStore, GreenCareLookupStore, GreenCareReferenceStore, GreenCareTreatmentsStore } from './green-care.stores';
import {
  GREEN_CARE_MODULE,
  dosageUnitKey,
  isReEntryActive,
  isoDay,
  licenseState,
  reEntryUntil,
  saveBlob,
} from './green-care.util';

interface TreatmentForm {
  site_id: string | null;
  treatment_date: Date | null;
  operator_id: string | null;
  target_pest_or_weed: string;
  treated_crop_or_surface: string;
  treated_area_sqm: number | null;
  commercial_product_name: string;
  registration_number: string;
  active_ingredient: string;
  dosage_used: number | null;
  dosage_unit: GcDosageUnit;
  water_volume_liters: number | null;
  warehouse_product_id: string | null;
  warehouse_id: string | null;
  re_entry_interval_hours: number | null;
  weather_conditions_at_application: string;
  notes: string;
}

const EMPTY_FORM: TreatmentForm = {
  site_id: null,
  treatment_date: null,
  operator_id: null,
  target_pest_or_weed: '',
  treated_crop_or_surface: '',
  treated_area_sqm: null,
  commercial_product_name: '',
  registration_number: '',
  active_ingredient: '',
  dosage_used: null,
  dosage_unit: 'ml/hl',
  water_volume_liters: null,
  warehouse_product_id: null,
  warehouse_id: null,
  re_entry_interval_hours: null,
  weather_conditions_at_application: '',
  notes: '',
};

/**
 * Phytosanitary treatment diary ("Quaderno di Campagna / Registro Fitosanitari"): the immutable treatment log, the creation drawer
 * with the live check of the operator's licence on the treatment date (PER / PNRP / OPF in CH, Patentino PAN in IT), the
 * registration number hint (UFAG/BLW or Ministero della Salute), the re-entry interval indicator and the inspection PDF export.
 */
@Component({
  selector: 'app-green-care-treatments',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzDatePickerModule,
    NzDrawerModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  providers: [GreenCareTreatmentsStore],
  styleUrl: './green-care.scss',
  template: `
    <app-page-header
      [title]="'PAGE_TITLE.GREEN_CARE_TREATMENTS' | translate"
      [subtitle]="'greenCare.section.treatmentsSubtitle' | translate"
    ></app-page-header>

    @if (store.error(); as error) {
      <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="error | translate"></nz-alert>
    }

    <div class="toolbar">
      <label class="field" for="gc-t-range">
        <span>{{ 'greenCare.filter.period' | translate }}</span>
        <nz-range-picker id="gc-t-range" name="range" [(ngModel)]="range" (ngModelChange)="reload()"></nz-range-picker>
      </label>
      <label class="field" for="gc-t-site">
        <span>{{ 'greenCare.field.site' | translate }}</span>
        <nz-select nzId="gc-t-site" nzAllowClear nzShowSearch [(ngModel)]="siteFilter" (ngModelChange)="reload()">
          @for (option of lookup.sites(); track option.id) {
            <nz-option [nzValue]="option.id" [nzLabel]="option.label"></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="gc-t-operator">
        <span>{{ 'greenCare.field.operator' | translate }}</span>
        <nz-select nzId="gc-t-operator" nzAllowClear [(ngModel)]="operatorFilter" (ngModelChange)="reload()">
          @for (operator of operators(); track operator.id) {
            <nz-option [nzValue]="operator.id" [nzLabel]="operator.name"></nz-option>
          }
        </nz-select>
      </label>
      <span class="spacer"></span>
      <button nz-button type="button" data-test="export-pdf" [nzLoading]="store.exporting()" (click)="exportPdf()">
        {{ 'greenCare.action.exportInspectionPdf' | translate }}
      </button>
      @if (canWrite) {
        <button nz-button nzType="primary" type="button" data-test="add-treatment" (click)="openForm()">
          {{ 'greenCare.action.newTreatment' | translate }}
        </button>
      }
    </div>

    <nz-table #treatments nzSize="small" [nzData]="store.treatments()" [nzLoading]="store.loading()" [nzShowPagination]="false" [nzScroll]="{ x: '1400px' }">
      <thead>
        <tr>
          <th>{{ 'greenCare.field.treatmentDate' | translate }}</th>
          <th>{{ 'greenCare.field.site' | translate }}</th>
          <th>{{ 'greenCare.field.product' | translate }}</th>
          <th>{{ 'greenCare.field.registrationNumber' | translate }}</th>
          <th>{{ 'greenCare.field.target' | translate }}</th>
          <th>{{ 'greenCare.field.dosage' | translate }}</th>
          <th>{{ 'greenCare.field.operator' | translate }}</th>
          <th>{{ 'greenCare.field.reEntry' | translate }}</th>
        </tr>
      </thead>
      <tbody>
        @for (row of treatments.data; track row.id) {
          <tr [attr.data-test]="'treatment-' + row.id">
            <td>{{ row.treatment_date | date: 'mediumDate' }}</td>
            <td>{{ row.site_name }}</td>
            <td>
              {{ row.commercial_product_name }}
              <div class="hint">{{ row.active_ingredient }}</div>
            </td>
            <td>{{ row.registration_number }}</td>
            <td>{{ row.target_pest_or_weed }} · {{ row.treated_crop_or_surface }}</td>
            <td>{{ row.dosage_used | number: '1.0-3' }} {{ 'greenCare.enum.dosageUnit.' + dosageKey(row.dosage_unit) | translate }}</td>
            <td>
              {{ row.operator_name }}
              @if (row.operator_license_type) {
                <nz-tag>{{ 'greenCare.enum.licenseType.' + row.operator_license_type | translate }}</nz-tag>
              }
            </td>
            <td>
              @if (row.re_entry_interval_hours) {
                <nz-tag [nzColor]="reEntryActive(row.treatment_date, row.re_entry_interval_hours) ? 'red' : 'green'">
                  {{ row.re_entry_interval_hours }} h
                </nz-tag>
              } @else {
                <span class="muted">-</span>
              }
            </td>
          </tr>
        }
      </tbody>
    </nz-table>

    <nz-drawer
      [nzVisible]="formOpen()"
      [nzWidth]="720"
      [nzTitle]="'greenCare.action.newTreatment' | translate"
      (nzOnClose)="closeForm()"
    >
      <ng-container *nzDrawerContent>
        @if (formError(); as error) {
          <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="error | translate: formErrorParams()"></nz-alert>
        }
        <div class="form-grid">
          <label class="field" for="gc-tf-site">
            <span>{{ 'greenCare.field.site' | translate }} *</span>
            <nz-select nzId="gc-tf-site" nzShowSearch [(ngModel)]="form.site_id" (ngModelChange)="revalidate()">
              @for (option of lookup.sites(); track option.id) {
                <nz-option [nzValue]="option.id" [nzLabel]="option.label"></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="gc-tf-date">
            <span>{{ 'greenCare.field.treatmentDate' | translate }} *</span>
            <nz-date-picker nzId="gc-tf-date" name="treatment_date" [(ngModel)]="form.treatment_date" (ngModelChange)="revalidate()"></nz-date-picker>
          </label>
          <label class="field" for="gc-tf-operator">
            <span>{{ 'greenCare.field.operator' | translate }} *</span>
            <nz-select nzId="gc-tf-operator" [(ngModel)]="form.operator_id" (ngModelChange)="revalidate()">
              @for (operator of operators(); track operator.id) {
                <nz-option [nzValue]="operator.id" [nzLabel]="operator.name"></nz-option>
              }
            </nz-select>
          </label>
        </div>

        @if (licenseView(); as view) {
          <nz-alert
            class="feedback"
            nzShowIcon
            data-test="license-status"
            [nzType]="view.valid ? (view.state === 'expiring' ? 'warning' : 'success') : 'error'"
            [nzMessage]="view.messageKey | translate: view.params"
          ></nz-alert>
        }

        <div class="form-grid">
          <label class="field" for="gc-tf-product">
            <span>{{ 'greenCare.field.commercialProduct' | translate }} *</span>
            <input nz-input id="gc-tf-product" name="commercial_product_name" [(ngModel)]="form.commercial_product_name" />
          </label>
          <label class="field" for="gc-tf-registration">
            <span>{{ 'greenCare.field.registrationNumber' | translate }} *</span>
            <input nz-input id="gc-tf-registration" name="registration_number" [(ngModel)]="form.registration_number" />
            <span class="hint" data-test="registration-hint">{{ registrationHintKey() | translate }}: {{ registrationHint() }}</span>
          </label>
          <label class="field" for="gc-tf-ingredient">
            <span>{{ 'greenCare.field.activeIngredient' | translate }}</span>
            <input nz-input id="gc-tf-ingredient" name="active_ingredient" [(ngModel)]="form.active_ingredient" />
          </label>
          <label class="field" for="gc-tf-target">
            <span>{{ 'greenCare.field.target' | translate }} *</span>
            <input nz-input id="gc-tf-target" name="target_pest_or_weed" [(ngModel)]="form.target_pest_or_weed" />
          </label>
          <label class="field" for="gc-tf-crop">
            <span>{{ 'greenCare.field.treatedSurface' | translate }} *</span>
            <input nz-input id="gc-tf-crop" name="treated_crop_or_surface" [(ngModel)]="form.treated_crop_or_surface" />
          </label>
          <label class="field" for="gc-tf-area">
            <span>{{ 'greenCare.field.treatedArea' | translate }}</span>
            <nz-input-number nzId="gc-tf-area" name="treated_area_sqm" [(ngModel)]="form.treated_area_sqm" [nzMin]="0" [nzStep]="1"></nz-input-number>
          </label>
          <label class="field" for="gc-tf-dosage">
            <span>{{ 'greenCare.field.dosage' | translate }} *</span>
            <nz-input-number nzId="gc-tf-dosage" name="dosage_used" [(ngModel)]="form.dosage_used" [nzMin]="0" [nzStep]="0.1"></nz-input-number>
          </label>
          <label class="field" for="gc-tf-unit">
            <span>{{ 'greenCare.field.dosageUnit' | translate }} *</span>
            <nz-select nzId="gc-tf-unit" [(ngModel)]="form.dosage_unit">
              @for (unit of dosageUnits; track unit) {
                <nz-option [nzValue]="unit" [nzLabel]="'greenCare.enum.dosageUnit.' + dosageKey(unit) | translate"></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="gc-tf-water">
            <span>{{ 'greenCare.field.waterVolume' | translate }}</span>
            <nz-input-number nzId="gc-tf-water" name="water_volume_liters" [(ngModel)]="form.water_volume_liters" [nzMin]="0" [nzStep]="1"></nz-input-number>
          </label>
          <label class="field" for="gc-tf-stock">
            <span>{{ 'greenCare.field.warehouseProduct' | translate }}</span>
            <nz-select nzId="gc-tf-stock" nzShowSearch nzServerSearch nzAllowClear [(ngModel)]="form.warehouse_product_id" (nzOnSearch)="lookup.searchProducts($event)">
              @for (option of lookup.products(); track option.id) {
                <nz-option [nzValue]="option.id" [nzLabel]="option.label"></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="gc-tf-warehouse">
            <span>{{ 'greenCare.field.warehouse' | translate }}</span>
            <nz-select nzId="gc-tf-warehouse" nzAllowClear [(ngModel)]="form.warehouse_id">
              @for (option of lookup.warehouses(); track option.id) {
                <nz-option [nzValue]="option.id" [nzLabel]="option.label"></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="gc-tf-reentry">
            <span>{{ 'greenCare.field.reEntryHours' | translate }}</span>
            <nz-input-number nzId="gc-tf-reentry" name="re_entry_interval_hours" [(ngModel)]="form.re_entry_interval_hours" [nzMin]="0" [nzStep]="1"></nz-input-number>
          </label>
          <label class="field" for="gc-tf-weather">
            <span>{{ 'greenCare.field.weatherConditions' | translate }}</span>
            <input nz-input id="gc-tf-weather" name="weather_conditions_at_application" [(ngModel)]="form.weather_conditions_at_application" />
          </label>
          <label class="field full" for="gc-tf-notes">
            <span>{{ 'greenCare.field.notes' | translate }}</span>
            <textarea nz-input id="gc-tf-notes" name="notes" rows="2" [(ngModel)]="form.notes"></textarea>
          </label>
        </div>

        @if (reEntry(); as until) {
          <nz-alert
            class="reentry"
            nzShowIcon
            data-test="re-entry"
            [nzType]="until.active ? 'warning' : 'info'"
            [nzMessage]="'greenCare.treatment.reEntryUntil' | translate: { until: until.label }"
          ></nz-alert>
        }

        <nz-alert class="reentry" nzType="info" nzShowIcon [nzMessage]="'greenCare.treatment.immutableNote' | translate"></nz-alert>

        <div class="actions section-title">
          <button nz-button nzType="primary" type="button" data-test="save-treatment" [disabled]="!formValid()" (click)="save()">
            {{ 'greenCare.action.saveTreatment' | translate }}
          </button>
          <button nz-button type="button" (click)="closeForm()">{{ 'greenCare.action.cancel' | translate }}</button>
        </div>
      </ng-container>
    </nz-drawer>
  `,
})
export class GreenCareTreatmentsComponent implements OnInit {
  protected readonly store = inject(GreenCareTreatmentsStore);
  protected readonly lookup = inject(GreenCareLookupStore);
  private readonly crews = inject(GreenCareCrewStore);
  private readonly reference = inject(GreenCareReferenceStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly canWrite = inject(PermissionsService).canWrite(GREEN_CARE_MODULE);
  protected readonly dosageUnits = GC_DOSAGE_UNITS;
  protected readonly dosageKey = dosageUnitKey;
  protected readonly reEntryActive = isReEntryActive;

  protected range: Date[] = [];
  protected siteFilter: string | null = null;
  protected operatorFilter: string | null = null;

  protected readonly formOpen = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly formErrorParams = signal<Record<string, string>>({});
  protected form: TreatmentForm = { ...EMPTY_FORM };
  private readonly formTick = signal(0);

  protected readonly operators = computed(() =>
    this.crews.crews().flatMap((crew) => crew.members.map((member) => ({ id: member.id, name: member.name }))),
  );

  /** What the live licence check tells about the chosen operator on the chosen date. */
  protected readonly licenseView = computed(() => {
    const check = this.store.licenseCheck();
    if (check === null) {
      return null;
    }
    if (!check.valid || check.license === null) {
      return {
        valid: false,
        state: 'expired' as const,
        messageKey: `greenCare.error.${check.reason ?? 'operator_license_missing'}`,
        params: { expiry_date: check.license?.expiry_date ?? '' } as Record<string, string | number>,
      };
    }
    const state = licenseState(check.license.days_to_expiry, true);
    return {
      valid: true,
      state,
      messageKey: state === 'expiring' ? 'greenCare.license.expiring' : 'greenCare.license.valid',
      params: {
        type: this.i18n.instant(`greenCare.enum.licenseType.${check.license.license_type}`),
        number: check.license.license_number,
        expiry_date: check.license.expiry_date,
        days: check.license.days_to_expiry,
      } as Record<string, string | number>,
    };
  });

  protected readonly registrationJurisdiction = computed(() => this.store.licenseCheck()?.jurisdiction ?? null);
  protected readonly registrationHintKey = computed(() =>
    this.registrationJurisdiction() === 'CH' ? 'greenCare.hint.registrationCh' : this.registrationJurisdiction() === 'IT' ? 'greenCare.hint.registrationIt' : 'greenCare.hint.registration',
  );
  protected readonly registrationHint = computed(() => {
    const hints = this.reference.reference()?.registration_number_hint;
    const jurisdiction = this.registrationJurisdiction();
    if (!hints) {
      return '';
    }
    return jurisdiction === null ? `${hints.CH} / ${hints.IT}` : hints[jurisdiction];
  });

  ngOnInit(): void {
    void this.reference.load();
    void this.crews.load();
    void this.lookup.loadSites();
    void this.lookup.loadWarehouses();
    void this.lookup.searchProducts();
    void this.store.loadLicenses();
    void this.reload();
  }

  protected filters(): GcTreatmentFilters {
    return {
      from: this.range.length === 2 ? isoDay(this.range[0]) : null,
      to: this.range.length === 2 ? isoDay(this.range[1]) : null,
      site_id: this.siteFilter,
      operator_id: this.operatorFilter,
    };
  }

  protected async reload(): Promise<void> {
    await this.store.load(this.filters());
  }

  protected async exportPdf(): Promise<void> {
    const blob = await this.store.exportPdf(this.filters());
    if (blob) {
      saveBlob(blob, 'quaderno-di-campagna.pdf');
    } else {
      this.message.error(this.i18n.instant('greenCare.error.file_not_found'));
    }
  }

  protected openForm(): void {
    this.form = { ...EMPTY_FORM, treatment_date: new Date() };
    this.formError.set(null);
    this.store.clearLicenseCheck();
    this.formOpen.set(true);
  }

  protected closeForm(): void {
    this.formOpen.set(false);
    this.store.clearLicenseCheck();
  }

  /** Real-time validation: asks the API whether the operator holds a valid licence on the treatment date. */
  protected async revalidate(): Promise<void> {
    this.formTick.update((value) => value + 1);
    const { operator_id: operator, treatment_date: date, site_id: site } = this.form;
    if (operator === null || date === null) {
      this.store.clearLicenseCheck();
      return;
    }
    await this.store.checkLicense(operator, isoDay(date), site);
  }

  protected reEntry(): { active: boolean; label: string } | null {
    this.formTick();
    const date = this.form.treatment_date;
    if (date === null) {
      return null;
    }
    const until = reEntryUntil(isoDay(date), this.form.re_entry_interval_hours);
    return until === null ? null : { active: until.getTime() > Date.now(), label: until.toLocaleString() };
  }

  protected formValid(): boolean {
    const f = this.form;
    const check = this.store.licenseCheck();
    return (
      f.site_id !== null &&
      f.treatment_date !== null &&
      f.operator_id !== null &&
      f.commercial_product_name.trim() !== '' &&
      f.registration_number.trim() !== '' &&
      f.target_pest_or_weed.trim() !== '' &&
      f.treated_crop_or_surface.trim() !== '' &&
      (f.dosage_used ?? 0) > 0 &&
      (check === null || check.valid) &&
      (f.warehouse_product_id === null || f.warehouse_id !== null)
    );
  }

  protected payload(): GcTreatmentPayload {
    const f = this.form;
    return {
      site_id: f.site_id ?? '',
      treatment_date: f.treatment_date ? isoDay(f.treatment_date) : '',
      target_pest_or_weed: f.target_pest_or_weed.trim(),
      treated_crop_or_surface: f.treated_crop_or_surface.trim(),
      treated_area_sqm: f.treated_area_sqm,
      commercial_product_name: f.commercial_product_name.trim(),
      registration_number: f.registration_number.trim(),
      active_ingredient: f.active_ingredient.trim() || null,
      dosage_used: f.dosage_used ?? 0,
      dosage_unit: f.dosage_unit,
      water_volume_liters: f.water_volume_liters,
      warehouse_product_id: f.warehouse_product_id,
      warehouse_id: f.warehouse_id,
      operator_id: f.operator_id ?? '',
      re_entry_interval_hours: f.re_entry_interval_hours,
      weather_conditions_at_application: f.weather_conditions_at_application.trim() || null,
      notes: f.notes.trim() || null,
    };
  }

  protected async save(): Promise<void> {
    if (!this.formValid()) {
      return;
    }
    const outcome = await this.store.create(this.payload());
    if (outcome.ok) {
      this.closeForm();
      this.message.success(this.i18n.instant('greenCare.toast.treatmentSaved'));
      await this.reload();
    } else {
      this.formError.set(outcome.errorKey);
      this.formErrorParams.set(outcome.params);
    }
  }
}
