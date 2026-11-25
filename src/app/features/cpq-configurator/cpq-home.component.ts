import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { CpqConfiguratorApiService, CpqInstance, CpqModelRecord, PermissionsService } from '@core';
import { downloadBlob, PageHeaderComponent, TranslatePipe } from '@shared';
import { CPQ_ADMIN_MODULE, CpqFailure, failureOf, formatMoney } from './cpq-format';

/**
 * Entry of the technical-commercial configurator (Mod 230): the published models to configure and the configured
 * instances with their part number, how many times it was reused and the proposal of each one.
 */
@Component({
  selector: 'app-cpq-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    RouterLink,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzInputModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  template: `
    <app-page-header
      [title]="'CPQ_CONFIGURATOR.TITLE' | translate"
      [subtitle]="'CPQ_CONFIGURATOR.SUBTITLE' | translate"
    >
      <div class="header-actions">
        @if (canManage()) {
          <a nz-button routerLink="/cpq-configurator/models">{{
            'CPQ_CONFIGURATOR.MANAGE_MODELS' | translate
          }}</a>
        }
        <a nz-button nzType="primary" routerLink="/cpq-configurator/configure">{{
          'CPQ_CONFIGURATOR.START' | translate
        }}</a>
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

    <nz-card [nzTitle]="'CPQ_CONFIGURATOR.MODELS' | translate" class="gap">
      <nz-spin [nzSpinning]="loading()">
        @if (models().length === 0 && !loading()) {
          <nz-empty
            [nzNotFoundContent]="'CPQ_CONFIGURATOR.NO_PUBLISHED_MODELS' | translate"
          ></nz-empty>
        }
        <div class="models">
          @for (model of models(); track model.id) {
            <nz-card nzSize="small" [nzTitle]="model.display">
              <nz-tag>{{ model.code }}</nz-tag>
              <nz-tag nzColor="blue">v{{ model.version }}</nz-tag>
              <p>{{ model.description?.[lang()] ?? model.description?.['en'] ?? '' }}</p>
              <a
                nz-button
                nzType="primary"
                [routerLink]="['/cpq-configurator/configure', model.id]"
                >{{ 'CPQ_CONFIGURATOR.CONFIGURE_ACTION' | translate }}</a
              >
            </nz-card>
          }
        </div>
      </nz-spin>
    </nz-card>

    <nz-card [nzTitle]="'CPQ_CONFIGURATOR.INSTANCES' | translate">
      <div class="toolbar">
        <input
          nz-input
          class="search"
          [attr.aria-label]="'CPQ_CONFIGURATOR.SEARCH_PART_NUMBER' | translate"
          [placeholder]="'CPQ_CONFIGURATOR.SEARCH_PART_NUMBER' | translate"
          [ngModel]="search()"
          (ngModelChange)="onSearch($event)"
        />
      </div>
      <nz-table
        [nzData]="instances()"
        nzSize="small"
        [nzShowPagination]="false"
        [nzFrontPagination]="false"
      >
        <thead>
          <tr>
            <th>{{ 'CPQ_CONFIGURATOR.PART_NUMBER' | translate }}</th>
            <th>{{ 'CPQ_CONFIGURATOR.COLUMN.MODEL' | translate }}</th>
            <th>{{ 'CPQ_CONFIGURATOR.COLUMN.CUSTOMER' | translate }}</th>
            <th class="num">{{ 'CPQ_CONFIGURATOR.TOTAL.SELLING_PRICE' | translate }}</th>
            <th class="num">{{ 'CPQ_CONFIGURATOR.TOTAL.LEAD_TIME' | translate }}</th>
            <th class="num">{{ 'CPQ_CONFIGURATOR.COLUMN.REUSED' | translate }}</th>
            <th>{{ 'CPQ_CONFIGURATOR.COLUMN.ACTIONS' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (instance of instances(); track instance.id) {
            <tr>
              <td>
                <code>{{ instance.part_number }}</code>
              </td>
              <td>{{ modelName(instance) }}</td>
              <td>{{ instance.customer_reference }}</td>
              <td class="num">{{ money(instance.selling_price, instance.currency) }}</td>
              <td class="num">{{ instance.lead_time_days }}</td>
              <td class="num">{{ instance.reuse_count }}</td>
              <td>
                <button nz-button nzSize="small" (click)="download(instance)">
                  {{ 'CPQ_CONFIGURATOR.PROPOSAL.DOWNLOAD_PDF' | translate }}
                </button>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (instances().length === 0 && !loading()) {
        <nz-empty [nzNotFoundContent]="'CPQ_CONFIGURATOR.NO_INSTANCES' | translate"></nz-empty>
      }
    </nz-card>
  `,
  styles: `
    .gap {
      display: block;
      margin-bottom: 16px;
    }
    .models {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 12px;
    }
    .toolbar {
      margin-bottom: 12px;
    }
    .search {
      max-width: 320px;
    }
    .num {
      text-align: right;
    }
  `,
})
export class CpqHomeComponent implements OnInit {
  private readonly api = inject(CpqConfiguratorApiService);
  private readonly permissions = inject(PermissionsService);

  readonly models = signal<CpqModelRecord[]>([]);
  readonly instances = signal<CpqInstance[]>([]);
  readonly loading = signal(false);
  readonly failure = signal<CpqFailure | null>(null);
  readonly search = signal('');
  /** Whoever may read the administration of the configurator (managers) gets the link to the definition of the models. */
  readonly canManage = computed(() => this.permissions.canRead(CPQ_ADMIN_MODULE));
  private timer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    void this.load();
  }

  lang(): 'it' | 'en' | 'de' | 'fr' {
    const language = (document.documentElement.lang || 'en').slice(0, 2);

    return (['it', 'en', 'de', 'fr'].includes(language) ? language : 'en') as
      'it' | 'en' | 'de' | 'fr';
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.failure.set(null);
    try {
      const [models, instances] = await Promise.all([
        firstValueFrom(this.api.getModels('published')),
        firstValueFrom(this.api.getInstances({ search: this.search() })),
      ]);
      this.models.set(models.data);
      this.instances.set(instances.data);
    } catch (error) {
      this.failure.set(failureOf(error));
    } finally {
      this.loading.set(false);
    }
  }

  onSearch(value: string): void {
    this.search.set(value);
    if (this.timer !== null) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => void this.load(), 300);
  }

  modelName(instance: CpqInstance): string {
    return this.models().find((model) => model.id === instance.model_id)?.display ?? '';
  }

  money(value: string, currency: string): string {
    return formatMoney(value, currency);
  }

  async download(instance: CpqInstance): Promise<void> {
    try {
      downloadBlob(
        await firstValueFrom(this.api.downloadInstanceProposalPdf(instance.id)),
        `proposal-${instance.part_number}.pdf`,
      );
    } catch (error) {
      this.failure.set(failureOf(error));
    }
  }
}
