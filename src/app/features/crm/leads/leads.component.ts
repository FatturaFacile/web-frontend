import { Component, computed, inject, signal, TemplateRef, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { DatePipe } from '@angular/common';
import {
  I18nService,
  Lead,
  LeadApiService,
  LeadFilterParams,
  LeadSource,
  leadDisplayName,
} from '@core';
import {
  BaseTableComponent,
  PageHeaderComponent,
  TableColumnDef,
  TableQueryParams,
  TranslatePipe,
} from '@shared';
import { LeadAssigneeDirectory } from './lead-assignee-directory';
import { LeadAssigneeSelectComponent } from './lead-assignee-select.component';
import { leadFiltersFromQueryParams, leadFiltersToQueryParams } from './lead-filters';
import { LeadRatingTagComponent } from './lead-rating-tag.component';
import { LeadScoreBadgeComponent } from './lead-score-badge.component';
import { LeadFacade } from './lead.facade';

type CellTpl = TemplateRef<{ $implicit: Lead; value: unknown }>;

@Component({
  selector: 'app-crm-leads',
  imports: [
    FormsModule,
    RouterLink,
    DatePipe,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzIconModule,
    NzInputNumberModule,
    NzSelectModule,
    BaseTableComponent,
    PageHeaderComponent,
    TranslatePipe,
    LeadAssigneeSelectComponent,
    LeadRatingTagComponent,
    LeadScoreBadgeComponent,
  ],
  providers: [LeadFacade],
  templateUrl: './leads.component.html',
  styleUrl: './leads.component.scss',
})
export class LeadsComponent {
  protected readonly facade = inject(LeadFacade);
  protected readonly assignees = inject(LeadAssigneeDirectory);
  private readonly api = inject(LeadApiService);
  private readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly sources = signal<LeadSource[]>([]);

  private readonly nameTpl = viewChild<CellTpl>('nameTpl');
  private readonly scoreTpl = viewChild<CellTpl>('scoreTpl');
  private readonly ratingTpl = viewChild<CellTpl>('ratingTpl');
  private readonly sourceTpl = viewChild<CellTpl>('sourceTpl');
  private readonly assigneeTpl = viewChild<CellTpl>('assigneeTpl');
  private readonly statusTpl = viewChild<CellTpl>('statusTpl');
  private readonly createdTpl = viewChild<CellTpl>('createdTpl');

  readonly columns = computed<TableColumnDef<Lead>[]>(() => {
    this.i18n.currentLanguage();
    const t = (key: string) => this.i18n.translate(key);
    return [
      {
        key: 'name',
        header: t('CRM.LEADS.COLUMNS.NAME'),
        width: '240px',
        customCellTemplate: this.nameTpl(),
      },
      {
        key: 'score',
        header: t('CRM.LEADS.COLUMNS.SCORE'),
        width: '100px',
        customCellTemplate: this.scoreTpl(),
      },
      {
        key: 'rating',
        header: t('CRM.LEADS.COLUMNS.RATING'),
        width: '120px',
        customCellTemplate: this.ratingTpl(),
      },
      {
        key: 'lead_source',
        header: t('CRM.LEADS.COLUMNS.SOURCE'),
        width: '160px',
        customCellTemplate: this.sourceTpl(),
      },
      {
        key: 'assigned_user_id',
        header: t('CRM.LEADS.COLUMNS.ASSIGNEE'),
        width: '180px',
        customCellTemplate: this.assigneeTpl(),
      },
      {
        key: 'status',
        header: t('CRM.LEADS.COLUMNS.STATUS'),
        width: '120px',
        customCellTemplate: this.statusTpl(),
      },
      {
        key: 'created_at',
        header: t('CRM.LEADS.COLUMNS.CREATED_AT'),
        width: '140px',
        customCellTemplate: this.createdTpl(),
      },
    ];
  });

  protected readonly ratingOptions = computed(() => {
    this.i18n.currentLanguage();
    return (['cold', 'warm', 'hot'] as const).map((r) => ({
      value: r,
      label: this.i18n.translate(`CRM.LEADS.RATING.${r.toUpperCase()}`),
    }));
  });

  protected readonly sortOptions = computed(() => {
    this.i18n.currentLanguage();
    return [
      { value: '-score', label: this.i18n.translate('CRM.LEADS.SORT.SCORE_DESC') },
      { value: 'score', label: this.i18n.translate('CRM.LEADS.SORT.SCORE_ASC') },
      { value: 'created_at', label: this.i18n.translate('CRM.LEADS.SORT.CREATED_AT') },
    ];
  });

  protected readonly sourceOptions = computed(() =>
    this.sources().map((s) => ({ value: s.id, label: s.name })),
  );

  constructor() {
    this.route.queryParams
      .pipe(takeUntilDestroyed())
      .subscribe((q) => this.facade.replaceFilters(leadFiltersFromQueryParams(q)));
    this.api.listSources().subscribe({
      next: (list) => this.sources.set(list),
      error: () => this.sources.set([]),
    });
  }

  protected name(lead: Lead): string {
    return leadDisplayName(lead);
  }

  protected statusLabel(status: string | null): string {
    return status ? this.i18n.translate(`CRM.LEADS.STATUS.${status.toUpperCase()}`) : '-';
  }

  protected setFilter(patch: Partial<LeadFilterParams>): void {
    const next = { ...this.facade.filterParams(), ...patch };
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: leadFiltersToQueryParams(next),
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected clearFilters(): void {
    this.setFilter({
      rating: undefined,
      assigned_user_id: undefined,
      source: undefined,
      min_score: undefined,
      sort: undefined,
    });
  }

  protected onParamsChange(params: TableQueryParams): void {
    if (params.pageIndex !== this.facade.pageIndex()) {
      this.facade.setPage(params.pageIndex);
    }
    if (params.pageSize !== this.facade.pageSize()) {
      this.facade.setPageSize(params.pageSize);
    }
  }

  protected open(lead: Lead): void {
    void this.router.navigate([lead.id], { relativeTo: this.route });
  }
}
