import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzPaginationModule } from 'ng-zorro-antd/pagination';
import { NzResultModule } from 'ng-zorro-antd/result';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { Subscription } from 'rxjs';
import {
  EMPLOYMENT_TYPES,
  RecruitingEmploymentType,
  I18nService,
  PublicCareersApiService,
  PublicJob,
} from '@core';
import { TranslatePipe } from '@shared';
import { CareersLocaleSwitcherComponent } from './careers-locale-switcher.component';
import { CareersPortalState } from './careers-portal.state';

@Component({
  selector: 'app-careers-home',
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    NzButtonModule,
    NzEmptyModule,
    NzInputModule,
    NzPaginationModule,
    NzResultModule,
    NzSelectModule,
    NzSpinModule,
    TranslatePipe,
    CareersLocaleSwitcherComponent,
  ],
  providers: [CareersPortalState],
  templateUrl: './careers-home.component.html',
  styleUrl: './careers.scss',
  host: { '[class.embed]': 'portal.embed()' },
})
export class CareersHomeComponent {
  readonly portal = inject(CareersPortalState);
  private readonly api = inject(PublicCareersApiService);
  private readonly title = inject(Title);
  private readonly i18n = inject(I18nService);

  readonly employmentTypes = EMPLOYMENT_TYPES;

  readonly jobs = signal<PublicJob[]>([]);
  readonly total = signal(0);
  readonly pageIndex = signal(1);
  readonly pageSize = 10;
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly notFound = signal(false);

  readonly search = signal('');
  readonly employmentType = signal<RecruitingEmploymentType | null>(null);
  readonly location = signal('');

  private request?: Subscription;

  constructor() {
    this.portal.connect(() => {
      this.loadJobs();
    });
  }

  loadJobs(): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set(false);
    this.notFound.set(false);
    this.request = this.api
      .listJobs(this.portal.slug(), {
        locale: this.portal.locale(),
        search: this.search().trim() || undefined,
        employment_type: this.employmentType() ?? undefined,
        location_site: this.location().trim() || undefined,
        page: this.pageIndex(),
        per_page: this.pageSize,
      })
      .subscribe({
        next: (res) => {
          this.jobs.set(res.data);
          this.total.set(res.meta.total);
          this.loading.set(false);
          this.updateTitle();
        },
        error: (err: unknown) => {
          this.jobs.set([]);
          this.loading.set(false);
          const status = (err as { status?: number } | null)?.status;
          if (status === 404) {
            this.notFound.set(true);
          } else {
            this.error.set(true);
          }
        },
      });
  }

  applyFilters(): void {
    this.pageIndex.set(1);
    this.loadJobs();
  }

  onPageChange(index: number): void {
    this.pageIndex.set(index);
    this.loadJobs();
  }

  private updateTitle(): void {
    const company = this.portal.page()?.company_name;
    const label = this.i18n.translate('careers.pageTitle');
    this.title.setTitle(company ? `${label} - ${company}` : label);
  }
}
