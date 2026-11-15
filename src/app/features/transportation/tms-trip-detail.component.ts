import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { Observable } from 'rxjs';
import { PermissionsService, TmsTrip, TmsTripStatus, TmsTripStop, TranslateService, TransportationApiService, TransportationResponse } from '@core';
import { ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText, moveId, nullable, TRIP_STATUS_COLORS } from './transportation.util';

type TripDialog = 'stop' | 'trip';

/** One trip with its capacity use and the stops: reorder them while planned or dispatched, complete them one after the other while in progress. */
@Component({
  selector: 'app-tms-trip-detail',
  styleUrl: './transportation.scss',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ModalActionsDirective,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    @if (trip(); as record) {
      <app-page-header [title]="record.number" [subtitle]="record.carrier?.name ?? ''">
        <a nz-button routerLink="/transportation/trips">{{ 'TMS.BACK_TO_LIST' | translate }}</a>
        @if (canEdit()) {
          @if (record.status === 'planned') {
            <button nz-button nzType="primary" type="button" (click)="run('dispatch')">{{ 'TMS.ACTION_DISPATCH' | translate }}</button>
          }
          @if (record.status === 'dispatched') {
            <button nz-button nzType="primary" type="button" (click)="run('start')">{{ 'TMS.ACTION_START' | translate }}</button>
          }
          @if (record.status === 'in_progress') {
            <button nz-button nzType="primary" type="button" (click)="openTripDialog()">{{ 'TMS.ACTION_COMPLETE' | translate }}</button>
          }
          @if (record.status === 'planned' || record.status === 'dispatched') {
            <button nz-button nzDanger type="button" (click)="run('cancel')">{{ 'TMS.ACTION_CANCEL' | translate }}</button>
          }
        }
      </app-page-header>

      <nz-card class="main-card">
        <dl class="detail-grid">
          <div>
            <dt>{{ 'TMS.STATUS' | translate }}</dt>
            <dd><nz-tag [nzColor]="statusColor(record.status)">{{ 'RES.V.' + record.status | translate }}</nz-tag></dd>
          </div>
          <div>
            <dt>{{ 'TMS.PLANNED_WINDOW' | translate }}</dt>
            <dd>{{ record.planned_start_at ?? '-' }} / {{ record.planned_end_at ?? '-' }}</dd>
          </div>
          <div>
            <dt>{{ 'TMS.ACTUAL_WINDOW' | translate }}</dt>
            <dd>{{ record.actual_start_at ?? '-' }} / {{ record.actual_end_at ?? '-' }}</dd>
          </div>
          <div>
            <dt>{{ 'TMS.TOTAL_WEIGHT' | translate }}</dt>
            <dd>{{ record.total_weight_kg }} / {{ record.capacity_weight_kg ?? '-' }} kg</dd>
          </div>
          <div>
            <dt>{{ 'TMS.TOTAL_VOLUME' | translate }}</dt>
            <dd>{{ record.total_volume_cbm }} / {{ record.capacity_volume_cbm ?? '-' }} m3</dd>
          </div>
          <div>
            <dt>{{ 'TMS.UTILIZATION' | translate }}</dt>
            <dd>{{ record.utilization_percent ?? '-' }} %</dd>
          </div>
          <div>
            <dt>{{ 'TMS.DISTANCE' | translate }}</dt>
            <dd>{{ record.actual_distance_km ?? record.planned_distance_km ?? '-' }} km</dd>
          </div>
          <div>
            <dt>{{ 'TMS.ACTUAL_COST' | translate }}</dt>
            <dd>{{ record.actual_cost ?? '-' }} {{ record.currency }}</dd>
          </div>
          @if (record.notes) {
            <div>
              <dt>{{ 'TMS.NOTES' | translate }}</dt>
              <dd>{{ record.notes }}</dd>
            </div>
          }
        </dl>
      </nz-card>

      <nz-card class="main-card" [nzTitle]="'TMS.STOPS' | translate">
        @if (canReorder()) {
          <div class="toolbar">
            <button nz-button nzType="primary" type="button" [disabled]="!orderChanged()" (click)="saveOrder()">{{ 'TMS.SAVE_ORDER' | translate }}</button>
            <button nz-button type="button" [disabled]="!orderChanged()" (click)="resetOrder()">{{ 'TMS.RESET_ORDER' | translate }}</button>
          </div>
        }
        <nz-table #table [nzData]="orderedStops()" [nzShowPagination]="false" nzSize="small">
          <thead>
            <tr>
              <th class="num">#</th>
              <th>{{ 'TMS.STOP_TYPE' | translate }}</th>
              <th>{{ 'TMS.ORDER' | translate }}</th>
              <th>{{ 'TMS.LOCATION' | translate }}</th>
              <th>{{ 'TMS.PLANNED_ARRIVAL' | translate }}</th>
              <th>{{ 'TMS.ACTUAL_ARRIVAL' | translate }}</th>
              <th>{{ 'TMS.STATUS' | translate }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (stop of table.data; track stop.id; let index = $index; let last = $last) {
              <tr>
                <td class="num">{{ index + 1 }}</td>
                <td>{{ 'TMS.STOP_' + stop.stop_type.toUpperCase() | translate }}</td>
                <td>
                  @if (stop.transport_order_id) {
                    <a [routerLink]="['/transportation/orders', stop.transport_order_id]">{{ stop.order_number ?? stop.transport_order_id }}</a>
                  } @else {
                    -
                  }
                </td>
                <td>{{ stop.location ?? '-' }}{{ stop.city ? ' (' + stop.city + ')' : '' }}</td>
                <td>{{ stop.planned_arrival_at ?? '-' }}</td>
                <td>{{ stop.actual_arrival_at ?? '-' }}</td>
                <td><nz-tag [nzColor]="stop.status === 'completed' ? 'success' : 'default'">{{ 'TMS.STOP_STATUS_' + stop.status.toUpperCase() | translate }}</nz-tag></td>
                <td class="num">
                  @if (canReorder() && stop.status === 'pending') {
                    <button nz-button nzSize="small" nzType="link" type="button" [disabled]="index === 0" [attr.aria-label]="'TMS.MOVE_UP' | translate" (click)="move(index, -1)">&uarr;</button>
                    <button nz-button nzSize="small" nzType="link" type="button" [disabled]="last" [attr.aria-label]="'TMS.MOVE_DOWN' | translate" (click)="move(index, 1)">&darr;</button>
                  }
                  @if (canComplete(stop)) {
                    <button nz-button nzSize="small" nzType="link" type="button" (click)="openStopDialog(stop)">{{ 'TMS.COMPLETE_STOP' | translate }}</button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-card>
    } @else if (!loading()) {
      <nz-empty [nzNotFoundContent]="'TMS.NOT_FOUND' | translate"></nz-empty>
    }

    <nz-modal [nzVisible]="dialog() !== null" [nzTitle]="(dialog() === 'stop' ? 'TMS.COMPLETE_STOP' : 'TMS.ACTION_COMPLETE') | translate" (nzOnCancel)="dialog.set(null)" (nzOnOk)="submit()" okAction="confirm">
      <ng-container *nzModalContent>
        @if (dialog() === 'stop') {
          <form nz-form [formGroup]="stopForm" nzLayout="vertical">
            <nz-form-item>
              <nz-form-label>{{ 'TMS.ARRIVED_AT' | translate }}</nz-form-label>
              <nz-form-control><input nz-input type="datetime-local" formControlName="arrived_at" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'TMS.DEPARTED_AT' | translate }}</nz-form-label>
              <nz-form-control><input nz-input type="datetime-local" formControlName="departed_at" /></nz-form-control>
            </nz-form-item>
          </form>
        } @else {
          <form nz-form [formGroup]="tripForm" nzLayout="vertical">
            <nz-form-item>
              <nz-form-label>{{ 'TMS.ACTUAL_DISTANCE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input type="number" min="0" formControlName="actual_distance_km" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'TMS.ACTUAL_COST' | translate }}</nz-form-label>
              <nz-form-control><input nz-input type="number" min="0" formControlName="actual_cost" /></nz-form-control>
            </nz-form-item>
          </form>
        }
      </ng-container>
    </nz-modal>
  `,
})
export class TmsTripDetailComponent implements OnInit {
  private readonly api = inject(TransportationApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly permissions = inject(PermissionsService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly trip = signal<TmsTrip | null>(null);
  readonly loading = signal(false);
  readonly dialog = signal<TripDialog | null>(null);
  /** Stop ids in the order the planner arranged them, saved with the sequence endpoint. */
  readonly draftOrder = signal<string[]>([]);
  readonly canEdit = computed(() => this.permissions.canWrite('transportation'));

  readonly stopForm = this.fb.group({ arrived_at: '', departed_at: '' });
  readonly tripForm = this.fb.group({ actual_distance_km: '', actual_cost: '' });

  private stopToComplete: TmsTripStop | null = null;

  readonly stops = computed(() => [...(this.trip()?.stops ?? [])].sort((a, b) => a.sequence - b.sequence));
  readonly orderedStops = computed(() => {
    const byId = new Map(this.stops().map((stop) => [stop.id, stop]));
    return this.draftOrder()
      .map((id) => byId.get(id))
      .filter((stop): stop is TmsTripStop => stop !== undefined);
  });
  readonly orderChanged = computed(() => this.draftOrder().join() !== this.stops().map((stop) => stop.id).join());
  readonly canReorder = computed(() => this.canEdit() && (this.trip()?.status === 'planned' || this.trip()?.status === 'dispatched'));

  private get tripId(): string {
    return this.route.snapshot.paramMap.get('id') ?? '';
  }

  ngOnInit(): void {
    this.load();
  }

  statusColor(status: TmsTripStatus): string {
    return TRIP_STATUS_COLORS[status];
  }

  load(): void {
    this.loading.set(true);
    this.api.getTrip(this.tripId).subscribe({
      next: (response) => {
        this.setTrip(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.trip.set(null);
        this.loading.set(false);
      },
    });
  }

  /** Only the first pending stop of a trip in progress can be completed (the API refuses a stop with an earlier pending one). */
  canComplete(stop: TmsTripStop): boolean {
    if (!this.canEdit() || this.trip()?.status !== 'in_progress' || stop.status !== 'pending') {
      return false;
    }
    return this.stops().find((candidate) => candidate.status === 'pending')?.id === stop.id;
  }

  move(index: number, offset: number): void {
    this.draftOrder.update((ids) => moveId(ids, index, offset));
  }

  resetOrder(): void {
    this.draftOrder.set(this.stops().map((stop) => stop.id));
  }

  saveOrder(): void {
    this.handle(this.api.reorderTripStops(this.tripId, this.draftOrder()));
  }

  run(action: 'dispatch' | 'start' | 'cancel'): void {
    const requests = { dispatch: () => this.api.dispatchTrip(this.tripId), start: () => this.api.startTrip(this.tripId), cancel: () => this.api.cancelTrip(this.tripId) };
    this.handle(requests[action]());
  }

  openStopDialog(stop: TmsTripStop): void {
    this.stopToComplete = stop;
    this.stopForm.reset({ arrived_at: '', departed_at: '' });
    this.dialog.set('stop');
  }

  openTripDialog(): void {
    this.tripForm.reset({ actual_distance_km: '', actual_cost: '' });
    this.dialog.set('trip');
  }

  submit(): void {
    if (this.dialog() === 'stop' && this.stopToComplete !== null) {
      const value = this.stopForm.getRawValue();
      this.handle(this.api.completeTripStop(this.tripId, this.stopToComplete.id, { arrived_at: nullable(value.arrived_at), departed_at: nullable(value.departed_at) }));
    } else if (this.dialog() === 'trip') {
      const value = this.tripForm.getRawValue();
      this.handle(this.api.completeTrip(this.tripId, { actual_distance_km: nullable(value.actual_distance_km), actual_cost: nullable(value.actual_cost) }));
    }
  }

  private handle(request: Observable<TransportationResponse<TmsTrip>>): void {
    request.subscribe({
      next: () => {
        this.dialog.set(null);
        this.message.success(this.translate.instant('RES.MSG.DONE'));
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('TMS.ACTION_ERROR')),
    });
  }

  private setTrip(record: TmsTrip): void {
    this.trip.set(record);
    this.resetOrder();
  }
}
