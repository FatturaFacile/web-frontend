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
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { GcWasteFilters, GcWasteSlip, GcWasteSlipPayload, PermissionsService, TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { GreenCareLookupStore, GreenCareReferenceStore, GreenCareWasteStore } from './green-care.stores';
import { GREEN_CARE_MODULE, isoDay, parseDay } from './green-care.util';

interface SlipForm {
  slip_number: string;
  site_id: string | null;
  disposal_date: Date | null;
  waste_code: string | null;
  waste_description: string;
  green_waste_weight_kg: number | null;
  compost_facility_id: string | null;
  transporter_vehicle_plate: string;
  document_reference: string;
  disposal_cost: number | null;
  is_billable_to_customer: boolean;
}

const EMPTY_FORM: SlipForm = {
  slip_number: '',
  site_id: null,
  disposal_date: null,
  waste_code: null,
  waste_description: '',
  green_waste_weight_kg: null,
  compost_facility_id: null,
  transporter_vehicle_plate: '',
  document_reference: '',
  disposal_cost: null,
  is_billable_to_customer: false,
};

/**
 * Green waste disposal slips ("Formulari Smaltimento Verde CER / OTR"): the slips with the weights in kg, the composting facilities,
 * the FIR / DDT / OTR transport document and the customer pass-through flag, plus the summary by waste code and facility.
 */
@Component({
  selector: 'app-green-care-waste',
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
    NzPopconfirmModule,
    NzSelectModule,
    NzSwitchModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  providers: [GreenCareWasteStore],
  styleUrl: './green-care.scss',
  template: `
    <app-page-header
      [title]="'PAGE_TITLE.GREEN_CARE_WASTE' | translate"
      [subtitle]="'greenCare.section.wasteSubtitle' | translate"
    ></app-page-header>

    @if (store.error(); as error) {
      <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="error | translate"></nz-alert>
    }

    <div class="toolbar">
      <label class="field" for="gc-w-range">
        <span>{{ 'greenCare.filter.period' | translate }}</span>
        <nz-range-picker id="gc-w-range" name="range" [(ngModel)]="range" (ngModelChange)="reload()"></nz-range-picker>
      </label>
      <label class="field" for="gc-w-site">
        <span>{{ 'greenCare.field.site' | translate }}</span>
        <nz-select nzId="gc-w-site" nzAllowClear nzShowSearch [(ngModel)]="siteFilter" (ngModelChange)="reload()">
          @for (option of lookup.sites(); track option.id) {
            <nz-option [nzValue]="option.id" [nzLabel]="option.label"></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="gc-w-code">
        <span>{{ 'greenCare.field.wasteCode' | translate }}</span>
        <nz-select nzId="gc-w-code" nzAllowClear [(ngModel)]="codeFilter" (ngModelChange)="reload()">
          @for (code of wasteCodes(); track code.code) {
            <nz-option [nzValue]="code.code" [nzLabel]="code.code"></nz-option>
          }
        </nz-select>
      </label>
      <span class="spacer"></span>
      @if (canWrite) {
        <button nz-button nzType="primary" type="button" data-test="add-slip" (click)="openForm(null)">
          {{ 'greenCare.action.newSlip' | translate }}
        </button>
      }
    </div>

    @if (store.summary(); as summary) {
      <div class="kpi-grid" data-test="waste-summary">
        <div class="kpi">
          <div class="kpi-title">{{ 'greenCare.kpi.green_waste_kg' | translate }}</div>
          <div class="kpi-value">{{ summary.total_kg | number: '1.0-2' }} kg</div>
        </div>
        <div class="kpi">
          <div class="kpi-title">{{ 'greenCare.kpi.billableDisposalCost' | translate }}</div>
          <div class="kpi-value">{{ summary.billable_cost | number: '1.2-2' }}</div>
        </div>
        @for (item of summary.by_waste_code; track item.waste_code) {
          <div class="kpi">
            <div class="kpi-title">{{ item.waste_code }}</div>
            <div class="kpi-value">{{ item.kg | number: '1.0-2' }} kg</div>
            <div class="kpi-sub">{{ 'greenCare.waste.slipsCount' | translate: { count: item.slips } }}</div>
          </div>
        }
      </div>
    }

    <nz-table #slips nzSize="small" [nzData]="store.slips()" [nzLoading]="store.loading()" [nzShowPagination]="false" [nzScroll]="{ x: '1200px' }">
      <thead>
        <tr>
          <th>{{ 'greenCare.field.slipNumber' | translate }}</th>
          <th>{{ 'greenCare.field.disposalDate' | translate }}</th>
          <th>{{ 'greenCare.field.site' | translate }}</th>
          <th>{{ 'greenCare.field.wasteCode' | translate }}</th>
          <th>{{ 'greenCare.field.weightKg' | translate }}</th>
          <th>{{ 'greenCare.field.compostFacility' | translate }}</th>
          <th>{{ 'greenCare.field.documentReference' | translate }}</th>
          <th>{{ 'greenCare.field.billableToCustomer' | translate }}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        @for (slip of slips.data; track slip.id) {
          <tr [attr.data-test]="'slip-' + slip.id">
            <td>{{ slip.slip_number }}</td>
            <td>{{ slip.disposal_date | date: 'mediumDate' }}</td>
            <td>{{ slip.site_name ?? '-' }}</td>
            <td>{{ slip.waste_code }}</td>
            <td>{{ slip.green_waste_weight_kg | number: '1.0-2' }}</td>
            <td>{{ slip.compost_facility_name ?? '-' }}</td>
            <td>{{ slip.document_reference ?? '-' }}</td>
            <td>
              <nz-tag [nzColor]="slip.is_billable_to_customer ? 'gold' : 'default'">{{
                (slip.is_billable_to_customer ? 'greenCare.common.yes' : 'greenCare.common.no') | translate
              }}</nz-tag>
            </td>
            <td>
              <div class="row-actions">
                @if (canWrite) {
                  <button nz-button nzSize="small" type="button" (click)="openForm(slip)">{{ 'greenCare.action.edit' | translate }}</button>
                  <button
                    nz-button
                    nzSize="small"
                    nzDanger
                    type="button"
                    nz-popconfirm
                    [nzPopconfirmTitle]="'greenCare.confirm.deleteSlip' | translate"
                    (nzOnConfirm)="remove(slip)"
                  >
                    {{ 'greenCare.action.delete' | translate }}
                  </button>
                }
              </div>
            </td>
          </tr>
        }
      </tbody>
    </nz-table>

    @if (store.summary(); as summary) {
      @if (summary.by_facility.length > 0) {
        <h3 class="section-title">{{ 'greenCare.waste.byFacility' | translate }}</h3>
        <nz-table #facilities nzSize="small" [nzData]="summary.by_facility" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'greenCare.field.compostFacility' | translate }}</th>
              <th>{{ 'greenCare.field.weightKg' | translate }}</th>
              <th>{{ 'greenCare.waste.slips' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of facilities.data; track $index) {
              <tr>
                <td>{{ row.name ?? '-' }}</td>
                <td>{{ row.kg | number: '1.0-2' }}</td>
                <td>{{ row.slips }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
      }
    }

    <nz-drawer
      [nzVisible]="formOpen()"
      [nzWidth]="640"
      [nzTitle]="(editingId() ? 'greenCare.action.editSlip' : 'greenCare.action.newSlip') | translate"
      (nzOnClose)="formOpen.set(false)"
    >
      <ng-container *nzDrawerContent>
        @if (formError(); as error) {
          <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="error | translate: formErrorParams()"></nz-alert>
        }
        <div class="form-grid">
          <label class="field" for="gc-wf-number">
            <span>{{ 'greenCare.field.slipNumber' | translate }}</span>
            <input nz-input id="gc-wf-number" name="slip_number" [(ngModel)]="form.slip_number" />
          </label>
          <label class="field" for="gc-wf-date">
            <span>{{ 'greenCare.field.disposalDate' | translate }} *</span>
            <nz-date-picker nzId="gc-wf-date" name="disposal_date" [(ngModel)]="form.disposal_date"></nz-date-picker>
          </label>
          <label class="field" for="gc-wf-site">
            <span>{{ 'greenCare.field.site' | translate }}</span>
            <nz-select nzId="gc-wf-site" nzAllowClear nzShowSearch [(ngModel)]="form.site_id">
              @for (option of lookup.sites(); track option.id) {
                <nz-option [nzValue]="option.id" [nzLabel]="option.label"></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="gc-wf-code">
            <span>{{ 'greenCare.field.wasteCode' | translate }} *</span>
            <nz-select nzId="gc-wf-code" (ngModelChange)="onCode($event)" [(ngModel)]="form.waste_code">
              @for (code of wasteCodes(); track code.code) {
                <nz-option [nzValue]="code.code" [nzLabel]="code.code + ' · ' + code.description"></nz-option>
              }
            </nz-select>
          </label>
          <label class="field full" for="gc-wf-description">
            <span>{{ 'greenCare.field.wasteDescription' | translate }}</span>
            <input nz-input id="gc-wf-description" name="waste_description" [(ngModel)]="form.waste_description" />
          </label>
          <label class="field" for="gc-wf-weight">
            <span>{{ 'greenCare.field.weightKg' | translate }} *</span>
            <nz-input-number nzId="gc-wf-weight" name="green_waste_weight_kg" [(ngModel)]="form.green_waste_weight_kg" [nzMin]="0" [nzStep]="1"></nz-input-number>
          </label>
          <label class="field" for="gc-wf-facility">
            <span>{{ 'greenCare.field.compostFacility' | translate }}</span>
            <nz-select nzId="gc-wf-facility" nzAllowClear nzShowSearch nzServerSearch [(ngModel)]="form.compost_facility_id" (nzOnSearch)="lookup.searchSuppliers($event)">
              @for (option of facilityOptions(); track option.id) {
                <nz-option [nzValue]="option.id" [nzLabel]="option.label"></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="gc-wf-plate">
            <span>{{ 'greenCare.field.transporterPlate' | translate }}</span>
            <input nz-input id="gc-wf-plate" name="transporter_vehicle_plate" [(ngModel)]="form.transporter_vehicle_plate" />
          </label>
          <label class="field" for="gc-wf-reference">
            <span>{{ 'greenCare.field.documentReference' | translate }}</span>
            <input nz-input id="gc-wf-reference" name="document_reference" [(ngModel)]="form.document_reference" />
            <span class="hint">{{ 'greenCare.hint.documentReference' | translate }}</span>
          </label>
          <label class="field" for="gc-wf-cost">
            <span>{{ 'greenCare.field.disposalCost' | translate }}</span>
            <nz-input-number nzId="gc-wf-cost" name="disposal_cost" [(ngModel)]="form.disposal_cost" [nzMin]="0" [nzStep]="0.01"></nz-input-number>
          </label>
          <label class="field switch" for="gc-wf-billable">
            <span>{{ 'greenCare.field.billableToCustomer' | translate }}</span>
            <nz-switch nzId="gc-wf-billable" name="is_billable_to_customer" [(ngModel)]="form.is_billable_to_customer"></nz-switch>
          </label>
        </div>
        <div class="actions section-title">
          <button nz-button nzType="primary" type="button" data-test="save-slip" [disabled]="!formValid()" (click)="save()">
            {{ 'greenCare.action.save' | translate }}
          </button>
          <button nz-button type="button" (click)="formOpen.set(false)">{{ 'greenCare.action.cancel' | translate }}</button>
        </div>
      </ng-container>
    </nz-drawer>
  `,
})
export class GreenCareWasteComponent implements OnInit {
  protected readonly store = inject(GreenCareWasteStore);
  protected readonly lookup = inject(GreenCareLookupStore);
  private readonly reference = inject(GreenCareReferenceStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly canWrite = inject(PermissionsService).canWrite(GREEN_CARE_MODULE);

  protected range: Date[] = [];
  protected siteFilter: string | null = null;
  protected codeFilter: string | null = null;

  protected readonly formOpen = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly formError = signal<string | null>(null);
  protected readonly formErrorParams = signal<Record<string, string>>({});
  protected form: SlipForm = { ...EMPTY_FORM };
  private readonly pinned = signal<{ id: string; label: string }[]>([]);

  protected readonly wasteCodes = computed(() => {
    const codes = this.reference.reference()?.waste_codes;
    return codes ? [...codes.IT, ...codes.CH] : [];
  });
  protected readonly facilityOptions = computed(() => {
    const known = this.lookup.suppliers();
    return [...this.pinned().filter((option) => !known.some((item) => item.id === option.id)), ...known];
  });

  ngOnInit(): void {
    void this.reference.load();
    void this.lookup.loadSites();
    void this.lookup.searchSuppliers();
    void this.reload();
  }

  protected filters(): GcWasteFilters {
    return {
      from: this.range.length === 2 ? isoDay(this.range[0]) : null,
      to: this.range.length === 2 ? isoDay(this.range[1]) : null,
      site_id: this.siteFilter,
      waste_code: this.codeFilter,
    };
  }

  protected async reload(): Promise<void> {
    await this.store.load(this.filters());
  }

  protected openForm(slip: GcWasteSlip | null): void {
    this.formError.set(null);
    this.editingId.set(slip?.id ?? null);
    this.pinned.set(slip?.compost_facility_id && slip.compost_facility_name ? [{ id: slip.compost_facility_id, label: slip.compost_facility_name }] : []);
    this.form =
      slip === null
        ? { ...EMPTY_FORM, disposal_date: new Date() }
        : {
            slip_number: slip.slip_number,
            site_id: slip.site_id,
            disposal_date: parseDay(slip.disposal_date.slice(0, 10)),
            waste_code: slip.waste_code,
            waste_description: slip.waste_description ?? '',
            green_waste_weight_kg: slip.green_waste_weight_kg,
            compost_facility_id: slip.compost_facility_id,
            transporter_vehicle_plate: slip.transporter_vehicle_plate ?? '',
            document_reference: slip.document_reference ?? '',
            disposal_cost: slip.disposal_cost,
            is_billable_to_customer: slip.is_billable_to_customer,
          };
    this.formOpen.set(true);
  }

  /** Fills the description of the chosen waste code when none was typed. */
  protected onCode(code: string | null): void {
    if (code !== null && this.form.waste_description.trim() === '') {
      this.form.waste_description = this.wasteCodes().find((item) => item.code === code)?.description ?? '';
    }
  }

  protected formValid(): boolean {
    return this.form.disposal_date !== null && this.form.waste_code !== null && (this.form.green_waste_weight_kg ?? 0) > 0;
  }

  protected payload(): GcWasteSlipPayload {
    const f = this.form;
    return {
      slip_number: f.slip_number.trim() || null,
      site_id: f.site_id,
      disposal_date: f.disposal_date ? isoDay(f.disposal_date) : '',
      waste_code: f.waste_code ?? '',
      waste_description: f.waste_description.trim() || null,
      green_waste_weight_kg: f.green_waste_weight_kg ?? 0,
      compost_facility_id: f.compost_facility_id,
      transporter_vehicle_plate: f.transporter_vehicle_plate.trim() || null,
      document_reference: f.document_reference.trim() || null,
      disposal_cost: f.disposal_cost,
      is_billable_to_customer: f.is_billable_to_customer,
    };
  }

  protected async save(): Promise<void> {
    if (!this.formValid()) {
      return;
    }
    const outcome = await this.store.save(this.editingId(), this.payload());
    if (outcome.ok) {
      this.formOpen.set(false);
      this.message.success(this.i18n.instant('greenCare.toast.slipSaved'));
      await this.reload();
    } else {
      this.formError.set(outcome.errorKey);
      this.formErrorParams.set(outcome.params);
    }
  }

  protected async remove(slip: GcWasteSlip): Promise<void> {
    const outcome = await this.store.remove(slip.id);
    if (outcome.ok) {
      this.message.success(this.i18n.instant('greenCare.toast.slipDeleted'));
      await this.reload();
    } else {
      this.message.error(this.i18n.instant(outcome.errorKey ?? 'greenCare.error.unknown', outcome.params));
    }
  }
}
