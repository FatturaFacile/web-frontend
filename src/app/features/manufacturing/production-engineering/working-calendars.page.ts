import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import {
  ManufacturingProductionApiService,
  MfgCalendarClosure,
  MfgCalendarDayType,
  MfgCalendarPreviewDay,
  MfgCalendarShift,
  MfgWorkingCalendarDetail,
  SaveWorkingCalendarPayload,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { apiErrorText, calendarTotals, calendarWeeks, DAY_TYPES, isoDate } from './production-engineering.utils';

interface CalendarDraft {
  code: string;
  name: string;
  timezone: string;
  country_code: string;
  region_code: string;
  is_default: boolean;
  shifts: MfgCalendarShift[];
  closures: MfgCalendarClosure[];
}

const blankCalendar = (): CalendarDraft => ({
  code: '',
  name: '',
  timezone: 'Europe/Zurich',
  country_code: 'CH',
  region_code: '',
  is_default: false,
  shifts: [1, 2, 3, 4, 5].map((day) => ({ day_of_week: day, shift_code: 'D', start_time: '08:00', end_time: '17:00', break_minutes: 60, labor_multiplier: '1' })),
  closures: [],
});

const draftOf = (calendar: MfgWorkingCalendarDetail): CalendarDraft => ({
  code: calendar.code,
  name: calendar.name,
  timezone: calendar.timezone,
  country_code: calendar.country_code,
  region_code: calendar.region_code ?? '',
  is_default: calendar.is_default,
  shifts: (calendar.shifts ?? []).map((s) => ({ ...s, start_time: s.start_time.slice(0, 5), end_time: s.end_time.slice(0, 5) })),
  closures: (calendar.closures ?? []).map((c) => ({ ...c })),
});

const monthBounds = (): { from: string; to: string } => {
  const now = new Date();

  return { from: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
};

/** Working calendar editor (weekly shifts and planned shutdowns) with a preview of the resolved days. */
@Component({
  selector: 'app-mfg-working-calendars',
  imports: [FormsModule, PageHeaderComponent, TranslatePipe, NzButtonModule, NzCardModule, NzCheckboxModule, NzInputModule, NzPopconfirmModule, NzSelectModule, NzSpinModule],
  styles: `
    .layout { display: grid; grid-template-columns: minmax(220px, 280px) 1fr; gap: 16px; align-items: start }
    @media (max-width: 900px) { .layout { grid-template-columns: 1fr } }
    ul.list { list-style: none; margin: 0; padding: 0 }
    ul.list button { width: 100%; text-align: left; margin-bottom: 4px }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px 16px }
    .grid .field { display: flex; flex-direction: column; gap: 4px; font-size: 13px }
    .row { display: grid; grid-template-columns: 120px 80px 110px 110px 90px 90px auto; gap: 8px; margin-bottom: 8px; align-items: end }
    .row .field { display: flex; flex-direction: column; gap: 2px; font-size: 12px }
    .rowc { display: grid; grid-template-columns: 150px 150px 1fr auto; gap: 8px; margin-bottom: 8px; align-items: end }
    h4 { margin: 20px 0 8px }
    .actions { display: flex; gap: 8px; margin-top: 16px }
    .preview { margin-top: 16px }
    .legend { display: flex; gap: 16px; flex-wrap: wrap; margin: 8px 0; font-size: 13px }
    .legend i, .cell i { display: inline-block; width: 12px; height: 12px; border-radius: 2px; margin-right: 4px }
    .calendar { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px }
    .head { font-weight: 600; font-size: 12px; text-align: center }
    .cell { min-height: 56px; border-radius: 4px; padding: 4px 6px; font-size: 12px; border: 1px solid var(--border-color, #d9d9d9) }
    .cell.out { opacity: .3 }
    .working_shift { background: #d9f7be } .holiday { background: #ffccc7 } .non_working_weekend { background: #f0f0f0 } .planned_shutdown { background: #ffe7ba }
    .working_shift i { background: #52c41a } .holiday i { background: #f5222d } .non_working_weekend i { background: #bfbfbf } .planned_shutdown i { background: #fa8c16 }
    .totals { margin-top: 8px; font-size: 13px }
  `,
  template: `
    <app-page-header [title]="'MFG_PE.CALENDARS_TITLE' | translate" [subtitle]="'MFG_PE.CALENDARS_SUBTITLE' | translate"></app-page-header>

    <div class="layout">
      <nz-card [nzTitle]="'MFG_PE.CALENDARS' | translate">
        <nz-spin [nzSpinning]="loading()">
          <ul class="list" data-testid="calendar-list">
            @for (c of calendars(); track c.id) {
              <li>
                <button nz-button type="button" [nzType]="c.id === selectedId() ? 'primary' : 'default'" [attr.data-testid]="'cal-' + c.code" (click)="select(c)">
                  {{ c.code }} · {{ c.name }}
                </button>
              </li>
            }
          </ul>
        </nz-spin>
        <button nz-button nzBlock type="button" data-testid="new-calendar" (click)="create()">{{ 'MFG_PE.NEW_CALENDAR' | translate }}</button>
      </nz-card>

      <div>
        @if (draft(); as d) {
          <nz-card [nzTitle]="(selectedId() ? 'MFG_PE.EDIT_CALENDAR' : 'MFG_PE.NEW_CALENDAR') | translate" data-testid="calendar-form">
            <div class="grid">
              <div class="field"><span>{{ 'MFG_PE.COL_CODE' | translate }}</span><input [attr.aria-label]="'MFG_PE.COL_CODE' | translate" nz-input [ngModel]="d.code" (ngModelChange)="patch({ code: $event })" data-testid="c-code" /></div>
              <div class="field"><span>{{ 'MFG_PE.COL_NAME' | translate }}</span><input [attr.aria-label]="'MFG_PE.COL_NAME' | translate" nz-input [ngModel]="d.name" (ngModelChange)="patch({ name: $event })" data-testid="c-name" /></div>
              <div class="field"><span>{{ 'MFG_PE.TIMEZONE' | translate }}</span><input [attr.aria-label]="'MFG_PE.TIMEZONE' | translate" nz-input [ngModel]="d.timezone" (ngModelChange)="patch({ timezone: $event })" /></div>
              <div class="field"><span>{{ 'MFG_PE.COUNTRY' | translate }}</span><nz-select [attr.aria-label]="'MFG_PE.COUNTRY' | translate" [ngModel]="d.country_code" (ngModelChange)="patch({ country_code: $event })">
                  <nz-option nzValue="CH" nzLabel="CH"></nz-option>
                  <nz-option nzValue="IT" nzLabel="IT"></nz-option>
                </nz-select>
              </div>
              <div class="field"><span>{{ 'MFG_PE.REGION' | translate }}</span><input [attr.aria-label]="'MFG_PE.REGION' | translate" nz-input maxlength="3" [ngModel]="d.region_code" (ngModelChange)="patch({ region_code: $event })" /></div>
              <span nz-checkbox [ngModel]="d.is_default" (ngModelChange)="patch({ is_default: $event })">{{ 'MFG_PE.DEFAULT_CALENDAR' | translate }}</span>
            </div>

            <h4>{{ 'MFG_PE.SHIFTS' | translate }}</h4>
            @for (s of d.shifts; track $index) {
              <div class="row" [attr.data-testid]="'shift-' + $index">
                <div class="field"><span>{{ 'MFG_PE.DAY' | translate }}</span><nz-select [attr.aria-label]="'MFG_PE.DAY' | translate" [ngModel]="s.day_of_week" (ngModelChange)="patchShift($index, { day_of_week: $event })">
                    @for (n of weekdays; track n) {
                      <nz-option [nzValue]="n" [nzLabel]="'MFG_PE.DAY_' + n | translate"></nz-option>
                    }
                  </nz-select>
                </div>
                <div class="field"><span>{{ 'MFG_PE.SHIFT_CODE' | translate }}</span><input [attr.aria-label]="'MFG_PE.SHIFT_CODE' | translate" nz-input [ngModel]="s.shift_code" (ngModelChange)="patchShift($index, { shift_code: $event })" /></div>
                <div class="field"><span>{{ 'MFG_PE.FROM' | translate }}</span><input [attr.aria-label]="'MFG_PE.FROM' | translate" nz-input type="time" [ngModel]="s.start_time" (ngModelChange)="patchShift($index, { start_time: $event })" /></div>
                <div class="field"><span>{{ 'MFG_PE.TO' | translate }}</span><input [attr.aria-label]="'MFG_PE.TO' | translate" nz-input type="time" [ngModel]="s.end_time" (ngModelChange)="patchShift($index, { end_time: $event })" /></div>
                <div class="field"><span>{{ 'MFG_PE.BREAK_MINUTES' | translate }}</span><input [attr.aria-label]="'MFG_PE.BREAK_MINUTES' | translate" nz-input type="number" min="0" [ngModel]="s.break_minutes" (ngModelChange)="patchShift($index, { break_minutes: $event === '' ? null : +$event })" /></div>
                <div class="field"><span>{{ 'MFG_PE.LABOUR_MULTIPLIER' | translate }}</span><input [attr.aria-label]="'MFG_PE.LABOUR_MULTIPLIER' | translate" nz-input type="number" min="0" step="0.05" [ngModel]="s.labor_multiplier" (ngModelChange)="patchShift($index, { labor_multiplier: $event === '' ? null : '' + $event })" /></div>
                <button nz-button nzDanger type="button" [attr.aria-label]="'MFG_PE.DELETE' | translate" (click)="removeShift($index)">×</button>
              </div>
            }
            <button nz-button type="button" data-testid="add-shift" (click)="addShift()">{{ 'MFG_PE.ADD_SHIFT' | translate }}</button>

            <h4>{{ 'MFG_PE.CLOSURES' | translate }}</h4>
            @for (c of d.closures; track $index) {
              <div class="rowc">
                <div class="field"><span>{{ 'MFG_PE.FROM' | translate }}</span><input [attr.aria-label]="'MFG_PE.FROM' | translate" nz-input type="date" [ngModel]="c.starts_on" (ngModelChange)="patchClosure($index, { starts_on: $event })" /></div>
                <div class="field"><span>{{ 'MFG_PE.TO' | translate }}</span><input [attr.aria-label]="'MFG_PE.TO' | translate" nz-input type="date" [ngModel]="c.ends_on" (ngModelChange)="patchClosure($index, { ends_on: $event })" /></div>
                <div class="field"><span>{{ 'MFG_PE.REASON' | translate }}</span><input [attr.aria-label]="'MFG_PE.REASON' | translate" nz-input [ngModel]="c.reason" (ngModelChange)="patchClosure($index, { reason: $event })" /></div>
                <button nz-button nzDanger type="button" [attr.aria-label]="'MFG_PE.DELETE' | translate" (click)="removeClosure($index)">×</button>
              </div>
            }
            <button nz-button type="button" data-testid="add-closure" (click)="addClosure()">{{ 'MFG_PE.ADD_CLOSURE' | translate }}</button>

            <div class="actions">
              <button nz-button nzType="primary" type="button" data-testid="save-calendar" [disabled]="!valid() || saving()" [nzLoading]="saving()" (click)="save()">{{ 'MFG_PE.SAVE' | translate }}</button>
              @if (selectedId()) {
                <button nz-button nzDanger type="button" nz-popconfirm [nzPopconfirmTitle]="'MFG_PE.CONFIRM_DELETE' | translate" (nzOnConfirm)="remove()">{{ 'MFG_PE.DELETE' | translate }}</button>
              }
            </div>
          </nz-card>

          @if (selectedId()) {
            <nz-card class="preview" [nzTitle]="'MFG_PE.PREVIEW' | translate" data-testid="preview">
              <div class="grid">
                <div class="field"><span>{{ 'MFG_PE.FROM' | translate }}</span><input [attr.aria-label]="'MFG_PE.FROM' | translate" nz-input type="date" [ngModel]="from()" (ngModelChange)="from.set($event)" data-testid="p-from" /></div>
                <div class="field"><span>{{ 'MFG_PE.TO' | translate }}</span><input [attr.aria-label]="'MFG_PE.TO' | translate" nz-input type="date" [ngModel]="to()" (ngModelChange)="to.set($event)" data-testid="p-to" /></div>
                <div style="align-self: end">
                  <button nz-button type="button" data-testid="run-preview" [disabled]="!from() || !to() || previewing()" [nzLoading]="previewing()" (click)="runPreview()">{{ 'MFG_PE.PREVIEW_RUN' | translate }}</button>
                </div>
              </div>
              <div class="legend" aria-hidden="true">
                @for (t of dayTypes; track t) {
                  <span [class]="t"><i></i>{{ 'MFG_PE.DAY_TYPE_' + t.toUpperCase() | translate }}</span>
                }
              </div>
              @if (weeks().length > 0) {
                <div class="calendar" role="table" [attr.aria-label]="'MFG_PE.PREVIEW' | translate">
                  @for (n of weekdays; track n) {
                    <div class="head" role="columnheader">{{ 'MFG_PE.DAY_' + n | translate }}</div>
                  }
                  @for (week of weeks(); track $index) {
                    @for (cell of week; track cell.date) {
                      <div class="cell" role="cell" [class.out]="!cell.inRange" [class]="cell.preview ? cell.preview.day_type : ''" [attr.data-testid]="'day-' + cell.date" [attr.data-type]="cell.preview?.day_type ?? null" [title]="cell.preview?.label ?? ''">
                        <strong>{{ cell.day }}</strong>
                        @if (cell.preview; as p) {
                          <div>
                            @if (p.day_type === 'working_shift') {
                              {{ p.available_minutes / 60 }} h
                            } @else {
                              {{ p.label || ('MFG_PE.DAY_TYPE_' + p.day_type.toUpperCase() | translate) }}
                            }
                          </div>
                        }
                      </div>
                    }
                  }
                </div>
                <p class="totals" data-testid="totals">
                  {{ 'MFG_PE.PREVIEW_TOTALS' | translate: { working: totals().working_shift, holidays: totals().holiday, shutdowns: totals().planned_shutdown, hours: totals().hours } }}
                </p>
              }
            </nz-card>
          }
        }
      </div>
    </div>
  `,
})
export class WorkingCalendarsComponent {
  private readonly api = inject(ManufacturingProductionApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly weekdays = [1, 2, 3, 4, 5, 6, 7];
  protected readonly dayTypes: readonly MfgCalendarDayType[] = DAY_TYPES;
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly previewing = signal(false);
  protected readonly calendars = signal<MfgWorkingCalendarDetail[]>([]);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly draft = signal<CalendarDraft | null>(null);
  protected readonly from = signal(monthBounds().from);
  protected readonly to = signal(monthBounds().to);
  protected readonly days = signal<MfgCalendarPreviewDay[]>([]);
  protected readonly weeks = computed(() => calendarWeeks(this.days()));
  protected readonly totals = computed(() => calendarTotals(this.days()));
  protected readonly valid = computed(() => {
    const d = this.draft();

    return !!d && d.code.trim() !== '' && d.name.trim() !== '' && d.shifts.every((s) => s.start_time !== '' && s.end_time !== '' && s.shift_code.trim() !== '');
  });

  constructor() {
    this.reload();
  }

  protected select(calendar: MfgWorkingCalendarDetail): void {
    this.api
      .getWorkingCalendar(calendar.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.selectedId.set(res.data.id);
          this.draft.set(draftOf(res.data));
          this.days.set([]);
          this.runPreview();
        },
        error: (err: unknown) => this.message.error(apiErrorText(err) ?? this.i18n.instant('MFG_PE.LOAD_ERROR')),
      });
  }

  protected create(): void {
    this.selectedId.set(null);
    this.days.set([]);
    this.draft.set(blankCalendar());
  }

  protected patch(patch: Partial<CalendarDraft>): void {
    this.draft.update((d) => (d ? { ...d, ...patch } : d));
  }

  protected patchShift(index: number, patch: Partial<MfgCalendarShift>): void {
    this.draft.update((d) => (d ? { ...d, shifts: d.shifts.map((s, i) => (i === index ? { ...s, ...patch } : s)) } : d));
  }

  protected addShift(): void {
    this.draft.update((d) => (d ? { ...d, shifts: [...d.shifts, { day_of_week: 1, shift_code: 'D', start_time: '08:00', end_time: '17:00', break_minutes: 0, labor_multiplier: '1' }] } : d));
  }

  protected removeShift(index: number): void {
    this.draft.update((d) => (d ? { ...d, shifts: d.shifts.filter((_, i) => i !== index) } : d));
  }

  protected patchClosure(index: number, patch: Partial<MfgCalendarClosure>): void {
    this.draft.update((d) => (d ? { ...d, closures: d.closures.map((c, i) => (i === index ? { ...c, ...patch } : c)) } : d));
  }

  protected addClosure(): void {
    const today = isoDate(new Date());
    this.draft.update((d) => (d ? { ...d, closures: [...d.closures, { starts_on: today, ends_on: today, reason: '' }] } : d));
  }

  protected removeClosure(index: number): void {
    this.draft.update((d) => (d ? { ...d, closures: d.closures.filter((_, i) => i !== index) } : d));
  }

  protected save(): void {
    const d = this.draft();
    if (!d) {
      return;
    }
    const payload: SaveWorkingCalendarPayload = {
      ...d,
      region_code: d.region_code.trim() === '' ? null : d.region_code.trim(),
      closures: d.closures.map((c) => ({ ...c, reason: c.reason?.trim() ? c.reason : null })),
    };
    const id = this.selectedId();
    this.saving.set(true);
    (id ? this.api.updateWorkingCalendar(id, payload) : this.api.createWorkingCalendar(payload))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.saving.set(false);
          this.message.success(this.i18n.instant('MFG_PE.SAVED'));
          this.selectedId.set(res.data.id);
          this.reload();
          this.runPreview();
        },
        error: (err: unknown) => {
          this.saving.set(false);
          this.message.error(apiErrorText(err) ?? this.i18n.instant('MFG_PE.ERROR'));
        },
      });
  }

  protected remove(): void {
    const id = this.selectedId();
    if (!id) {
      return;
    }
    this.api
      .deleteWorkingCalendar(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.selectedId.set(null);
          this.draft.set(null);
          this.days.set([]);
          this.message.success(this.i18n.instant('MFG_PE.DELETED'));
          this.reload();
        },
        error: (err: unknown) => this.message.error(apiErrorText(err) ?? this.i18n.instant('MFG_PE.ERROR')),
      });
  }

  protected runPreview(): void {
    const id = this.selectedId();
    if (!id || !this.from() || !this.to()) {
      return;
    }
    this.previewing.set(true);
    this.api
      .previewCalendarDays(id, this.from(), this.to())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.days.set(res.data);
          this.previewing.set(false);
        },
        error: (err: unknown) => {
          this.previewing.set(false);
          this.message.error(apiErrorText(err) ?? this.i18n.instant('MFG_PE.ERROR'));
        },
      });
  }

  private reload(): void {
    this.loading.set(true);
    this.api
      .listWorkingCalendars({ per_page: 100 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.calendars.set(res.data);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.message.error(this.i18n.instant('MFG_PE.LOAD_ERROR'));
        },
      });
  }
}
