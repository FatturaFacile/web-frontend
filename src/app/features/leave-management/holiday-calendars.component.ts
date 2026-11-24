import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { I18nService, LeaveCountryCode, PermissionsService, SundayHolidayRuleCode } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { LeaveManagementNavComponent } from './leave-management-nav.component';
import { LeaveManagementStore } from './leave-management.store';
import { SWISS_CANTONS } from './leave-management.util';

/**
 * Holiday Calendar Management: Official 26 Swiss Cantons + Federal holidays and
 * Italian National + Municipal Patron Saints (Sant'Ambrogio Milan, SS. Pietro e Paolo Rome, etc.)
 * with Sunday-falling holiday rules (festività cadenti di domenica).
 */
@Component({
  selector: 'app-holiday-calendars',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    NzButtonModule,
    NzCardModule,
    NzDrawerModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
    LeaveManagementNavComponent,
  ],
  template: `
    <app-page-header
      [title]="'leaveMgmt.title' | translate"
      [subtitle]="'leaveMgmt.subtitle' | translate"
    />
    <app-leave-management-nav activeTab="holidays" />

    <nz-card class="mb-4" [nzTitle]="'leaveMgmt.action.loadCatalog' | translate">
      <div class="grid grid-cols-1 gap-3 md:grid-cols-6 items-end">
        <div>
          <label class="block text-xs font-medium mb-1" for="hc-country">{{
            'leaveMgmt.field.country' | translate
          }}</label>
          <nz-select
            nzId="hc-country"
            class="w-full"
            [ngModel]="previewCountry()"
            (ngModelChange)="previewCountry.set($event)"
          >
            <nz-option nzValue="CH" [nzLabel]="'leaveMgmt.country.CH' | translate" />
            <nz-option nzValue="IT" [nzLabel]="'leaveMgmt.country.IT' | translate" />
          </nz-select>
        </div>
        <div>
          <label class="block text-xs font-medium mb-1" for="hc-year">Year</label>
          <nz-input-number
            id="hc-year"
            class="w-full"
            [ngModel]="previewYear()"
            (ngModelChange)="previewYear.set($event)"
            [nzMin]="2020"
            [nzMax]="2050"
          />
        </div>
        <div>
          <label class="block text-xs font-medium mb-1" for="hc-canton">{{
            'leaveMgmt.field.canton' | translate
          }}</label>
          @if (previewCountry() === 'CH') {
            <nz-select
              nzId="hc-canton"
              class="w-full"
              [ngModel]="previewCanton()"
              (ngModelChange)="previewCanton.set($event)"
            >
              @for (c of cantons; track c) {
                <nz-option [nzValue]="c" [nzLabel]="c" />
              }
            </nz-select>
          } @else {
            <input
              nz-input
              id="hc-canton"
              [ngModel]="previewCanton()"
              (ngModelChange)="previewCanton.set($event)"
            />
          }
        </div>
        <div>
          <label class="block text-xs font-medium mb-1" for="hc-muni">{{
            'leaveMgmt.field.municipality' | translate
          }}</label>
          <input
            nz-input
            id="hc-muni"
            [ngModel]="previewMunicipality()"
            (ngModelChange)="previewMunicipality.set($event)"
            placeholder="Milano / Roma"
          />
        </div>
        <div>
          <label class="block text-xs font-medium mb-1" for="hc-patron">{{
            'leaveMgmt.field.patronDate' | translate
          }}</label>
          <input
            nz-input
            id="hc-patron"
            [ngModel]="previewPatronDate()"
            (ngModelChange)="previewPatronDate.set($event)"
            placeholder="12-07"
          />
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            nz-button
            nzType="primary"
            type="button"
            data-testid="lm-preview-holidays-btn"
            (click)="loadPreview()"
          >
            {{ 'leaveMgmt.action.loadCatalog' | translate }}
          </button>
          @if (canManage()) {
            <button nz-button type="button" (click)="drawerOpen.set(true)">
              {{ 'leaveMgmt.action.createCalendar' | translate }}
            </button>
          }
        </div>
      </div>

      @if (store.holidayCatalog(); as catalog) {
        <nz-table
          class="mt-4"
          #catTable
          [nzData]="catalog.holidays"
          [nzFrontPagination]="false"
          [nzShowPagination]="false"
          nzSize="small"
        >
          <thead>
            <tr>
              <th>Date</th>
              <th>Holiday</th>
              <th>Scope</th>
              <th>{{ 'leaveMgmt.gantt.sundayHoliday' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (h of catTable.data; track h.date + h.name) {
              <tr>
                <td>{{ h.date }}</td>
                <td>{{ h.name }}</td>
                <td>
                  <nz-tag>{{ h.scope }}</nz-tag>
                </td>
                <td>
                  @if (h.is_sunday) {
                    <nz-tag nzColor="orange">{{
                      'leaveMgmt.gantt.sundayHoliday' | translate
                    }}</nz-tag>
                  } @else {
                    <span>—</span>
                  }
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
      }
    </nz-card>

    <nz-card [nzTitle]="'leaveMgmt.tab.holidays' | translate">
      <nz-table
        #calTable
        [nzData]="store.holidayCalendars()"
        [nzLoading]="store.loading()"
        nzSize="middle"
      >
        <thead>
          <tr>
            <th>Code</th>
            <th>Name</th>
            <th>{{ 'leaveMgmt.field.country' | translate }}</th>
            <th>{{ 'leaveMgmt.field.canton' | translate }}</th>
            <th>{{ 'leaveMgmt.field.municipality' | translate }}</th>
            <th>Year</th>
            <th>Holidays</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          @for (cal of calTable.data; track cal.id) {
            <tr>
              <td>{{ cal.code }}</td>
              <td>{{ cal.name }}</td>
              <td>
                <nz-tag>{{ cal.country }}</nz-tag>
              </td>
              <td>{{ cal.canton_or_province_code ?? '—' }}</td>
              <td>
                {{ cal.municipality_name ?? '—' }}
                {{
                  cal.municipality_patron_saint_date
                    ? '(' + cal.municipality_patron_saint_date + ')'
                    : ''
                }}
              </td>
              <td>{{ cal.year }}</td>
              <td>{{ cal.holidays.length }}</td>
              <td>
                @if (canManage()) {
                  <button
                    nz-button
                    nzSize="small"
                    nzDanger
                    type="button"
                    nz-popconfirm
                    nzPopconfirmTitle="Delete?"
                    (nzOnConfirm)="removeCalendar(cal.id)"
                  >
                    Delete
                  </button>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    <nz-drawer
      [nzVisible]="drawerOpen()"
      [nzTitle]="'leaveMgmt.action.createCalendar' | translate"
      [nzWidth]="460"
      (nzOnClose)="drawerOpen.set(false)"
    >
      <ng-container *nzDrawerContent>
        <form nz-form nzLayout="vertical" [formGroup]="form" (ngSubmit)="saveCalendar()">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="cal-code">Code</nz-form-label>
            <nz-form-control
              ><input nz-input id="cal-code" formControlName="code"
            /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="cal-name">Name</nz-form-label>
            <nz-form-control
              ><input nz-input id="cal-name" formControlName="name"
            /></nz-form-control>
          </nz-form-item>
          <div class="grid grid-cols-2 gap-3">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="cal-country">{{
                'leaveMgmt.field.country' | translate
              }}</nz-form-label>
              <nz-form-control>
                <nz-select nzId="cal-country" formControlName="country">
                  <nz-option nzValue="CH" [nzLabel]="'leaveMgmt.country.CH' | translate" />
                  <nz-option nzValue="IT" [nzLabel]="'leaveMgmt.country.IT' | translate" />
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="cal-year">Year</nz-form-label>
              <nz-form-control>
                <nz-input-number
                  id="cal-year"
                  class="w-full"
                  formControlName="year"
                  [nzMin]="2020"
                  [nzMax]="2050"
                />
              </nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-label nzFor="cal-canton">{{
              'leaveMgmt.field.canton' | translate
            }}</nz-form-label>
            <nz-form-control
              ><input nz-input id="cal-canton" formControlName="canton_or_province_code"
            /></nz-form-control>
          </nz-form-item>
          <div class="grid grid-cols-2 gap-3">
            <nz-form-item>
              <nz-form-label nzFor="cal-muni">{{
                'leaveMgmt.field.municipality' | translate
              }}</nz-form-label>
              <nz-form-control
                ><input nz-input id="cal-muni" formControlName="municipality_name"
              /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="cal-patron">{{
                'leaveMgmt.field.patronDate' | translate
              }}</nz-form-label>
              <nz-form-control
                ><input
                  nz-input
                  id="cal-patron"
                  formControlName="municipality_patron_saint_date"
                  placeholder="12-07"
              /></nz-form-control>
            </nz-form-item>
          </div>
          <div class="flex justify-end gap-2 mt-4">
            <button nz-button type="button" (click)="drawerOpen.set(false)">
              {{ 'leaveMgmt.action.cancel' | translate }}
            </button>
            <button
              nz-button
              nzType="primary"
              type="submit"
              [disabled]="form.invalid"
              [nzLoading]="store.saving()"
            >
              {{ 'leaveMgmt.action.createCalendar' | translate }}
            </button>
          </div>
        </form>
      </ng-container>
    </nz-drawer>
  `,
})
export class HolidayCalendarsComponent implements OnInit {
  protected readonly store = inject(LeaveManagementStore);
  private readonly fb = inject(FormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly permissions = inject(PermissionsService);

  protected readonly cantons = SWISS_CANTONS;
  protected readonly previewCountry = signal<LeaveCountryCode>('CH');
  protected readonly previewYear = signal(new Date().getFullYear());
  protected readonly previewCanton = signal('TI');
  protected readonly previewMunicipality = signal('Milano');
  protected readonly previewPatronDate = signal('');
  protected readonly drawerOpen = signal(false);

  protected readonly canManage = computed(
    () => this.permissions.canWrite('hr') || this.permissions.canWrite('leave_management'),
  );

  protected readonly form = this.fb.nonNullable.group({
    code: ['', Validators.required],
    name: ['', Validators.required],
    country: ['CH' as LeaveCountryCode, Validators.required],
    year: [new Date().getFullYear(), Validators.required],
    canton_or_province_code: ['TI'],
    municipality_name: [''],
    municipality_patron_saint_date: [''],
    sunday_holiday_rule: ['compensatory_pay_or_day' as SundayHolidayRuleCode],
  });

  ngOnInit(): void {
    void this.store.loadHolidayCalendars();
    void this.loadPreview();
  }

  protected async loadPreview(): Promise<void> {
    try {
      await this.store.previewHolidayCatalog({
        country: this.previewCountry(),
        year: this.previewYear(),
        canton_or_province_code: this.previewCanton() || undefined,
        municipality_name: this.previewMunicipality() || undefined,
        municipality_patron_saint_date: this.previewPatronDate() || undefined,
      });
    } catch {
      this.message.error(this.i18n.translate('COMMON.ERROR'));
    }
  }

  protected async saveCalendar(): Promise<void> {
    if (this.form.invalid) {
      return;
    }
    const val = this.form.getRawValue();
    try {
      await this.store.createHolidayCalendar({
        ...val,
        canton_or_province_code: val.canton_or_province_code || null,
        municipality_name: val.municipality_name || null,
        municipality_patron_saint_date: val.municipality_patron_saint_date || null,
      });
      this.drawerOpen.set(false);
      this.message.success(this.i18n.translate('leaveMgmt.action.createCalendar'));
    } catch {
      this.message.error(this.i18n.translate('COMMON.ERROR'));
    }
  }

  protected async removeCalendar(id: string): Promise<void> {
    try {
      await this.store.deleteHolidayCalendar(id);
    } catch {
      this.message.error(this.i18n.translate('COMMON.ERROR'));
    }
  }
}
