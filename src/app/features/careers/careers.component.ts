import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { I18nService, PublicCareersApiService, PublicCareersRecord } from '@core';
import { TranslatePipe } from '@shared';
import { PublicShellComponent } from '../warranty-rma/public/public-shell.component';

type PageState = 'loading' | 'ready' | 'notFound' | 'error';

/** Locales the careers API accepts; the page falls back to English when the company has no content in the requested one. */
const CAREERS_LOCALES = ['it-CH', 'de-CH', 'fr-CH', 'it-IT', 'en'] as const;
type CareersLocale = (typeof CAREERS_LOCALES)[number];

const text = (record: PublicCareersRecord | null, key: string): string => {
  const value = record?.[key];
  return typeof value === 'string' ? value : '';
};

/**
 * Public careers page of a company: `/careers/:slug` lists the published openings, `/careers/:slug?job=<id>` shows one
 * opening with its application form (CV upload and GDPR consent). No session: the tenant comes from the slug.
 */
@Component({
  selector: 'app-careers',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzInputModule,
    NzSpinModule,
    NzTagModule,
    TranslatePipe,
    PublicShellComponent,
  ],
  template: `
    <app-rma-public-shell [brand]="companyName()">
      @switch (state()) {
        @case ('loading') {
          <nz-spin nzSimple class="careers-spin" [nzTip]="'COMMON.LOADING' | translate" />
        }
        @case ('notFound') {
          <nz-card>
            <p class="careers-title">{{ 'CAREERS.NOT_FOUND' | translate }}</p>
            <p>{{ 'CAREERS.NOT_FOUND_HINT' | translate }}</p>
            @if (jobId()) {
              <button nz-button nzType="default" (click)="backToList()">{{ 'CAREERS.BACK_TO_LIST' | translate }}</button>
            }
          </nz-card>
        }
        @case ('error') {
          <nz-alert nzType="error" nzShowIcon [nzMessage]="'CAREERS.UNAVAILABLE' | translate" />
        }
        @case ('ready') {
          @if (!job()) {
            <h1 class="careers-title">{{ 'CAREERS.TITLE' | translate }}</h1>
            @if (intro()) {
              <p class="careers-intro">{{ intro() }}</p>
            }
            <div class="careers-search">
              <label for="careers-search">{{ 'CAREERS.SEARCH' | translate }}</label>
              <input
                id="careers-search"
                nz-input
                [ngModel]="search()"
                (ngModelChange)="search.set($event)"
                (keyup.enter)="loadJobs()"
              />
              <button nz-button nzType="primary" (click)="loadJobs()">{{ 'CAREERS.SEARCH_ACTION' | translate }}</button>
            </div>
            @if (jobs().length === 0) {
              <nz-card>{{ 'CAREERS.NO_OPENINGS' | translate }}</nz-card>
            }
            @for (item of jobs(); track item['id']) {
              <nz-card class="careers-job">
                <h2 class="careers-job-title">{{ str(item, 'title') }}</h2>
                <p class="careers-meta">
                  @if (str(item, 'department_name')) {
                    <nz-tag>{{ str(item, 'department_name') }}</nz-tag>
                  }
                  @if (str(item, 'location_site')) {
                    <nz-tag>{{ str(item, 'location_site') }}</nz-tag>
                  }
                  @if (str(item, 'employment_type')) {
                    <nz-tag>{{ str(item, 'employment_type') }}</nz-tag>
                  }
                </p>
                <button nz-button nzType="primary" (click)="openJob(str(item, 'id'))">
                  {{ 'CAREERS.VIEW_OPENING' | translate }}
                </button>
              </nz-card>
            }
          } @else {
            <button nz-button nzType="link" (click)="backToList()">{{ 'CAREERS.BACK_TO_LIST' | translate }}</button>
            <h1 class="careers-title">{{ str(job(), 'title') }}</h1>
            <p class="careers-meta">
              @if (str(job(), 'location_site')) {
                <nz-tag>{{ str(job(), 'location_site') }}</nz-tag>
              }
              @if (str(job(), 'employment_type')) {
                <nz-tag>{{ str(job(), 'employment_type') }}</nz-tag>
              }
              @if (str(job(), 'salary_range_public')) {
                <nz-tag>{{ str(job(), 'salary_range_public') }}</nz-tag>
              }
            </p>
            <nz-card>
              @for (section of sections(); track section.key) {
                @if (section.body) {
                  <h2 class="careers-section">{{ section.titleKey | translate }}</h2>
                  <p class="careers-body">{{ section.body }}</p>
                }
              }
            </nz-card>

            @if (applied()) {
              <nz-alert nzType="success" nzShowIcon [nzMessage]="applied()" />
            } @else {
              <nz-card [nzTitle]="'CAREERS.APPLY' | translate" class="careers-apply">
                <form (ngSubmit)="apply()" class="careers-form">
                  <label for="ap-first">{{ 'CAREERS.FIRST_NAME' | translate }}</label>
                  <input id="ap-first" nz-input name="first_name" required maxlength="100" [(ngModel)]="form.first_name" />
                  <label for="ap-last">{{ 'CAREERS.LAST_NAME' | translate }}</label>
                  <input id="ap-last" nz-input name="last_name" required maxlength="100" [(ngModel)]="form.last_name" />
                  <label for="ap-email">{{ 'CAREERS.EMAIL' | translate }}</label>
                  <input id="ap-email" nz-input type="email" name="email" required maxlength="180" [(ngModel)]="form.email" />
                  <label for="ap-phone">{{ 'CAREERS.PHONE' | translate }}</label>
                  <input id="ap-phone" nz-input name="phone" maxlength="50" [(ngModel)]="form.phone" />
                  <label for="ap-cover">{{ 'CAREERS.COVER_LETTER' | translate }}</label>
                  <textarea id="ap-cover" nz-input rows="5" name="cover_letter" maxlength="20000" [(ngModel)]="form.cover_letter"></textarea>
                  <label for="ap-cv">{{ 'CAREERS.CV' | translate }}</label>
                  <input id="ap-cv" type="file" accept=".pdf,.doc,.docx" required (change)="onFile($event)" />
                  <p class="careers-hint">{{ 'CAREERS.CV_HINT' | translate }}</p>
                  @if (privacyNotice()) {
                    <p class="careers-privacy">{{ privacyNotice() }}</p>
                  }
                  @if (privacyUrl()) {
                    <a [href]="privacyUrl()" target="_blank" rel="noopener noreferrer">{{ 'CAREERS.PRIVACY_POLICY' | translate }}</a>
                  }
                  <div class="careers-consent">
                    <input id="ap-consent" type="checkbox" name="consent" [(ngModel)]="form.consent" (ngModelChange)="touch()" />
                    <label for="ap-consent">{{ 'CAREERS.CONSENT' | translate }}</label>
                  </div>
                  @if (submitError()) {
                    <nz-alert nzType="error" nzShowIcon [nzMessage]="submitError()" />
                  }
                  <button nz-button nzType="primary" type="submit" [nzLoading]="submitting()" [disabled]="!canSubmit()">
                    {{ 'CAREERS.SUBMIT' | translate }}
                  </button>
                </form>
              </nz-card>
            }
          }
        }
      }
    </app-rma-public-shell>
  `,
  styles: `
    .careers-spin {
      display: block;
      margin: 48px auto;
    }
    .careers-title {
      font-size: 24px;
      margin: 0 0 12px;
    }
    .careers-intro,
    .careers-body {
      white-space: pre-line;
    }
    .careers-search {
      display: grid;
      grid-template-columns: max-content 1fr max-content;
      gap: 8px;
      align-items: center;
      margin: 12px 0 16px;
    }
    .careers-job {
      margin-bottom: 12px;
    }
    .careers-job-title,
    .careers-section {
      font-size: 18px;
      margin: 0 0 8px;
    }
    .careers-form {
      display: grid;
      gap: 8px;
    }
    .careers-apply {
      margin-top: 16px;
    }
    .careers-consent {
      display: flex;
      gap: 8px;
      align-items: flex-start;
    }
    .careers-hint,
    .careers-privacy {
      margin: 0;
      font-size: 13px;
    }
  `,
})
export class CareersComponent implements OnInit {
  private readonly api = inject(PublicCareersApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  readonly slug = this.route.snapshot.paramMap.get('slug') ?? '';
  readonly state = signal<PageState>('loading');
  readonly page = signal<PublicCareersRecord | null>(null);
  readonly jobs = signal<PublicCareersRecord[]>([]);
  readonly job = signal<PublicCareersRecord | null>(null);
  readonly jobId = signal<string | null>(this.route.snapshot.queryParamMap.get('job'));
  readonly search = signal('');
  readonly submitting = signal(false);
  readonly submitError = signal('');
  readonly applied = signal('');

  readonly form = { first_name: '', last_name: '', email: '', phone: '', cover_letter: '', consent: false };
  private cv: File | null = null;
  /** Bumped on every form change so `canSubmit` re-evaluates (the plain `form` object is not a signal). */
  private readonly revision = signal(0);

  readonly companyName = computed(() => text(this.page(), 'company_name') || null);
  readonly intro = computed(() => text(this.page(), 'intro'));
  readonly privacyNotice = computed(() => text(this.page(), 'privacy_notice'));
  readonly privacyUrl = computed(() => text(this.page(), 'privacy_policy_url'));
  readonly sections = computed(() => {
    const job = this.job();
    return [
      { key: 'description', titleKey: 'CAREERS.DESCRIPTION', body: text(job, 'description') },
      { key: 'requirements', titleKey: 'CAREERS.REQUIREMENTS', body: text(job, 'requirements') },
      { key: 'benefits', titleKey: 'CAREERS.BENEFITS', body: text(job, 'benefits') },
    ];
  });

  readonly str = text;

  ngOnInit(): void {
    this.api.getCareersPage(this.slug).subscribe({
      next: (res) => {
        this.page.set(res.data);
        const id = this.jobId();
        if (id) {
          this.openJob(id);
        } else {
          this.loadJobs();
        }
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  touch(): void {
    this.revision.update((n) => n + 1);
  }

  canSubmit(): boolean {
    this.revision();
    const f = this.form;
    return !this.submitting() && !!f.first_name.trim() && !!f.last_name.trim() && !!f.email.trim() && f.consent && this.cv !== null;
  }

  onFile(event: Event): void {
    this.cv = (event.target as HTMLInputElement).files?.item(0) ?? null;
    this.touch();
  }

  loadJobs(): void {
    this.job.set(null);
    this.api.getJobs(this.slug, { search: this.search().trim() || undefined, locale: this.locale() }).subscribe({
      next: (res) => {
        this.jobs.set(res.data);
        this.state.set('ready');
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  openJob(id: string): void {
    this.jobId.set(id);
    void this.router.navigate([], { queryParams: { job: id }, queryParamsHandling: 'merge' });
    this.api.getJob(this.slug, id, this.locale()).subscribe({
      next: (res) => {
        this.job.set(res.data);
        this.state.set('ready');
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  backToList(): void {
    this.jobId.set(null);
    this.applied.set('');
    void this.router.navigate([], { queryParams: { job: null }, queryParamsHandling: 'merge' });
    this.loadJobs();
  }

  apply(): void {
    const id = this.jobId();
    if (!id || !this.cv || !this.canSubmit()) {
      return;
    }
    this.submitting.set(true);
    this.submitError.set('');
    this.api
      .apply(this.slug, id, {
        first_name: this.form.first_name.trim(),
        last_name: this.form.last_name.trim(),
        email: this.form.email.trim(),
        phone: this.form.phone.trim() || null,
        cover_letter: this.form.cover_letter.trim() || null,
        locale: this.locale(),
        consent_accepted: this.form.consent,
        consent_text_version: text(this.page(), 'consent_text_version'),
        cv: this.cv,
      })
      .subscribe({
        next: (res) => {
          this.submitting.set(false);
          this.applied.set(text(res.data, 'message') || text(res.data, 'reference'));
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          const serverMessage = error instanceof HttpErrorResponse ? (error.error as { message?: string } | null)?.message : null;
          this.submitError.set(serverMessage ?? this.i18n.translate('CAREERS.SUBMIT_ERROR'));
        },
      });
  }

  private locale(): CareersLocale {
    const browser = (typeof navigator === 'undefined' ? 'en' : navigator.language).toLowerCase();
    const match =
      CAREERS_LOCALES.find((l) => l.toLowerCase() === browser) ??
      CAREERS_LOCALES.find((l) => l.toLowerCase().startsWith(browser.slice(0, 2)));
    const available = this.page()?.['available_locales'];
    const list = Array.isArray(available) ? (available as string[]) : [];
    return match && (list.length === 0 || list.includes(match)) ? match : 'en';
  }

  private fail(error: unknown): void {
    this.state.set(error instanceof HttpErrorResponse && error.status === 404 ? 'notFound' : 'error');
  }
}
