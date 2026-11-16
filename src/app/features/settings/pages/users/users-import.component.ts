import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccessApiService, I18nService, ImportReport, ImportRow, ImportRowStatus, SettingsApiService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { saveBlob } from '../../../hr/shared/hr-http.util';
import { AccessNavComponent } from '../access/access-nav.component';
import { problemDetail, reportAccessError, systemRoleLabel } from '../access/access-ui.util';
import { PlanLimitsComponent } from '../access/plan-limits.component';

/** Header and an example row of the CSV the import accepts (semicolon separated, teams separated by `|`). */
export const IMPORT_TEMPLATE = 'email;name;role;team\nmario.rossi@example.com;Mario Rossi;member;Sales|Support\n';

const STATUS_COLORS: Record<ImportRowStatus, string> = {
  created: 'green',
  invited: 'green',
  would_add: 'blue',
  would_invite: 'blue',
  skipped: 'default',
  error: 'red',
};

/**
 * Adds many people from a CSV file. The file is first checked without changing anything ("check only"); the real import
 * is offered once the report of every row has been seen.
 */
@Component({
  selector: 'app-users-import',
  imports: [
    AccessNavComponent,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    PlanLimitsComponent,
    TranslatePipe,
  ],
  template: `
    <app-page-header [title]="'access.import.title' | translate" [subtitle]="'access.import.subtitle' | translate" />
    <app-access-nav />
    <app-plan-limits [version]="limitsVersion()" />
    <nz-card>
      <p>{{ 'access.import.help' | translate }}</p>
      <div class="mb-3">
        <button nz-button type="button" data-test="download-template" (click)="downloadTemplate()">
          {{ 'access.import.template' | translate }}
        </button>
      </div>

      <label for="import-file">{{ 'access.import.file' | translate }}</label>
      <input
        id="import-file"
        class="mb-3 d-block"
        type="file"
        accept=".csv,.txt,text/csv,text/plain"
        data-test="import-file"
        (change)="onFile($event)"
      />

      <label for="import-role">{{ 'access.import.defaultRole' | translate }}</label>
      <nz-select id="import-role" class="mb-3 w-100" [ngModel]="defaultRole()" (ngModelChange)="defaultRole.set($event)">
        @for (value of roles(); track value) {
          <nz-option [nzValue]="value" [nzLabel]="roleLabel(value)" />
        }
      </nz-select>

      @if (errorText(); as text) {
        <nz-alert class="mb-3" nzType="error" nzShowIcon [nzMessage]="text" data-test="import-error" />
      }

      <div class="mb-3">
        <button
          nz-button
          type="button"
          data-test="check-import"
          [nzLoading]="busy()"
          [disabled]="!file() || busy()"
          (click)="run(true)"
        >
          {{ 'access.import.check' | translate }}
        </button>
        <button
          nz-button
          nzType="primary"
          type="button"
          data-test="confirm-import"
          [nzLoading]="busy()"
          [disabled]="!canConfirm()"
          (click)="run(false)"
        >
          {{ 'access.import.confirm' | translate }}
        </button>
      </div>

      @if (report(); as current) {
        <nz-alert
          class="mb-3"
          data-test="import-summary"
          [nzType]="current.errors > 0 ? 'warning' : 'success'"
          nzShowIcon
          [nzMessage]="(current.dry_run ? 'access.import.dryRunDone' : 'access.import.done') | translate"
          [nzDescription]="
            'access.import.summary'
              | translate
                : {
                    total: current.total,
                    created: current.created,
                    invited: current.invited,
                    skipped: current.skipped,
                    errors: current.errors,
                  }
          "
        />
        <nz-table #table [nzData]="current.rows" [nzShowPagination]="current.rows.length > 20" [nzPageSize]="20">
          <thead>
            <tr>
              <th>{{ 'access.import.line' | translate }}</th>
              <th>{{ 'memberAccess.email' | translate }}</th>
              <th>{{ 'access.invitations.status' | translate }}</th>
              <th>{{ 'access.import.message' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of table.data; track row.line) {
              <tr data-test="import-row">
                <td>{{ row.line }}</td>
                <td>{{ row.email }}</td>
                <td>
                  <nz-tag [nzColor]="statusColor(row)">{{ 'access.import.statuses.' + row.status | translate }}</nz-tag>
                </td>
                <td>{{ row.message }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
      }
    </nz-card>
  `,
})
export class UsersImportComponent implements OnInit {
  private readonly api = inject(AccessApiService);
  private readonly settingsApi = inject(SettingsApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly file = signal<File | null>(null);
  protected readonly roles = signal<string[]>([]);
  protected readonly defaultRole = signal('member');
  protected readonly report = signal<ImportReport | null>(null);
  protected readonly busy = signal(false);
  protected readonly errorText = signal<string | null>(null);
  protected readonly limitsVersion = signal(0);
  /** The real import is offered only after a check of the same file that found at least one row to import. */
  protected readonly canConfirm = computed(() => {
    const current = this.report();
    return !this.busy() && this.file() !== null && current !== null && current.dry_run && current.total > current.errors + current.skipped;
  });

  ngOnInit(): void {
    this.settingsApi.getAccessOptions().subscribe({
      next: (res) => this.roles.set(res.data.roles),
      error: () => undefined,
    });
  }

  protected roleLabel(role: string): string {
    return systemRoleLabel(this.i18n, role);
  }

  protected statusColor(row: ImportRow): string {
    return STATUS_COLORS[row.status] ?? 'default';
  }

  protected onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.file.set(input.files?.item(0) ?? null);
    // A report belongs to the file it was made for.
    this.report.set(null);
    this.errorText.set(null);
  }

  protected downloadTemplate(): void {
    saveBlob(new Blob([IMPORT_TEMPLATE], { type: 'text/csv;charset=utf-8' }), 'users-template.csv');
  }

  /** `dryRun` checks the file only; `false` imports it. */
  protected run(dryRun: boolean): void {
    const file = this.file();
    if (file === null) {
      return;
    }

    this.busy.set(true);
    this.errorText.set(null);
    this.api.importUsers(file, dryRun, this.defaultRole()).subscribe({
      next: (res) => {
        this.busy.set(false);
        this.report.set(res.data);
        if (!dryRun) {
          this.message.success(this.i18n.translate('access.import.done'));
          this.limitsVersion.update((value) => value + 1);
        }
      },
      error: (err: unknown) => {
        this.busy.set(false);
        // A file the API refuses (wrong type, too big, no header) is explained next to the file input.
        const detail = err instanceof HttpErrorResponse && err.status === 422 ? problemDetail(err) : null;
        if (detail !== null) {
          this.errorText.set(detail);
        } else {
          reportAccessError(err, this.message, this.i18n);
        }
      },
    });
  }
}
