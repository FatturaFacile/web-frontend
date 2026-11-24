import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { EventsApiService, MANAGED_EVENT_STATUSES, ManagedEvent, ManagedEventRequest, ManagedEventStatus, TranslateService } from '@core';
import { IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText, blankToNull, EVENT_STATUS_COLORS, nowInput, toApiDateTime, toInputDateTime } from './events.util';

/** The events of the company with their places taken; new events are created here and managed on their page. */
@Component({
  selector: 'app-events-list',
  styleUrl: './events.scss',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    IconActionDirective,
    ModalActionsDirective,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'EVENTS.LIST_TITLE' | translate" [subtitle]="'EVENTS.LIST_SUBTITLE' | translate">
      <a nz-button routerLink="/events/check-in">{{ 'EVENTS.CHECKIN' | translate }}</a>
      <button nz-button nzType="primary" (click)="openModal()" appIconAction="create"></button>
    </app-page-header>

    <div class="toolbar">
      <nz-select style="width: 220px" nzAllowClear [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event); load()" [nzPlaceHolder]="'EVENTS.STATUS' | translate">
        @for (status of statuses; track status) {
          <nz-option [nzValue]="status" [nzLabel]="('EVENTS.STATUS_' + status.toUpperCase()) | translate"></nz-option>
        }
      </nz-select>
    </div>

    <nz-card class="main-card">
      <nz-table #table [nzData]="events()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="25">
        <thead>
          <tr>
            <th>{{ 'EVENTS.CODE' | translate }}</th>
            <th>{{ 'EVENTS.NAME' | translate }}</th>
            <th>{{ 'EVENTS.STARTS_AT' | translate }}</th>
            <th>{{ 'EVENTS.VENUE' | translate }}</th>
            <th>{{ 'EVENTS.STATUS' | translate }}</th>
            <th class="num">{{ 'EVENTS.PLACES' | translate }}</th>
            <th class="num">{{ 'EVENTS.WAITLISTED' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <td>
                <a [routerLink]="['/events', row.id]">{{ row.code }}</a>
              </td>
              <td>{{ row.name }}</td>
              <td>{{ row.starts_at }}</td>
              <td>{{ row.venue }}</td>
              <td>
                <nz-tag [nzColor]="statusColor(row.status)">{{ ('EVENTS.STATUS_' + row.status.toUpperCase()) | translate }}</nz-tag>
              </td>
              <td class="num">{{ row.confirmed_count ?? 0 }} / {{ row.capacity ?? '∞' }}</td>
              <td class="num">{{ row.waitlisted_count ?? 0 }}</td>
              <td>
                <div class="row-actions">
                  <button nz-button nzType="text" appIconAction="edit" (click)="openModal(row)"></button>
                </div>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && events().length === 0) {
        <nz-empty [nzNotFoundContent]="'EVENTS.NO_EVENTS' | translate"></nz-empty>
      }
    </nz-card>

    <nz-modal appModalActions [(nzVisible)]="modalVisible" [nzTitle]="(editing() ? 'EVENTS.EDIT_EVENT' : 'EVENTS.NEW_EVENT') | translate" (nzOnCancel)="modalVisible.set(false)" (nzOnOk)="save()" okAction="save" [nzOkDisabled]="form.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="form" nzLayout="vertical">
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="ev-code">{{ 'EVENTS.CODE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="ev-code" formControlName="code" maxlength="40" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="ev-name">{{ 'EVENTS.NAME' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="ev-name" formControlName="name" maxlength="160" /></nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="ev-start">{{ 'EVENTS.STARTS_AT' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="ev-start" type="datetime-local" formControlName="starts_at" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="ev-end">{{ 'EVENTS.ENDS_AT' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="ev-end" type="datetime-local" formControlName="ends_at" /></nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzFor="ev-venue">{{ 'EVENTS.VENUE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="ev-venue" formControlName="venue" maxlength="200" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="ev-capacity">{{ 'EVENTS.CAPACITY' | translate }}</nz-form-label>
              <nz-form-control [nzExtra]="'EVENTS.CAPACITY_HINT' | translate"><input nz-input id="ev-capacity" type="number" min="1" formControlName="capacity" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="ev-currency">{{ 'EVENTS.CURRENCY' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="ev-currency" formControlName="currency" maxlength="3" /></nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-control><label for="events-list-waitlist-enabled" nzId="events-list-waitlist-enabled" nz-checkbox formControlName="waitlist_enabled">{{ 'EVENTS.WAITLIST_ENABLED' | translate }}</label></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="ev-description">{{ 'EVENTS.DESCRIPTION' | translate }}</nz-form-label>
            <nz-form-control><textarea nz-input id="ev-description" rows="3" formControlName="description" maxlength="5000"></textarea></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class EventsListComponent implements OnInit {
  private readonly api = inject(EventsApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly statuses = MANAGED_EVENT_STATUSES;
  readonly events = signal<ManagedEvent[]>([]);
  readonly loading = signal(false);
  readonly modalVisible = signal(false);
  readonly editing = signal<ManagedEvent | null>(null);
  readonly statusFilter = signal<ManagedEventStatus | null>(null);

  readonly form = this.fb.group({
    code: ['', [Validators.required]],
    name: ['', [Validators.required]],
    starts_at: [nowInput(), [Validators.required]],
    ends_at: [nowInput(), [Validators.required]],
    venue: [''],
    capacity: this.fb.control<number | null>(null, [Validators.min(1)]),
    currency: ['EUR', [Validators.required, Validators.minLength(3), Validators.maxLength(3)]],
    waitlist_enabled: [true],
    description: [''],
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.getEvents({ status: this.statusFilter() ?? undefined, per_page: 100 }).subscribe({
      next: (response) => {
        this.events.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('EVENTS.ACTION_ERROR'));
      },
    });
  }

  statusColor(status: string): string {
    return EVENT_STATUS_COLORS[status] ?? 'default';
  }

  openModal(event: ManagedEvent | null = null): void {
    this.editing.set(event);
    this.form.reset({
      code: event?.code ?? '',
      name: event?.name ?? '',
      starts_at: event ? toInputDateTime(event.starts_at) : nowInput(),
      ends_at: event ? toInputDateTime(event.ends_at) : nowInput(),
      venue: event?.venue ?? '',
      capacity: event?.capacity ?? null,
      currency: event?.currency ?? 'EUR',
      waitlist_enabled: event?.waitlist_enabled ?? true,
      description: event?.description ?? '',
    });
    this.modalVisible.set(true);
  }

  save(): void {
    const value = this.form.getRawValue();
    const payload: ManagedEventRequest = {
      code: value.code,
      name: value.name,
      description: blankToNull(value.description),
      venue: blankToNull(value.venue),
      starts_at: toApiDateTime(value.starts_at),
      ends_at: toApiDateTime(value.ends_at),
      capacity: value.capacity,
      waitlist_enabled: value.waitlist_enabled,
      currency: value.currency.toUpperCase(),
    };
    const current = this.editing();
    const request = current ? this.api.updateEvent(current.id, payload) : this.api.createEvent(payload);

    request.subscribe({
      next: () => {
        this.message.success(this.translate.instant('EVENTS.EVENT_SAVED'));
        this.modalVisible.set(false);
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('EVENTS.ACTION_ERROR')),
    });
  }
}
