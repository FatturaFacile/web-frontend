import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  EsgReportingPeriod,
  EsgScope3Report,
  EsgSupplierRequest,
  EsgSupplierRequestStatus,
  ProcurementApiService,
  ProcurementSupplier,
  SustainabilityApiService,
  TranslateService,
} from '@core';
import { ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText } from './sustainability.util';

const STATUS_COLORS: Readonly<Record<EsgSupplierRequestStatus, string>> = {
  requested: 'blue',
  received: 'orange',
  applied: 'green',
  declined: 'default',
  cancelled: 'default',
};

/** Scope 3 activity types per GHG Protocol category with their units (mirrors the API activity catalog). */
const SCOPE3_ACTIVITIES: readonly { category: number; activity_type: string; units: readonly string[] }[] = [
  { category: 1, activity_type: 'purchased_goods', units: ['EUR', 'CHF'] },
  { category: 2, activity_type: 'capital_goods', units: ['EUR', 'CHF'] },
  { category: 3, activity_type: 'fuel_energy_related', units: ['kWh'] },
  { category: 4, activity_type: 'freight_road', units: ['tkm'] },
  { category: 4, activity_type: 'freight_sea', units: ['tkm'] },
  { category: 4, activity_type: 'freight_air', units: ['tkm'] },
  { category: 5, activity_type: 'waste', units: ['kg'] },
  { category: 6, activity_type: 'business_travel_car', units: ['km'] },
  { category: 6, activity_type: 'business_travel_air', units: ['km'] },
  { category: 6, activity_type: 'business_travel_rail', units: ['km'] },
  { category: 7, activity_type: 'employee_commuting_car', units: ['km'] },
  { category: 7, activity_type: 'employee_commuting_transit', units: ['km'] },
  { category: 8, activity_type: 'upstream_leased_assets', units: ['kWh'] },
  { category: 9, activity_type: 'downstream_freight', units: ['tkm'] },
  { category: 10, activity_type: 'processing_sold_products', units: ['kg'] },
  { category: 11, activity_type: 'use_of_sold_products', units: ['kWh'] },
  { category: 12, activity_type: 'end_of_life_sold_products', units: ['kg'] },
  { category: 13, activity_type: 'downstream_leased_assets', units: ['kWh'] },
  { category: 14, activity_type: 'franchises', units: ['kWh'] },
  { category: 15, activity_type: 'investments', units: ['EUR', 'CHF'] },
];

