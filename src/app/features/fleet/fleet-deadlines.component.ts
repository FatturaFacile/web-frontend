import { DecimalPipe } from '@angular/common';
import { Component, effect, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  FLEET_DEADLINE_TYPES,
  FleetApiService,
  FleetDeadline,
  FleetDeadlineRequest,
  FleetDeadlineType,
  FleetVehicle,
  TranslateService,
} from '@core';
import { IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText, blankToNull, decimalOrNull, todayIso } from './fleet.util';

/** Compliance deadlines (road tax, insurance, inspection) with expiry alerts and renewal. */
@Component({
  selector: 'app-fleet-deadlines',
  styleUrl: './fleet.scss',
  imports: [
    DecimalPipe,
    FormsModule,
    ReactiveFormsModule,
    IconActionDirective,
    ModalActionsDirective,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    @if (!vehicleId()) {
      <app-page-header [title]="'FLEET.DEADLINES_TITLE' | translate" [subtitle]="'FLEET.DEADLINES_SUBTITLE' | translate">
        <button nz-button nzType="primary" (click)="openModal()" appIconAction="create"></button>
      </app-page-header>
    }

    <div class="toolbar">
      <nz-select style="width: 200px" nzAllowClear [ngModel]="type()" (ngModelChange)="type.set($event); load()" [nzPlaceHolder]="'FLEET.DEADLINE_TYPE' | translate">
        @for (value of deadlineTypes; track value) {
          <nz-option [nzValue]="value" [nzLabel]="('FLEET.DEADLINE_' + value.toUpperCase()) | translate"></nz-option>
        }
      </nz-select>
      <nz-select style="width: 220px" [ngModel]="window()" (ngModelChange)="window.set($event); load()" [attr.aria-label]="'FLEET.SHOW' | translate">
        <nz-option nzValue="open" [nzLabel]="'FLEET.WINDOW_OPEN' | translate"></nz-option>
        <nz-option nzValue="30" [nzLabel]="'FLEET.WINDOW_EXPIRING_30' | translate"></nz-option>
        <nz-option nzValue="60" [nzLabel]="'FLEET.WINDOW_EXPIRING_60' | translate"></nz-option>
        <nz-option nzValue="expired" [nzLabel]="'FLEET.WINDOW_EXPIRED' | translate"></nz-option>
        <nz-option nzValue="renewed" [nzLabel]="'FLEET.WINDOW_RENEWED' | translate"></nz-option>
        <nz-option nzValue="all" [nzLabel]="'FLEET.WINDOW_ALL' | translate"></nz-option>
      </nz-select>
      <span class="spacer"></span>
      @if (vehicleId()) {
        <button nz-button nzType="primary" (click)="openModal()" appIconAction="create"></button>
      }
    </div>

    <nz-card class="main-card">
      <nz-table #table [nzData]="deadlines()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="25">
        <thead>
          <tr>
            @if (!vehicleId()) {
              <th>{{ 'FLEET.VEHICLE' | translate }}</th>
            }
            <th>{{ 'FLEET.DEADLINE_TYPE' | translate }}</th>
            <th>{{ 'FLEET.PROVIDER' | translate }}</th>
            <th>{{ 'FLEET.REFERENCE' | translate }}</th>
            <th>{{ 'FLEET.EXPIRES_ON' | translate }}</th>
            <th>{{ 'FLEET.STATUS' | translate }}</th>
            <th class="num">{{ 'FLEET.COST' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              @if (!vehicleId()) {
                <td>{{ row.vehicle?.license_plate }}</td>
              }
              <td>{{ ('FLEET.DEADLINE_' + row.deadline_type.toUpperCase()) | translate }}</td>
              <td>{{ row.provider }}</td>
              <td>{{ row.reference }}</td>
              <td [class.row-overdue]="row.is_expired">{{ row.expires_on }}</td>
              <td>
                @if (row.status === 'renewed') {
                  <nz-tag>{{ 'FLEET.RENEWED' | translate }}</nz-tag>
                } @else if (row.is_expired) {
                  <nz-tag nzColor="red">{{ 'FLEET.EXPIRED' | translate }}</nz-tag>
                } @else if (row.days_to_expiry <= 30) {
                  <nz-tag nzColor="orange">{{ 'FLEET.EXPIRES_IN_DAYS' | translate: { days: row.days_to_expiry } }}</nz-tag>
                } @else {
                  <nz-tag nzColor="green">{{ 'FLEET.VALID' | translate }}</nz-tag>
                }
              </td>
              <td class="num">{{ row.cost | number: '1.2-2' }} {{ row.currency }}</td>
              <td>
                <div class="row-actions">
                  @if (row.status === 'open') {
                    <button nz-button nzType="default" (click)="openRenew(row)">{{ 'FLEET.RENEW' | translate }}</button>
                  }
                  <button nz-button nzType="text" appIconAction="edit" (click)="openModal(row)"></button>
                  <button nz-button nzType="text" nzDanger appIconAction="delete" nz-popconfirm [nzPopconfirmTitle]="'FLEET.DELETE_CONFIRM' | translate" (nzOnConfirm)="remove(row)"></button>
                </div>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && deadlines().length === 0) {
        <nz-empty [nzNotFoundContent]="'FLEET.NO_DEADLINES' | translate"></nz-empty>
      }
    </nz-card>

    <nz-modal appModalActions [(nzVisible)]="modalVisible" [nzTitle]="(editing() ? 'FLEET.EDIT_DEADLINE' : 'FLEET.NEW_DEADLINE') | translate" (nzOnCancel)="modalVisible.set(false)" (nzOnOk)="save()" okAction="save" [nzOkDisabled]="form.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="form" nzLayout="vertical">
          @if (!editing()) {
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'FLEET.VEHICLE' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="vehicle_id" nzShowSearch>
                  @for (vehicle of vehicles(); track vehicle.id) {
                    <nz-option [nzValue]="vehicle.id" [nzLabel]="vehicle.license_plate + ' - ' + vehicle.make + ' ' + vehicle.model"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          }
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'FLEET.DEADLINE_TYPE' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="deadline_type">
                  @for (value of deadlineTypes; track value) {
                    <nz-option [nzValue]="value" [nzLabel]="('FLEET.DEADLINE_' + value.toUpperCase()) | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="deadline-expires">{{ 'FLEET.EXPIRES_ON' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="deadline-expires" type="date" formControlName="expires_on" /></nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzFor="deadline-provider">{{ 'FLEET.PROVIDER' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="deadline-provider" formControlName="provider" maxlength="160" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="deadline-reference">{{ 'FLEET.REFERENCE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="deadline-reference" formControlName="reference" maxlength="80" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="deadline-cost">{{ 'FLEET.COST' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="deadline-cost" type="number" min="0" step="any" formControlName="cost" /></nz-form-control>
            </nz-form-item>
          </div>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal appModalActions [(nzVisible)]="renewVisible" [nzTitle]="'FLEET.RENEW' | translate" (nzOnCancel)="renewVisible.set(false)" (nzOnOk)="saveRenew()" okAction="save" [nzOkDisabled]="renewForm.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="renewForm" nzLayout="vertical">
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="renew-expires">{{ 'FLEET.NEW_EXPIRY' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="renew-expires" type="date" formControlName="expires_on" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="renew-cost">{{ 'FLEET.COST' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="renew-cost" type="number" min="0" step="any" formControlName="cost" /></nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzFor="renew-provider">{{ 'FLEET.PROVIDER' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="renew-provider" formControlName="provider" maxlength="160" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="renew-reference">{{ 'FLEET.REFERENCE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="renew-reference" formControlName="reference" maxlength="80" /></nz-form-control>
            </nz-form-item>
          </div>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class FleetDeadlinesComponent implements OnInit {
  private readonly api = inject(FleetApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  /** When set, the list is limited to this vehicle (vehicle page). */
  readonly vehicleId = input<string | null>(null);

  readonly deadlineTypes = FLEET_DEADLINE_TYPES;
  readonly deadlines = signal<FleetDeadline[]>([]);
  readonly vehicles = signal<FleetVehicle[]>([]);
  readonly loading = signal(false);
  readonly type = signal<FleetDeadlineType | null>(null);
  /** What to list: the open deadlines, those expiring within 30 or 60 days, the expired, the renewed or all. */
  readonly window = signal('open');
  readonly modalVisible = signal(false);
  readonly renewVisible = signal(false);
  readonly editing = signal<FleetDeadline | null>(null);
  readonly renewing = signal<FleetDeadline | null>(null);

  readonly form = this.fb.group({
    vehicle_id: ['', [Validators.required]],
    deadline_type: ['insurance' as FleetDeadlineType, [Validators.required]],
    provider: [''],
    reference: [''],
    expires_on: [todayIso(), [Validators.required]],
    cost: this.fb.control<number | null>(null, [Validators.min(0)]),
  });

  readonly renewForm = this.fb.group({
    expires_on: ['', [Validators.required]],
    cost: this.fb.control<number | null>(null, [Validators.min(0)]),
    provider: [''],
    reference: [''],
  });

  constructor() {
    effect(() => {
      this.vehicleId();
      this.load();
    });
  }

  ngOnInit(): void {
    this.api.getVehicles({ per_page: 100 }).subscribe((response) => this.vehicles.set(response.data));
  }

  load(): void {
    const window = this.window();
    this.loading.set(true);
    this.api
      .getDeadlines({
        vehicle_id: this.vehicleId() ?? undefined,
        deadline_type: this.type() ?? undefined,
        status: window === 'renewed' ? 'renewed' : window === 'all' ? undefined : 'open',
        expiring: window === '30' || window === '60' ? Number(window) : undefined,
        expired: window === 'expired' ? true : undefined,
        per_page: 100,
      })
      .subscribe({
        next: (response) => {
          this.deadlines.set(response.data);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.message.error(this.translate.instant('FLEET.ACTION_ERROR'));
        },
      });
  }

  openModal(deadline: FleetDeadline | null = null): void {
    this.editing.set(deadline);
    this.form.reset({
      vehicle_id: deadline?.vehicle_id ?? this.vehicleId() ?? '',
      deadline_type: deadline?.deadline_type ?? 'insurance',
      provider: deadline?.provider ?? '',
      reference: deadline?.reference ?? '',
      expires_on: deadline?.expires_on ?? todayIso(),
      cost: deadline ? Number(deadline.cost) : null,
    });
    this.modalVisible.set(true);
  }

  save(): void {
    const value = this.form.getRawValue();
    const payload: FleetDeadlineRequest = {
      deadline_type: value.deadline_type,
      provider: blankToNull(value.provider),
      reference: blankToNull(value.reference),
      expires_on: value.expires_on,
      cost: decimalOrNull(value.cost) ?? '0',
    };
    const current = this.editing();
    const request = current ? this.api.updateDeadline(current.id, payload) : this.api.createDeadline({ ...payload, vehicle_id: value.vehicle_id });

    request.subscribe({
      next: () => {
        this.message.success(this.translate.instant('FLEET.DEADLINE_SAVED'));
        this.modalVisible.set(false);
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('FLEET.ACTION_ERROR')),
    });
  }

  openRenew(deadline: FleetDeadline): void {
    this.renewing.set(deadline);
    this.renewForm.reset({ expires_on: '', cost: Number(deadline.cost), provider: deadline.provider ?? '', reference: deadline.reference ?? '' });
    this.renewVisible.set(true);
  }

  saveRenew(): void {
    const deadline = this.renewing();
    if (!deadline) {
      return;
    }

    const value = this.renewForm.getRawValue();
    this.api
      .renewDeadline(deadline.id, {
        expires_on: value.expires_on,
        cost: decimalOrNull(value.cost),
        provider: blankToNull(value.provider),
        reference: blankToNull(value.reference),
      })
      .subscribe({
        next: () => {
          this.message.success(this.translate.instant('FLEET.DEADLINE_RENEWED'));
          this.renewVisible.set(false);
          this.load();
        },
        error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('FLEET.ACTION_ERROR')),
      });
  }

  remove(deadline: FleetDeadline): void {
    this.api.deleteDeadline(deadline.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('FLEET.DELETED'));
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('FLEET.ACTION_ERROR')),
    });
  }
}
