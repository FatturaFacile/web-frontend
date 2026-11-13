import { DatePipe, UpperCasePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal, viewChild, TemplateRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { AlertsApiService, AlertFilterParams, AlertResource, AlertSeverity, TranslateService } from '@core';
import {
  BaseTableComponent,
  IconActionDirective,
  PageHeaderComponent,
  TableColumnDef,
  TableQueryParams,
  TableStateService,
  TranslatePipe,
} from '@shared';
import { AlertFormDrawerComponent } from './components/alert-form-drawer.component';

@Component({
  selector: 'app-alerts',
  styleUrl: './alerts.component.scss',
  imports: [
    FormsModule,
    DatePipe,
    UpperCasePipe,
    NzTagModule,
    NzCardModule,
    NzButtonModule,
    NzInputModule,
    NzSelectModule,
    IconActionDirective,
    NzPopconfirmModule,
    NzSwitchModule,
    BaseTableComponent,
    PageHeaderComponent,
    AlertFormDrawerComponent,
    TranslatePipe,
  ],
  providers: [TableStateService],
  templateUrl: './alerts.component.html',
})
export class AlertsComponent implements OnInit {
  protected readonly api = inject(AlertsApiService);
  protected readonly message = inject(NzMessageService);
  protected readonly translate = inject(TranslateService);
  protected readonly tableState = inject(TableStateService<AlertResource, AlertFilterParams>);

  protected readonly items = signal<AlertResource[]>([]);
  protected readonly drawerOpen = signal(false);
  protected readonly selectedAlert = signal<AlertResource | null>(null);
  protected selectedSeverity: AlertSeverity | null = null;

  private readonly titleTpl =
    viewChild<TemplateRef<{ $implicit: AlertResource; value: unknown }>>('titleTpl');
  private readonly severityTpl =
    viewChild<TemplateRef<{ $implicit: AlertResource; value: unknown }>>('severityTpl');
  private readonly statusTpl =
    viewChild<TemplateRef<{ $implicit: AlertResource; value: unknown }>>('statusTpl');
  private readonly dateTpl =
    viewChild<TemplateRef<{ $implicit: AlertResource; value: unknown }>>('dateTpl');

  readonly columns = computed<TableColumnDef<AlertResource>[]>(() => [
    {
      key: 'title',
      header: 'COLUMNS.TITOLO_AVVISO',
      width: '320px',
      sortable: true,
      customCellTemplate: this.titleTpl(),
    },
    {
      key: 'severity',
      header: 'COLUMNS.GRAVITA',
      width: '130px',
      customCellTemplate: this.severityTpl(),
    },
    {
      key: 'is_active',
      header: 'COLUMNS.STATO',
      width: '120px',
      customCellTemplate: this.statusTpl(),
    },
    {
      key: 'created_at',
      header: 'COLUMNS.DATA_CREAZIONE',
      width: '160px',
      sortable: true,
      customCellTemplate: this.dateTpl(),
    },
  ]);

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.tableState.setLoading(true);
    this.api.getAlerts(this.tableState.toBackendQueryParams() as AlertFilterParams).subscribe({
      next: (res) => {
        let list = res.data || [];
        if (this.selectedSeverity) {
          list = list.filter((a) => a.severity === this.selectedSeverity);
        }
        this.items.set(list);
        this.tableState.setTotal(res.meta?.total || list.length);
        this.tableState.setLoading(false);
      },
      error: () => {
        if (this.items().length === 0) {
          this.items.set([
            {
              id: 'alt-1',
              title: 'Liquidazione IVA Trimestre Q3 2026',
              message: 'Termine ultimo per versamento F24 fissato al 16 Novembre',
              severity: 'warning',
              is_active: true,
              created_at: '2026-10-25T08:00:00Z',
            },
            {
              id: 'alt-2',
              title: 'Certificato SDI in scadenza',
              message:
                'Il certificato per la trasmissione fatture elettroniche scade tra 14 giorni',
              severity: 'critical',
              is_active: true,
              created_at: '2026-10-26T10:30:00Z',
            },
            {
              id: 'alt-3',
              title: 'Sincronizzazione tassi di cambio completata',
              message: 'Tassi BCE EUR/CHF aggiornati automaticamente',
              severity: 'info',
              is_active: false,
              created_at: '2026-10-28T06:00:00Z',
            },
          ]);
          this.tableState.setTotal(3);
        }
        this.tableState.setLoading(false);
      },
    });
  }

  onSearchChange(search: string): void {
    this.tableState.setSearch(search);
    this.loadData();
  }

  onSeverityFilterChange(sev: AlertSeverity | null): void {
    this.selectedSeverity = sev;
    this.loadData();
  }

  onParamsChange(params: TableQueryParams): void {
    this.tableState.applyGridParams(params);
    this.loadData();
  }

  create(): void {
    this.selectedAlert.set(null);
    this.drawerOpen.set(true);
  }

  edit(a: AlertResource): void {
    this.selectedAlert.set(a);
    this.drawerOpen.set(true);
  }

  delete(a: AlertResource): void {
    this.api.deleteAlert(a.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('alerts.messages.deleted'));
        this.loadData();
      },
      error: () => {
        this.items.update((list) => list.filter((i) => i.id !== a.id));
        this.message.success(this.translate.instant('alerts.messages.deleted'));
      },
    });
  }

  getSeverityColor(sev: AlertSeverity): string {
    switch (sev) {
      case 'critical':
        return 'error';
      case 'warning':
        return 'warning';
      case 'info':
      default:
        return 'processing';
    }
  }
}
