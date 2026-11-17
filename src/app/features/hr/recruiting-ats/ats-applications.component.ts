import { Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ATS_SOURCES,
  ATS_STAGES,
  AtsApplicationCard,
  AtsApplicationPayload,
  AtsApplicationSource,
  AtsJobOpening,
  HrExtraApiService,
  I18nService,
} from '@core';
import { TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { reportHttpError } from '../shared/hr-http.util';

/** Multipart body of a manual application: the CV file travels next to the text fields. */
export function buildApplicationForm(payload: AtsApplicationPayload, cv: File | null): AtsApplicationPayload | FormData {
  if (!cv) {
    return payload;
  }
  const form = new FormData();
  for (const [key, value] of Object.entries(payload)) {
    if (value !== null && value !== undefined && value !== '') {
      form.append(key, String(value));
    }
  }
  form.append('cv', cv);
  return form;
}

/** Applications of the ATS with filters, a manual-entry form (CV upload) and the detail drawer trigger. */
@Component({
  selector: 'app-ats-applications',
  imports: [FormsModule, NzButtonModule, NzInputModule, NzModalModule, NzSelectModule, NzTableModule, NzTagModule, TranslatePipe],
  template: `
    <div class="filter-bar">
      <input nz-input class="w-field-md" [placeholder]="'COMMON.SEARCH' | translate" [ngModel]="search()" (ngModelChange)="search.set($event)" (keyup.enter)="load()" />
      <nz-select class="w-field-md" nzAllowClear [nzPlaceHolder]="'hrmAts.opening' | translate" [ngModel]="openingFilter()" (ngModelChange)="openingFilter.set($event); load()">
        @for (o of openings(); track o.id) {
          <nz-option [nzValue]="o.id" [nzLabel]="o.reference + ' - ' + (o.position_title ?? '')" />
        }
      </nz-select>
      <nz-select class="w-field-md" nzAllowClear [nzPlaceHolder]="'hrmAts.stageLabel' | translate" [ngModel]="stageFilter()" (ngModelChange)="stageFilter.set($event); load()">
        @for (s of stages; track s) {
          <nz-option [nzValue]="s" [nzLabel]="('hrmAts.stage.' + s) | translate" />
        }
      </nz-select>
      <label><input type="checkbox" [ngModel]="expiringOnly()" (ngModelChange)="expiringOnly.set($event); load()" /> {{ 'hrmAts.consentExpiring' | translate }}</label>
      <button nz-button type="button" (click)="load()">{{ 'hrmLeave.show' | translate }}</button>
      @if (canWrite()) {
        <button nz-button nzType="primary" type="button" (click)="openForm()">{{ 'hrmAts.newApplication' | translate }}</button>
      }
    </div>
    <nz-table #table nzSize="small" [nzData]="rows()" [nzLoading]="loading()" [nzFrontPagination]="false" [nzTotal]="total()" [nzPageIndex]="page()" [nzPageSize]="20" (nzPageIndexChange)="page.set($event); load()">
      <thead>
        <tr>
          <th>{{ 'hrmCommon.name' | translate }}</th>
          <th>{{ 'hrmRecruiting.email' | translate }}</th>
          <th>{{ 'hrmAts.opening' | translate }}</th>
          <th>{{ 'hrmAts.stageLabel' | translate }}</th>
          <th>{{ 'hrmAts.averageScore' | translate }}</th>
          <th>{{ 'hrmAts.consentExpires' | translate }}</th>
        </tr>
      </thead>
      <tbody>
        @for (row of table.data; track row.id) {
          <tr class="clickable" (click)="open.emit(row.id)">
            <td>{{ row.full_name }}</td>
            <td>{{ row.email }}</td>
            <td>{{ row.job_opening_title }}</td>
            <td>
              <nz-tag>{{ 'hrmAts.stage.' + row.stage | translate }}</nz-tag>
            </td>
            <td>{{ row.average_score ?? '-' }}</td>
            <td>{{ row.privacy_consent_expires_at?.slice(0, 10) }}</td>
          </tr>
        }
      </tbody>
    </nz-table>

    <nz-modal [nzVisible]="formOpen()" [nzTitle]="'hrmAts.newApplication' | translate" [nzOkDisabled]="!valid()" [nzOkLoading]="saving()" (nzOnOk)="save()" (nzOnCancel)="formOpen.set(false)">
      <ng-container *nzModalContent>
        <label for="ap-op">{{ 'hrmAts.opening' | translate }}</label>
        <nz-select id="ap-op" class="w-full" nzShowSearch [ngModel]="formOpening()" (ngModelChange)="formOpening.set($event)">
          @for (o of openings(); track o.id) {
            <nz-option [nzValue]="o.id" [nzLabel]="o.reference + ' - ' + (o.position_title ?? '')" />
          }
        </nz-select>
        <label for="ap-fn">{{ 'hrmRecruiting.firstName' | translate }}</label>
        <input nz-input id="ap-fn" maxlength="100" [ngModel]="firstName()" (ngModelChange)="firstName.set($event)" />
        <label for="ap-ln">{{ 'hrmRecruiting.lastName' | translate }}</label>
        <input nz-input id="ap-ln" maxlength="100" [ngModel]="lastName()" (ngModelChange)="lastName.set($event)" />
        <label for="ap-em">{{ 'hrmRecruiting.email' | translate }}</label>
        <input nz-input id="ap-em" type="email" maxlength="180" [ngModel]="email()" (ngModelChange)="email.set($event)" />
        <label for="ap-ph">{{ 'hrmRecruiting.phone' | translate }}</label>
        <input nz-input id="ap-ph" maxlength="50" [ngModel]="phone()" (ngModelChange)="phone.set($event)" />
        <label for="ap-src">{{ 'hrmRecruiting.source' | translate }}</label>
        <nz-select id="ap-src" class="w-full" [ngModel]="source()" (ngModelChange)="source.set($event)">
          @for (s of sources; track s) {
            <nz-option [nzValue]="s" [nzLabel]="('hrmAts.source.' + s) | translate" />
          }
        </nz-select>
        <label for="ap-ret">{{ 'hrmAts.retentionMonths' | translate }}</label>
        <nz-select id="ap-ret" class="w-full" [ngModel]="retention()" (ngModelChange)="retention.set($event)">
          <nz-option [nzValue]="6" [nzLabel]="'6 ' + ('hrmAts.months' | translate)" />
          <nz-option [nzValue]="12" [nzLabel]="'12 ' + ('hrmAts.months' | translate)" />
        </nz-select>
        <label for="ap-cv">{{ 'hrmAts.cv' | translate }}</label>
        <input id="ap-cv" type="file" accept=".pdf,.doc,.docx" (change)="cv.set($any($event.target).files?.[0] ?? null)" />
        <label for="ap-cl">{{ 'hrmRecruiting.coverNote' | translate }}</label>
        <textarea nz-input id="ap-cl" rows="3" [ngModel]="coverLetter()" (ngModelChange)="coverLetter.set($event)"></textarea>
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .clickable {
      cursor: pointer;
    }
    label {
      display: block;
      margin-top: 8px;
    }
    .filter-bar label {
      display: inline;
      margin: 0;
    }
  `,
})
export class AtsApplicationsComponent implements OnInit {
  readonly canWrite = input(false);
  readonly open = output<string>();

  private readonly api = inject(HrExtraApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly stages = ATS_STAGES;
  protected readonly sources = ATS_SOURCES.filter((s) => s !== 'careers_page');
  protected readonly openings = signal<AtsJobOpening[]>([]);
  protected readonly rows = signal<AtsApplicationCard[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly loading = signal(false);
  protected readonly search = signal('');
  protected readonly openingFilter = signal<string | null>(null);
  protected readonly stageFilter = signal<string | null>(null);
  protected readonly expiringOnly = signal(false);

  protected readonly formOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly formOpening = signal('');
  protected readonly firstName = signal('');
  protected readonly lastName = signal('');
  protected readonly email = signal('');
  protected readonly phone = signal('');
  protected readonly source = signal<AtsApplicationSource>('manual');
  protected readonly retention = signal(12);
  protected readonly coverLetter = signal('');
  protected readonly cv = signal<File | null>(null);
  protected readonly valid = computed(
    () => this.formOpening() !== '' && this.firstName().trim() !== '' && this.lastName().trim() !== '' && /^\S+@\S+$/.test(this.email().trim()),
  );

  ngOnInit(): void {
    this.api.listRecruitingJobOpenings().subscribe({ next: (res) => this.openings.set(res.data) });
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api
      .listRecruitingApplications({
        search: this.search() || undefined,
        job_opening_id: this.openingFilter() ?? undefined,
        stage: this.stageFilter() ?? undefined,
        consent_expiring_within_days: this.expiringOnly() ? 30 : undefined,
        page: this.page(),
        per_page: 20,
      })
      .subscribe({
        next: (res) => {
          this.rows.set(res.data);
          this.total.set(res.meta?.total ?? res.data.length);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          reportHttpError(err, this.message, this.i18n);
        },
      });
  }

  protected openForm(): void {
    this.formOpening.set(this.openingFilter() ?? '');
    this.firstName.set('');
    this.lastName.set('');
    this.email.set('');
    this.phone.set('');
    this.coverLetter.set('');
    this.cv.set(null);
    this.formOpen.set(true);
  }

  protected save(): void {
    const payload: AtsApplicationPayload = {
      job_opening_id: this.formOpening(),
      first_name: this.firstName().trim(),
      last_name: this.lastName().trim(),
      email: this.email().trim(),
      phone: this.phone().trim() || null,
      cover_letter: this.coverLetter().trim() || null,
      source: this.source(),
      retention_months: this.retention(),
    };
    this.saving.set(true);
    this.api.createRecruitingApplication(buildApplicationForm(payload, this.cv())).subscribe({
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
}
