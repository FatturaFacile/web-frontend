import { DatePipe, UpperCasePipe } from '@angular/common';
import { Component, computed, inject, signal, viewChild, TemplateRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { AlertsApiService, AlertFilterParams, AlertResource, AlertSeverity, FetchGridModel, TranslateService } from '@core';
import {
  BaseTableComponent,
  IconActionDirective,
  PageHeaderComponent,
  TableColumnDef,
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
  templateUrl: './alerts.component.html',
})
export class AlertsComponent {
  protected readonly api = inject(AlertsApiService);
  protected readonly message = inject(NzMessageService);
  protected readonly translate = inject(TranslateService);
  protected readonly grid = new FetchGridModel<AlertResource, AlertFilterParams>((query) => this.api.getAlerts(query));

  protected readonly drawerOpen = signal(false);
  protected readonly selectedAlert = signal<AlertResource | null>(null);

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
      valueLabel: (value) => this.severityLabel(value),
      header: 'COLUMNS.GRAVITA',
      width: '130px',
      customCellTemplate: this.severityTpl(),
    },
    {
      key: 'is_active',
      valueLabel: (value) => this.translate.instant(value === '1' ? 'common.status.active' : 'common.status.inactive'),
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

  onSearchChange(search: string): void {
    this.grid.setFilter({ search: search || undefined });
  }

  onSeverityFilterChange(severity: AlertSeverity | null): void {
    this.grid.setFilter({ severity: severity ?? undefined });
  }

  private severityLabel(severity: string): string {
    const keys: Record<string, string> = {
      info: 'alerts.lblInformativo',
      warning: 'alerts.lblAttenzione',
      critical: 'alerts.lblCritico',
    };
    return this.translate.instant(keys[severity] ?? severity);
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
        this.grid.reload();
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
