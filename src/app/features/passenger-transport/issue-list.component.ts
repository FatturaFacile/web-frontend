import { Component, computed, input } from '@angular/core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { PtrComplianceIssue } from '@core';
import { TranslatePipe } from '@shared';

/** The legal findings of a driving-time or document check: blocking violations in red, advisories in amber, each with its citation. */
@Component({
  selector: 'app-ptr-issue-list',
  imports: [NzAlertModule, TranslatePipe],
  styleUrl: './passenger-transport.scss',
  template: `
    <div class="issue-list">
      @for (row of rows(); track row.key) {
        <nz-alert
          [nzType]="row.issue.severity === 'blocking' ? 'error' : 'warning'"
          nzShowIcon
          [nzMessage]="'passengerTransport.compliance.' + row.issue.code | translate: row.params"
          [nzDescription]="row.issue.citation"
        ></nz-alert>
      }
    </div>
  `,
})
export class IssueListComponent {
  readonly issues = input.required<readonly PtrComplianceIssue[]>();

  protected readonly rows = computed(() =>
    this.issues().map((issue, index) => ({
      key: `${issue.code}-${index}`,
      issue,
      params: Object.fromEntries(
        Object.entries(issue.params).map(([key, value]) => [key, value ?? '']),
      ) as Record<string, string | number>,
    })),
  );
}
