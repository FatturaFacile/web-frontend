import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nService, WorkflowApiService, WorkflowBusinessCalendar, WorkflowHoliday, WorkflowHolidayType } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { toDayKey } from '@shared/utils/date-validators';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCalendarModule } from 'ng-zorro-antd/calendar';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';

export const HOLIDAY_TYPES: readonly WorkflowHolidayType[] = ['national', 'cantonal', 'patron_saint', 'company'];
export const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
type Weekday = (typeof WEEKDAYS)[number];

/** Swiss cantons (ISO 3166-2:CH) offered for the cantonal holidays. */
export const CH_CANTONS: readonly string[] = [
  'AG', 'AI', 'AR', 'BE', 'BL', 'BS', 'FR', 'GE', 'GL', 'GR', 'JU', 'LU', 'NE',
  'NW', 'OW', 'SG', 'SH', 'SO', 'SZ', 'TG', 'TI', 'UR', 'VD', 'VS', 'ZG', 'ZH',
];

/** Groups the holidays by their day (`Y-m-d`), for the cells of the calendar. */
export function holidaysByDay(holidays: readonly WorkflowHoliday[]): Map<string, WorkflowHoliday[]> {
  const map = new Map<string, WorkflowHoliday[]>();
  for (const holiday of holidays) {
    const key = holiday.holiday_date.slice(0, 10);
    map.set(key, [...(map.get(key) ?? []), holiday]);
  }
  return map;
}

function emptyCalendar(): WorkflowBusinessCalendar {
  return {
    id: '',
    name: '',
    timezone: 'Europe/Zurich',
    work_monday: true,
    work_tuesday: true,
    work_wednesday: true,
    work_thursday: true,
    work_friday: true,
    work_saturday: false,
    work_sunday: false,
    work_hours_start: '08:00',
    work_hours_end: '17:00',
    is_default: false,
  };
}

/**
 * Business calendars (Mod 006): working days and hours that the SLA clock of an approval counts, with a month calendar
 * of the holidays, manual holidays and the seeding of the official CH / IT ones of a year.
 */
