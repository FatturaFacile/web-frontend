import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { TALENT_CERTIFICATE_VALIDITIES, TalentCertificate, TalentCertificateValidity, TalentCourse, TalentEmployee, TalentLearningApiService, TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText, keyOf } from './talent-learning.util';

/** Completion certificates of every employee, filtered by course, employee and validity. */
@Component({
  selector: 'app-talent-certificates',
  styleUrl: './talent-learning.scss',
  imports: [FormsModule, PageHeaderComponent, TranslatePipe, NzCardModule, NzEmptyModule, NzSelectModule, NzTableModule, NzTagModule],
  template: `
    <app-page-header [title]="'TALENT_LEARNING.CERTIFICATES_TITLE' | translate" [subtitle]="'TALENT_LEARNING.CERTIFICATES_SUBTITLE' | translate"></app-page-header>

    <div class="toolbar">
      <nz-select style="width: 220px" nzAllowClear nzShowSearch [ngModel]="courseFilter()" (ngModelChange)="courseFilter.set($event); changeFilter()" [nzPlaceHolder]="'TALENT_LEARNING.COURSE' | translate">
        @for (course of courses(); track course.id) {
          <nz-option [nzValue]="course.id" [nzLabel]="course.code + ' - ' + course.title"></nz-option>
        }
      </nz-select>
      <nz-select style="width: 220px" nzAllowClear nzShowSearch [ngModel]="employeeFilter()" (ngModelChange)="employeeFilter.set($event); changeFilter()" [nzPlaceHolder]="'TALENT_LEARNING.EMPLOYEE' | translate">
        @for (employee of employees(); track employee.id) {
          <nz-option [nzValue]="employee.id" [nzLabel]="employee.full_name"></nz-option>
        }
      </nz-select>
      <nz-select style="width: 200px" nzAllowClear [ngModel]="validityFilter()" (ngModelChange)="validityFilter.set($event); changeFilter()" [nzPlaceHolder]="'TALENT_LEARNING.VALIDITY' | translate">
        @for (value of validities; track value) {
          <nz-option [nzValue]="value" [nzLabel]="'TALENT_LEARNING.VALIDITY_' + key(value) | translate"></nz-option>
        }
      </nz-select>
    </div>

    <nz-card class="main-card">
      <nz-table
        #table
        [nzData]="certificates()"
        [nzLoading]="loading()"
        nzSize="small"
        [nzFrontPagination]="false"
        [nzTotal]="total()"
        [nzPageIndex]="page()"
        [nzPageSize]="pageSize"
        (nzPageIndexChange)="changePage($event)"
      >
        <thead>
          <tr>
            <th>{{ 'TALENT_LEARNING.CERTIFICATE' | translate }}</th>
            <th>{{ 'TALENT_LEARNING.EMPLOYEE' | translate }}</th>
            <th>{{ 'TALENT_LEARNING.COURSE' | translate }}</th>
            <th>{{ 'TALENT_LEARNING.ISSUED_ON' | translate }}</th>
            <th>{{ 'TALENT_LEARNING.EXPIRES_ON' | translate }}</th>
            <th>{{ 'TALENT_LEARNING.VALIDITY' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <td>{{ row.certificate_number }}</td>
              <td>{{ row.employee?.full_name ?? '-' }}</td>
              <td>{{ row.course?.title }}</td>
              <td>{{ row.issued_on }}</td>
              <td>{{ row.expires_on ?? '-' }}</td>
              <td>
                <nz-tag [nzColor]="row.is_valid ? 'green' : 'red'">{{ (row.is_valid ? 'TALENT_LEARNING.VALIDITY_VALID' : 'TALENT_LEARNING.VALIDITY_EXPIRED') | translate }}</nz-tag>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && certificates().length === 0) {
        <nz-empty [nzNotFoundContent]="'TALENT_LEARNING.NO_CERTIFICATES' | translate"></nz-empty>
      }
    </nz-card>
  `,
})
export class TalentCertificatesComponent implements OnInit {
  private readonly api = inject(TalentLearningApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly validities = TALENT_CERTIFICATE_VALIDITIES;
  readonly key = keyOf;
  readonly pageSize = 25;
  readonly certificates = signal<TalentCertificate[]>([]);
  readonly courses = signal<TalentCourse[]>([]);
  readonly employees = signal<TalentEmployee[]>([]);
  readonly courseFilter = signal<string | null>(null);
  readonly employeeFilter = signal<string | null>(null);
  readonly validityFilter = signal<TalentCertificateValidity | null>(null);
  readonly page = signal(1);
  readonly total = signal(0);
  readonly loading = signal(false);

  ngOnInit(): void {
    this.api.getEmployeeLookup().subscribe((response) => this.employees.set(response.data));
    this.api.getCourses({ per_page: 100 }).subscribe((response) => this.courses.set(response.data));
    this.load();
  }

  changeFilter(): void {
    this.page.set(1);
    this.load();
  }

  changePage(page: number): void {
    this.page.set(page);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api
      .getCertificates({
        course_id: this.courseFilter() ?? undefined,
        employee_id: this.employeeFilter() ?? undefined,
        validity: this.validityFilter() ?? undefined,
        page: this.page(),
        per_page: this.pageSize,
      })
      .subscribe({
        next: (response) => {
          this.certificates.set(response.data);
          this.total.set(response.meta?.total ?? response.data.length);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.message.error(apiErrorText(error) ?? this.translate.instant('TALENT_LEARNING.ACTION_ERROR'));
        },
      });
  }
}
