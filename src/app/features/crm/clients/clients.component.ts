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
import { ClientApiService, ContactResource, ContactType, contactDisplayName, I18nService } from '@core';
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
  template: `
    <app-page-header [title]="'CRM.CLIENTS.TITLE' | translate" [subtitle]="'CRM.CLIENTS.SUBTITLE' | translate" />

    <nz-card>
      <div class="toolbar">
        <input
          class="search"
          nz-input
          type="search"
          [attr.aria-label]="'CRM.CLIENTS.SEARCH_PLACEHOLDER' | translate"
          [placeholder]="'CRM.CLIENTS.SEARCH_PLACEHOLDER' | translate"
          [ngModel]="facade.filterParams().search"
          (ngModelChange)="facade.setFilter({ search: $event })"
        />

        <nz-select
          class="type-filter"
          nzAllowClear
          [nzPlaceHolder]="'CRM.CLIENTS.FILTER_TYPE' | translate"
          [attr.aria-label]="'CRM.CLIENTS.FILTER_TYPE' | translate"
          [nzOptions]="typeOptions()"
          [ngModel]="facade.filterParams().type"
          (ngModelChange)="facade.setFilter({ type: $event ?? undefined })"
        />

        <span class="spacer"></span>
        <button nz-button nzType="primary" type="button" (click)="create()">
          <nz-icon nzType="plus" /> {{ 'CRM.CLIENTS.NEW' | translate }}
        </button>
      </div>

      <app-base-table
        [data]="facade.items()"
        [columns]="columns()"
        [loading]="facade.loading()"
        [total]="facade.totalCount()"
        [pageIndex]="facade.pageIndex()"
        [pageSize]="facade.pageSize()"
        [actionsTemplate]="actionsTpl"
        (paramsChange)="onParamsChange($event)"
      />

      <!-- Cell Templates -->
      <ng-template #nameTpl let-c>
        <strong>{{ name(c) }}</strong>
        @if (c.company_name && c.first_name) {
          <div class="sub-text">{{ c.first_name }} {{ c.last_name }}</div>
        }
      </ng-template>

      <ng-template #typeTpl let-c>
        <nz-tag [nzColor]="typeColor(c.type)">{{ typeLabel(c.type) }}</nz-tag>
      </ng-template>

      <ng-template #taxTpl let-c>
        {{ c.vat_number || c.fiscal_code || c.uid_number || '-' }}
      </ng-template>

      <ng-template #countryTpl let-c>
        <nz-tag>{{ c.country }}</nz-tag>
      </ng-template>

      <!-- Row Actions Template -->
      <ng-template #actionsTpl let-c>
        <div class="actions-group">
          <button
            nz-button
            nzType="text"
            nzSize="small"
            type="button"
            (click)="viewStats(c)"
            title="Statistiche"
          >
            <nz-icon nzType="bar-chart" />
          </button>
          <button
            nz-button
            nzType="text"
            nzSize="small"
            type="button"
            (click)="edit(c)"
            [title]="'CRM.CLIENTS.ACTIONS.EDIT' | translate"
          >
            <nz-icon nzType="edit" />
          </button>
          <button
            nz-button
            nzType="text"
            nzDanger
            nzSize="small"
            type="button"
            nz-popconfirm
            [nzPopconfirmTitle]="'CRM.CLIENTS.ACTIONS.CONFIRM_DELETE' | translate: { name: name(c) }"
            [nzOkText]="'COMMON.DELETE' | translate"
            [nzCancelText]="'COMMON.CANCEL' | translate"
            (nzOnConfirm)="delete(c)"
            [title]="'CRM.CLIENTS.ACTIONS.DELETE' | translate"
          >
            <nz-icon nzType="delete" />
          </button>
        </div>
      </ng-template>
    </nz-card>

    <app-client-form-drawer
      [contact]="selected()"
      [open]="drawerOpen()"
      (openChange)="drawerOpen.set($event)"
      (saved)="facade.reload()"
    />
  `,
  styles: `
    .toolbar {
      display: flex;
      gap: 12px;
      align-items: center;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    .search {
      width: 280px;
    }
    .type-filter {
      width: 170px;
    }
    .spacer {
      flex: 1;
    }
    .sub-text {
      font-size: 12px;
      color: #8c8c8c;
    }
    .actions-group {
      display: flex;
      justify-content: flex-end;
      gap: 4px;
    }
  `,
})
export class ClientsComponent {
  protected readonly facade = inject(ClientFacade);
  private readonly api = inject(ClientApiService);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);
  private readonly i18n = inject(I18nService);

  protected readonly drawerOpen = signal(false);
  protected readonly selected = signal<ContactResource | null>(null);

  private readonly nameTpl = viewChild<TemplateRef<{ $implicit: ContactResource; value: unknown }>>('nameTpl');
  private readonly typeTpl = viewChild<TemplateRef<{ $implicit: ContactResource; value: unknown }>>('typeTpl');
  private readonly taxTpl = viewChild<TemplateRef<{ $implicit: ContactResource; value: unknown }>>('taxTpl');
  private readonly countryTpl = viewChild<TemplateRef<{ $implicit: ContactResource; value: unknown }>>('countryTpl');

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
      nzTitle: `Statistiche ${this.name(c)}`,
      nzContent: `Anagrafica ${c.country} - Tipo: ${this.typeLabel(c.type)} - Partita IVA/Codice Fiscale: ${c.vat_number || c.fiscal_code || c.uid_number || 'N/D'}`,
      nzOkText: 'Chiudi',
    });
  }
}

export { ClientsComponent as CrmClientsComponent };
