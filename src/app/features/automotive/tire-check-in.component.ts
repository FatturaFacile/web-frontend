import { Component, inject, model, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { AutomotiveApiService, AutomotiveVehicle, TireCheckInPayload, TranslateService } from '@core';
import { ModalActionsDirective, TranslatePipe } from '@shared';

const SEASONS: readonly TireCheckInPayload['season'][] = ['summer', 'winter', 'all_season'];

/** Stores a customer's tire set in the tire hotel (POST /automotive/tire-hotel/check-in). */
@Component({
  selector: 'app-tire-check-in',
  imports: [ReactiveFormsModule, NzFormModule, NzInputModule, NzInputNumberModule, NzModalModule, NzSelectModule, ModalActionsDirective, TranslatePipe],
  template: `
    <nz-modal appModalActions
      [nzVisible]="open()"
      [nzTitle]="'TIRE_HOTEL.CHECK_IN' | translate"
      okAction="save"
      [nzOkDisabled]="form.invalid"
      [nzOkLoading]="saving()"
      (nzOnCancel)="open.set(false)"
      (nzOnOk)="submit()"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="form">
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'TIRE_HOTEL.COL_PLATE_MODEL' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="vehicle_id" nzShowSearch (nzOnSearch)="searchVehicles($event)" (nzOpenChange)="$event && !vehicles().length && searchVehicles('')">
                @for (v of vehicles(); track v.id) {
                  <nz-option [nzValue]="v.id" [nzLabel]="v.license_plate + ' - ' + v.make + ' ' + v.model"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'TIRE_HOTEL.COL_SEASON' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="season">
                @for (s of seasons; track s) {
                  <nz-option [nzValue]="s" [nzLabel]="'TIRE_HOTEL.SEASON_' + s.toUpperCase() | translate"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'TIRE_HOTEL.BRAND' | translate }}</nz-form-label>
            <nz-form-control><input nz-input formControlName="brand" maxlength="100" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>{{ 'TIRE_HOTEL.MODEL' | translate }}</nz-form-label>
            <nz-form-control><input nz-input formControlName="model" maxlength="100" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'TIRE_HOTEL.SIZE' | translate }}</nz-form-label>
            <nz-form-control><input nz-input formControlName="size" maxlength="50" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>DOT</nz-form-label>
            <nz-form-control><input nz-input formControlName="dot" maxlength="20" /></nz-form-control>
          </nz-form-item>
          @for (field of treads; track field) {
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'TIRE_HOTEL.TREAD_' + field.toUpperCase() | translate }}</nz-form-label>
              <nz-form-control><nz-input-number [formControlName]="field" [nzMin]="0" [nzMax]="20" [nzStep]="0.1" /></nz-form-control>
            </nz-form-item>
          }
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'TIRE_HOTEL.COL_RACK' | translate }}</nz-form-label>
            <nz-form-control><input nz-input formControlName="warehouse_shelf_location" maxlength="100" /></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class TireCheckInComponent {
  private readonly api = inject(AutomotiveApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly open = model.required<boolean>();
  readonly checkedIn = output<void>();

  protected readonly seasons = SEASONS;
  protected readonly treads = ['front_left_tread_mm', 'front_right_tread_mm', 'rear_left_tread_mm', 'rear_right_tread_mm'] as const;
  protected readonly vehicles = signal<AutomotiveVehicle[]>([]);
  protected readonly saving = signal(false);

  protected readonly form = this.fb.group({
    vehicle_id: ['', Validators.required],
    season: ['winter' as TireCheckInPayload['season'], Validators.required],
    brand: ['', [Validators.required, Validators.maxLength(100)]],
    model: [''],
    size: ['', [Validators.required, Validators.maxLength(50)]],
    dot: [''],
    front_left_tread_mm: [8, [Validators.required, Validators.min(0)]],
    front_right_tread_mm: [8, [Validators.required, Validators.min(0)]],
    rear_left_tread_mm: [8, [Validators.required, Validators.min(0)]],
    rear_right_tread_mm: [8, [Validators.required, Validators.min(0)]],
    warehouse_shelf_location: ['', [Validators.required, Validators.maxLength(100)]],
  });

  protected searchVehicles(term: string): void {
    this.api.listVehicles({ search: term, per_page: 20 }).subscribe((res) => this.vehicles.set(res.data));
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    const payload: TireCheckInPayload = { ...raw, model: raw.model || null, dot: raw.dot || null };
    this.saving.set(true);
    this.api.checkInTires(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.open.set(false);
        this.message.success(this.translate.instant('TIRE_HOTEL.CHECK_IN_SUCCESS'));
        this.checkedIn.emit();
      },
      error: () => {
        this.saving.set(false);
        this.message.error(this.translate.instant('TIRE_HOTEL.CHECK_IN_ERROR'));
      },
    });
  }
}
