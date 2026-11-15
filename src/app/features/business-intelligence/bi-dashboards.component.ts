import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { BiDashboard, BiOverview, BusinessIntelligenceApiService, TranslateService } from '@core';
import { IconActionDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText, blankToNull, VISIBILITY_COLORS } from './bi.util';

/** The dashboards the caller can open, the figures of the module and the form to create a new dashboard. */
@Component({
  selector: 'app-bi-dashboards',
  styleUrl: './business-intelligence.scss',
  imports: [
    FormsModule,
    RouterLink,
    IconActionDirective,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzStatisticModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'BI.TITLE' | translate" [subtitle]="'BI.SUBTITLE' | translate">
      <button nz-button nzType="primary" appIconAction="create" (click)="openModal()"></button>
    </app-page-header>

    @if (overview(); as stats) {
      <div class="stats-grid">
        <nz-card><nz-statistic [nzTitle]="'BI.DASHBOARDS' | translate" [nzValue]="stats.dashboards"></nz-statistic></nz-card>
        <nz-card><nz-statistic [nzTitle]="'BI.SAVED_QUERIES' | translate" [nzValue]="stats.saved_queries"></nz-statistic></nz-card>
        <nz-card><nz-statistic [nzTitle]="'BI.SCHEDULED_QUERIES' | translate" [nzValue]="stats.scheduled_queries"></nz-statistic></nz-card>
        <nz-card><nz-statistic [nzTitle]="'BI.CALCULATED_MEASURES' | translate" [nzValue]="stats.calculated_measures"></nz-statistic></nz-card>
      </div>
      @if (stats.failed_snapshots.length > 0) {
        <nz-card class="main-card" [nzTitle]="'BI.FAILED_SNAPSHOTS' | translate">
          @for (failure of stats.failed_snapshots; track failure.id) {
            <p><nz-tag nzColor="red">{{ failure.taken_on }}</nz-tag> {{ failure.error }}</p>
          }
        </nz-card>
      }
    }

    <div class="toolbar">
      <input nz-input style="width: 260px" [placeholder]="'BI.SEARCH' | translate" [attr.aria-label]="'BI.SEARCH' | translate" [ngModel]="search()" (ngModelChange)="search.set($event)" (keydown.enter)="load()" />
      <button nz-button (click)="load()">{{ 'BI.SEARCH' | translate }}</button>
    </div>

    <nz-card class="main-card">
      <nz-table #table [nzData]="dashboards()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="25">
        <thead>
          <tr>
            <th>{{ 'BI.NAME' | translate }}</th>
            <th>{{ 'BI.OWNER' | translate }}</th>
            <th>{{ 'BI.VISIBILITY' | translate }}</th>
            <th>{{ 'BI.WIDGETS' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <td><a [routerLink]="['/business-intelligence/dashboards', row.id]">{{ row.name }}</a></td>
              <td>{{ row.owner_name ?? '' }}</td>
              <td><nz-tag [nzColor]="visibilityColor(row.visibility)">{{ ('BI.VISIBILITY_' + row.visibility.toUpperCase()) | translate }}</nz-tag></td>
              <td class="num">{{ row.widgets?.length ?? '' }}</td>
              <td>
                <div class="row-actions">
                  @if (row.is_owner) {
                    <button nz-button nzType="text" nzDanger appIconAction="delete" nz-popconfirm [nzPopconfirmTitle]="'BI.DELETE_DASHBOARD_CONFIRM' | translate" (nzOnConfirm)="remove(row)"></button>
                  }
                </div>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && dashboards().length === 0) {
        <nz-empty [nzNotFoundContent]="'BI.NO_DASHBOARDS' | translate"></nz-empty>
      }
    </nz-card>

    <nz-modal [(nzVisible)]="modalVisible" [nzTitle]="'BI.NEW_DASHBOARD' | translate" (nzOnCancel)="modalVisible.set(false)" (nzOnOk)="create()" [nzOkDisabled]="name().trim() === ''">
      <ng-container *nzModalContent>
        <label for="dashboard-name">{{ 'BI.NAME' | translate }}</label>
        <input nz-input id="dashboard-name" maxlength="160" [ngModel]="name()" (ngModelChange)="name.set($event)" />
        <label for="dashboard-description" class="bi-label">{{ 'BI.DESCRIPTION' | translate }}</label>
        <textarea nz-input id="dashboard-description" rows="2" [ngModel]="description()" (ngModelChange)="description.set($event)"></textarea>
        <label for="dashboard-visibility" class="bi-label">{{ 'BI.VISIBILITY' | translate }}</label>
        <nz-select id="dashboard-visibility" style="width: 100%" [ngModel]="visibility()" (ngModelChange)="visibility.set($event)">
          <nz-option nzValue="private" [nzLabel]="'BI.VISIBILITY_PRIVATE' | translate"></nz-option>
          <nz-option nzValue="company" [nzLabel]="'BI.VISIBILITY_COMPANY' | translate"></nz-option>
        </nz-select>
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .bi-label { display: block; margin-top: 12px; }
  `,
})
export class BiDashboardsComponent implements OnInit {
  private readonly api = inject(BusinessIntelligenceApiService);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly dashboards = signal<BiDashboard[]>([]);
  readonly overview = signal<BiOverview | null>(null);
  readonly loading = signal(false);
  readonly search = signal('');
  readonly modalVisible = signal(false);
  readonly name = signal('');
  readonly description = signal('');
  readonly visibility = signal<'private' | 'company'>('private');

  ngOnInit(): void {
    this.load();
    this.api.getOverview().subscribe({ next: (response) => this.overview.set(response.data), error: () => this.overview.set(null) });
  }

  visibilityColor(visibility: string): string {
    return VISIBILITY_COLORS[visibility] ?? 'default';
  }

  load(): void {
    this.loading.set(true);
    this.api.getDashboards({ search: this.search().trim() || undefined, per_page: 100 }).subscribe({
      next: (response) => {
        this.dashboards.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('BI.ACTION_ERROR'));
      },
    });
  }

  openModal(): void {
    this.name.set('');
    this.description.set('');
    this.visibility.set('private');
    this.modalVisible.set(true);
  }

  create(): void {
    this.api.createDashboard({ name: this.name().trim(), description: blankToNull(this.description()), visibility: this.visibility() }).subscribe({
      next: (response) => {
        this.modalVisible.set(false);
        this.message.success(this.translate.instant('BI.DASHBOARD_CREATED'));
        void this.router.navigate(['/business-intelligence/dashboards', response.data.id]);
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('BI.ACTION_ERROR')),
    });
  }

  remove(dashboard: BiDashboard): void {
    this.api.deleteDashboard(dashboard.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('BI.DASHBOARD_DELETED'));
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('BI.ACTION_ERROR')),
    });
  }
}
