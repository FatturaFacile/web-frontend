import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { CpqConfiguratorApiService, CpqModelRecord, CpqRecordPayload } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { CPQ_NEW_MODEL_FIELDS } from './cpq-definition-fields';
import { CpqEntityDrawerComponent } from './cpq-entity-drawer.component';
import { CpqFailure, failureOf, modelStatusColor } from './cpq-format';

/**
 * Every model of the company with its status and version (managers): create a model, open its editor, publish, archive
 * or delete a draft.
 */
@Component({
  selector: 'app-cpq-models',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzPopconfirmModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
    CpqEntityDrawerComponent,
  ],
  template: `
    <app-page-header
      [title]="'CPQ_CONFIGURATOR.MODELS_ADMIN.TITLE' | translate"
      [subtitle]="'CPQ_CONFIGURATOR.MODELS_ADMIN.SUBTITLE' | translate"
    >
      <div class="header-actions">
        <a nz-button routerLink="/cpq-configurator">{{ 'CPQ_CONFIGURATOR.BACK' | translate }}</a>
        <button nz-button nzType="primary" (click)="creating.set(true)">
          {{ 'CPQ_CONFIGURATOR.MODELS_ADMIN.NEW' | translate }}
        </button>
      </div>
    </app-page-header>

    @if (failure(); as problem) {
      <nz-alert
        class="gap"
        nzType="error"
        nzShowIcon
        [nzMessage]="
          problem.key
            ? (problem.key | translate)
            : (problem.detail ?? ('CPQ_CONFIGURATOR.ERR.GENERIC' | translate))
        "
      ></nz-alert>
    }

    <nz-card>
      <nz-spin [nzSpinning]="loading()">
        <nz-table
          [nzData]="models()"
          nzSize="small"
          [nzShowPagination]="false"
          [nzFrontPagination]="false"
        >
          <thead>
            <tr>
              <th>{{ 'CPQ_CONFIGURATOR.FIELD.CODE' | translate }}</th>
              <th>{{ 'CPQ_CONFIGURATOR.FIELD.NAME' | translate }}</th>
              <th>{{ 'CPQ_CONFIGURATOR.FIELD.PART_NUMBER_PREFIX' | translate }}</th>
              <th>{{ 'CPQ_CONFIGURATOR.COLUMN.STATUS' | translate }}</th>
              <th class="num">{{ 'CPQ_CONFIGURATOR.COLUMN.VERSION' | translate }}</th>
              <th>{{ 'CPQ_CONFIGURATOR.COLUMN.ACTIONS' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (model of models(); track model.id) {
              <tr>
                <td>{{ model.code }}</td>
                <td>{{ model.display }}</td>
                <td>{{ model.part_number_prefix }}</td>
                <td>
                  <nz-tag [nzColor]="statusColor(model.status)">{{
                    'CPQ_CONFIGURATOR.STATUS.' + model.status.toUpperCase() | translate
                  }}</nz-tag>
                </td>
                <td class="num">{{ model.version }}</td>
                <td class="actions">
                  <a
                    nz-button
                    nzSize="small"
                    [routerLink]="['/cpq-configurator/models', model.id]"
                    >{{ 'CPQ_CONFIGURATOR.EDIT' | translate }}</a
                  >
                  @if (model.status === 'published') {
                    <a
                      nz-button
                      nzSize="small"
                      [routerLink]="['/cpq-configurator/configure', model.id]"
                      >{{ 'CPQ_CONFIGURATOR.CONFIGURE_ACTION' | translate }}</a
                    >
                  }
                  @if (model.status === 'draft') {
                    <button
                      nz-button
                      nzSize="small"
                      nzType="primary"
                      nz-popconfirm
                      [nzPopconfirmTitle]="'CPQ_CONFIGURATOR.EDITOR.CONFIRM_PUBLISH' | translate"
                      (nzOnConfirm)="run(model, 'publish')"
                    >
                      {{ 'CPQ_CONFIGURATOR.EDITOR.PUBLISH' | translate }}
                    </button>
                  }
                  @if (model.status !== 'archived') {
                    <button
                      nz-button
                      nzSize="small"
                      nz-popconfirm
                      [nzPopconfirmTitle]="'CPQ_CONFIGURATOR.EDITOR.CONFIRM_ARCHIVE' | translate"
                      (nzOnConfirm)="run(model, 'archive')"
                    >
                      {{ 'CPQ_CONFIGURATOR.EDITOR.ARCHIVE' | translate }}
                    </button>
                  }
                  <button
                    nz-button
                    nzSize="small"
                    nzDanger
                    nz-popconfirm
                    [nzPopconfirmTitle]="'CPQ_CONFIGURATOR.CONFIRM_DELETE' | translate"
                    (nzOnConfirm)="run(model, 'delete')"
                  >
                    {{ 'CPQ_CONFIGURATOR.DELETE' | translate }}
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-spin>
    </nz-card>

    <app-cpq-entity-drawer
      [open]="creating()"
      [title]="'CPQ_CONFIGURATOR.DRAWER.MODEL_NEW' | translate"
      [fields]="newFields"
      [defaults]="{
        currency: 'EUR',
        base_price: 0,
        base_cost: 0,
        base_lead_time_days: 0,
        max_discount_percent: 100,
      }"
      [saving]="saving()"
      [failure]="failure()"
      (saved)="create($event)"
      (closed)="creating.set(false)"
    ></app-cpq-entity-drawer>
  `,
  styles: `
    .gap {
      display: block;
      margin-bottom: 12px;
    }
    .actions {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .num {
      text-align: right;
    }
  `,
})
export class CpqModelsComponent implements OnInit {
  private readonly api = inject(CpqConfiguratorApiService);
  private readonly router = inject(Router);

  readonly newFields = CPQ_NEW_MODEL_FIELDS;
  readonly models = signal<CpqModelRecord[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly creating = signal(false);
  readonly failure = signal<CpqFailure | null>(null);

  ngOnInit(): void {
    void this.load();
  }

  statusColor(status: CpqModelRecord['status']): string {
    return modelStatusColor(status);
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.models.set((await firstValueFrom(this.api.getModels())).data);
    } catch (error) {
      this.failure.set(failureOf(error));
    } finally {
      this.loading.set(false);
    }
  }

  async create(payload: CpqRecordPayload): Promise<void> {
    this.saving.set(true);
    this.failure.set(null);
    try {
      const response = await firstValueFrom(this.api.createModel(payload));
      this.creating.set(false);
      await this.router.navigate(['/cpq-configurator/models', response.data.id]);
    } catch (error) {
      this.failure.set(failureOf(error));
    } finally {
      this.saving.set(false);
    }
  }

  async run(model: CpqModelRecord, action: 'publish' | 'archive' | 'delete'): Promise<void> {
    this.failure.set(null);
    try {
      if (action === 'publish') {
        await firstValueFrom(this.api.publishModel(model.id));
      } else if (action === 'archive') {
        await firstValueFrom(this.api.archiveModel(model.id));
      } else {
        await firstValueFrom(this.api.deleteModel(model.id));
      }
      await this.load();
    } catch (error) {
      this.failure.set(failureOf(error));
    }
  }
}
