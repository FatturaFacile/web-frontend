import { Component, computed, inject, signal, viewChild, TemplateRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzGridModule } from 'ng-zorro-antd/grid';
import {
  ClientApiService,
  ContactResource,
  ContactType,
  contactDisplayName,
  I18nService,
} from '@core';
import {
  BaseTableComponent,
  PageHeaderComponent,
  TableColumnDef,
  TableQueryParams,
  TranslatePipe,
} from '@shared';
import { ClientFacade } from '../services/client.facade';
import { ClientFormDrawerComponent } from './client-form-drawer.component';

@Component({
  selector: 'app-crm-clients',
  imports: [
    FormsModule,
    NzTagModule,
    NzCardModule,
    NzButtonModule,
    NzInputModule,
    NzSelectModule,
    NzIconModule,
    NzPopconfirmModule,
    NzModalModule,
    NzStatisticModule,
    NzGridModule,
    BaseTableComponent,
    PageHeaderComponent,
    TranslatePipe,
    ClientFormDrawerComponent,
  ],
  templateUrl: './clients.component.html',
  styleUrl: './clients.component.scss',
})
export class ClientsComponent {
  protected readonly facade = inject(ClientFacade);
  private readonly api = inject(ClientApiService);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);
  private readonly i18n = inject(I18nService);

  protected readonly drawerOpen = signal(false);
  protected readonly selected = signal<ContactResource | null>(null);

  private readonly nameTpl =
    viewChild<TemplateRef<{ $implicit: ContactResource; value: unknown }>>('nameTpl');
  private readonly typeTpl =
    viewChild<TemplateRef<{ $implicit: ContactResource; value: unknown }>>('typeTpl');
  private readonly taxTpl =
    viewChild<TemplateRef<{ $implicit: ContactResource; value: unknown }>>('taxTpl');
  private readonly countryTpl =
    viewChild<TemplateRef<{ $implicit: ContactResource; value: unknown }>>('countryTpl');

  readonly columns = computed<TableColumnDef<ContactResource>[]>(() => [
    {
      key: 'name',
      header: this.i18n.translate('CRM.CLIENTS.COLUMNS.NAME'),
      width: '240px',
      sortable: true,
      customCellTemplate: this.nameTpl(),
    },
    {
      key: 'type',
      header: this.i18n.translate('CRM.CLIENTS.COLUMNS.TYPE'),
      width: '130px',
      customCellTemplate: this.typeTpl(),
    },
    {
      key: 'vat_number',
      header: this.i18n.translate('CRM.CLIENTS.COLUMNS.TAX_ID'),
      width: '160px',
      customCellTemplate: this.taxTpl(),
    },
    {
      key: 'email',
      header: this.i18n.translate('CRM.CLIENTS.COLUMNS.EMAIL'),
      width: '200px',
    },
    {
      key: 'phone',
      header: this.i18n.translate('CRM.CLIENTS.COLUMNS.PHONE'),
      width: '140px',
    },
    {
      key: 'country',
      header: this.i18n.translate('CRM.CLIENTS.COLUMNS.COUNTRY'),
      width: '100px',
      customCellTemplate: this.countryTpl(),
    },
  ]);

  protected readonly typeOptions = computed(() => {
    this.i18n.currentLanguage();
    return [
      { label: this.i18n.translate('CRM.CLIENTS.TYPES.CLIENT'), value: 'client' },
      { label: this.i18n.translate('CRM.CLIENTS.TYPES.SUPPLIER'), value: 'supplier' },
      { label: this.i18n.translate('CRM.CLIENTS.TYPES.BOTH'), value: 'both' },
    ];
  });

  protected name(c: ContactResource): string {
    return contactDisplayName(c);
  }

  protected typeLabel(type: ContactType): string {
    return this.i18n.translate(`CRM.CLIENTS.TYPES.${type.toUpperCase()}`);
  }

  protected typeColor(type: ContactType): string {
    switch (type) {
      case 'client':
        return 'blue';
      case 'supplier':
        return 'purple';
      default:
        return 'cyan';
    }
  }

  protected onParamsChange(params: TableQueryParams): void {
    if (params.pageIndex !== this.facade.pageIndex()) {
      this.facade.setPage(params.pageIndex);
    }
    if (params.pageSize !== this.facade.pageSize()) {
      this.facade.setPageSize(params.pageSize);
    }
  }

  protected create(): void {
    this.selected.set(null);
    this.drawerOpen.set(true);
  }

  protected edit(c: ContactResource): void {
    this.selected.set(c);
    this.drawerOpen.set(true);
  }

  protected delete(c: ContactResource): void {
    this.api.delete(c.id).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('CRM.CLIENTS.MESSAGES.DELETED'));
        this.facade.reload();
      },
      error: () => undefined,
    });
  }

  protected viewStats(c: ContactResource): void {
    this.modal.info({
      nzTitle: this.i18n.translate('crm.clients.statsModal.title', { name: this.name(c) }),
      nzContent: this.i18n.translate('crm.clients.statsModal.content', {
        country: c.country,
        type: this.typeLabel(c.type),
        fiscal: c.vat_number || c.fiscal_code || c.uid_number || 'N/D',
      }),
      nzOkText: this.i18n.translate('common.actions.close'),
    });
  }
}

export { ClientsComponent as CrmClientsComponent };
