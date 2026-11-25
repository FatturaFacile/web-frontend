import { Component, effect, inject, input, signal } from '@angular/core';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTableModule } from 'ng-zorro-antd/table';
import { BudgetAuditEvent, BudgetingApiService, BudgetImport, TranslateService } from '@core';
import { TranslatePipe } from '@shared';
import { apiErrorText } from './budgeting.util';

/** The audit trail of a version (revisions, transfers, grid saves, scenarios) and the history of its imports. */
@Component({
  selector: 'app-budgeting-audit',
  styleUrl: './budgeting.scss',
  imports: [TranslatePipe, NzCardModule, NzEmptyModule, NzTableModule],
  template: `
    <nz-card class="main-card" [nzTitle]="'BUDGETING_CONTROL.AUDIT_TRAIL' | translate">
      <nz-table #trail [nzData]="events()" nzSize="small" [nzPageSize]="15">
        <thead>
          <tr>
            <th>{{ 'BUDGETING.DATE' | translate }}</th>
            <th>{{ 'BUDGETING.ACTION' | translate }}</th>
            <th>{{ 'BUDGETING.COMMENT' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (event of trail.data; track event.id) {
            <tr>
              <td>{{ event.created_at }}</td>
              <td>{{ ('BUDGETING_CONTROL.AUDIT_' + event.action.toUpperCase()) | translate }}</td>
              <td>{{ event.comment }}</td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (events().length === 0) {
        <nz-empty [nzNotFoundContent]="'BUDGETING_CONTROL.NO_AUDIT' | translate"></nz-empty>
      }
    </nz-card>

    <nz-card class="main-card" [nzTitle]="'BUDGETING_CONTROL.IMPORT_HISTORY' | translate">
      <nz-table #history [nzData]="imports()" nzSize="small" [nzPageSize]="10">
        <thead>
          <tr>
            <th>{{ 'BUDGETING.DATE' | translate }}</th>
            <th>{{ 'BUDGETING_CONTROL.FILE' | translate }}</th>
            <th>{{ 'BUDGETING.STATUS' | translate }}</th>
            <th class="num">{{ 'BUDGETING_CONTROL.ROWS' | translate }}</th>
            <th class="num">{{ 'BUDGETING_CONTROL.ERRORS' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (item of history.data; track item.id) {
            <tr>
              <td>{{ item.created_at }}</td>
              <td>{{ item.file_name }}</td>
              <td>{{ ('BUDGETING_CONTROL.IMPORT_STATUS_' + item.status.toUpperCase()) | translate }}</td>
              <td class="num">{{ item.imported_rows }} / {{ item.total_rows }}</td>
              <td class="num">{{ item.error_rows }}</td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>
  `,
})
export class BudgetingAuditComponent {
  private readonly api = inject(BudgetingApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly versionId = input.required<string>();
  readonly refresh = input(0);
  readonly events = signal<BudgetAuditEvent[]>([]);
  readonly imports = signal<BudgetImport[]>([]);

  constructor() {
    effect(() => {
      this.versionId();
      this.refresh();
      this.load();
    });
  }

  load(): void {
    this.api.getVersionAudit(this.versionId()).subscribe({
      next: (response) => this.events.set(response.data),
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('BUDGETING.ACTION_ERROR')),
    });
    this.api.getImports(this.versionId()).subscribe({
      next: (response) => this.imports.set(response.data),
      error: () => this.imports.set([]),
    });
  }
}