@Component({
  selector: 'app-business-calendar',
  imports: [
    FormsModule,
    NzBadgeModule,
    NzButtonModule,
    NzCalendarModule,
    NzCardModule,
    NzCheckboxModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzSwitchModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  template: `
    <app-page-header [title]="'workflows.calendar.title' | translate"></app-page-header>

    <nz-card>
      <div class="row">
        <nz-select
          class="select"
          [ngModel]="selectedId()"
          (ngModelChange)="select($event)"
          [nzPlaceHolder]="'workflows.calendar.select' | translate"
          [attr.aria-label]="'workflows.calendar.select' | translate"
        >
          @for (calendar of calendars(); track calendar.id) {
            <nz-option [nzValue]="calendar.id" [nzLabel]="calendar.name"></nz-option>
          }
        </nz-select>
        <button nz-button (click)="newCalendar()" data-testid="new-calendar">{{ 'workflows.calendar.new' | translate }}</button>
      </div>

      <div class="row">
        <label class="inline">
          {{ 'workflows.calendar.name' | translate }}
          <input nz-input maxlength="150" [ngModel]="form().name" (ngModelChange)="patch('name', $event)" />
        </label>
        <label class="inline">
          {{ 'workflows.calendar.timezone' | translate }}
          <input nz-input [ngModel]="form().timezone" (ngModelChange)="patch('timezone', $event)" />
        </label>
        <label class="inline">
          {{ 'workflows.calendar.hoursStart' | translate }}
          <input nz-input type="time" [ngModel]="form().work_hours_start" (ngModelChange)="patch('work_hours_start', $event)" />
        </label>
        <label class="inline">
          {{ 'workflows.calendar.hoursEnd' | translate }}
          <input nz-input type="time" [ngModel]="form().work_hours_end" (ngModelChange)="patch('work_hours_end', $event)" />
        </label>
        <label class="inline">
          {{ 'workflows.calendar.default' | translate }}
          <nz-switch [ngModel]="form().is_default" (ngModelChange)="patch('is_default', $event)"></nz-switch>
        </label>
      </div>
      <div class="row">
        @for (day of weekdays; track day) {
          <label nz-checkbox [ngModel]="workingDay(day)" (ngModelChange)="setWorkingDay(day, $event)">
            {{ 'workflows.calendar.day.' + day | translate }}
          </label>
        }
      </div>
      <button nz-button nzType="primary" data-testid="save-calendar" [nzLoading]="saving()" [disabled]="!canSave()" (click)="saveCalendar()">
        {{ 'workflows.calendar.save' | translate }}
      </button>
    </nz-card>

    @if (selectedId()) {
      <div class="grid">
        <nz-card [nzTitle]="'workflows.calendar.holidays' | translate">
          <nz-calendar [nzDateCell]="dateCell" (nzSelectChange)="onDaySelected($event)"></nz-calendar>
          <ng-template #dateCell let-date>
            @for (holiday of holidaysOn(date); track holiday.id) {
              <nz-badge nzStatus="error" [nzText]="holiday.name" class="holiday-badge"></nz-badge>
            }
          </ng-template>
        </nz-card>

        <div>
          <nz-card [nzTitle]="'workflows.calendar.addHoliday' | translate">
            <div class="row">
              <label class="inline">
                {{ 'workflows.calendar.date' | translate }}
                <input nz-input type="date" [ngModel]="holidayDraft().holiday_date" (ngModelChange)="patchHoliday('holiday_date', $event)" data-testid="holiday-date" />
              </label>
              <label class="inline">
                {{ 'workflows.calendar.holidayName' | translate }}
                <input nz-input maxlength="150" [ngModel]="holidayDraft().name" (ngModelChange)="patchHoliday('name', $event)" data-testid="holiday-name" />
              </label>
              <label class="inline">
                {{ 'workflows.calendar.holidayType' | translate }}
                <nz-select class="select" [ngModel]="holidayDraft().holiday_type" (ngModelChange)="patchHoliday('holiday_type', $event)">
                  @for (type of holidayTypes; track type) {
                    <nz-option [nzValue]="type" [nzLabel]="'workflows.calendar.type.' + type | translate"></nz-option>
                  }
                </nz-select>
              </label>
              <button nz-button nzType="primary" data-testid="add-holiday" [disabled]="!canAddHoliday()" (click)="addHoliday()">
                {{ 'workflows.calendar.add' | translate }}
              </button>
            </div>
          </nz-card>

          <nz-card [nzTitle]="'workflows.calendar.seed.title' | translate" class="section">
            <div class="row">
              <label class="inline">
                {{ 'workflows.calendar.seed.country' | translate }}
                <nz-select class="select" [ngModel]="seed().country" (ngModelChange)="patchSeed('country', $event)">
                  <nz-option nzValue="CH" nzLabel="CH"></nz-option>
                  <nz-option nzValue="IT" nzLabel="IT"></nz-option>
                </nz-select>
              </label>
              @if (seed().country === 'CH') {
                <label class="inline">
                  {{ 'workflows.calendar.seed.canton' | translate }}
                  <nz-select class="select" nzAllowClear nzShowSearch [ngModel]="seed().canton" (ngModelChange)="patchSeed('canton', $event)">
                    @for (canton of cantons; track canton) {
                      <nz-option [nzValue]="canton" [nzLabel]="canton"></nz-option>
                    }
                  </nz-select>
                </label>
              } @else {
                <label class="inline">
                  {{ 'workflows.calendar.seed.patronSaint' | translate }}
                  <input nz-input maxlength="60" [ngModel]="seed().patron_saint" (ngModelChange)="patchSeed('patron_saint', $event)" />
                </label>
              }
              <label class="inline">
                {{ 'workflows.calendar.seed.year' | translate }}
                <nz-input-number [ngModel]="seed().year" (ngModelChange)="patchSeed('year', $event)" [nzMin]="2000" [nzMax]="2100"></nz-input-number>
              </label>
              <button nz-button data-testid="seed-holidays" [nzLoading]="seeding()" (click)="seedHolidays()">
                {{ 'workflows.calendar.seed.run' | translate }}
              </button>
            </div>
          </nz-card>

          <nz-table #list class="section" [nzData]="sortedHolidays()" [nzPageSize]="10" nzSize="small">
            <thead>
              <tr>
                <th>{{ 'workflows.calendar.date' | translate }}</th>
                <th>{{ 'workflows.calendar.holidayName' | translate }}</th>
                <th>{{ 'workflows.calendar.holidayType' | translate }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (holiday of list.data; track holiday.id) {
                <tr>
                  <td>{{ holiday.holiday_date }}</td>
                  <td>{{ holiday.name }}</td>
                  <td><nz-tag>{{ 'workflows.calendar.type.' + holiday.holiday_type | translate }}</nz-tag></td>
                  <td><button nz-button nzSize="small" nzDanger (click)="removeHoliday(holiday)">{{ 'workflows.calendar.remove' | translate }}</button></td>
                </tr>
              }
            </tbody>
          </nz-table>
        </div>
      </div>
    }
  `,
  styles: `
    .row {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      align-items: flex-end;
      margin-bottom: 12px;
    }
    .select {
      min-width: 180px;
    }
    .inline {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .grid {
      display: grid;
      grid-template-columns: minmax(320px, 1fr) minmax(320px, 1fr);
      gap: 16px;
      margin-top: 16px;
    }
    .section {
      margin-top: 16px;
      display: block;
    }
    .holiday-badge {
      display: block;
      font-size: 11px;
    }
    @media (max-width: 900px) {
      .grid {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class BusinessCalendarComponent implements OnInit {
  private readonly api = inject(WorkflowApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly weekdays = WEEKDAYS;
  protected readonly holidayTypes = HOLIDAY_TYPES;
  protected readonly cantons = CH_CANTONS;

  readonly calendars = signal<WorkflowBusinessCalendar[]>([]);
  readonly selectedId = signal<string | null>(null);
  readonly form = signal<WorkflowBusinessCalendar>(emptyCalendar());
  readonly holidays = signal<WorkflowHoliday[]>([]);
  readonly saving = signal(false);
  readonly seeding = signal(false);
  readonly holidayDraft = signal<{ holiday_date: string; name: string; holiday_type: WorkflowHolidayType }>({
    holiday_date: '',
    name: '',
    holiday_type: 'company',
  });
  readonly seed = signal<{ country: 'CH' | 'IT'; canton: string | null; patron_saint: string; year: number }>({
    country: 'CH',
    canton: null,
    patron_saint: '',
    year: new Date().getFullYear(),
  });

  protected readonly byDay = computed(() => holidaysByDay(this.holidays()));
  protected readonly sortedHolidays = computed(() =>
    [...this.holidays()].sort((a, b) => a.holiday_date.localeCompare(b.holiday_date)),
  );
  protected readonly canSave = computed(() => this.form().name.trim() !== '' && this.workingDays().length > 0);
  protected readonly canAddHoliday = computed(
    () => this.holidayDraft().holiday_date !== '' && this.holidayDraft().name.trim() !== '',
  );

  ngOnInit(): void {
    this.loadCalendars();
  }

  private workingDays(): Weekday[] {
    return WEEKDAYS.filter((day) => this.workingDay(day));
  }

  workingDay(day: Weekday): boolean {
    return this.form()[`work_${day}` as const];
  }

  setWorkingDay(day: Weekday, value: boolean): void {
    this.form.update((current) => ({ ...current, [`work_${day}` as const]: value }));
  }

  patch<K extends keyof WorkflowBusinessCalendar>(key: K, value: WorkflowBusinessCalendar[K]): void {
    this.form.update((current) => ({ ...current, [key]: value }));
  }

  patchHoliday<K extends 'holiday_date' | 'name' | 'holiday_type'>(key: K, value: string): void {
    this.holidayDraft.update((current) => ({ ...current, [key]: value }));
  }

  patchSeed<K extends 'country' | 'canton' | 'patron_saint' | 'year'>(key: K, value: unknown): void {
    this.seed.update((current) => ({ ...current, [key]: value }));
  }

  loadCalendars(selectId?: string): void {
    this.api.getCalendars().subscribe({
      next: (res) => {
        this.calendars.set(res.data);
        const target = selectId ?? this.selectedId() ?? res.data.find((calendar) => calendar.is_default)?.id ?? res.data[0]?.id;
        if (target) {
          this.select(target);
        }
      },
      error: () => this.notify('error', 'workflows.calendar.loadError'),
    });
  }

  newCalendar(): void {
    this.selectedId.set(null);
    this.form.set(emptyCalendar());
    this.holidays.set([]);
  }

  select(id: string | null): void {
    if (!id) {
      this.newCalendar();
      return;
    }
    const calendar = this.calendars().find((candidate) => candidate.id === id);
    if (!calendar) {
      return;
    }
    this.selectedId.set(id);
    this.form.set({ ...calendar });
    this.loadHolidays(id);
  }

  private loadHolidays(calendarId: string): void {
    this.api.getHolidays(calendarId).subscribe({
      next: (res) => this.holidays.set(res.data),
      error: () => this.notify('error', 'workflows.calendar.loadError'),
    });
  }

  saveCalendar(): void {
    const { id, ...payload } = this.form();
    this.saving.set(true);
    const request = this.selectedId() ? this.api.updateCalendar(id, payload) : this.api.createCalendar(payload);
    request.subscribe({
      next: (res) => {
        this.saving.set(false);
        this.notify('success', 'workflows.calendar.saved');
        this.loadCalendars(res.data.id);
      },
      error: () => {
        this.saving.set(false);
        this.notify('error', 'workflows.calendar.saveError');
      },
    });
  }

  holidaysOn(date: Date): WorkflowHoliday[] {
    const key = toDayKey(date);
    return key ? (this.byDay().get(key) ?? []) : [];
  }

  onDaySelected(date: Date): void {
    const key = toDayKey(date);
    if (key) {
      this.patchHoliday('holiday_date', key);
    }
  }

  addHoliday(): void {
    const calendarId = this.selectedId();
    if (!calendarId || !this.canAddHoliday()) {
      return;
    }
    const draft = this.holidayDraft();
    this.api.addHoliday(calendarId, { ...draft, name: draft.name.trim() }).subscribe({
      next: (res) => {
        this.holidays.update((current) => [...current, res.data]);
        this.holidayDraft.update((current) => ({ ...current, name: '' }));
      },
      error: () => this.notify('error', 'workflows.calendar.holidayError'),
    });
  }

  removeHoliday(holiday: WorkflowHoliday): void {
    const calendarId = this.selectedId();
    if (!calendarId) {
      return;
    }
    this.api.deleteHoliday(calendarId, holiday.id).subscribe({
      next: () => this.holidays.update((current) => current.filter((candidate) => candidate.id !== holiday.id)),
      error: () => this.notify('error', 'workflows.calendar.holidayError'),
    });
  }

  seedHolidays(): void {
    const calendarId = this.selectedId();
    if (!calendarId) {
      return;
    }
    const seed = this.seed();
    this.seeding.set(true);
    this.api
      .seedHolidays(calendarId, {
        country: seed.country,
        year: seed.year,
        ...(seed.country === 'CH' && seed.canton ? { canton: seed.canton } : {}),
        ...(seed.country === 'IT' && seed.patron_saint.trim() ? { patron_saint: seed.patron_saint.trim() } : {}),
      })
      .subscribe({
        next: () => {
          this.seeding.set(false);
          this.notify('success', 'workflows.calendar.seed.done');
          this.loadHolidays(calendarId);
        },
        error: () => {
          this.seeding.set(false);
          this.notify('error', 'workflows.calendar.seed.error');
        },
      });
  }

  private notify(level: 'success' | 'error', key: string): void {
    this.message[level](this.i18n.translate(key));
  }
}
