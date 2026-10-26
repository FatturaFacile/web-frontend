import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { ClientApiService, ContactResource, ContactType, contactDisplayName, I18nService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { ClientFacade } from '../services/client.facade';
import { ClientFormDrawerComponent } from './client-form-drawer.component';

@Component({
  selector: 'app-crm-clients',
  imports: [
    FormsModule,
    NzTableModule,
    NzTagModule,
    NzCardModule,
    NzButtonModule,
    NzInputModule,
    NzSelectModule,
    NzIconModule,
    NzEmptyModule,
    NzSkeletonModule,
    NzPopconfirmModule,
    PageHeaderComponent,
    TranslatePipe,
    ClientFormDrawerComponent,
  ],
  template: `
    <app-page-header [title]="'CRM.CLIENTS.TITLE' | translate" [subtitle]="'CRM.CLIENTS.SUBTITLE' | translate" />

    <nz-card>
      <div class="toolbar">
        <input class="search"
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

      @if (!facade.loaded()) {
        <nz-skeleton [nzActive]="true" [nzParagraph]="{ rows: 6 }" />
      } @else {
        <nz-table
          #table
          nzSize="middle"
          [nzData]="facade.items()"
          [nzFrontPagination]="false"
          [nzLoading]="facade.loading()"
          [nzTotal]="facade.totalCount()"
          [nzPageIndex]="facade.pageIndex()"
          [nzPageSize]="facade.pageSize()"
          [nzNoResult]="empty"
          (nzPageIndexChange)="facade.setPage($event)"
          (nzPageSizeChange)="facade.setPageSize($event)"
        >
          <thead>
            <tr>
              <th>{{ 'CRM.CLIENTS.COLUMNS.NAME' | translate }}</th>
              <th>{{ 'CRM.CLIENTS.COLUMNS.TYPE' | translate }}</th>
              <th>{{ 'CRM.CLIENTS.COLUMNS.TAX_ID' | translate }}</th>
              <th>{{ 'CRM.CLIENTS.COLUMNS.EMAIL' | translate }}</th>
              <th>{{ 'CRM.CLIENTS.COLUMNS.PHONE' | translate }}</th>
              <th>{{ 'CRM.CLIENTS.COLUMNS.COUNTRY' | translate }}</th>
              <th nzAlign="right">{{ 'CRM.CLIENTS.COLUMNS.ACTIONS' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (c of table.data; track c.id) {
              <tr>
                <td>{{ name(c) }}</td>
                <td><nz-tag [nzColor]="typeColor(c.type)">{{ typeLabel(c.type) }}</nz-tag></td>
                <td>{{ c.vat_number || c.uid_number || '�' }}</td>
                <td>
                  <div>{{ c.email || '�' }}</div>
                  <small>{{ c.phone }}</small>
                </td>
                <td>{{ c.country }}</td>
                <td nzAlign="right">
                  <button nz-button nzType="text" type="button" [attr.aria-label]="'CRM.CLIENTS.ACTIONS.EDIT' | translate: { name: name(c) }" (click)="edit(c)">
                    <nz-icon nzType="edit" />
                  </button>
                  <button
                    nz-button
                    nzType="text"
                    nzDanger
                    type="button"
                    [attr.aria-label]="'CRM.CLIENTS.ACTIONS.DELETE' | translate: { name: name(c) }"
                    nz-popconfirm
                    [nzPopconfirmTitle]="'CRM.CLIENTS.ACTIONS.CONFIRM_DELETE' | translate"
                    [nzOkText]="'CRM.CLIENTS.ACTIONS.DELETE_OK' | translate"
                    [nzCancelText]="'COMMON.CANCEL' | translate"
                    (nzOnConfirm)="remove(c)"
                  >
                    <nz-icon nzType="delete" />
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
        <ng-template #empty>
          <nz-empty [nzNotFoundContent]="'CRM.CLIENTS.EMPTY' | translate">
            <div nz-empty-footer>
              <button nz-button nzType="primary" type="button" (click)="create()">{{ 'CRM.CLIENTS.EMPTY_CTA' | translate }}</button>
            </div>
          </nz-empty>
        </ng-template>
      }
    </nz-card>

    <app-client-form-drawer [(open)]="drawerOpen" [contact]="editing()" (saved)="facade.reload()" />
  `,
  styles: `
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 16px;
    }
    .search {
      width: 320px;
    }
    .type-filter {
      width: 180px;
    }
    .spacer {
      flex: 1;
    }
  `,
})
export class ClientsComponent {
  protected readonly facade = inject(ClientFacade);
  private readonly api = inject(ClientApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly drawerOpen = signal(false);
  protected readonly editing = signal<ContactResource | null>(null);

  private readonly typeKeys: { key: string; value: ContactType }[] = [
    { key: 'CRM.CLIENTS.TYPES.CLIENT', value: 'client' },
    { key: 'CRM.CLIENTS.TYPES.SUPPLIER', value: 'supplier' },
    { key: 'CRM.CLIENTS.TYPES.BOTH', value: 'both' },
    { key: 'CRM.CLIENTS.TYPES.LEAD', value: 'lead' },
  ];
  /** Recomputed when the UI language changes (nz-select needs plain string labels). */
  protected readonly typeOptions = computed(() => {
    this.i18n.currentLanguage();
    return this.typeKeys.map((o) => ({ label: this.i18n.translate(o.key), value: o.value }));
  });

  protected name(c: ContactResource): string {
    return contactDisplayName(c);
  }

  protected typeLabel(t: ContactType): string {
    return this.typeOptions().find((o) => o.value === t)?.label ?? t;
  }

  protected typeColor(t: ContactType): string {
    return t === 'supplier' ? 'orange' : t === 'lead' ? 'default' : 'blue';
  }

  protected create(): void {
    this.editing.set(null);
    this.drawerOpen.set(true);
  }

  protected edit(c: ContactResource): void {
    this.editing.set(c);
    this.drawerOpen.set(true);
  }

  protected remove(c: ContactResource): void {
    this.api.delete(c.id).subscribe(() => {
      this.message.success(this.i18n.translate('CRM.CLIENTS.MESSAGES.DELETED'));
      this.facade.reload();
    });
  }
}

export { ClientsComponent as CrmClientsComponent };

