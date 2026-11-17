import { Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ATS_EMPLOYMENT_TYPES,
  ATS_LOCALES,
  AtsEmploymentType,
  AtsJobOpening,
  AtsJobOpeningPayload,
  AtsLocale,
  AtsTranslation,
  HrEmployeeApiService,
  HrExtraApiService,
  I18nService,
  PositionResource,
} from '@core';
import { ModalActionsDirective, TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { reportHttpError } from '../shared/hr-http.util';

/** Builds the opening payload of the form (pure, so it is unit tested). */
export function buildOpeningPayload(form: {
  position_id: string;
  location_site: string;
  employment_type: AtsEmploymentType;
  openings_count: number | null;
  closes_at: string;
  salary_min: number | null;
  salary_max: number | null;
  currency: 'EUR' | 'CHF';
  languages: AtsLocale[];
  translations: Partial<Record<AtsLocale, AtsTranslation>>;
}): AtsJobOpeningPayload {
  const translations: Partial<Record<AtsLocale, AtsTranslation>> = {};
  for (const locale of form.languages) {
    translations[locale] = form.translations[locale] ?? {};
  }
  const hasSalary = form.salary_min !== null || form.salary_max !== null;
  return {
    position_id: form.position_id,
    location_site: form.location_site.trim(),
    employment_type: form.employment_type,
    openings_count: form.openings_count,
    closes_at: form.closes_at || null,
    salary_range_public: hasSalary ? { min: form.salary_min, max: form.salary_max, currency: form.currency } : null,
    published_languages: form.languages,
    translations,
  };
}

/** Job openings of the ATS: list, create/edit, publish and close. */
@Component({
  selector: 'app-ats-openings',
  imports: [FormsModule, ModalActionsDirective, NzButtonModule, NzInputModule, NzModalModule, NzSelectModule, NzTableModule, NzTagModule, TranslatePipe],
  template: `
    <div class="filter-bar">
      <nz-select class="w-field-md" nzAllowClear [nzPlaceHolder]="'hrmCommon.statusCol' | translate" [ngModel]="status()" (ngModelChange)="status.set($event); load()">
        @for (s of statuses; track s) {
          <nz-option [nzValue]="s" [nzLabel]="('hrmAts.openingStatus.' + s) | translate" />
        }
      </nz-select>
      @if (canWrite()) {
        <button nz-button nzType="primary" type="button" (click)="openForm(null)">{{ 'hrmAts.newOpening' | translate }}</button>
      }
    </div>
    <nz-table #table nzSize="small" [nzData]="rows()" [nzLoading]="loading()" [nzShowPagination]="false">
      <thead>
        <tr>
          <th>{{ 'hrmAts.reference' | translate }}</th>
          <th>{{ 'hrmAts.position' | translate }}</th>
          <th>{{ 'hrmRecruiting.location' | translate }}</th>
          <th>{{ 'hrmCommon.statusCol' | translate }}</th>
          <th>{{ 'hrmAts.hires' | translate }}</th>
          <th>{{ 'hrmRecruiting.applications' | translate }}</th>
          <th>{{ 'hrmRecruiting.closesOn' | translate }}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        @for (row of table.data; track row.id) {
          <tr>
            <td>{{ row.reference }}</td>
            <td>{{ row.position_title }}</td>
            <td>{{ row.location_site }}</td>
            <td>
              <nz-tag>{{ 'hrmAts.openingStatus.' + row.status | translate }}</nz-tag>
            </td>
            <td>{{ row.hires_count }} / {{ row.openings_count }}</td>
            <td>{{ row.applications_count }}</td>
            <td>{{ row.closes_at }}</td>
            <td>
              <button nz-button nzSize="small" type="button" (click)="board.emit(row.id)">{{ 'hrmAts.openBoard' | translate }}</button>
              @if (canWrite()) {
                @if (row.status === 'draft') {
                  <button nz-button nzSize="small" type="button" (click)="publish(row, false)">{{ 'hrmAts.publish' | translate }}</button>
                  <button nz-button nzSize="small" type="button" (click)="publish(row, true)">{{ 'hrmAts.publishInternal' | translate }}</button>
                }
                @if (row.status === 'draft' || row.status === 'published' || row.status === 'internal_only') {
                  <button nz-button nzSize="small" type="button" (click)="openForm(row)">{{ 'hrmCommon.edit' | translate }}</button>
                  <button nz-button nzSize="small" nzDanger type="button" (click)="close(row, 'filled')">{{ 'hrmAts.closeFilled' | translate }}</button>
                  <button nz-button nzSize="small" nzDanger type="button" (click)="close(row, 'cancelled')">{{ 'hrmAts.cancelOpening' | translate }}</button>
                }
              }
            </td>
          </tr>
        }
      </tbody>
    </nz-table>

    <nz-modal [nzVisible]="formOpen()" [nzTitle]="(editing() ? 'hrmAts.editOpening' : 'hrmAts.newOpening') | translate" [nzWidth]="720" [nzOkDisabled]="!valid()" [nzOkLoading]="saving()" (nzOnOk)="save()" (nzOnCancel)="formOpen.set(false)">
      <ng-container *nzModalContent>
        <div class="form-grid">
          <label for="op-pos">{{ 'hrmAts.position' | translate }}</label>
          <nz-select id="op-pos" nzShowSearch [nzDisabled]="editing()" [ngModel]="positionId()" (ngModelChange)="positionId.set($event)">
            @for (p of positions(); track p.id) {
              <nz-option [nzValue]="p.id" [nzLabel]="p.code + ' - ' + p.title" />
            }
          </nz-select>
          <label for="op-site">{{ 'hrmRecruiting.location' | translate }}</label>
          <input nz-input id="op-site" maxlength="150" [ngModel]="site()" (ngModelChange)="site.set($event)" />
          <label for="op-type">{{ 'hrmLeave.employmentType' | translate }}</label>
          <nz-select id="op-type" [ngModel]="employmentType()" (ngModelChange)="employmentType.set($event)">
            @for (t of employmentTypes; track t) {
              <nz-option [nzValue]="t" [nzLabel]="('hrmAts.employmentType.' + t) | translate" />
            }
          </nz-select>
          <label for="op-count">{{ 'hrmAts.openingsCount' | translate }}</label>
          <input nz-input id="op-count" type="number" min="1" max="1000" [ngModel]="openingsCount()" (ngModelChange)="openingsCount.set($event)" />
          <label for="op-closes">{{ 'hrmRecruiting.closesOn' | translate }}</label>
          <input nz-input id="op-closes" type="date" [ngModel]="closesAt()" (ngModelChange)="closesAt.set($event)" />
          <label for="op-smin">{{ 'hrmAts.salaryRange' | translate }}</label>
          <div class="salary">
            <input nz-input id="op-smin" type="number" min="0" [ngModel]="salaryMin()" (ngModelChange)="salaryMin.set($event)" />
            <input nz-input type="number" min="0" [attr.aria-label]="'hrmAts.salaryMax' | translate" [ngModel]="salaryMax()" (ngModelChange)="salaryMax.set($event)" />
            <nz-select [ngModel]="currency()" (ngModelChange)="currency.set($event)">
              <nz-option nzValue="CHF" nzLabel="CHF" />
              <nz-option nzValue="EUR" nzLabel="EUR" />
            </nz-select>
          </div>
          <label for="op-langs">{{ 'hrmAts.languages' | translate }}</label>
          <nz-select id="op-langs" nzMode="multiple" [ngModel]="languages()" (ngModelChange)="languages.set($event)">
            @for (l of locales; track l) {
              <nz-option [nzValue]="l" [nzLabel]="l" />
            }
          </nz-select>
        </div>
        @for (l of languages(); track l) {
          <fieldset>
            <legend>{{ l }}</legend>
            <input nz-input maxlength="200" [placeholder]="'hrmCommon.title' | translate" [ngModel]="translation(l).title" (ngModelChange)="setTranslation(l, 'title', $event)" />
            <textarea nz-input rows="3" [placeholder]="'hrmCommon.description' | translate" [ngModel]="translation(l).description" (ngModelChange)="setTranslation(l, 'description', $event)"></textarea>
            <textarea nz-input rows="2" [placeholder]="'hrmAts.requirements' | translate" [ngModel]="translation(l).requirements" (ngModelChange)="setTranslation(l, 'requirements', $event)"></textarea>
            <textarea nz-input rows="2" [placeholder]="'hrmAts.benefits' | translate" [ngModel]="translation(l).benefits" (ngModelChange)="setTranslation(l, 'benefits', $event)"></textarea>
          </fieldset>
        }
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .form-grid {
      display: grid;
      grid-template-columns: 180px 1fr;
      gap: 8px 12px;
      align-items: center;
    }
    .salary {
      display: grid;
      grid-template-columns: 1fr 1fr 100px;
      gap: 8px;
    }
    fieldset {
      margin-top: 12px;
      display: grid;
      gap: 6px;
    }
  `,
})
export class AtsOpeningsComponent implements OnInit {
  readonly canWrite = input(false);
  readonly board = output<string>();

  private readonly api = inject(HrExtraApiService);
  private readonly employeeApi = inject(HrEmployeeApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly statuses = ['draft', 'published', 'internal_only', 'closed_filled', 'cancelled'];
  protected readonly employmentTypes = ATS_EMPLOYMENT_TYPES;
  protected readonly locales = ATS_LOCALES;
  protected readonly status = signal<string | null>(null);
  protected readonly rows = signal<AtsJobOpening[]>([]);
  protected readonly loading = signal(false);
  protected readonly positions = signal<PositionResource[]>([]);

  protected readonly formOpen = signal(false);
  protected readonly editing = signal<AtsJobOpening | null>(null);
  protected readonly saving = signal(false);
  protected readonly positionId = signal('');
  protected readonly site = signal('');
  protected readonly employmentType = signal<AtsEmploymentType>('full_time');
  protected readonly openingsCount = signal<number | null>(1);
  protected readonly closesAt = signal('');
  protected readonly salaryMin = signal<number | null>(null);
  protected readonly salaryMax = signal<number | null>(null);
  protected readonly currency = signal<'EUR' | 'CHF'>('CHF');
  protected readonly languages = signal<AtsLocale[]>(['it-CH']);
  private readonly translations = signal<Partial<Record<AtsLocale, AtsTranslation>>>({});

  protected readonly valid = computed(
    () => this.positionId() !== '' && this.site().trim() !== '' && this.languages().length > 0,
  );

  ngOnInit(): void {
    this.load();
    this.employeeApi.getPositions({ per_page: 200 } as never).subscribe({ next: (res) => this.positions.set(res.data) });
  }

  protected load(): void {
    this.loading.set(true);
    this.api.listRecruitingJobOpenings(this.status() ? { status: this.status() } : undefined).subscribe({
      next: (res) => {
        this.rows.set(res.data);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        reportHttpError(err, this.message, this.i18n);
      },
    });
  }

  protected translation(locale: AtsLocale): AtsTranslation {
    return this.translations()[locale] ?? {};
  }

  protected setTranslation(locale: AtsLocale, field: keyof AtsTranslation, value: string): void {
    this.translations.update((current) => ({ ...current, [locale]: { ...current[locale], [field]: value } }));
  }

  protected openForm(row: AtsJobOpening | null): void {
    this.editing.set(row);
    this.positionId.set(row?.position_id ?? '');
    this.site.set(row?.location_site ?? '');
    this.employmentType.set((row?.employment_type as AtsEmploymentType) ?? 'full_time');
    this.openingsCount.set(row?.openings_count ?? 1);
    this.closesAt.set(row?.closes_at ?? '');
    this.salaryMin.set(row?.salary_range_public?.min ?? null);
    this.salaryMax.set(row?.salary_range_public?.max ?? null);
    this.currency.set(row?.salary_range_public?.currency ?? 'CHF');
    this.languages.set(row?.published_languages?.length ? row.published_languages : ['it-CH']);
    this.translations.set({ ...(row?.translations ?? {}) });
    this.formOpen.set(true);
  }

  protected save(): void {
    const payload = buildOpeningPayload({
      position_id: this.positionId(),
      location_site: this.site(),
      employment_type: this.employmentType(),
      openings_count: this.openingsCount(),
      closes_at: this.closesAt(),
      salary_min: this.salaryMin(),
      salary_max: this.salaryMax(),
      currency: this.currency(),
      languages: this.languages(),
      translations: this.translations(),
    });
    const current = this.editing();
    this.saving.set(true);
    const request = current ? this.api.updateRecruitingJobOpening(current.id, payload) : this.api.createRecruitingJobOpening(payload);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.message.success(this.i18n.translate('hrmCommon.saved'));
        this.load();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        reportHttpError(err, this.message, this.i18n);
      },
    });
  }

  protected publish(row: AtsJobOpening, internalOnly: boolean): void {
    this.api.publishRecruitingJobOpening(row.id, internalOnly ? { internal_only: true } : {}).subscribe({
      next: () => this.load(),
      error: (err: unknown) => reportHttpError(err, this.message, this.i18n),
    });
  }

  protected close(row: AtsJobOpening, outcome: 'filled' | 'cancelled'): void {
    this.api.closeRecruitingJobOpening(row.id, { outcome }).subscribe({
      next: () => this.load(),
      error: (err: unknown) => reportHttpError(err, this.message, this.i18n),
    });
  }
}
