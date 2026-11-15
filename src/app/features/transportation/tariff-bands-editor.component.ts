import { Component, inject, input, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzTableModule } from 'ng-zorro-antd/table';
import { TmsTariffBand, TmsTariffBandPayload, TranslateService, TransportationApiService } from '@core';
import { ModalActionsDirective, TranslatePipe } from '@shared';
import { apiErrorText, isRangeValid, nullable } from './transportation.util';

/** Editor of the price bands of one tariff table: zone pair, weight range, distance range and prices (from inclusive, to exclusive, empty to means open ended). */
@Component({
  selector: 'app-tariff-bands-editor',
  styleUrl: './transportation.scss',
  imports: [ReactiveFormsModule, ModalActionsDirective, TranslatePipe, NzButtonModule, NzFormModule, NzInputModule, NzModalModule, NzPopconfirmModule, NzTableModule],
  template: `
    @if (canEdit()) {
      <div class="toolbar">
        <button nz-button nzType="primary" type="button" (click)="startAdd()">{{ 'TMS.ACTION_NEW_TARIFF_BAND' | translate }}</button>
      </div>
    }

    <nz-table #table [nzData]="bands()" [nzShowPagination]="false" [nzLoading]="loading()" nzSize="small">
      <thead>
        <tr>
          <th>{{ 'TMS.BAND_ORIGIN_ZONE' | translate }}</th>
          <th>{{ 'TMS.BAND_DESTINATION_ZONE' | translate }}</th>
          <th class="num">{{ 'TMS.BAND_WEIGHT_RANGE' | translate }}</th>
          <th class="num">{{ 'TMS.BAND_DISTANCE_RANGE' | translate }}</th>
          <th class="num">{{ 'TMS.BAND_FIXED_AMOUNT' | translate }}</th>
          <th class="num">{{ 'TMS.BAND_PRICE_PER_KG' | translate }}</th>
          <th class="num">{{ 'TMS.BAND_PRICE_PER_KM' | translate }}</th>
          @if (canEdit()) {
            <th></th>
          }
        </tr>
      </thead>
      <tbody>
        @for (band of table.data; track band.id) {
          <tr>
            <td>{{ band.origin_zone || '*' }}</td>
            <td>{{ band.destination_zone || '*' }}</td>
            <td class="num">{{ band.weight_from_kg }} - {{ band.weight_to_kg ?? '∞' }}</td>
            <td class="num">{{ band.distance_from_km }} - {{ band.distance_to_km ?? '∞' }}</td>
            <td class="num">{{ band.fixed_amount }}</td>
            <td class="num">{{ band.price_per_kg }}</td>
            <td class="num">{{ band.price_per_km }}</td>
            @if (canEdit()) {
              <td class="num">
                <button nz-button nzSize="small" nzType="link" type="button" (click)="startEdit(band)">{{ 'RES.ACTION.EDIT' | translate }}</button>
                <button
                  nz-button
                  nzSize="small"
                  nzType="link"
                  nzDanger
                  type="button"
                  nz-popconfirm
                  [nzPopconfirmTitle]="'RES.ACTION.CONFIRM' | translate"
                  (nzOnConfirm)="remove(band)"
                >
                  {{ 'RES.ACTION.DELETE' | translate }}
                </button>
              </td>
            }
          </tr>
        }
      </tbody>
    </nz-table>

    <nz-modal [nzVisible]="editing() !== null" [nzTitle]="'TMS.TAB_TARIFF_BANDS' | translate" (nzOnCancel)="editing.set(null)" (nzOnOk)="save()" okAction="confirm" [nzOkDisabled]="!isValid()" nzWidth="720px">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="form" nzLayout="vertical">
          <div class="form-row">
            <nz-form-item>
              <nz-form-label>{{ 'TMS.BAND_ORIGIN_ZONE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input formControlName="origin_zone" maxlength="30" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'TMS.BAND_DESTINATION_ZONE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input formControlName="destination_zone" maxlength="30" /></nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label>{{ 'TMS.BAND_WEIGHT_FROM' | translate }}</nz-form-label>
              <nz-form-control><input nz-input type="number" min="0" formControlName="weight_from_kg" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'TMS.BAND_WEIGHT_TO' | translate }}</nz-form-label>
              <nz-form-control><input nz-input type="number" min="0" formControlName="weight_to_kg" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'TMS.BAND_DISTANCE_FROM' | translate }}</nz-form-label>
              <nz-form-control><input nz-input type="number" min="0" formControlName="distance_from_km" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'TMS.BAND_DISTANCE_TO' | translate }}</nz-form-label>
              <nz-form-control><input nz-input type="number" min="0" formControlName="distance_to_km" /></nz-form-control>
            </nz-form-item>
          </div>
          @if (!rangesValid()) {
            <p class="muted" role="alert">{{ 'TMS.BAND_RANGE_ERROR' | translate }}</p>
          }
          <div class="form-row">
            <nz-form-item>
              <nz-form-label>{{ 'TMS.BAND_FIXED_AMOUNT' | translate }}</nz-form-label>
              <nz-form-control><input nz-input type="number" min="0" formControlName="fixed_amount" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'TMS.BAND_PRICE_PER_KG' | translate }}</nz-form-label>
              <nz-form-control><input nz-input type="number" min="0" formControlName="price_per_kg" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'TMS.BAND_PRICE_PER_KM' | translate }}</nz-form-label>
              <nz-form-control><input nz-input type="number" min="0" formControlName="price_per_km" /></nz-form-control>
            </nz-form-item>
          </div>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class TariffBandsEditorComponent implements OnInit {
  private readonly api = inject(TransportationApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly tariffTableId = input.required<string>();
  readonly canEdit = input(true);

  readonly bands = signal<TmsTariffBand[]>([]);
  readonly loading = signal(false);
  /** The band being edited, 'new' for a band to create, null while the dialog is closed. */
  readonly editing = signal<TmsTariffBand | 'new' | null>(null);

  readonly form = this.fb.group({
    origin_zone: '',
    destination_zone: '',
    weight_from_kg: '0',
    weight_to_kg: '',
    distance_from_km: '0',
    distance_to_km: '',
    fixed_amount: '0',
    price_per_kg: '0',
    price_per_km: '0',
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.getTariffBands(this.tariffTableId()).subscribe({
      next: (response) => {
        this.bands.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('TMS.LOAD_ERROR'));
      },
    });
  }

  startAdd(): void {
    this.form.reset();
    this.editing.set('new');
  }

  startEdit(band: TmsTariffBand): void {
    this.form.reset({
      origin_zone: band.origin_zone ?? '',
      destination_zone: band.destination_zone ?? '',
      weight_from_kg: band.weight_from_kg,
      weight_to_kg: band.weight_to_kg ?? '',
      distance_from_km: band.distance_from_km,
      distance_to_km: band.distance_to_km ?? '',
      fixed_amount: band.fixed_amount,
      price_per_kg: band.price_per_kg,
      price_per_km: band.price_per_km,
    });
    this.editing.set(band);
  }

  rangesValid(): boolean {
    const value = this.form.getRawValue();
    return isRangeValid(value.weight_from_kg, value.weight_to_kg) && isRangeValid(value.distance_from_km, value.distance_to_km);
  }

  isValid(): boolean {
    const value = this.form.getRawValue();
    const amounts = [value.weight_from_kg, value.distance_from_km, value.fixed_amount, value.price_per_kg, value.price_per_km];
    return this.rangesValid() && amounts.every((amount) => amount !== '' && Number(amount) >= 0);
  }

  payload(): TmsTariffBandPayload {
    const value = this.form.getRawValue();
    return {
      origin_zone: nullable(value.origin_zone),
      destination_zone: nullable(value.destination_zone),
      weight_from_kg: value.weight_from_kg,
      weight_to_kg: nullable(value.weight_to_kg),
      distance_from_km: value.distance_from_km,
      distance_to_km: nullable(value.distance_to_km),
      fixed_amount: value.fixed_amount,
      price_per_kg: value.price_per_kg,
      price_per_km: value.price_per_km,
    };
  }

  save(): void {
    const target = this.editing();
    if (target === null || !this.isValid()) {
      return;
    }
    const request =
      target === 'new'
        ? this.api.createTariffBand({ tariff_table_id: this.tariffTableId(), ...this.payload() })
        : this.api.updateTariffBand(target.id, this.payload());
    request.subscribe({
      next: () => {
        this.editing.set(null);
        this.message.success(this.translate.instant('RES.MSG.DONE'));
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('TMS.ACTION_ERROR')),
    });
  }

  remove(band: TmsTariffBand): void {
    this.api.deleteTariffBand(band.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('RES.MSG.DONE'));
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('TMS.ACTION_ERROR')),
    });
  }
}
