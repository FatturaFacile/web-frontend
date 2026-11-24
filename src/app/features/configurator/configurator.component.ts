import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  ConfiguratorApiService,
  ConfiguratorConfiguration,
  ConfiguratorModel,
  I18nService,
  PermissionsService,
} from '@core';
import { ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import {
  configurationStatusColor,
  formatMoney,
  modelStatusColor,
} from './configurator-format';

const CONFIGURATION_STATUSES = ['draft', 'validated', 'pending_approval', 'approved', 'rejected', 'converted'] as const;

@Component({
  selector: 'app-configurator',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    ModalActionsDirective,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  template: `
    <app-page-header [title]="'CONFIGURATOR.TITLE' | translate" [subtitle]="'CONFIGURATOR.SUBTITLE' | translate">
      <div class="header-actions">
        <a nz-button routerLink="/configurator/configure">
          <span nz-icon nzType="setting"></span>
          {{ 'CONFIGURATOR.NEW_CONFIGURATION' | translate }}
        </a>
        @if (canWrite()) {
          <button nz-button nzType="primary" (click)="openModelModal()">
            <span nz-icon nzType="plus"></span>
            {{ 'CONFIGURATOR.NEW_MODEL' | translate }}
          </button>
        }
      </div>
    </app-page-header>

    <nz-card>
      <nz-tabs [(nzSelectedIndex)]="selectedTab">
        <nz-tab [nzTitle]="'CONFIGURATOR.TAB_MODELS' | translate">
          <nz-table #modelsTable [nzData]="models()" [nzLoading]="modelsLoading()" nzSize="middle" [nzShowPagination]="models().length > 10">
            <thead>
              <tr>
                <th>{{ 'CONFIGURATOR.CODE' | translate }}</th>
                <th>{{ 'CONFIGURATOR.NAME' | translate }}</th>
                <th>{{ 'CONFIGURATOR.STATUS' | translate }}</th>
                <th>{{ 'CONFIGURATOR.VERSION' | translate }}</th>
                <th>{{ 'CONFIGURATOR.BASE_PRICE' | translate }}</th>
                <th>{{ 'CONFIGURATOR.MIN_MARGIN' | translate }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (model of modelsTable.data; track model.id) {
                <tr>
                  <td>
                    <a [routerLink]="['/configurator/models', model.id]">{{ model.code }}</a>
                  </td>
                  <td>{{ model.name }}</td>
                  <td>
                    <nz-tag [nzColor]="modelStatusColor(model.status)">{{ 'CONFIGURATOR.MODEL_STATUS_' + model.status.toUpperCase() | translate }}</nz-tag>
                  </td>
                  <td>{{ model.version }}</td>
                  <td>{{ money(model.base_price, model.currency) }}</td>
                  <td>{{ model.min_margin_percent ? model.min_margin_percent + ' %' : '-' }}</td>
                  <td class="row-actions">
                    <a nz-button nzSize="small" [routerLink]="['/configurator/models', model.id]">{{ 'CONFIGURATOR.EDIT_MODEL' | translate }}</a>
                    @if (model.status === 'published') {
                      <a nz-button nzSize="small" nzType="primary" routerLink="/configurator/configure" [queryParams]="{ model: model.id }">
                        {{ 'CONFIGURATOR.CONFIGURE' | translate }}
                      </a>
                    }
                    @if (canWrite() && model.status !== 'archived') {
                      <button nz-button nzSize="small" nz-popconfirm [nzPopconfirmTitle]="'CONFIGURATOR.CONFIRM_ARCHIVE' | translate" (nzOnConfirm)="archiveModel(model)">
                        {{ 'CONFIGURATOR.ARCHIVE' | translate }}
                      </button>
                    }
                    @if (canWrite() && model.status === 'draft') {
                      <button nz-button nzSize="small" nzDanger nz-popconfirm [nzPopconfirmTitle]="'CONFIGURATOR.CONFIRM_DELETE' | translate" (nzOnConfirm)="deleteModel(model)">
                        {{ 'CONFIGURATOR.DELETE' | translate }}
                      </button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7"><nz-empty [nzNotFoundContent]="'CONFIGURATOR.NO_MODELS' | translate"></nz-empty></td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-tab>

        <nz-tab [nzTitle]="'CONFIGURATOR.TAB_CONFIGURATIONS' | translate">
          <div class="toolbar">
            <nz-select
              class="status-filter"
              nzAllowClear
              [nzPlaceHolder]="'CONFIGURATOR.FILTER_STATUS' | translate"
              [ngModel]="statusFilter()"
              (ngModelChange)="setStatusFilter($event)"
            >
              @for (status of statuses; track status) {
                <nz-option [nzValue]="status" [nzLabel]="'CONFIGURATOR.CONFIG_STATUS_' + status.toUpperCase() | translate"></nz-option>
              }
            </nz-select>
          </div>
          <nz-table #configurationsTable [nzData]="configurations()" [nzLoading]="configurationsLoading()" nzSize="middle" [nzShowPagination]="configurations().length > 10">
            <thead>
              <tr>
                <th>{{ 'CONFIGURATOR.NUMBER' | translate }}</th>
                <th>{{ 'CONFIGURATOR.MODEL' | translate }}</th>
                <th>{{ 'CONFIGURATOR.CUSTOMER' | translate }}</th>
                <th>{{ 'CONFIGURATOR.STATUS' | translate }}</th>
                <th>{{ 'CONFIGURATOR.TOTAL_NET' | translate }}</th>
                <th>{{ 'CONFIGURATOR.MARGIN' | translate }}</th>
                <th>{{ 'CONFIGURATOR.QUOTE' | translate }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (configuration of configurationsTable.data; track configuration.id) {
                <tr>
                  <td>
                    <a routerLink="/configurator/configure" [queryParams]="{ configuration: configuration.id }">{{ configuration.number }}</a>
                  </td>
                  <td>{{ configuration.model?.name }}</td>
                  <td>{{ configuration.contact?.name || '-' }}</td>
                  <td>
                    <nz-tag [nzColor]="configurationStatusColor(configuration.status)">{{ 'CONFIGURATOR.CONFIG_STATUS_' + configuration.status.toUpperCase() | translate }}</nz-tag>
                    @if (configuration.requires_approval && configuration.status !== 'converted') {
                      <nz-tag nzColor="gold">{{ 'CONFIGURATOR.BELOW_MARGIN' | translate }}</nz-tag>
                    }
                  </td>
                  <td>{{ money(configuration.total_net, configuration.currency) }}</td>
                  <td>{{ configuration.margin_percent ? configuration.margin_percent + ' %' : '-' }}</td>
                  <td>{{ configuration.quote_number || '-' }}</td>
                  <td class="row-actions">
                    <a nz-button nzSize="small" routerLink="/configurator/configure" [queryParams]="{ configuration: configuration.id }">{{ 'CONFIGURATOR.OPEN' | translate }}</a>
                    @if (canWrite() && (configuration.status === 'draft' || configuration.status === 'rejected')) {
                      <button nz-button nzSize="small" nzDanger nz-popconfirm [nzPopconfirmTitle]="'CONFIGURATOR.CONFIRM_DELETE' | translate" (nzOnConfirm)="deleteConfiguration(configuration)">
                        {{ 'CONFIGURATOR.DELETE' | translate }}
                      </button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="8"><nz-empty [nzNotFoundContent]="'CONFIGURATOR.NO_CONFIGURATIONS' | translate"></nz-empty></td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-tab>
      </nz-tabs>
    </nz-card>

    <nz-modal appModalActions
      [nzVisible]="modelModalVisible()"
      [nzTitle]="'CONFIGURATOR.NEW_MODEL' | translate"
      (nzOnCancel)="modelModalVisible.set(false)"
      (nzOnOk)="createModel()"
      okAction="create"
      [nzOkDisabled]="modelForm.invalid"
      nzWidth="600px"
    >
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="modelForm" nzLayout="vertical">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="model-code">{{ 'CONFIGURATOR.CODE' | translate }}</nz-form-label>
            <nz-form-control>
              <input nz-input id="model-code" formControlName="code" maxlength="40" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="model-name">{{ 'CONFIGURATOR.NAME' | translate }}</nz-form-label>
            <nz-form-control>
              <input nz-input id="model-name" formControlName="name" maxlength="190" />
            </nz-form-control>
          </nz-form-item>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzFor="model-price">{{ 'CONFIGURATOR.BASE_PRICE' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-input-number id="model-price" formControlName="base_price" [nzMin]="0" [nzStep]="10" [nzPrecision]="2"></nz-input-number>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="model-cost">{{ 'CONFIGURATOR.BASE_COST' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-input-number id="model-cost" formControlName="base_cost" [nzMin]="0" [nzStep]="10" [nzPrecision]="2"></nz-input-number>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="model-currency">{{ 'CONFIGURATOR.CURRENCY' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select id="model-currency" formControlName="currency">
                  <nz-option nzValue="EUR" nzLabel="EUR"></nz-option>
                  <nz-option nzValue="CHF" nzLabel="CHF"></nz-option>
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzFor="model-tax">{{ 'CONFIGURATOR.TAX_RATE' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-input-number id="model-tax" formControlName="tax_rate" [nzMin]="0" [nzMax]="100" [nzPrecision]="2"></nz-input-number>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="model-margin">{{ 'CONFIGURATOR.MIN_MARGIN' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-input-number id="model-margin" formControlName="min_margin_percent" [nzMin]="0" [nzMax]="99.99" [nzPrecision]="2"></nz-input-number>
              </nz-form-control>
            </nz-form-item>
          </div>
        </form>
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .header-actions { display: flex; gap: 8px; }
    .toolbar { margin-bottom: 12px; }
    .status-filter { min-width: 220px; }
    .row-actions { display: flex; gap: 6px; flex-wrap: wrap; }
    .form-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
    nz-input-number { width: 100%; }
  `,
})
export class ConfiguratorComponent implements OnInit {
  private readonly api = inject(ConfiguratorApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly permissions = inject(PermissionsService);

  readonly statuses = CONFIGURATION_STATUSES;
  readonly modelStatusColor = modelStatusColor;
  readonly configurationStatusColor = configurationStatusColor;
  readonly money = formatMoney;

  readonly canWrite = computed(() => this.permissions.canWrite('configurator'));
  selectedTab = 0;

  readonly models = signal<ConfiguratorModel[]>([]);
  readonly modelsLoading = signal(false);
  readonly configurations = signal<ConfiguratorConfiguration[]>([]);
  readonly configurationsLoading = signal(false);
  readonly statusFilter = signal<string | null>(null);
  readonly modelModalVisible = signal(false);

  readonly modelForm = this.fb.group({
    code: ['', [Validators.required, Validators.maxLength(40), Validators.pattern(/^[A-Za-z0-9._-]+$/)]],
    name: ['', [Validators.required, Validators.maxLength(190)]],
    base_price: [0, [Validators.min(0)]],
    base_cost: [0, [Validators.min(0)]],
    currency: ['EUR'],
    tax_rate: [22, [Validators.min(0), Validators.max(100)]],
    min_margin_percent: this.fb.control<number | null>(null, [Validators.min(0), Validators.max(99.99)]),
  });

  ngOnInit(): void {
    this.loadModels();
    this.loadConfigurations();
  }

  loadModels(): void {
    this.modelsLoading.set(true);
    this.api
      .getModels()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.models.set(response.data);
          this.modelsLoading.set(false);
        },
        error: () => this.modelsLoading.set(false),
      });
  }

  loadConfigurations(): void {
    this.configurationsLoading.set(true);
    this.api
      .getConfigurations({ status: this.statusFilter() ?? undefined })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.configurations.set(response.data);
          this.configurationsLoading.set(false);
        },
        error: () => this.configurationsLoading.set(false),
      });
  }

  setStatusFilter(status: string | null): void {
    this.statusFilter.set(status);
    this.loadConfigurations();
  }

  openModelModal(): void {
    this.modelForm.reset({ code: '', name: '', base_price: 0, base_cost: 0, currency: 'EUR', tax_rate: 22, min_margin_percent: null });
    this.modelModalVisible.set(true);
  }

  createModel(): void {
    if (this.modelForm.invalid) {
      this.modelForm.markAllAsTouched();
      return;
    }

    this.api.createModel(this.modelForm.getRawValue()).subscribe({
      next: (response) => {
        this.message.success(this.i18n.translate('CONFIGURATOR.MODEL_CREATED'));
        this.modelModalVisible.set(false);
        void this.router.navigate(['/configurator/models', response.data.id]);
      },
      error: (error) => this.fail(error),
    });
  }

  archiveModel(model: ConfiguratorModel): void {
    this.api.archiveModel(model.id).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('CONFIGURATOR.MODEL_ARCHIVED'));
        this.loadModels();
      },
      error: (error) => this.fail(error),
    });
  }

  deleteModel(model: ConfiguratorModel): void {
    this.api.deleteModel(model.id).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('CONFIGURATOR.MODEL_DELETED'));
        this.loadModels();
      },
      error: (error) => this.fail(error),
    });
  }

  deleteConfiguration(configuration: ConfiguratorConfiguration): void {
    this.api.deleteConfiguration(configuration.id).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('CONFIGURATOR.CONFIGURATION_DELETED'));
        this.loadConfigurations();
      },
      error: (error) => this.fail(error),
    });
  }

  private fail(error: { error?: { message?: string } }): void {
    this.message.error(error?.error?.message ?? this.i18n.translate('CONFIGURATOR.ACTION_ERROR'));
  }
}
