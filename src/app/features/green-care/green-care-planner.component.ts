import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { GC_EQUIPMENT_TYPES, GcGps, GcInterventionPayload, GcRoute, GcStop, PermissionsService, TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { GreenCareCrewStore, GreenCareLookupStore, GreenCarePlannerStore, GreenCareReferenceStore } from './green-care.stores';
import {
  GREEN_CARE_MODULE,
  addDays,
  billingStatusColor,
  isoDay,
  mondayOf,
  routeStatusColor,
  weatherColor,
  weekDays,
} from './green-care.util';

interface HoursRow {
  member_id: string;
  name: string;
  hours: number | null;
}

interface MachineRow {
  machine: string;
  hours: number | null;
}

interface MaterialRow {
  product_id: string | null;
  quantity: number | null;
  warehouse_id: string | null;
}

interface InterventionForm {
  checkin_at: Date | null;
  checkout_at: Date | null;
  checkin_gps: GcGps | null;
  checkout_gps: GcGps | null;
  crew_hours: HoursRow[];
  machinery: MachineRow[];
  materials: MaterialRow[];
  counts_toward_contract_passage: boolean;
  green_waste_weight_kg: number | null;
  waste_code: string;
  compost_facility_id: string | null;
}

/**
 * Multi-crew route planner ("Pianificazione Giro Squadre"): the weekly board with weather badges, one-click optimisation of the
 * week, automatic rescheduling of rainy stops, the ordered stops of a route with crew, vehicle and equipment, and the intervention
 * log drawer of a stop (check-in/out with GPS, hours, machinery, plants and materials, photos, passage toggle, green waste).
 */
@Component({
  selector: 'app-green-care-planner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCheckboxModule,
    NzDatePickerModule,
    NzDrawerModule,
    NzEmptyModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSpinModule,
    NzSwitchModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  providers: [GreenCarePlannerStore],
  styleUrl: './green-care.scss',
  template: `
    <app-page-header
      [title]="'PAGE_TITLE.GREEN_CARE_PLANNER' | translate"
      [subtitle]="'greenCare.section.plannerSubtitle' | translate"
    ></app-page-header>

    @if (store.error(); as error) {
      <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="error | translate"></nz-alert>
    }

    <div class="toolbar">
      <div class="actions">
        <button nz-button type="button" data-test="week-prev" (click)="shiftWeek(-1)">‹ {{ 'greenCare.planner.previousWeek' | translate }}</button>
        <button nz-button type="button" data-test="week-today" (click)="goToday()">{{ 'greenCare.planner.thisWeek' | translate }}</button>
        <button nz-button type="button" data-test="week-next" (click)="shiftWeek(1)">{{ 'greenCare.planner.nextWeek' | translate }} ›</button>
      </div>
      <strong data-test="week-label">{{ weekStart() | date: 'mediumDate' }} – {{ weekEnd() | date: 'mediumDate' }}</strong>
      <label class="field" for="gc-p-crew">
        <span>{{ 'greenCare.filter.crew' | translate }}</span>
        <nz-select nzId="gc-p-crew" nzAllowClear [(ngModel)]="crewFilter" (ngModelChange)="reload()">
          @for (crew of crews.crews(); track crew.id) {
            <nz-option [nzValue]="crew.id" [nzLabel]="crew.name"></nz-option>
          }
        </nz-select>
      </label>
      <span class="spacer"></span>
      @if (canWrite) {
        <button nz-button nzType="primary" type="button" data-test="optimize" (click)="openOptimize()">
          {{ 'greenCare.action.optimizeWeek' | translate }}
        </button>
        <button nz-button type="button" data-test="reschedule" [nzLoading]="store.rescheduling()" (click)="reschedule()">
          {{ 'greenCare.action.rescheduleRain' | translate }}
        </button>
      }
    </div>

    @if (store.lastReschedule(); as result) {
      <nz-alert
        class="feedback"
        nzShowIcon
        nzCloseable
        data-test="reschedule-result"
        [nzType]="result.rescheduled_stops > 0 ? 'warning' : 'info'"
        [nzMessage]="'greenCare.planner.rescheduled' | translate: { stops: result.rescheduled_stops, routes: result.affected_routes.length }"
      ></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      <div class="week-board">
        @for (day of days(); track day) {
          <div class="day-column" [attr.data-test]="'day-' + day">
            <div class="day-head">
              <span>{{ dayDate(day) | date: 'EEE d' }}</span>
              <span class="hint">{{ routesOf(day).length }}</span>
            </div>
            <div class="day-body">
              @for (route of routesOf(day); track route.id) {
                <div
                  class="route-card"
                  [class.selected]="selectedId() === route.id"
                  [attr.data-test]="'route-' + route.id"
                  (click)="selectedId.set(route.id)"
                  (keyup.enter)="selectedId.set(route.id)"
                  tabindex="0"
                >
                  <div class="route-head">
                    <strong>{{ route.crew_name }}</strong>
                    <nz-tag [nzColor]="routeColor(route)">{{ 'greenCare.enum.routeStatus.' + route.status | translate }}</nz-tag>
                  </div>
                  <nz-tag [nzColor]="weather(route)" [attr.data-test]="'weather-' + route.id">
                    {{ 'greenCare.enum.weatherAlert.' + route.weather_alert_status | translate }}
                  </nz-tag>
                  <div class="hint">
                    {{ 'greenCare.planner.stopsCount' | translate: { count: route.stops.length } }}
                    @if (route.route_optimization_metadata; as meta) {
                      · {{ meta.total_km }} km · {{ meta.estimated_duration_minutes }} min
                    }
                  </div>
                </div>
              } @empty {
                <span class="muted">{{ 'greenCare.empty.dayRoutes' | translate }}</span>
              }
            </div>
          </div>
        }
      </div>
    </nz-spin>

    <nz-drawer
      [nzVisible]="selected() !== null"
      [nzWidth]="640"
      [nzTitle]="'greenCare.planner.routeDetail' | translate"
      (nzOnClose)="selectedId.set(null)"
    >
      <ng-container *nzDrawerContent>
        @if (selected(); as route) {
          <div class="actions">
            <strong>{{ route.crew_name }} · {{ route.schedule_date | date: 'fullDate' }}</strong>
            <nz-tag [nzColor]="weather(route)">{{ 'greenCare.enum.weatherAlert.' + route.weather_alert_status | translate }}</nz-tag>
            @if (canWrite) {
              <button nz-button nzSize="small" type="button" data-test="refresh-weather" (click)="refreshWeather(route)">
                {{ 'greenCare.action.refreshWeather' | translate }}
              </button>
            }
          </div>
          <div class="form-grid section-title">
            <div>
              <div class="hint">{{ 'greenCare.field.vehiclePlate' | translate }}</div>
              {{ route.assigned_vehicle_plate ?? '-' }}
            </div>
            <div>
              <div class="hint">{{ 'greenCare.field.trailerPlate' | translate }}</div>
              {{ route.assigned_trailer_plate ?? '-' }}
            </div>
            <div class="full">
              <div class="hint">{{ 'greenCare.field.equipment' | translate }}</div>
              @for (item of equipmentOf(route); track item.type) {
                <nz-tag>{{ 'greenCare.enum.equipment.' + item.type | translate }} × {{ item.count }}</nz-tag>
              } @empty {
                <span class="muted">-</span>
              }
            </div>
          </div>
          @if (route.weather_forecast_summary; as forecast) {
            <div class="hint" data-test="forecast">
              {{
                'greenCare.planner.forecast'
                  | translate
                    : {
                        rain: forecast.precipitation_mm ?? '-',
                        min: forecast.temp_min ?? '-',
                        max: forecast.temp_max ?? '-',
                        wind: forecast.wind_kmh ?? '-',
                      }
              }}
            </div>
          }

          <h4 class="section-title">{{ 'greenCare.planner.stops' | translate }}</h4>
          <div class="stop-list">
            @for (stop of route.stops; track stop.id; let first = $first; let last = $last) {
              <div class="stop" [class.extra]="stop.is_extra_passage" [attr.data-test]="'stop-' + stop.id">
                <span class="stop-order">{{ stop.stop_order }}</span>
                <div>
                  <strong>{{ stop.site_name }}</strong>
                  <div class="hint">{{ stop.site_address }} · {{ stop.estimated_duration_minutes }} min</div>
                  <div>
                    @for (activity of stop.planned_activities; track activity) {
                      <nz-tag>{{ 'greenCare.enum.service.' + activity | translate }}</nz-tag>
                    }
                  </div>
                  <div>
                    @if (stop.passage_number !== null && stop.passage_included !== null) {
                      <nz-tag [nzColor]="stop.is_extra_passage ? 'red' : 'green'" [attr.data-test]="'passage-' + stop.id">
                        {{
                          (stop.is_extra_passage ? 'greenCare.passage.extra' : 'greenCare.passage.within')
                            | translate
                              : {
                                  current: stop.passage_number,
                                  included: stop.passage_included,
                                  extra: stop.passage_number - stop.passage_included,
                                }
                        }}
                      </nz-tag>
                    }
                    <nz-tag [nzColor]="billing(stop)">{{ 'greenCare.enum.billingStatus.' + stop.billing_status | translate }}</nz-tag>
                    @if (stop.actual_checkout_at) {
                      <nz-tag nzColor="green">{{ 'greenCare.planner.done' | translate }}</nz-tag>
                    }
                  </div>
                </div>
                <div class="row-actions">
                  @if (canWrite) {
                    <button nz-button nzSize="small" type="button" [disabled]="first" (click)="move(route, stop, -1)">↑</button>
                    <button nz-button nzSize="small" type="button" [disabled]="last" (click)="move(route, stop, 1)">↓</button>
                    <button nz-button nzSize="small" nzType="primary" type="button" [attr.data-test]="'log-' + stop.id" (click)="openIntervention(route, stop)">
                      {{ 'greenCare.action.logIntervention' | translate }}
                    </button>
                  }
                </div>
              </div>
            } @empty {
              <nz-empty [nzNotFoundContent]="'greenCare.empty.stops' | translate"></nz-empty>
            }
          </div>
          @if (canWrite) {
            <button
              nz-button
              nzDanger
              type="button"
              nz-popconfirm
              [nzPopconfirmTitle]="'greenCare.confirm.deleteRoute' | translate"
              (nzOnConfirm)="removeRoute(route)"
            >
              {{ 'greenCare.action.deleteRoute' | translate }}
            </button>
          }
        }
      </ng-container>
    </nz-drawer>

    <nz-drawer
      [nzVisible]="interventionStop() !== null"
      [nzWidth]="720"
      [nzTitle]="'greenCare.intervention.title' | translate"
      (nzOnClose)="interventionStop.set(null)"
    >
      <ng-container *nzDrawerContent>
        @if (interventionStop(); as stop) {
          <p>
            <strong>{{ stop.site_name }}</strong>
          </p>
          @if (interventionError(); as error) {
            <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="error | translate: interventionErrorParams()"></nz-alert>
          }
          <div class="form-grid">
            <label class="field" for="gc-i-in">
              <span>{{ 'greenCare.field.checkIn' | translate }}</span>
              <nz-date-picker nzId="gc-i-in" nzShowTime name="checkin_at" [(ngModel)]="form.checkin_at"></nz-date-picker>
              <button nz-button nzSize="small" type="button" data-test="gps-in" (click)="capture('in')">{{ 'greenCare.action.captureGps' | translate }}</button>
              @if (form.checkin_gps; as gps) {
                <span class="hint">{{ gps.lat | number: '1.4-4' }}, {{ gps.lng | number: '1.4-4' }}</span>
              }
            </label>
            <label class="field" for="gc-i-out">
              <span>{{ 'greenCare.field.checkOut' | translate }}</span>
              <nz-date-picker nzId="gc-i-out" nzShowTime name="checkout_at" [(ngModel)]="form.checkout_at"></nz-date-picker>
              <button nz-button nzSize="small" type="button" data-test="gps-out" (click)="capture('out')">{{ 'greenCare.action.captureGps' | translate }}</button>
              @if (form.checkout_gps; as gps) {
                <span class="hint">{{ gps.lat | number: '1.4-4' }}, {{ gps.lng | number: '1.4-4' }}</span>
              }
            </label>
          </div>

          <h4 class="section-title">{{ 'greenCare.intervention.crewHours' | translate }}</h4>
          @for (row of form.crew_hours; track row.member_id) {
            <label class="field" [for]="'gc-i-h-' + row.member_id">
              <span>{{ row.name }}</span>
              <nz-input-number [nzId]="'gc-i-h-' + row.member_id" [name]="'hours-' + row.member_id" [(ngModel)]="row.hours" [nzMin]="0" [nzStep]="0.25"></nz-input-number>
            </label>
          } @empty {
            <span class="muted">{{ 'greenCare.empty.members' | translate }}</span>
          }

          <h4 class="section-title">{{ 'greenCare.intervention.machineryHours' | translate }}</h4>
          @for (row of form.machinery; track $index) {
            <div class="botanical-row">
              <nz-select [name]="'machine-' + $index" [(ngModel)]="row.machine">
                @for (type of equipmentTypes; track type) {
                  <nz-option [nzValue]="type" [nzLabel]="'greenCare.enum.equipment.' + type | translate"></nz-option>
                }
              </nz-select>
              <nz-input-number [name]="'machine-hours-' + $index" [(ngModel)]="row.hours" [nzMin]="0" [nzStep]="0.25"></nz-input-number>
              <button nz-button nzDanger type="button" (click)="removeMachine($index)">{{ 'greenCare.action.remove' | translate }}</button>
            </div>
          }
          <button nz-button type="button" (click)="addMachine()">{{ 'greenCare.action.addMachine' | translate }}</button>

          <h4 class="section-title">{{ 'greenCare.intervention.materials' | translate }}</h4>
          @for (row of form.materials; track $index) {
            <div class="botanical-row" [attr.data-test]="'material-' + $index">
              <nz-select nzShowSearch nzServerSearch [name]="'product-' + $index" [(ngModel)]="row.product_id" (nzOnSearch)="lookup.searchProducts($event)">
                @for (option of lookup.products(); track option.id) {
                  <nz-option [nzValue]="option.id" [nzLabel]="option.label"></nz-option>
                }
              </nz-select>
              <nz-input-number [name]="'qty-' + $index" [(ngModel)]="row.quantity" [nzMin]="0" [nzStep]="0.1"></nz-input-number>
              <nz-select nzAllowClear [name]="'wh-' + $index" [(ngModel)]="row.warehouse_id">
                @for (option of lookup.warehouses(); track option.id) {
                  <nz-option [nzValue]="option.id" [nzLabel]="option.label"></nz-option>
                }
              </nz-select>
              <span></span>
              <button nz-button nzDanger type="button" (click)="removeMaterial($index)">{{ 'greenCare.action.remove' | translate }}</button>
            </div>
          }
          <button nz-button type="button" data-test="add-material" (click)="addMaterial()">{{ 'greenCare.action.addMaterial' | translate }}</button>

          <h4 class="section-title">{{ 'greenCare.intervention.greenWaste' | translate }}</h4>
          <div class="form-grid">
            <label class="field" for="gc-i-waste-kg">
              <span>{{ 'greenCare.field.weightKg' | translate }}</span>
              <nz-input-number nzId="gc-i-waste-kg" name="green_waste_weight_kg" [(ngModel)]="form.green_waste_weight_kg" [nzMin]="0" [nzStep]="1"></nz-input-number>
            </label>
            <label class="field" for="gc-i-waste-code">
              <span>{{ 'greenCare.field.wasteCode' | translate }}</span>
              <nz-select nzId="gc-i-waste-code" nzAllowClear [(ngModel)]="form.waste_code">
                @for (code of wasteCodes(); track code.code) {
                  <nz-option [nzValue]="code.code" [nzLabel]="code.code"></nz-option>
                }
              </nz-select>
            </label>
            <label class="field" for="gc-i-facility">
              <span>{{ 'greenCare.field.compostFacility' | translate }}</span>
              <nz-select nzId="gc-i-facility" nzShowSearch nzServerSearch nzAllowClear [(ngModel)]="form.compost_facility_id" (nzOnSearch)="lookup.searchSuppliers($event)">
                @for (option of lookup.suppliers(); track option.id) {
                  <nz-option [nzValue]="option.id" [nzLabel]="option.label"></nz-option>
                }
              </nz-select>
            </label>
          </div>

          <label class="field switch section-title" for="gc-i-counts">
            <span>{{ 'greenCare.field.countsTowardPassage' | translate }}</span>
            <nz-switch nzId="gc-i-counts" name="counts_toward_contract_passage" [(ngModel)]="form.counts_toward_contract_passage"></nz-switch>
          </label>

          <h4 class="section-title">{{ 'greenCare.intervention.photos' | translate }}</h4>
          <div class="actions">
            <label nz-button for="gc-i-before">{{ 'greenCare.action.uploadBefore' | translate }} ({{ stop.before_photos.length }})</label>
            <input id="gc-i-before" class="hidden-input" type="file" accept="image/*" multiple (change)="photos(stop, 'before', $event)" />
            <label nz-button for="gc-i-after">{{ 'greenCare.action.uploadAfter' | translate }} ({{ stop.after_photos.length }})</label>
            <input id="gc-i-after" class="hidden-input" type="file" accept="image/*" multiple (change)="photos(stop, 'after', $event)" />
          </div>

          <div class="actions section-title">
            <button nz-button nzType="primary" type="button" data-test="save-intervention" [disabled]="!interventionValid()" (click)="saveIntervention()">
              {{ 'greenCare.action.saveIntervention' | translate }}
            </button>
            <button nz-button type="button" (click)="interventionStop.set(null)">{{ 'greenCare.action.cancel' | translate }}</button>
          </div>
        }
      </ng-container>
    </nz-drawer>

    <nz-modal
      [nzVisible]="optimizeOpen()"
      [nzTitle]="'greenCare.planner.optimizeTitle' | translate"
      [nzFooter]="optimizeFooter"
      [nzWidth]="640"
      (nzOnCancel)="optimizeOpen.set(false)"
    >
      <ng-container *nzModalContent>
        <p>{{ 'greenCare.planner.optimizeIntro' | translate: { week: weekLabel() } }}</p>
        @if (optimizeError(); as error) {
          <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="error | translate: optimizeErrorParams()"></nz-alert>
        }
        <label class="field" for="gc-o-crews">
          <span>{{ 'greenCare.filter.crews' | translate }}</span>
          <nz-select nzId="gc-o-crews" nzMode="multiple" [(ngModel)]="optimizeCrews">
            @for (crew of crews.crews(); track crew.id) {
              <nz-option [nzValue]="crew.id" [nzLabel]="crew.name"></nz-option>
            }
          </nz-select>
        </label>
        <label nz-checkbox name="refresh_weather" [(ngModel)]="optimizeWeather">{{ 'greenCare.planner.refreshWeather' | translate }}</label>

        @if (store.lastOptimize(); as result) {
          <nz-alert
            class="section-title"
            nzType="success"
            nzShowIcon
            data-test="optimize-summary"
            [nzMessage]="'greenCare.planner.optimized' | translate: { routes: result.summary.routes_created, stops: result.summary.stops_created }"
          ></nz-alert>
          @if (result.unassigned.length > 0) {
            <h4 class="section-title">{{ 'greenCare.planner.unassigned' | translate }}</h4>
            @for (item of result.unassigned; track item.contract_id) {
              <div>
                <strong>{{ item.site_name }}</strong>
                <span class="hint"> · {{ item.reason }}</span>
              </div>
            }
          }
        }
      </ng-container>
      <ng-template #optimizeFooter>
        <button nz-button type="button" (click)="optimizeOpen.set(false)">{{ 'greenCare.action.close' | translate }}</button>
        <button nz-button nzType="primary" type="button" data-test="run-optimize" [nzLoading]="store.optimizing()" (click)="runOptimize()">
          {{ 'greenCare.action.optimizeWeek' | translate }}
        </button>
      </ng-template>
    </nz-modal>
  `,
})
export class GreenCarePlannerComponent implements OnInit {
  protected readonly store = inject(GreenCarePlannerStore);
  protected readonly crews = inject(GreenCareCrewStore);
  protected readonly lookup = inject(GreenCareLookupStore);
  private readonly reference = inject(GreenCareReferenceStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly canWrite = inject(PermissionsService).canWrite(GREEN_CARE_MODULE);
  protected readonly equipmentTypes = GC_EQUIPMENT_TYPES;

  protected readonly weekStart = signal<Date>(mondayOf(new Date()));
  protected readonly weekEnd = computed(() => addDays(this.weekStart(), 6));
  protected readonly days = computed(() => weekDays(this.weekStart()));
  protected readonly weekLabel = computed(() => `${isoDay(this.weekStart())} – ${isoDay(this.weekEnd())}`);
  protected crewFilter: string | null = null;

  protected readonly selectedId = signal<string | null>(null);
  protected readonly selected = computed(() => this.store.routes().find((route) => route.id === this.selectedId()) ?? null);

  protected readonly optimizeOpen = signal(false);
  protected readonly optimizeError = signal<string | null>(null);
  protected readonly optimizeErrorParams = signal<Record<string, string>>({});
  protected optimizeCrews: string[] = [];
  protected optimizeWeather = true;

  protected readonly interventionStop = signal<GcStop | null>(null);
  protected readonly interventionError = signal<string | null>(null);
  protected readonly interventionErrorParams = signal<Record<string, string>>({});
  protected form: InterventionForm = this.emptyForm();
  protected readonly wasteCodes = computed(() => {
    const codes = this.reference.reference()?.waste_codes;
    return codes ? [...codes.IT, ...codes.CH] : [];
  });

  protected readonly weather = (route: GcRoute): string => weatherColor(route.weather_alert_status);
  protected readonly routeColor = (route: GcRoute): string => routeStatusColor(route.status);
  protected readonly billing = (stop: GcStop): string => billingStatusColor(stop.billing_status);

  ngOnInit(): void {
    void this.reference.load();
    void this.crews.load();
    void this.lookup.loadWarehouses();
    void this.lookup.searchProducts();
    void this.lookup.searchSuppliers();
    void this.reload();
  }

  protected dayDate(day: string): Date {
    const [year, month, date] = day.split('-').map(Number);
    return new Date(year, month - 1, date);
  }

  protected routesOf(day: string): GcRoute[] {
    return this.store.routes().filter((route) => route.schedule_date.slice(0, 10) === day);
  }

  protected equipmentOf(route: GcRoute): { type: string; count: number }[] {
    const list = route.equipment_list;
    if (list === null) {
      return [];
    }
    if (Array.isArray(list)) {
      return list.map((type) => ({ type, count: 1 }));
    }
    return Object.entries(list)
      .filter(([, count]) => (count ?? 0) > 0)
      .map(([type, count]) => ({ type, count: count ?? 0 }));
  }

  protected async reload(): Promise<void> {
    await this.store.load({ from: isoDay(this.weekStart()), to: isoDay(this.weekEnd()), crew_team_id: this.crewFilter });
  }

  protected async shiftWeek(weeks: number): Promise<void> {
    this.weekStart.set(addDays(this.weekStart(), weeks * 7));
    await this.reload();
  }

  protected async goToday(): Promise<void> {
    this.weekStart.set(mondayOf(new Date()));
    await this.reload();
  }

  protected openOptimize(): void {
    this.optimizeError.set(null);
    this.optimizeCrews = this.crews.crews().filter((crew) => crew.is_active).map((crew) => crew.id);
    this.optimizeOpen.set(true);
  }

  protected async runOptimize(): Promise<void> {
    this.optimizeError.set(null);
    const outcome = await this.store.optimize({
      week_start: isoDay(this.weekStart()),
      crew_team_ids: this.optimizeCrews.length > 0 ? this.optimizeCrews : undefined,
      refresh_weather: this.optimizeWeather,
    });
    if (outcome.ok) {
      this.message.success(this.i18n.instant('greenCare.toast.routesOptimized'));
      await this.reload();
    } else {
      this.optimizeError.set(outcome.errorKey);
      this.optimizeErrorParams.set(outcome.params);
    }
  }

  protected async reschedule(): Promise<void> {
    const outcome = await this.store.reschedule({ from: isoDay(this.weekStart()), to: isoDay(this.weekEnd()) });
    if (!outcome.ok) {
      this.message.error(this.i18n.instant(outcome.errorKey ?? 'greenCare.error.unknown', outcome.params));
    }
  }

  protected async refreshWeather(route: GcRoute): Promise<void> {
    const outcome = await this.store.refreshWeather(route.id);
    if (!outcome.ok) {
      this.message.error(this.i18n.instant(outcome.errorKey ?? 'greenCare.error.unknown', outcome.params));
    }
  }

  protected async move(route: GcRoute, stop: GcStop, delta: -1 | 1): Promise<void> {
    const ids = route.stops.map((item) => item.id);
    const from = ids.indexOf(stop.id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= ids.length) {
      return;
    }
    [ids[from], ids[to]] = [ids[to], ids[from]];
    const outcome = await this.store.reorder(route, ids);
    if (!outcome.ok) {
      this.message.error(this.i18n.instant(outcome.errorKey ?? 'greenCare.error.unknown', outcome.params));
    }
  }

  protected async removeRoute(route: GcRoute): Promise<void> {
    const outcome = await this.store.removeRoute(route.id);
    if (outcome.ok) {
      this.selectedId.set(null);
      this.message.success(this.i18n.instant('greenCare.toast.routeDeleted'));
    } else {
      this.message.error(this.i18n.instant(outcome.errorKey ?? 'greenCare.error.unknown', outcome.params));
    }
  }

  private emptyForm(): InterventionForm {
    return {
      checkin_at: null,
      checkout_at: null,
      checkin_gps: null,
      checkout_gps: null,
      crew_hours: [],
      machinery: [],
      materials: [],
      counts_toward_contract_passage: true,
      green_waste_weight_kg: null,
      waste_code: '',
      compost_facility_id: null,
    };
  }

  protected openIntervention(route: GcRoute, stop: GcStop): void {
    const crew = this.crews.crews().find((item) => item.id === route.crew_team_id);
    const logged = new Map((stop.crew_hours_logged?.members ?? []).map((row) => [row.member_id, row.hours]));
    this.interventionError.set(null);
    this.form = {
      checkin_at: stop.actual_checkin_at ? new Date(stop.actual_checkin_at) : new Date(),
      checkout_at: stop.actual_checkout_at ? new Date(stop.actual_checkout_at) : null,
      checkin_gps: stop.checkin_gps,
      checkout_gps: stop.checkout_gps,
      crew_hours: (crew?.members ?? []).map((member) => ({ member_id: member.id, name: member.name, hours: logged.get(member.id) ?? null })),
      machinery: (stop.machinery_hours_logged ?? []).map((row) => ({ machine: row.machine, hours: row.hours })),
      materials: (stop.materials_and_plants_used ?? []).map((row) => ({
        product_id: row.product_id,
        quantity: row.quantity,
        warehouse_id: row.warehouse_id ?? null,
      })),
      counts_toward_contract_passage: stop.contract_id !== null ? stop.counts_toward_contract_passage || stop.actual_checkout_at === null : false,
      green_waste_weight_kg: null,
      waste_code: '',
      compost_facility_id: null,
    };
    this.interventionStop.set(stop);
  }

  protected addMachine(): void {
    this.form.machinery = [...this.form.machinery, { machine: 'lawnmowers', hours: null }];
  }

  protected removeMachine(index: number): void {
    this.form.machinery = this.form.machinery.filter((_, position) => position !== index);
  }

  protected addMaterial(): void {
    this.form.materials = [...this.form.materials, { product_id: null, quantity: null, warehouse_id: null }];
  }

  protected removeMaterial(index: number): void {
    this.form.materials = this.form.materials.filter((_, position) => position !== index);
  }

  protected capture(kind: 'in' | 'out'): void {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const gps: GcGps = { lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy };
        if (kind === 'in') {
          this.form = { ...this.form, checkin_gps: gps };
        } else {
          this.form = { ...this.form, checkout_gps: gps };
        }
      },
      () => this.message.warning(this.i18n.instant('greenCare.toast.gpsUnavailable')),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  protected interventionValid(): boolean {
    const f = this.form;
    const timesOk = f.checkin_at !== null && (f.checkout_at === null || f.checkout_at >= f.checkin_at);
    const materialsOk = f.materials.every((row) => row.product_id !== null && (row.quantity ?? 0) > 0);
    const wasteOk = (f.green_waste_weight_kg ?? 0) <= 0 || f.waste_code !== '';
    return timesOk && materialsOk && wasteOk;
  }

  protected payload(): GcInterventionPayload {
    const f = this.form;
    const weight = f.green_waste_weight_kg ?? 0;
    return {
      checkin_at: f.checkin_at ? f.checkin_at.toISOString() : null,
      checkout_at: f.checkout_at ? f.checkout_at.toISOString() : null,
      checkin_gps: f.checkin_gps,
      checkout_gps: f.checkout_gps,
      crew_hours: f.crew_hours.filter((row) => (row.hours ?? 0) > 0).map((row) => ({ member_id: row.member_id, hours: row.hours ?? 0 })),
      machinery_hours: f.machinery.filter((row) => (row.hours ?? 0) > 0).map((row) => ({ machine: row.machine, hours: row.hours ?? 0 })),
      materials: f.materials
        .filter((row) => row.product_id !== null)
        .map((row) => ({ product_id: row.product_id ?? '', quantity: row.quantity ?? 0, warehouse_id: row.warehouse_id })),
      counts_toward_contract_passage: f.counts_toward_contract_passage,
      green_waste_weight_kg: weight > 0 ? weight : null,
      waste_code: weight > 0 ? f.waste_code : null,
      compost_facility_id: weight > 0 ? f.compost_facility_id : null,
    };
  }

  protected async saveIntervention(): Promise<void> {
    const stop = this.interventionStop();
    if (stop === null || !this.interventionValid()) {
      return;
    }
    const outcome = await this.store.logIntervention(stop.id, this.payload());
    if (outcome.ok) {
      this.interventionStop.set(null);
      this.message.success(this.i18n.instant('greenCare.toast.interventionSaved'));
      await this.reload();
    } else {
      this.interventionError.set(outcome.errorKey);
      this.interventionErrorParams.set(outcome.params);
    }
  }

  protected async photos(stop: GcStop, type: 'before' | 'after', event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (files.length > 0) {
      const outcome = await this.store.uploadPhotos(stop.id, type, files);
      if (outcome.ok) {
        this.message.success(this.i18n.instant('greenCare.toast.photosSaved'));
        const fresh = this.store.routes().flatMap((route) => route.stops).find((item) => item.id === stop.id);
        if (fresh) {
          this.interventionStop.set(fresh);
        }
      } else {
        this.message.error(this.i18n.instant(outcome.errorKey ?? 'greenCare.error.unknown', outcome.params));
      }
    }
    input.value = '';
  }
}
