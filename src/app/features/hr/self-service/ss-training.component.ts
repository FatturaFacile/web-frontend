import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { HrSelfServiceApiService, I18nService, SelfServiceTraining } from '@core';
import { TranslatePipe } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTableModule } from 'ng-zorro-antd/table';
import { HrStatusTagComponent } from '../shared/hr-status-tag.component';
import { reportHttpError } from '../shared/hr-http.util';

@Component({
  selector: 'app-ss-training',
  imports: [DatePipe, NzTableModule, TranslatePipe, HrStatusTagComponent],
  template: `
    <h3>{{ 'hrmSelfService.trainingRecords' | translate }}</h3>
    <nz-table #records [nzData]="data().training_records" [nzLoading]="loading()" [nzFrontPagination]="false" nzSize="middle">
      <thead>
        <tr>
          <th>{{ 'hrmCommon.code' | translate }}</th>
          <th>{{ 'hrmSelfService.course' | translate }}</th>
          <th>{{ 'hrmSelfService.category' | translate }}</th>
          <th>{{ 'hrmSelfService.scheduledDate' | translate }}</th>
          <th>{{ 'hrmSelfService.completedDate' | translate }}</th>
          <th>{{ 'hrmCommon.statusCol' | translate }}</th>
        </tr>
      </thead>
      <tbody>
        @for (row of records.data; track row.id) {
          <tr>
            <td>{{ row.course_code }}</td>
            <td>{{ row.course_title }}</td>
            <td>{{ row.category }}</td>
            <td>{{ row.scheduled_date | date: 'mediumDate' }}</td>
            <td>{{ row.completed_date | date: 'mediumDate' }}</td>
            <td><app-hr-status-tag [value]="row.status" /></td>
          </tr>
        }
      </tbody>
    </nz-table>

    <h3 class="mt-4">{{ 'hrmSelfService.certifications' | translate }}</h3>
    <nz-table #certs [nzData]="data().certifications" [nzLoading]="loading()" [nzFrontPagination]="false" nzSize="middle">
      <thead>
        <tr>
          <th>{{ 'hrmCommon.code' | translate }}</th>
          <th>{{ 'hrmCommon.name' | translate }}</th>
          <th>{{ 'hrmSelfService.issueDate' | translate }}</th>
          <th>{{ 'hrmSelfService.expiryDate' | translate }}</th>
          <th>{{ 'hrmCommon.statusCol' | translate }}</th>
        </tr>
      </thead>
      <tbody>
        @for (row of certs.data; track row.id) {
          <tr>
            <td>{{ row.code }}</td>
            <td>{{ row.name }}</td>
            <td>{{ row.issue_date | date: 'mediumDate' }}</td>
            <td>{{ row.expiry_date | date: 'mediumDate' }}</td>
            <td><app-hr-status-tag [value]="row.status" /></td>
          </tr>
        }
      </tbody>
    </nz-table>
  `,
})
export class SsTrainingComponent implements OnInit {
  private readonly api = inject(HrSelfServiceApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly data = signal<SelfServiceTraining>({ training_records: [], certifications: [] });
  protected readonly loading = signal(true);

  ngOnInit(): void {
    this.api.getTraining().subscribe({
      next: (res) => {
        this.data.set(res.data);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        reportHttpError(err, this.message, this.i18n);
        this.loading.set(false);
      },
    });
  }
}