/** Scope 3 by the 15 GHG Protocol categories and the supplier-specific data requests behind it. */
@Component({
  selector: 'app-sustainability-scope3',
  styleUrl: './sustainability.scss',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    ModalActionsDirective,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'SUSTAINABILITY.SCOPE3_TITLE' | translate" [subtitle]="'SUSTAINABILITY.SCOPE3_SUBTITLE' | translate">
      <nz-select class="period-select" [ngModel]="periodId()" (ngModelChange)="selectPeriod($event)" [nzPlaceHolder]="'SUSTAINABILITY.SELECT_PERIOD' | translate">
        @for (period of periods(); track period.id) {
          <nz-option [nzValue]="period.id" [nzLabel]="period.name"></nz-option>
        }
      </nz-select>
      <button nz-button nzType="primary" [disabled]="!periodId()" (click)="openRequest()">{{ 'SUSTAINABILITY.SUPPLIER_REQUEST_NEW' | translate }}</button>
    </app-page-header>

    <nz-card class="main-card" [nzTitle]="'SUSTAINABILITY.SCOPE3_CATEGORIES' | translate">
      @if (report(); as scope3) {
        <p class="muted">{{ 'SUSTAINABILITY.SCOPE3_TOTAL' | translate }}: {{ scope3.total_tco2e }} tCO2e | {{ 'SUSTAINABILITY.SCOPE3_SUPPLIER_SHARE' | translate }}: {{ scope3.supplier_specific_percent }}% | {{ 'SUSTAINABILITY.SCOPE3_WITH_DATA' | translate }}: {{ scope3.categories_with_data }} / 15</p>
        <nz-table #categories [nzData]="scope3.categories" nzSize="small" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>#</th>
              <th>{{ 'SUSTAINABILITY.CATEGORY' | translate }}</th>
              <th class="num">kg CO2e</th>
              <th class="num">%</th>
              <th class="num">{{ 'SUSTAINABILITY.SCOPE3_SUPPLIER_SPECIFIC' | translate }} %</th>
              <th class="num">{{ 'SUSTAINABILITY.SCOPE3_ESTIMATED' | translate }} %</th>
              <th class="num">{{ 'SUSTAINABILITY.SUPPLIER_REQUESTS_OPEN' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of categories.data; track row.category) {
              <tr>
                <td>{{ row.category }}</td>
                <td>{{ ('SUSTAINABILITY.SCOPE3_CATEGORY_' + row.category) | translate }}</td>
                <td class="num">{{ row.co2e_kg }}</td>
                <td class="num">{{ row.share_percent }}</td>
                <td class="num">{{ row.supplier_specific_percent }}</td>
                <td class="num">{{ row.estimated_percent }}</td>
                <td class="num">{{ row.open_supplier_requests }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
      }
    </nz-card>

    <nz-card class="main-card" [nzTitle]="'SUSTAINABILITY.SUPPLIER_REQUESTS' | translate">
      <nz-table #requestsTable [nzData]="requests()" nzSize="small" [nzShowPagination]="false">
        <thead>
          <tr>
            <th>{{ 'SUSTAINABILITY.SUPPLIER' | translate }}</th>
            <th>{{ 'SUSTAINABILITY.CATEGORY' | translate }}</th>
            <th class="num">{{ 'SUSTAINABILITY.QUANTITY' | translate }}</th>
            <th class="num">{{ 'SUSTAINABILITY.SUPPLIER_REPORTED' | translate }}</th>
            <th>{{ 'SUSTAINABILITY.STATUS' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (request of requestsTable.data; track request.id) {
            <tr>
              <td>{{ request.supplier_name }}</td>
              <td>{{ request.scope3_category }} - {{ request.activity_type }}</td>
              <td class="num">{{ request.quantity }} {{ request.unit }}</td>
              <td class="num">{{ request.reported_co2e_kg }}</td>
              <td><nz-tag [nzColor]="statusColor(request.status)">{{ ('SUSTAINABILITY.SUPPLIER_STATUS_' + request.status.toUpperCase()) | translate }}</nz-tag></td>
              <td>
                @if (request.status === 'requested' || request.status === 'received') {
                  <button nz-button nzSize="small" (click)="openReceive(request)">{{ 'SUSTAINABILITY.SUPPLIER_REGISTER_DATA' | translate }}</button>
                  <button nz-button nzSize="small" (click)="decline(request)">{{ 'SUSTAINABILITY.SUPPLIER_DECLINE' | translate }}</button>
                  <button nz-button nzSize="small" nzDanger (click)="cancel(request)">{{ 'SUSTAINABILITY.SUPPLIER_CANCEL' | translate }}</button>
                }
                @if (request.status === 'received') {
                  <button nz-button nzSize="small" nzType="primary" (click)="apply(request)">{{ 'SUSTAINABILITY.SUPPLIER_APPLY' | translate }}</button>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    <nz-modal [(nzVisible)]="requestVisible" [nzTitle]="'SUSTAINABILITY.SUPPLIER_REQUEST_NEW' | translate" (nzOnCancel)="requestVisible.set(false)" (nzOnOk)="saveRequest()" okAction="save" [nzOkDisabled]="requestForm.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="requestForm" nzLayout="vertical">
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'SUSTAINABILITY.SUPPLIER' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="supplier_id" nzShowSearch>
                @for (supplier of suppliers(); track supplier.id) {
                  <nz-option [nzValue]="supplier.id" [nzLabel]="supplier.company_name"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'SUSTAINABILITY.ACTIVITY_TYPE' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="activity_type" (ngModelChange)="activityChanged($event)">
                @for (activity of activities; track activity.activity_type) {
                  <nz-option [nzValue]="activity.activity_type" [nzLabel]="activity.category + ' - ' + activity.activity_type"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'SUSTAINABILITY.QUANTITY' | translate }}</nz-form-label>
              <nz-form-control><input nz-input type="number" min="0" formControlName="quantity" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'SUSTAINABILITY.UNIT' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="unit">
                  @for (unit of units(); track unit) {
                    <nz-option [nzValue]="unit" [nzLabel]="unit"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-label>{{ 'SUSTAINABILITY.SUPPLIER_DUE_DATE' | translate }}</nz-form-label>
            <nz-form-control><input nz-input type="date" formControlName="due_date" /></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal [nzVisible]="receiving() !== null" [nzTitle]="'SUSTAINABILITY.SUPPLIER_REGISTER_DATA' | translate" (nzOnCancel)="receiving.set(null)" (nzOnOk)="saveReceive()" okAction="save" [nzOkDisabled]="receiveForm.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="receiveForm" nzLayout="vertical">
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'SUSTAINABILITY.SUPPLIER_REPORTED' | translate }}</nz-form-label>
            <nz-form-control><input nz-input type="number" min="0" formControlName="reported_co2e_kg" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>{{ 'SUSTAINABILITY.SUPPLIER_METHOD' | translate }}</nz-form-label>
            <nz-form-control><input nz-input formControlName="calculation_method" maxlength="190" /></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class SustainabilityScope3Component implements OnInit {
  private readonly api = inject(SustainabilityApiService);
  private readonly procurement = inject(ProcurementApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly activities = SCOPE3_ACTIVITIES;
  readonly periods = signal<EsgReportingPeriod[]>([]);
  readonly periodId = signal('');
  readonly report = signal<EsgScope3Report | null>(null);
  readonly requests = signal<EsgSupplierRequest[]>([]);
  readonly suppliers = signal<ProcurementSupplier[]>([]);
  readonly units = signal<readonly string[]>(['EUR', 'CHF']);
  readonly requestVisible = signal(false);
  readonly receiving = signal<EsgSupplierRequest | null>(null);

  readonly requestForm = this.fb.group({
    supplier_id: ['', [Validators.required]],
    activity_type: ['purchased_goods', [Validators.required]],
    quantity: ['', [Validators.required, Validators.min(0.0001)]],
    unit: ['EUR', [Validators.required]],
    due_date: [''],
  });

  readonly receiveForm = this.fb.group({
    reported_co2e_kg: ['', [Validators.required, Validators.min(0.0001)]],
    calculation_method: [''],
  });

  ngOnInit(): void {
    this.api.getPeriods().subscribe({
      next: (response) => {
        this.periods.set(response.data);
        if (response.data.length > 0) {
          this.selectPeriod(response.data[0].id);
        }
      },
      error: () => this.message.error(this.translate.instant('SUSTAINABILITY.ACTION_ERROR')),
    });
    this.procurement.getSuppliers({ per_page: 100 }).subscribe({ next: (response) => this.suppliers.set(response.data) });
  }

  statusColor(status: EsgSupplierRequestStatus): string {
    return STATUS_COLORS[status];
  }

  selectPeriod(periodId: string): void {
    this.periodId.set(periodId);
    this.reload();
  }

  reload(): void {
    const periodId = this.periodId();
    if (periodId === '') {
      return;
    }
    this.api.getScope3(periodId).subscribe({ next: (response) => this.report.set(response.data) });
    this.api.getSupplierRequests({ reporting_period_id: periodId, per_page: 100 }).subscribe({ next: (response) => this.requests.set(response.data) });
  }

  activityChanged(activityType: string): void {
    const units = SCOPE3_ACTIVITIES.find((activity) => activity.activity_type === activityType)?.units ?? [];
    this.units.set(units);
    this.requestForm.controls.unit.setValue(units[0] ?? '');
  }

  openRequest(): void {
    this.requestForm.reset({ supplier_id: '', activity_type: 'purchased_goods', quantity: '', unit: 'EUR', due_date: '' });
    this.units.set(['EUR', 'CHF']);
    this.requestVisible.set(true);
  }

  saveRequest(): void {
    const raw = this.requestForm.getRawValue();
    const activity = SCOPE3_ACTIVITIES.find((candidate) => candidate.activity_type === raw.activity_type);
    if (activity === undefined) {
      return;
    }

    this.api
      .createSupplierRequest({
        reporting_period_id: this.periodId(),
        supplier_id: raw.supplier_id,
        scope3_category: activity.category,
        activity_type: raw.activity_type,
        unit: raw.unit,
        quantity: String(raw.quantity),
        due_date: raw.due_date === '' ? null : raw.due_date,
      })
      .subscribe({
        next: () => {
          this.message.success(this.translate.instant('SUSTAINABILITY.SUPPLIER_REQUEST_SAVED'));
          this.requestVisible.set(false);
          this.reload();
        },
        error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('SUSTAINABILITY.ACTION_ERROR')),
      });
  }

  openReceive(request: EsgSupplierRequest): void {
    this.receiveForm.reset({ reported_co2e_kg: request.reported_co2e_kg ?? '', calculation_method: request.calculation_method ?? '' });
    this.receiving.set(request);
  }

  saveReceive(): void {
    const request = this.receiving();
    if (request === null) {
      return;
    }

    const raw = this.receiveForm.getRawValue();
    this.api
      .receiveSupplierRequest(request.id, {
        reported_co2e_kg: String(raw.reported_co2e_kg),
        calculation_method: raw.calculation_method === '' ? null : raw.calculation_method,
      })
      .subscribe({
        next: () => {
          this.message.success(this.translate.instant('SUSTAINABILITY.SUPPLIER_DATA_SAVED'));
          this.receiving.set(null);
          this.reload();
        },
        error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('SUSTAINABILITY.ACTION_ERROR')),
      });
  }

  apply(request: EsgSupplierRequest): void {
    this.run(this.api.applySupplierRequest(request.id), 'SUSTAINABILITY.SUPPLIER_APPLIED');
  }

  decline(request: EsgSupplierRequest): void {
    this.run(this.api.declineSupplierRequest(request.id), 'SUSTAINABILITY.SUPPLIER_DECLINED');
  }

  cancel(request: EsgSupplierRequest): void {
    this.run(this.api.cancelSupplierRequest(request.id), 'SUSTAINABILITY.SUPPLIER_CANCELLED');
  }

  private run(call: ReturnType<SustainabilityApiService['applySupplierRequest']>, successKey: string): void {
    call.subscribe({
      next: () => {
        this.message.success(this.translate.instant(successKey));
        this.reload();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('SUSTAINABILITY.ACTION_ERROR')),
    });
  }
}
