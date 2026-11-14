import { Component, computed, inject } from '@angular/core';
import { ExportDataset, ExportsApiService, PermissionsService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzCardModule } from 'ng-zorro-antd/card';
import { tap } from 'rxjs';
import {
  ActionFormComponent,
  ActionFormConfig,
} from '../hr/shared/action-form/action-form.component';
import { saveBlob } from '../hr/shared/hr-http.util';

const DATASETS: ExportDataset[] = ['invoices', 'purchases', 'payments', 'contacts'];

/** Files for the accountant: the archive of a period and the CSV of a dataset (Excel-compatible, semicolons). */
@Component({
  selector: 'app-exports',
  styleUrl: './exports.component.scss',
  imports: [ActionFormComponent, NzCardModule, PageHeaderComponent, TranslatePipe],
  template: `
    <app-page-header
      [title]="'exportsPage.title' | translate"
      [subtitle]="'exportsPage.subtitle' | translate"
    />
    <nz-card [nzTitle]="'exportsPage.archiveTitle' | translate" class="mb-3">
      <p>{{ 'exportsPage.archiveHint' | translate }}</p>
      <app-action-form [config]="archiveConfig" [canWrite]="canExport()" />
    </nz-card>
    <nz-card [nzTitle]="'exportsPage.csvTitle' | translate">
      <p>{{ 'exportsPage.csvHint' | translate }}</p>
      <app-action-form [config]="csvConfig" [canWrite]="canExport()" />
    </nz-card>
  `,
})
export class ExportsComponent {
  private readonly api = inject(ExportsApiService);
  private readonly permissions = inject(PermissionsService);

  protected readonly canExport = computed(() => this.permissions.canWrite('exports'));

  protected readonly archiveConfig: ActionFormConfig = {
    submitLabelKey: 'exportsPage.download',
    successKey: 'exportsPage.downloaded',
    fields: [
      { key: 'from', labelKey: 'hrmCommon.from', type: 'date', required: true },
      { key: 'to', labelKey: 'hrmCommon.to', type: 'date', required: true },
    ],
    submit: (payload) =>
      this.api
        .downloadAccountantArchive(String(payload['from']), String(payload['to']))
        .pipe(
          tap((blob) =>
            saveBlob(blob, `accountant-archive-${payload['from']}-${payload['to']}.zip`),
          ),
        ),
  };

  protected readonly csvConfig: ActionFormConfig = {
    submitLabelKey: 'exportsPage.download',
    successKey: 'exportsPage.downloaded',
    fields: [
      {
        key: 'dataset',
        labelKey: 'exportsPage.dataset',
        type: 'select',
        required: true,
        defaultValue: 'invoices',
        options: () =>
          DATASETS.map((value) => ({ value, labelKey: `exportsPage.datasets.${value}` })),
      },
      { key: 'from', labelKey: 'hrmCommon.from', type: 'date' },
      { key: 'to', labelKey: 'hrmCommon.to', type: 'date' },
    ],
    submit: (payload) =>
      this.api
        .downloadDatasetCsv(payload['dataset'] as ExportDataset, {
          from: payload['from'] as string | undefined,
          to: payload['to'] as string | undefined,
        })
        .pipe(tap((blob) => saveBlob(blob, `${payload['dataset']}.csv`))),
  };
}
