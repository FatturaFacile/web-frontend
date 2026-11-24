import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { PermissionsService, TMS_TRACKING_EVENT_TYPES, TmsOrderStatus, TmsTrackingEvent, TmsTransportOrder, TranslateService, TransportationApiService } from '@core';
import { ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { TrackingTimelineComponent } from './tracking-timeline.component';
import { apiErrorText, nullable, ORDER_STATUS_COLORS } from './transportation.util';

/** One shipment (transport order) with its route, windows, costs and the timeline of its tracking events. */
@Component({
  selector: 'app-tms-order-detail',
  styleUrl: './transportation.scss',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ModalActionsDirective,
    PageHeaderComponent,
    TrackingTimelineComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzTagModule,
  ],
  template: `
    @if (order(); as record) {
      <app-page-header [title]="record.number" [subtitle]="record.reference ?? ''">
        <a nz-button routerLink="/transportation/orders">{{ 'TMS.BACK_TO_LIST' | translate }}</a>
        @if (canEdit()) {
          @if (record.status === 'draft') {
            <button nz-button nzType="primary" type="button" (click)="plan()">{{ 'TMS.ACTION_PLAN' | translate }}</button>
          }
          @if (record.status === 'draft' || record.status === 'planned') {
            <button nz-button nzDanger type="button" (click)="cancel()">{{ 'TMS.ACTION_CANCEL' | translate }}</button>
          }
          <button nz-button type="button" (click)="openEventDialog()">{{ 'TMS.ACTION_NEW_EVENT' | translate }}</button>
        }
      </app-page-header>

      <nz-card class="main-card">
        <dl class="detail-grid">
          <div>
            <dt>{{ 'TMS.STATUS' | translate }}</dt>
            <dd>
              <nz-tag [nzColor]="statusColor(record.status)">{{ 'RES.V.' + record.status | translate }}</nz-tag>
              @if (record.is_on_time === true) {
                <nz-tag nzColor="success">{{ 'TMS.ON_TIME_TAG' | translate }}</nz-tag>
              } @else if (record.is_on_time === false) {
                <nz-tag nzColor="error">{{ 'TMS.LATE_TAG' | translate }}</nz-tag>
              }
            </dd>
          </div>
          <div>
            <dt>{{ 'TMS.ORIGIN' | translate }}</dt>
            <dd>{{ record.origin_name }}, {{ record.origin_location }}{{ record.origin_city ? ' (' + record.origin_city + ')' : '' }}</dd>
          </div>
          <div>
            <dt>{{ 'TMS.DESTINATION' | translate }}</dt>
            <dd>{{ record.destination_name }}, {{ record.destination_location }}{{ record.destination_city ? ' (' + record.destination_city + ')' : '' }}</dd>
          </div>
          <div>
            <dt>{{ 'TMS.PICKUP_WINDOW' | translate }}</dt>
            <dd>{{ record.pickup_from ?? '-' }} / {{ record.pickup_to ?? '-' }}</dd>
          </div>
          <div>
            <dt>{{ 'TMS.DELIVERY_WINDOW' | translate }}</dt>
            <dd>{{ record.delivery_from ?? '-' }} / {{ record.delivery_to ?? '-' }}</dd>
          </div>
          <div>
            <dt>{{ 'TMS.LOAD' | translate }}</dt>
            <dd>{{ record.weight_kg }} kg, {{ record.volume_cbm }} m3, {{ record.pallets }} {{ 'TMS.PALLETS' | translate }}</dd>
          </div>
          <div>
            <dt>{{ 'TMS.CARRIER' | translate }}</dt>
            <dd>
              @if (record.carrier) {
                <a [routerLink]="['/transportation/carriers', record.carrier.id]">{{ record.carrier.name }}</a>
              } @else {
                -
              }
            </dd>
          </div>
          <div>
            <dt>{{ 'TMS.TRIP' | translate }}</dt>
            <dd>
              @if (record.trip) {
                <a [routerLink]="['/transportation/trips', record.trip.id]">{{ record.trip.number }}</a>
              } @else {
                -
              }
            </dd>
          </div>
          <div>
            <dt>{{ 'TMS.EXPECTED_COST' | translate }}</dt>
            <dd>{{ record.expected_cost ?? '-' }} {{ record.currency }}</dd>
          </div>
          <div>
            <dt>{{ 'TMS.ACTUAL_COST' | translate }}</dt>
            <dd>{{ record.actual_cost ?? '-' }} {{ record.currency }}</dd>
          </div>
          @if (record.goods_description) {
            <div>
              <dt>{{ 'TMS.GOODS' | translate }}</dt>
              <dd>{{ record.goods_description }}</dd>
            </div>
          }
          @if (record.notes) {
            <div>
              <dt>{{ 'TMS.NOTES' | translate }}</dt>
              <dd>{{ record.notes }}</dd>
            </div>
          }
        </dl>
      </nz-card>

      <nz-card class="main-card" [nzTitle]="'TMS.TAB_TRACKING' | translate">
        <app-tracking-timeline [events]="events()"></app-tracking-timeline>
      </nz-card>
    } @else if (!loading()) {
      <nz-empty [nzNotFoundContent]="'TMS.NOT_FOUND' | translate"></nz-empty>
    }

    <nz-modal appModalActions [nzVisible]="eventDialog()" [nzTitle]="'TMS.ACTION_NEW_EVENT' | translate" (nzOnCancel)="eventDialog.set(false)" (nzOnOk)="saveEvent()" okAction="confirm" [nzOkDisabled]="eventForm.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="eventForm" nzLayout="vertical">
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'TMS.EVENT_TYPE' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="event_type">
                @for (type of eventTypes; track type) {
                  <nz-option [nzValue]="type" [nzLabel]="'RES.V.' + type | translate"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'TMS.OCCURRED_AT' | translate }}</nz-form-label>
            <nz-form-control><input nz-input type="datetime-local" formControlName="occurred_at" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>{{ 'TMS.LOCATION' | translate }}</nz-form-label>
            <nz-form-control><input nz-input formControlName="location" maxlength="160" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>{{ 'TMS.NOTES' | translate }}</nz-form-label>
            <nz-form-control><textarea nz-input rows="3" formControlName="notes" maxlength="5000"></textarea></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class TmsOrderDetailComponent implements OnInit {
  private readonly api = inject(TransportationApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly permissions = inject(PermissionsService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly eventTypes = TMS_TRACKING_EVENT_TYPES;
  readonly order = signal<TmsTransportOrder | null>(null);
  readonly events = signal<TmsTrackingEvent[]>([]);
  readonly loading = signal(false);
  readonly eventDialog = signal(false);
  readonly canEdit = computed(() => this.permissions.canWrite('transportation'));

  readonly eventForm = this.fb.group({
    event_type: this.fb.control<(typeof TMS_TRACKING_EVENT_TYPES)[number]>('in_transit', Validators.required),
    occurred_at: ['', Validators.required],
    location: '',
    notes: '',
  });

  private get orderId(): string {
    return this.route.snapshot.paramMap.get('id') ?? '';
  }

  ngOnInit(): void {
    this.load();
  }

  statusColor(status: TmsOrderStatus): string {
    return ORDER_STATUS_COLORS[status];
  }

  load(): void {
    this.loading.set(true);
    this.api.getTransportOrder(this.orderId).subscribe({
      next: (response) => {
        this.order.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.order.set(null);
        this.loading.set(false);
      },
    });
    this.loadEvents();
  }

  plan(): void {
    this.api.planTransportOrder(this.orderId).subscribe(this.afterAction());
  }

  cancel(): void {
    this.api.cancelTransportOrder(this.orderId).subscribe(this.afterAction());
  }

  openEventDialog(): void {
    this.eventForm.reset({ event_type: 'in_transit', occurred_at: '', location: '', notes: '' });
    this.eventDialog.set(true);
  }

  saveEvent(): void {
    if (this.eventForm.invalid) {
      return;
    }
    const value = this.eventForm.getRawValue();
    this.api
      .createTrackingEvent({
        transport_order_id: this.orderId,
        event_type: value.event_type,
        occurred_at: value.occurred_at,
        location: nullable(value.location),
        notes: nullable(value.notes),
      })
      .subscribe({
        next: () => {
          this.eventDialog.set(false);
          this.message.success(this.translate.instant('RES.MSG.DONE'));
          this.load();
        },
        error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('TMS.ACTION_ERROR')),
      });
  }

  private loadEvents(): void {
    this.api.getTrackingEvents(this.orderId).subscribe({
      next: (response) => this.events.set(response.data),
      error: () => this.events.set([]),
    });
  }

  private afterAction() {
    return {
      next: () => {
        this.message.success(this.translate.instant('RES.MSG.DONE'));
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('TMS.ACTION_ERROR')),
    };
  }
}
