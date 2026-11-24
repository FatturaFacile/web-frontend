import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { applyServerErrors, FsmApiService, FsmEquipment, FsmEquipmentHistory, I18nService, PermissionsService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';

/** Equipment of the customers with its service history (signed reports, replaced parts, meters) and meter update. */
@Component({
  selector: 'app-equipment-service-history',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzFormModule,
    NzInputNumberModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  styles: `
    .eq-alert {
      margin: 12px 0;
    }

    .eq-meter-form {
      gap: 8px;
    }

    .eq-card {
      margin-top: 16px;
    }
  `,
  template: `
    <app-page-header [title]="'FSM.EQUIP.TITLE' | translate" [subtitle]="'FSM.EQUIP.SUBTITLE' | translate" />

    @if (loadError()) {
      <nz-alert class="eq-alert" nzType="error" nzShowIcon [nzMessage]="'FSM.EQUIP.LOAD_ERROR' | translate" />
    }

    <nz-card>
      <nz-table nzSize="small" [nzData]="equipment()" [nzLoading]="loading()" [nzShowPagination]="equipment().length > 20" data-testid="equipment-table">
        <thead>
          <tr>
            <th>{{ 'FSM.EQUIP.SERIAL' | translate }}</th>
            <th>{{ 'FSM.EQUIP.SITE' | translate }}</th>
            <th>{{ 'FSM.EQUIP.HOURS' | translate }}</th>
            <th>{{ 'FSM.EQUIP.CYCLES' | translate }}</th>
            <th>{{ 'FSM.EQUIP.LAST_SERVICE' | translate }}</th>
            <th>{{ 'FSM.EQUIP.NEXT_SERVICE' | translate }}</th>
            <th>{{ 'COMMON.ACTIONS' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (item of equipment(); track item.id) {
            <tr [class.eq-selected]="item.id === selectedId()">
              <td>{{ item.serial_number }}</td>
              <td>{{ item.site_address ?? '-' }}</td>
              <td>{{ item.current_operating_hours }}</td>
              <td>{{ item.current_cycle_count }}</td>
              <td>{{ item.last_service_date ?? '-' }}</td>
              <td>{{ item.next_scheduled_service_date ?? '-' }}</td>
              <td>
                <button nz-button nzSize="small" type="button" [attr.aria-pressed]="item.id === selectedId()" (click)="select(item)">
                  {{ 'FSM.EQUIP.HISTORY' | translate }}
                </button>
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="7">{{ 'FSM.EQUIP.EMPTY' | translate }}</td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    @if (history(); as h) {
      <nz-card class="eq-card" [nzTitle]="('FSM.EQUIP.HISTORY_OF' | translate) + ' ' + h.equipment.serial_number" data-testid="history-card">
        @if (canWrite()) {
          <form nz-form nzLayout="inline" class="eq-meter-form" [formGroup]="meterForm" (ngSubmit)="saveMeters()">
            <nz-form-item>
              <nz-form-label nzFor="eq-hours">{{ 'FSM.EQUIP.HOURS' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-input-number nzId="eq-hours" formControlName="current_operating_hours" [nzMin]="0" [nzStep]="0.1" />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="eq-cycles">{{ 'FSM.EQUIP.CYCLES' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-input-number nzId="eq-cycles" formControlName="current_cycle_count" [nzMin]="0" [nzStep]="1" [nzPrecision]="0" />
              </nz-form-control>
            </nz-form-item>
            <button nz-button nzType="primary" type="submit" [nzLoading]="metersSaving()" [disabled]="meterForm.invalid || meterForm.pristine">
              {{ 'FSM.EQUIP.UPDATE_METERS' | translate }}
            </button>
          </form>
          @if (meterError()) {
            <nz-alert class="eq-alert" nzType="error" nzShowIcon data-testid="meter-error" [nzMessage]="meterError()" />
          }
        }

        <nz-table nzSize="small" [nzData]="h.history" [nzShowPagination]="false" data-testid="history-table">
          <thead>
            <tr>
              <th>{{ 'FSM.EQUIP.SIGNED_AT' | translate }}</th>
              <th>{{ 'FSM.REPORT.NUMBER' | translate }}</th>
              <th>{{ 'FSM.WO.TYPE' | translate }}</th>
              <th>{{ 'FSM.REPORT.SUMMARY' | translate }}</th>
              <th>{{ 'FSM.REPORT.LABOR_HOURS' | translate }}</th>
              <th>{{ 'FSM.REPORT.METERS' | translate }}</th>
              <th>{{ 'FSM.WO.PARTS' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (entry of h.history; track entry.report_id) {
              <tr>
                <td>{{ entry.signed_at.slice(0, 16).replace('T', ' ') }}</td>
                <td>
                  <a [routerLink]="['/field-service/work-orders', entry.work_order_id]">{{ entry.report_number }}</a>
                </td>
                <td>{{ entry.work_type ? ('FSM.TYPE.' + entry.work_type.toUpperCase() | translate) : '-' }}</td>
                <td>{{ entry.summary }}</td>
                <td>{{ entry.labor_hours }}</td>
                <td>{{ entry.meter_reading_hours ?? '-' }} h / {{ entry.meter_reading_cycles ?? '-' }}</td>
                <td>
                  @for (part of entry.parts; track $index) {
                    <nz-tag [nzColor]="part.covered ? 'green' : 'orange'">
                      {{ part.quantity }} &times; {{ part.product_id.slice(0, 8) }} ({{ (part.covered ? 'FSM.WO.COVERED' : 'FSM.WO.CHARGEABLE') | translate }})
                    </nz-tag>
                  } @empty {
                    -
                  }
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="7">{{ 'FSM.EQUIP.NO_HISTORY' | translate }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-card>
    }
  `,
})
export class EquipmentServiceHistoryComponent implements OnInit {
  private readonly api = inject(FsmApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly permissions = inject(PermissionsService);

  protected readonly canWrite = computed(() => this.permissions.canWrite('service'));
  protected readonly equipment = signal<FsmEquipment[]>([]);
  protected readonly loading = signal(false);
  protected readonly loadError = signal(false);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly history = signal<FsmEquipmentHistory | null>(null);

  protected readonly metersSaving = signal(false);
  protected readonly meterError = signal<string | null>(null);
  protected readonly meterForm = this.fb.group({
    current_operating_hours: this.fb.control<number | null>(null, Validators.min(0)),
    current_cycle_count: this.fb.control<number | null>(null, Validators.min(0)),
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.api.listEquipment().subscribe({
      next: (res) => {
        this.equipment.set(res.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
      },
    });
  }

  protected select(item: FsmEquipment): void {
    this.selectedId.set(item.id);
    this.meterError.set(null);
    this.loadHistory(item.id);
  }

  protected saveMeters(): void {
    const id = this.selectedId();
    if (!id || this.meterForm.invalid || this.metersSaving()) {
      return;
    }
    const v = this.meterForm.getRawValue();
    this.metersSaving.set(true);
    this.meterError.set(null);
    this.api
      .updateMeters(id, { current_operating_hours: v.current_operating_hours, current_cycle_count: v.current_cycle_count })
      .subscribe({
        next: () => {
          this.metersSaving.set(false);
          this.message.success(this.i18n.translate('FSM.EQUIP.METERS_UPDATED'));
          this.load();
          this.loadHistory(id);
        },
        error: (error: unknown) => {
          this.metersSaving.set(false);
          const messages = applyServerErrors(this.meterForm, error);
          this.meterError.set(messages[0] ?? this.i18n.translate('FSM.EQUIP.METERS_FAILED'));
        },
      });
  }

  private loadHistory(id: string): void {
    this.api.getEquipmentHistory(id).subscribe({
      next: (res) => {
        this.history.set(res.data);
        this.meterForm.reset({
          current_operating_hours: Number(res.data.equipment.current_operating_hours),
          current_cycle_count: res.data.equipment.current_cycle_count,
        });
      },
      error: () => {
        this.history.set(null);
        this.message.error(this.i18n.translate('FSM.EQUIP.HISTORY_FAILED'));
      },
    });
  }
}
