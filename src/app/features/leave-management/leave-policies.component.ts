import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  I18nService,
  LeaveCountryCode,
  LeaveTypeEnum,
  LeaveUnitModeCode,
  PermissionsService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
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
import { LEAVE_TYPE_OPTIONS } from './leave-management.util';

/**
 * Configuration of CH / IT Leave Entitlement Policies (Ferie, ROL, Ex-Festività, Art. 329a/329b CO,
 * 18-month INPS alerts, IJM/KTG Wartefrist, SUVA/INAIL, Legge 104/1992, Comporto).
 */
@Component({
  selector: 'app-leave-policies',
  imports: [
    ReactiveFormsModule,
    NzButtonModule,
    NzCardModule,
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
    <app-leave-management-nav activeTab="policies" />

    <nz-card class="mb-4">
      <div class="flex justify-between items-center">
        <span class="font-semibold">{{ 'leaveMgmt.tab.policies' | translate }}</span>
        @if (canManage()) {
          <button
            nz-button
            nzType="primary"
            type="button"
            data-testid="lm-new-policy-btn"
            (click)="drawerOpen.set(true)"
          >
            {{ 'leaveMgmt.action.createPolicy' | translate }}
          </button>
        }
      </div>
    </nz-card>

    <nz-card>
      <nz-table #polTable [nzData]="store.policies()" [nzLoading]="store.loading()" nzSize="middle">
        <thead>
          <tr>
            <th>Code</th>
            <th>Name</th>
            <th>{{ 'leaveMgmt.field.country' | translate }}</th>
            <th>{{ 'leaveMgmt.field.leaveType' | translate }}</th>
            <th nzAlign="right">Entitlement</th>
            <th>Unit</th>
            <th>Accrual</th>
            <th>Legal Flags</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          @for (pol of polTable.data; track pol.id) {
            <tr>
              <td>{{ pol.code }}</td>
              <td>{{ pol.name }}</td>
              <td>
                <nz-tag>{{ pol.country }}</nz-tag>
              </td>
              <td>{{ 'leaveMgmt.type.' + pol.leave_type | translate }}</td>
              <td nzAlign="right">{{ pol.annual_entitlement }}</td>
              <td>{{ pol.unit_mode }}</td>
              <td>{{ pol.accrual_frequency }}</td>
              <td>
                @if (pol.inps_18_month_alert_enabled) {
                  <nz-tag nzColor="orange">INPS 18m</nz-tag>
                }
                @if (pol.ch_curtailment_enabled) {
                  <nz-tag nzColor="blue">Art. 329b CO</nz-tag>
                }
                @if (pol.requires_inps_puc) {
                  <nz-tag nzColor="volcano">PUC</nz-tag>
                }
              </td>
              <td>
                @if (canManage()) {
                  <button
                    nz-button
                    nzSize="small"
                    nzDanger
                    type="button"
                    nz-popconfirm
                    nzPopconfirmTitle="Delete?"
                    (nzOnConfirm)="removePolicy(pol.id)"
                  >
                    Delete
                  </button>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    <nz-drawer
      [nzVisible]="drawerOpen()"
      [nzTitle]="'leaveMgmt.action.createPolicy' | translate"
      [nzWidth]="520"
      (nzOnClose)="drawerOpen.set(false)"
    >
      <ng-container *nzDrawerContent>
        <form nz-form nzLayout="vertical" [formGroup]="form" (ngSubmit)="savePolicy()">
          <div class="grid grid-cols-2 gap-3">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="pol-code">Code</nz-form-label>
              <nz-form-control
                ><input nz-input id="pol-code" formControlName="code"
              /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="pol-country">{{
                'leaveMgmt.field.country' | translate
              }}</nz-form-label>
              <nz-form-control>
                <nz-select nzId="pol-country" formControlName="country">
                  <nz-option nzValue="CH" [nzLabel]="'leaveMgmt.country.CH' | translate" />
                  <nz-option nzValue="IT" [nzLabel]="'leaveMgmt.country.IT' | translate" />
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="pol-name">Name</nz-form-label>
            <nz-form-control
              ><input nz-input id="pol-name" formControlName="name"
            /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="pol-type">{{
              'leaveMgmt.field.leaveType' | translate
            }}</nz-form-label>
            <nz-form-control>
              <nz-select nzId="pol-type" formControlName="leave_type">
                @for (lt of leaveTypeOptions; track lt) {
                  <nz-option [nzValue]="lt" [nzLabel]="'leaveMgmt.type.' + lt | translate" />
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <div class="grid grid-cols-3 gap-3">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="pol-ent">Entitlement</nz-form-label>
              <nz-form-control>
                <nz-input-number
                  id="pol-ent"
                  class="w-full"
                  formControlName="annual_entitlement"
                  [nzMin]="0"
                  [nzMax]="3000"
                />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="pol-unit">Unit</nz-form-label>
              <nz-form-control>
                <nz-select nzId="pol-unit" formControlName="unit_mode">
                  <nz-option nzValue="days" nzLabel="Days" />
                  <nz-option nzValue="hours" nzLabel="Hours" />
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="pol-freq">Accrual</nz-form-label>
              <nz-form-control>
                <nz-select nzId="pol-freq" formControlName="accrual_frequency">
                  <nz-option nzValue="monthly" nzLabel="Monthly" />
                  <nz-option nzValue="yearly" nzLabel="Yearly" />
                  <nz-option nzValue="none" nzLabel="None" />
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <nz-form-item>
              <nz-form-label nzFor="pol-18m">INPS 18m Alert</nz-form-label>
              <nz-form-control
                ><nz-switch id="pol-18m" formControlName="inps_18_month_alert_enabled"
              /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="pol-329b">Art. 329b CO Curtailment</nz-form-label>
              <nz-form-control
                ><nz-switch id="pol-329b" formControlName="ch_curtailment_enabled"
              /></nz-form-control>
            </nz-form-item>
          </div>
          <div class="flex justify-end gap-2 mt-4">
            <button nz-button type="button" (click)="drawerOpen.set(false)">
              {{ 'leaveMgmt.action.cancel' | translate }}
            </button>
            <button
              nz-button
              nzType="primary"
              type="submit"
              [disabled]="form.invalid"
              [nzLoading]="store.saving()"
            >
              {{ 'leaveMgmt.action.createPolicy' | translate }}
            </button>
          </div>
        </form>
      </ng-container>
    </nz-drawer>
  `,
})
export class LeavePoliciesComponent implements OnInit {
  protected readonly store = inject(LeaveManagementStore);
  private readonly fb = inject(FormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly permissions = inject(PermissionsService);

  protected readonly leaveTypeOptions = LEAVE_TYPE_OPTIONS;
  protected readonly drawerOpen = signal(false);

  protected readonly canManage = computed(
    () => this.permissions.canWrite('hr') || this.permissions.canWrite('leave_management'),
  );

  protected readonly form = this.fb.nonNullable.group({
    code: ['', Validators.required],
    name: ['', Validators.required],
    country: ['CH' as LeaveCountryCode, Validators.required],
    leave_type: ['AnnualVacation_Ferie_Ferien' as LeaveTypeEnum, Validators.required],
    unit_mode: ['days' as LeaveUnitModeCode, Validators.required],
    annual_entitlement: [20, Validators.required],
    accrual_frequency: ['monthly' as 'monthly' | 'yearly' | 'none', Validators.required],
    inps_18_month_alert_enabled: [false],
    ch_curtailment_enabled: [false],
  });

  ngOnInit(): void {
    void this.store.loadPolicies();
  }

  protected async savePolicy(): Promise<void> {
    if (this.form.invalid) {
      return;
    }
    try {
      await this.store.createPolicy(this.form.getRawValue());
      this.drawerOpen.set(false);
      this.message.success(this.i18n.translate('leaveMgmt.action.createPolicy'));
    } catch {
      this.message.error(this.i18n.translate('COMMON.ERROR'));
    }
  }

  protected async removePolicy(id: string): Promise<void> {
    try {
      await this.store.deletePolicy(id);
    } catch {
      this.message.error(this.i18n.translate('COMMON.ERROR'));
    }
  }
}
