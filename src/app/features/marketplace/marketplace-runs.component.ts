import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { MARKETPLACE_RUN_STATUSES, MarketplaceApiService, MarketplaceRunStatus, MarketplaceSyncRun, TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText, RUN_STATUS_COLORS } from './marketplace.util';

/** The sync run log of every installation of the company. */
@Component({
  selector: 'app-marketplace-runs',
  styleUrl: './marketplace.scss',
  imports: [FormsModule, RouterLink, PageHeaderComponent, TranslatePipe, NzCardModule, NzEmptyModule, NzSelectModule, NzTableModule, NzTagModule],
  template: `
    <app-page-header [title]="'MARKETPLACE.RUNS_TITLE' | translate" [subtitle]="'MARKETPLACE.RUNS_SUBTITLE' | translate"></app-page-header>

    <div class="toolbar">
      <nz-select style="width: 240px" nzAllowClear [nzPlaceHolder]="'MARKETPLACE.STATUS' | translate" [ngModel]="status()" (ngModelChange)="status.set($event); load()" [attr.aria-label]="'MARKETPLACE.STATUS' | translate">
        @for (value of statuses; track value) {
          <nz-option [nzValue]="value" [nzLabel]="('MARKETPLACE.RUN_' + value.toUpperCase()) | translate"></nz-option>
        }
      </nz-select>
    </div>

    <nz-card class="main-card">
      <nz-table #table [nzData]="runs()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="25">
        <thead>
          <tr>
            <th>{{ 'MARKETPLACE.STARTED_AT' | translate }}</th>
            <th>{{ 'MARKETPLACE.NAME' | translate }}</th>
            <th>{{ 'MARKETPLACE.RESOURCE' | translate }}</th>
            <th>{{ 'MARKETPLACE.STATUS' | translate }}</th>
            <th class="num">{{ 'MARKETPLACE.RECORDS' | translate }}</th>
            <th>{{ 'MARKETPLACE.MESSAGE' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <td>{{ row.started_at }}</td>
              <td><a [routerLink]="['/marketplace/installations', row.installation_id]">{{ row.installation_name ?? row.installation_id }}</a></td>
              <td>{{ row.resource }}</td>
              <td><nz-tag [nzColor]="runColor(row.status)">{{ ('MARKETPLACE.RUN_' + row.status.toUpperCase()) | translate }}</nz-tag></td>
              <td class="num">{{ row.records_processed }}</td>
              <td>{{ row.message ?? '' }}</td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && runs().length === 0) {
        <nz-empty [nzNotFoundContent]="'MARKETPLACE.NO_RUNS' | translate"></nz-empty>
      }
    </nz-card>
  `,
})
export class MarketplaceRunsComponent implements OnInit {
  private readonly api = inject(MarketplaceApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly statuses = MARKETPLACE_RUN_STATUSES;
  readonly runs = signal<MarketplaceSyncRun[]>([]);
  readonly loading = signal(false);
  readonly status = signal<MarketplaceRunStatus | null>(null);

  ngOnInit(): void {
    this.load();
  }

  runColor(status: string): string {
    return RUN_STATUS_COLORS[status] ?? 'default';
  }

  load(): void {
    this.loading.set(true);
    this.api.getSyncRuns({ status: this.status() ?? undefined, per_page: 100 }).subscribe({
      next: (response) => {
        this.runs.set(response.data);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.message.error(apiErrorText(error) ?? this.translate.instant('MARKETPLACE.ACTION_ERROR'));
      },
    });
  }
}
