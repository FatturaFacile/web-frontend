import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { CrmExtensionApiService, CrmSalesQuota, CrmTerritory, CrmTerritoryRequest, I18nService, PermissionsService } from '@core';
import { IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';

/** Sales territories with the rule-based assignment of accounts, and the sales quotas with their attainment. */
@Component({
  selector: 'app-crm-territories',
  imports: [
    FormsModule,
    IconActionDirective,
    ModalActionsDirective,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzProgressModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'CRMEXT.TERRITORIES.TITLE' | translate" [subtitle]="'CRMEXT.TERRITORIES.SUBTITLE' | translate">
      @if (canWrite()) {
        <button nz-button type="button" [nzLoading]="assigning()" (click)="runAssignment()">{{ 'CRMEXT.TERRITORIES.RUN_RULES' | translate }}</button>
        <button nz-button nzType="primary" type="button" appIconAction="create" (click)="openModal()"></button>
      }
    </app-page-header>

    <nz-card [nzTitle]="'CRMEXT.TERRITORIES.LIST' | translate">
      <nz-table [nzData]="territories()" [nzLoading]="loading()" [nzFrontPagination]="false" nzSize="middle">
        <thead>
          <tr>
            <th>{{ 'CRMEXT.COMMON.CODE' | translate }}</th>
            <th>{{ 'CRMEXT.COMMON.NAME' | translate }}</th>
            <th>{{ 'CRMEXT.TERRITORIES.COUNTRIES' | translate }}</th>
            <th>{{ 'CRMEXT.TERRITORIES.PRIORITY' | translate }}</th>
            <th>{{ 'CRMEXT.COMMON.STATUS' | translate }}</th>
            <th>{{ 'COMMON.ACTIONS' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (territory of territories(); track territory.id) {
            <tr>
              <td>{{ territory.code }}</td>
              <td>{{ territory.name }}</td>
              <td>
                @for (country of territory.criteria?.countries ?? []; track country) {
                  <nz-tag>{{ country }}</nz-tag>
                } @empty {
                  <span>{{ 'CRMEXT.TERRITORIES.ANY' | translate }}</span>
                }
              </td>
              <td>{{ territory.priority }}</td>
              <td>
                <nz-tag [nzColor]="territory.is_active ? 'green' : 'default'">{{ (territory.is_active ? 'CRMEXT.COMMON.ACTIVE' : 'CRMEXT.COMMON.INACTIVE') | translate }}</nz-tag>
              </td>
              <td>
                @if (canWrite()) {
                  <button nz-button nzType="text" nzDanger nzSize="small" type="button" appIconAction="delete" nz-popconfirm [nzPopconfirmTitle]="'CRMEXT.COMMON.CONFIRM_DELETE' | translate" (nzOnConfirm)="removeTerritory(territory)"></button>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    <nz-card class="quotas" [nzTitle]="'CRMEXT.QUOTAS.LIST' | translate">
      <nz-table [nzData]="quotas()" [nzLoading]="loading()" [nzFrontPagination]="false" nzSize="middle">
        <thead>
          <tr>
            <th>{{ 'CRMEXT.QUOTAS.PERIOD' | translate }}</th>
            <th>{{ 'CRMEXT.QUOTAS.TARGET' | translate }}</th>
            <th>{{ 'CRMEXT.QUOTAS.ACHIEVED' | translate }}</th>
            <th>{{ 'CRMEXT.QUOTAS.ATTAINMENT' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (quota of quotas(); track quota.id) {
            <tr>
              <td>{{ quota.period_start }} - {{ quota.period_end }}</td>
              <td>{{ quota.target_amount }} {{ quota.currency }}</td>
              <td>{{ quota.attainment?.achieved }} ({{ quota.attainment?.won_count }})</td>
              <td><nz-progress [nzPercent]="percent(quota)" nzSize="small" /></td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    <nz-modal appModalActions
      okAction="save"
      [nzVisible]="modalOpen()"
      [nzTitle]="'CRMEXT.TERRITORIES.NEW' | translate"
      [nzOkLoading]="saving()"
      [nzOkDisabled]="!valid()"
      (nzOnCancel)="modalOpen.set(false)"
      (nzOnOk)="save()"
    >
      <ng-container *nzModalContent>
        <label for="terr-code">{{ 'CRMEXT.COMMON.CODE' | translate }}</label>
        <input nz-input id="terr-code" maxlength="40" [(ngModel)]="code" />
        <label for="terr-name">{{ 'CRMEXT.COMMON.NAME' | translate }}</label>
        <input nz-input id="terr-name" maxlength="150" [(ngModel)]="name" />
        <label for="terr-countries">{{ 'CRMEXT.TERRITORIES.COUNTRIES_HINT' | translate }}</label>
        <input nz-input id="terr-countries" [(ngModel)]="countries" />
        <label for="terr-priority">{{ 'CRMEXT.TERRITORIES.PRIORITY' | translate }}</label>
        <input nz-input id="terr-priority" type="number" min="1" max="9999" [(ngModel)]="priority" />
      </ng-container>
    </nz-modal>
  `,
})
export class TerritoriesComponent {
  private readonly api = inject(CrmExtensionApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly permissions = inject(PermissionsService);
  protected readonly canWrite = computed(() => this.permissions.canWrite('crm'));

  protected readonly territories = signal<CrmTerritory[]>([]);
  protected readonly quotas = signal<CrmSalesQuota[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly assigning = signal(false);
  protected readonly modalOpen = signal(false);
  protected code = '';
  protected name = '';
  protected countries = '';
  protected priority = 100;

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.api.getTerritories().subscribe({
      next: (res) => this.territories.set(res.data ?? []),
      error: () => this.loading.set(false),
    });
    this.api.getSalesQuotas().subscribe({
      next: (res) => {
        this.quotas.set(res.data ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected percent(quota: CrmSalesQuota): number {
    return Math.min(100, Math.round(Number(quota.attainment?.attainment_percent ?? 0)));
  }

  protected openModal(): void {
    this.code = '';
    this.name = '';
    this.countries = '';
    this.priority = 100;
    this.modalOpen.set(true);
  }

  protected valid(): boolean {
    return this.code.trim().length > 0 && this.name.trim().length > 0;
  }

  /** Two-letter country codes, separated by comma or space. */
  protected parsedCountries(): string[] {
    return this.countries
      .split(/[\s,;]+/)
      .map((country) => country.trim().toUpperCase())
      .filter((country) => country.length === 2);
  }

  protected save(): void {
    const payload: CrmTerritoryRequest = {
      code: this.code.trim(),
      name: this.name.trim(),
      priority: Number(this.priority) || 100,
      criteria: { countries: this.parsedCountries() },
    };
    this.saving.set(true);
    this.api.createTerritory(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.message.success(this.i18n.translate('CRMEXT.COMMON.SAVED'));
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  protected removeTerritory(territory: CrmTerritory): void {
    this.api.deleteTerritory(territory.id).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('CRMEXT.COMMON.DELETED'));
        this.load();
      },
    });
  }

  protected runAssignment(): void {
    this.assigning.set(true);
    this.api.assignTerritories().subscribe({
      next: (res) => {
        this.assigning.set(false);
        this.message.success(this.i18n.translate('CRMEXT.TERRITORIES.RULES_DONE', { assigned: res.data.assigned, unmatched: res.data.unmatched }));
      },
      error: () => this.assigning.set(false),
    });
  }
}
