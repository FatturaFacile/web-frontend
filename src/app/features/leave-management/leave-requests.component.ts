import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  I18nService,
  LeaveCountryCode,
  LeaveRequestStatusCode,
  LeaveTypeEnum,
  LeaveUnitModeCode,
  Mod074LeaveRequestRecord,
  PermissionsService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { LeaveManagementNavComponent } from './leave-management-nav.component';
import { LeaveManagementStore } from './leave-management.store';
import {
  inpsPucValidator,
  LEAVE_TYPE_OPTIONS,
  LEAVE_TYPE_TAG_COLORS,
  STATUS_TAG_COLORS,
} from './leave-management.util';

/**
 * Leave Requests, INPS PUC Medical Protocol Registration, SUVA/INAIL Accidents,
 * Legge 104 Permits, IJM/KTG Wartefrist, and Approval / Rejection / Cancellation actions.
 */
@Component({
  selector: 'app-leave-requests',
  imports: [
    DecimalPipe,
    FormsModule,
    ReactiveFormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzDescriptionsModule,
    NzDrawerModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSwitchModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
    LeaveManagementNavComponent,
  ],
  template: `
    <app-page-header
      [title]="'leaveMgmt.title' | translate"
      [subtitle]="'leaveMgmt.subtitle' | translate"
    />
    <app-leave-management-nav activeTab="requests" />

    <nz-card class="mb-4">
      <div class="flex flex-wrap justify-between items-center gap-3">
        <div class="flex flex-wrap gap-3 items-center">
          <nz-select
            class="w-44"
            nzAllowClear
            [nzPlaceHolder]="'leaveMgmt.field.country' | translate"
            [ngModel]="filterCountry()"
            (ngModelChange)="filterCountry.set($event ?? ''); reload()"
          >
            <nz-option nzValue="CH" [nzLabel]="'leaveMgmt.country.CH' | translate" />
            <nz-option nzValue="IT" [nzLabel]="'leaveMgmt.country.IT' | translate" />
          </nz-select>

          <nz-select
            class="w-48"
            nzAllowClear
            [nzPlaceHolder]="'leaveMgmt.field.leaveType' | translate"
            [ngModel]="filterType()"
            (ngModelChange)="filterType.set($event ?? ''); reload()"
          >
            @for (lt of leaveTypeOptions; track lt) {
              <nz-option [nzValue]="lt" [nzLabel]="'leaveMgmt.type.' + lt | translate" />
            }
          </nz-select>
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            nz-button
            nzType="primary"
            type="button"
            data-testid="lm-new-request-btn"
            (click)="requestDrawerOpen.set(true)"
          >
            {{ 'leaveMgmt.action.newRequest' | translate }}
          </button>
          <button
            nz-button
            nzDanger
            type="button"
            data-testid="lm-register-sick-btn"
            (click)="sickDrawerOpen.set(true)"
          >
            {{ 'leaveMgmt.action.registerSick' | translate }}
          </button>
        </div>
      </div>
    </nz-card>

    <nz-card>
      <nz-table #reqTable [nzData]="store.requests()" [nzLoading]="store.loading()" nzSize="middle">
        <thead>
          <tr>
            <th>#</th>
            <th>{{ 'leaveMgmt.field.employee' | translate }}</th>
            <th>{{ 'leaveMgmt.field.country' | translate }}</th>
            <th>{{ 'leaveMgmt.field.leaveType' | translate }}</th>
            <th>{{ 'leaveMgmt.field.startDate' | translate }}</th>
            <th>{{ 'leaveMgmt.field.endDate' | translate }}</th>
            <th nzAlign="right">Days / Hours</th>
            <th>PUC / SUVA / INAIL</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          @for (row of reqTable.data; track row.id) {
            <tr>
              <td>{{ row.request_number }}</td>
              <td>{{ row.employee_name || row.employee_id.slice(0, 8) }}</td>
              <td>
                <nz-tag>{{ row.country }}</nz-tag>
              </td>
              <td>
                <nz-tag [nzColor]="typeColor(row.leave_type)">
                  {{ 'leaveMgmt.type.' + row.leave_type | translate }}
                </nz-tag>
              </td>
              <td>{{ row.start_date }}</td>
              <td>{{ row.end_date }}</td>
              <td nzAlign="right">
                {{ row.requested_days | number: '1.2-2' }}d /
                {{ row.requested_hours | number: '1.2-2' }}h
              </td>
              <td>
                @if (row.inps_medical_certificate_protocol_number) {
                  <nz-tag nzColor="volcano"
                    >PUC: {{ row.inps_medical_certificate_protocol_number }}</nz-tag
                  >
                }
                @if (row.suva_claim_number) {
                  <nz-tag nzColor="red">SUVA: {{ row.suva_claim_number }}</nz-tag>
                }
                @if (row.inail_claim_number) {
                  <nz-tag nzColor="orange">INAIL: {{ row.inail_claim_number }}</nz-tag>
                }
                @if (row.staffing_check_result?.breached) {
                  <nz-tag nzColor="red">!</nz-tag>
                }
              </td>
              <td>
                <nz-tag [nzColor]="statusColor(row.status)">
                  {{ 'leaveMgmt.status.' + row.status | translate }}
                </nz-tag>
              </td>
              <td>
                <div class="flex flex-wrap gap-1">
                  @if (canApprove() && row.status === 'pending_approval' && !row.is_locked) {
                    <button
                      nz-button
                      nzSize="small"
                      nzType="primary"
                      type="button"
                      (click)="decide(row, 'approve')"
                    >
                      {{ 'leaveMgmt.action.approve' | translate }}
                    </button>
                    <button
                      nz-button
                      nzSize="small"
                      nzDanger
                      type="button"
                      nz-popconfirm
                      [nzPopconfirmTitle]="'leaveMgmt.action.reject' | translate"
                      (nzOnConfirm)="decide(row, 'reject')"
                    >
                      {{ 'leaveMgmt.action.reject' | translate }}
                    </button>
                  }
                  @if (row.status === 'pending_approval' || row.status === 'approved') {
                    <button
                      nz-button
                      nzSize="small"
                      type="button"
                      nz-popconfirm
                      [nzPopconfirmTitle]="'leaveMgmt.action.cancel' | translate"
                      (nzOnConfirm)="decide(row, 'cancel')"
                    >
                      {{ 'leaveMgmt.action.cancel' | translate }}
                    </button>
                  }
                </div>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    <!-- Standard Leave Request Drawer -->
    <nz-drawer
      [nzVisible]="requestDrawerOpen()"
      [nzTitle]="'leaveMgmt.action.newRequest' | translate"
      [nzWidth]="480"
      (nzOnClose)="requestDrawerOpen.set(false)"
    >
      <ng-container *nzDrawerContent>
        <form
          nz-form
          nzLayout="vertical"
          [formGroup]="requestForm"
          (ngSubmit)="submitStandardRequest()"
        >
          <nz-form-item>
            <nz-form-label nzRequired nzFor="req-emp">{{
              'leaveMgmt.field.employee' | translate
            }}</nz-form-label>
            <nz-form-control>
              <nz-select nzId="req-emp" nzShowSearch formControlName="employee_id">
                @for (emp of store.employees(); track emp.id) {
                  <nz-option [nzValue]="emp.id" [nzLabel]="emp.full_name" />
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>

          <div class="grid grid-cols-2 gap-3">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="req-country">{{
                'leaveMgmt.field.country' | translate
              }}</nz-form-label>
              <nz-form-control>
                <nz-select nzId="req-country" formControlName="country">
                  <nz-option nzValue="CH" [nzLabel]="'leaveMgmt.country.CH' | translate" />
                  <nz-option nzValue="IT" [nzLabel]="'leaveMgmt.country.IT' | translate" />
                </nz-select>
              </nz-form-control>
            </nz-form-item>

            <nz-form-item>
              <nz-form-label nzRequired nzFor="req-type">{{
                'leaveMgmt.field.leaveType' | translate
              }}</nz-form-label>
              <nz-form-control>
                <nz-select nzId="req-type" formControlName="leave_type">
                  @for (lt of leaveTypeOptions; track lt) {
                    <nz-option [nzValue]="lt" [nzLabel]="'leaveMgmt.type.' + lt | translate" />
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="req-start">{{
                'leaveMgmt.field.startDate' | translate
              }}</nz-form-label>
              <nz-form-control>
                <input nz-input id="req-start" type="date" formControlName="start_date" />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="req-end">{{
                'leaveMgmt.field.endDate' | translate
              }}</nz-form-label>
              <nz-form-control>
                <input nz-input id="req-end" type="date" formControlName="end_date" />
              </nz-form-control>
            </nz-form-item>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <nz-form-item>
              <nz-form-label nzFor="req-dur">{{
                'leaveMgmt.field.duration' | translate
              }}</nz-form-label>
              <nz-form-control>
                <nz-select nzId="req-dur" formControlName="half_day_or_hourly_duration">
                  <nz-option nzValue="full_day" nzLabel="Full Day" />
                  <nz-option nzValue="morning" nzLabel="Half Day (Morning)" />
                  <nz-option nzValue="afternoon" nzLabel="Half Day (Afternoon)" />
                  <nz-option nzValue="hourly:2.00" nzLabel="2 Hours" />
                  <nz-option nzValue="hourly:4.00" nzLabel="4 Hours" />
                </nz-select>
              </nz-form-control>
            </nz-form-item>

            <nz-form-item>
              <nz-form-label nzFor="req-unit">Unit</nz-form-label>
              <nz-form-control>
                <nz-select nzId="req-unit" formControlName="duration_unit">
                  <nz-option nzValue="days" nzLabel="Days" />
                  <nz-option nzValue="hours" nzLabel="Hours" />
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          </div>

          @if (requestForm.controls.leave_type.value === 'IT_Legge104_Permessi') {
            <nz-form-item>
              <nz-form-label nzFor="req-104">{{
                'leaveMgmt.field.legge104Ref' | translate
              }}</nz-form-label>
              <nz-form-control>
                <input nz-input id="req-104" formControlName="legge_104_beneficiary_ref" />
              </nz-form-control>
            </nz-form-item>
          }

          <div class="flex justify-end gap-2 mt-4">
            <button nz-button type="button" (click)="requestDrawerOpen.set(false)">
              {{ 'leaveMgmt.action.cancel' | translate }}
            </button>
            <button
              nz-button
              nzType="primary"
              type="submit"
              data-testid="lm-submit-request-btn"
              [disabled]="requestForm.invalid"
              [nzLoading]="store.saving()"
            >
              {{ 'leaveMgmt.action.newRequest' | translate }}
            </button>
          </div>
        </form>
      </ng-container>
    </nz-drawer>

    <!-- Sick / INPS PUC / SUVA / INAIL / IPG-EO Drawer -->
    <nz-drawer
      [nzVisible]="sickDrawerOpen()"
      [nzTitle]="'leaveMgmt.action.registerSick' | translate"
      [nzWidth]="520"
      (nzOnClose)="sickDrawerOpen.set(false)"
    >
      <ng-container *nzDrawerContent>
        <form
          nz-form
          nzLayout="vertical"
          [formGroup]="sickForm"
          (ngSubmit)="submitSickRegistration()"
        >
          <nz-form-item>
            <nz-form-label nzRequired nzFor="sk-emp">{{
              'leaveMgmt.field.employee' | translate
            }}</nz-form-label>
            <nz-form-control>
              <nz-select nzId="sk-emp" nzShowSearch formControlName="employee_id">
                @for (emp of store.employees(); track emp.id) {
                  <nz-option [nzValue]="emp.id" [nzLabel]="emp.full_name" />
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>

          <div class="grid grid-cols-2 gap-3">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="sk-country">{{
                'leaveMgmt.field.country' | translate
              }}</nz-form-label>
              <nz-form-control>
                <nz-select nzId="sk-country" formControlName="country">
                  <nz-option nzValue="CH" [nzLabel]="'leaveMgmt.country.CH' | translate" />
                  <nz-option nzValue="IT" [nzLabel]="'leaveMgmt.country.IT' | translate" />
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="sk-type">{{
                'leaveMgmt.field.leaveType' | translate
              }}</nz-form-label>
              <nz-form-control>
                <nz-select nzId="sk-type" formControlName="leave_type">
                  <nz-option
                    nzValue="SickLeave_Malattia"
                    [nzLabel]="'leaveMgmt.type.SickLeave_Malattia' | translate"
                  />
                  <nz-option
                    nzValue="Accident_Infortunio_SUVA_INAIL"
                    [nzLabel]="'leaveMgmt.type.Accident_Infortunio_SUVA_INAIL' | translate"
                  />
                  <nz-option
                    nzValue="MaternityPaternity_Congedo"
                    [nzLabel]="'leaveMgmt.type.MaternityPaternity_Congedo' | translate"
                  />
                  <nz-option
                    nzValue="CH_MilitaryCivilService_EO_APG"
                    [nzLabel]="'leaveMgmt.type.CH_MilitaryCivilService_EO_APG' | translate"
                  />
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="sk-start">{{
                'leaveMgmt.field.startDate' | translate
              }}</nz-form-label>
              <nz-form-control>
                <input nz-input id="sk-start" type="date" formControlName="start_date" />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="sk-end">{{
                'leaveMgmt.field.endDate' | translate
              }}</nz-form-label>
              <nz-form-control>
                <input nz-input id="sk-end" type="date" formControlName="end_date" />
              </nz-form-control>
            </nz-form-item>
          </div>

          <nz-form-item>
            <nz-form-label nzFor="sk-puc">{{ 'leaveMgmt.field.puc' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="'9 chars alphanumeric'">
              <input
                nz-input
                id="sk-puc"
                maxlength="9"
                formControlName="inps_medical_certificate_protocol_number"
                placeholder="e.g. PUC123456"
              />
            </nz-form-control>
          </nz-form-item>

          <div class="grid grid-cols-2 gap-3">
            <nz-form-item>
              <nz-form-label nzFor="sk-suva">{{
                'leaveMgmt.field.suvaClaim' | translate
              }}</nz-form-label>
              <nz-form-control>
                <input nz-input id="sk-suva" formControlName="suva_claim_number" />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="sk-inail">{{
                'leaveMgmt.field.inailClaim' | translate
              }}</nz-form-label>
              <nz-form-control>
                <input nz-input id="sk-inail" formControlName="inail_claim_number" />
              </nz-form-control>
            </nz-form-item>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <nz-form-item>
              <nz-form-label nzFor="sk-warte">{{
                'leaveMgmt.field.wartefrist' | translate
              }}</nz-form-label>
              <nz-form-control>
                <nz-input-number
                  id="sk-warte"
                  class="w-full"
                  formControlName="ijm_ktg_waiting_days"
                  [nzMin]="0"
                  [nzMax]="365"
                />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="sk-ipg">{{
                'leaveMgmt.field.ipgEo' | translate
              }}</nz-form-label>
              <nz-form-control>
                <input nz-input id="sk-ipg" formControlName="ipg_eo_allowance_code" />
              </nz-form-control>
            </nz-form-item>
          </div>

          <div class="flex justify-end gap-2 mt-4">
            <button nz-button type="button" (click)="sickDrawerOpen.set(false)">
              {{ 'leaveMgmt.action.cancel' | translate }}
            </button>
            <button
              nz-button
              nzType="primary"
              type="submit"
              data-testid="lm-submit-sick-btn"
              [disabled]="sickForm.invalid"
              [nzLoading]="store.saving()"
            >
              {{ 'leaveMgmt.action.registerSick' | translate }}
            </button>
          </div>
        </form>
      </ng-container>
    </nz-drawer>
  `,
})
export class LeaveRequestsComponent implements OnInit {
  protected readonly store = inject(LeaveManagementStore);
  private readonly fb = inject(FormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly permissions = inject(PermissionsService);

  protected readonly leaveTypeOptions = LEAVE_TYPE_OPTIONS;
  protected readonly filterCountry = signal<LeaveCountryCode | ''>('');
  protected readonly filterType = signal<string>('');
  protected readonly requestDrawerOpen = signal(false);
  protected readonly sickDrawerOpen = signal(false);

  protected readonly canApprove = computed(
    () => this.permissions.canWrite('hr') || this.permissions.canWrite('leave_management'),
  );

  protected readonly requestForm = this.fb.nonNullable.group({
    employee_id: ['', Validators.required],
    country: ['CH' as LeaveCountryCode, Validators.required],
    leave_type: ['AnnualVacation_Ferie_Ferien' as LeaveTypeEnum, Validators.required],
    start_date: ['', Validators.required],
    end_date: ['', Validators.required],
    half_day_or_hourly_duration: ['full_day'],
    duration_unit: ['days' as LeaveUnitModeCode, Validators.required],
    legge_104_beneficiary_ref: [''],
  });

  protected readonly sickForm = this.fb.nonNullable.group({
    employee_id: ['', Validators.required],
    country: ['IT' as LeaveCountryCode, Validators.required],
    leave_type: ['SickLeave_Malattia' as LeaveTypeEnum, Validators.required],
    start_date: ['', Validators.required],
    end_date: ['', Validators.required],
    inps_medical_certificate_protocol_number: ['', [inpsPucValidator()]],
    suva_claim_number: [''],
    inail_claim_number: [''],
    ijm_ktg_waiting_days: [30],
    ipg_eo_allowance_code: [''],
  });

  ngOnInit(): void {
    void this.store.loadDirectory();
    void this.reload();
  }

  protected async reload(): Promise<void> {
    try {
      await this.store.loadRequests({
        country: this.filterCountry() || undefined,
        leave_type: this.filterType() || undefined,
      });
    } catch {
      this.message.error(this.i18n.translate('COMMON.ERROR'));
    }
  }

  protected async submitStandardRequest(): Promise<void> {
    if (this.requestForm.invalid) {
      return;
    }
    const raw = this.requestForm.getRawValue();
    try {
      await this.store.submitRequest({
        ...raw,
        legge_104_beneficiary_ref: raw.legge_104_beneficiary_ref || null,
      });
      this.requestDrawerOpen.set(false);
      this.message.success(this.i18n.translate('leaveMgmt.action.newRequest'));
    } catch {
      this.message.error(this.i18n.translate('COMMON.ERROR'));
    }
  }

  protected async submitSickRegistration(): Promise<void> {
    if (this.sickForm.invalid) {
      return;
    }
    const raw = this.sickForm.getRawValue();
    try {
      await this.store.registerSickInps({
        employee_id: raw.employee_id,
        country: raw.country,
        leave_type: raw.leave_type,
        start_date: raw.start_date,
        end_date: raw.end_date,
        inps_medical_certificate_protocol_number:
          raw.inps_medical_certificate_protocol_number || null,
        suva_claim_number: raw.suva_claim_number || null,
        inail_claim_number: raw.inail_claim_number || null,
        ijm_ktg_waiting_days: raw.ijm_ktg_waiting_days,
        ipg_eo_allowance_code: raw.ipg_eo_allowance_code || null,
        auto_approve: true,
      });
      this.sickDrawerOpen.set(false);
      this.message.success(this.i18n.translate('leaveMgmt.action.registerSick'));
    } catch {
      this.message.error(this.i18n.translate('COMMON.ERROR'));
    }
  }

  protected async decide(
    row: Mod074LeaveRequestRecord,
    action: 'approve' | 'reject' | 'cancel',
  ): Promise<void> {
    try {
      await this.store.decideRequest(row.id, action);
      this.message.success(this.i18n.translate(`leaveMgmt.action.${action}`));
    } catch {
      this.message.error(this.i18n.translate('COMMON.ERROR'));
    }
  }

  protected statusColor(status: LeaveRequestStatusCode): string {
    return STATUS_TAG_COLORS[status] ?? 'default';
  }

  protected typeColor(type: LeaveTypeEnum): string {
    return LEAVE_TYPE_TAG_COLORS[type] ?? 'blue';
  }
}
