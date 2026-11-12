import { DatePipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { SelfServiceProfile } from '@core';
import { TranslatePipe } from '@shared';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { HrStatusTagComponent } from '../shared/hr-status-tag.component';

@Component({
  selector: 'app-ss-profile',
  styleUrl: './ss-profile.component.scss',
  imports: [DatePipe, NzDescriptionsModule, TranslatePipe, HrStatusTagComponent],
  template: `
    <nz-descriptions nzBordered [nzColumn]="{ xs: 1, md: 2 }">
      <nz-descriptions-item [nzTitle]="'hrmSelfService.fullName' | translate">{{ profile().full_name }}</nz-descriptions-item>
      <nz-descriptions-item [nzTitle]="'hrmSelfService.employeeNumber' | translate">{{ profile().employee_number }}</nz-descriptions-item>
      <nz-descriptions-item [nzTitle]="'hrmSelfService.workEmail' | translate">{{ profile().work_email }}</nz-descriptions-item>
      <nz-descriptions-item [nzTitle]="'hrmSelfService.hireDate' | translate">{{ profile().hire_date | date: 'mediumDate' }}</nz-descriptions-item>
      <nz-descriptions-item [nzTitle]="'hrmSelfService.employmentStatus' | translate">
        <app-hr-status-tag [value]="profile().employment_status" />
      </nz-descriptions-item>
      <nz-descriptions-item [nzTitle]="'hrmSelfService.employmentType' | translate">{{ profile().employment_type }}</nz-descriptions-item>
      <nz-descriptions-item [nzTitle]="'hrmSelfService.fte' | translate">{{ profile().fte_ratio }}</nz-descriptions-item>
    </nz-descriptions>
  `,
})
export class SsProfileComponent {
  readonly profile = input.required<SelfServiceProfile>();
}
