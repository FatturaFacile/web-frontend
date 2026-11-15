import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzResultModule } from 'ng-zorro-antd/result';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { Subscription } from 'rxjs';
import { PublicCareersApiService, PublicJob } from '@core';
import { TranslatePipe } from '@shared';
import { ApplyFormComponent } from './apply-form.component';
import { CareersLocaleSwitcherComponent } from './careers-locale-switcher.component';
import { CareersPortalState } from './careers-portal.state';

@Component({
  selector: 'app-careers-job',
  imports: [
    DatePipe,
    DecimalPipe,
    RouterLink,
    NzButtonModule,
    NzResultModule,
    NzSpinModule,
    TranslatePipe,
    ApplyFormComponent,
    CareersLocaleSwitcherComponent,
  ],
  providers: [CareersPortalState],
  templateUrl: './careers-job.component.html',
  styleUrl: './careers.scss',
  host: { '[class.embed]': 'portal.embed()' },
})
export class CareersJobComponent {
  readonly portal = inject(CareersPortalState);
  private readonly api = inject(PublicCareersApiService);
  private readonly title = inject(Title);

  readonly jobId = signal('');
  readonly job = signal<PublicJob | null>(null);
  readonly loading = signal(false);
  readonly notFound = signal(false);
  readonly error = signal(false);

  private request?: Subscription;

  constructor() {
    this.portal.connect(({ routeParams }) => {
      this.jobId.set(routeParams.get('id') ?? '');
      this.loadJob();
    });
  }

  loadJob(): void {
    const id = this.jobId();
    this.request?.unsubscribe();
    this.loading.set(true);
    this.notFound.set(false);
    this.error.set(false);
    this.request = this.api.getJob(this.portal.slug(), id, this.portal.locale()).subscribe({
      next: (res) => {
        this.job.set(res.data);
        this.loading.set(false);
        const company = this.portal.page()?.company_name;
        this.title.setTitle(company ? `${res.data.title} - ${company}` : res.data.title);
      },
      error: (err: unknown) => {
        this.job.set(null);
        this.loading.set(false);
        if (err instanceof HttpErrorResponse && err.status === 404) {
          this.notFound.set(true);
        } else {
          this.error.set(true);
        }
      },
    });
  }
}
