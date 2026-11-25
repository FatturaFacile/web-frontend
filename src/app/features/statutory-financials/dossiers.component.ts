import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  PermissionsService,
  SF_STANDARDS,
  SF_STATUSES,
  SfDossierSummary,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { DossiersStore } from './dossiers.store';
import {
  canDelete,
  formatAmount,
  jurisdictionOf,
  scaleOfMode,
  SfOutcome,
  standardColor,
  statusColor,
  STATUTORY_FINANCIALS_MODULE,
  validationColor,
  validationKey,
} from './statutory-financials.util';

/** The dossiers of the tenant: filters, the table, creation and deletion of the ones not yet locked. */
@Component({
  selector: 'app-sf-dossiers',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzEmptyModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    RouterLink,
    TranslatePipe,
  ],
  providers: [DossiersStore],
  styleUrl: './statutory-financials.scss',
  template: `
    <app-page-header [title]="'statutoryFinancials.title' | translate"></app-page-header>

    <div class="toolbar" role="search">
      <label class="field" for="sf-filter-status">
        <span>{{ 'statutoryFinancials.field.status' | translate }}</span>
        <nz-select
          nzId="sf-filter-status"
          nzAllowClear
          [nzPlaceHolder]="'statutoryFinancials.action.all' | translate"
          [ngModel]="store.filters().status ?? null"
          (ngModelChange)="store.setFilters({ status: $event ?? undefined })"
        >
          @for (status of statuses; track status) {
            <nz-option
              [nzValue]="status"
              [nzLabel]="'statutoryFinancials.status.' + status | translate"
            ></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="sf-filter-standard">
        <span>{{ 'statutoryFinancials.field.standard' | translate }}</span>
        <nz-select
          nzId="sf-filter-standard"
          nzAllowClear
          [nzPlaceHolder]="'statutoryFinancials.action.all' | translate"
          [ngModel]="store.filters().standard ?? null"
          (ngModelChange)="store.setFilters({ standard: $event ?? undefined })"
        >
          @for (standard of standards; track standard) {
            <nz-option
              [nzValue]="standard"
              [nzLabel]="'statutoryFinancials.standard.' + standard | translate"
            ></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="sf-filter-year">
        <span>{{ 'statutoryFinancials.field.fiscalYear' | translate }}</span>
        <nz-select
          nzId="sf-filter-year"
          nzAllowClear
          [nzPlaceHolder]="'statutoryFinancials.action.all' | translate"
          [ngModel]="store.filters().fiscal_year_id ?? null"
          (ngModelChange)="store.setFilters({ fiscal_year_id: $event ?? undefined })"
        >
          @for (year of store.fiscalYears(); track year.id) {
            <nz-option [nzValue]="year.id" [nzLabel]="year.year_code"></nz-option>
          }
        </nz-select>
      </label>
      <span class="spacer"></span>
      @if (canWrite()) {
        <a nz-button nzType="primary" routerLink="/statutory-financials/new">
          {{ 'statutoryFinancials.action.newDossier' | translate }}
        </a>
      }
    </div>

    @if (store.error(); as error) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        [nzMessage]="error | translate"
      ></nz-alert>
    }
    @if (failure(); as outcome) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        nzCloseable
        [nzMessage]="
          outcome.errorKey ?? 'statutoryFinancials.error.generic' | translate: outcome.params
        "
        (nzOnClose)="failure.set(null)"
      ></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      <nz-table
        #table
        nzSize="small"
        [nzData]="store.dossiers()"
        [nzTotal]="store.total()"
        [nzPageIndex]="store.page()"
        [nzPageSize]="store.pageSize()"
        [nzFrontPagination]="false"
        [nzScroll]="{ x: '960px' }"
        (nzPageIndexChange)="store.setPage($event)"
      >
        <thead>
          <tr>
            <th scope="col">{{ 'statutoryFinancials.field.title' | translate }}</th>
            <th scope="col">{{ 'statutoryFinancials.field.fiscalYear' | translate }}</th>
            <th scope="col">{{ 'statutoryFinancials.field.standard' | translate }}</th>
            <th scope="col">{{ 'statutoryFinancials.field.status' | translate }}</th>
            <th scope="col">{{ 'statutoryFinancials.field.validation' | translate }}</th>
            <th scope="col" class="num">{{ 'statutoryFinancials.field.netResult' | translate }}</th>
            <th scope="col">{{ 'statutoryFinancials.field.generatedAt' | translate }}</th>
            <th scope="col">
              <span class="visually-hidden">{{
                'statutoryFinancials.field.actions' | translate
              }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          @for (dossier of table.data; track dossier.id) {
            <tr>
              <th scope="row">
                <a [routerLink]="['/statutory-financials', dossier.id]">{{ dossier.title }}</a>
              </th>
              <td>{{ dossier.fiscal_year?.year_code }}</td>
              <td>
                <nz-tag [nzColor]="standardColor(dossier.accounting_standard)">
                  {{ 'statutoryFinancials.standard.' + dossier.accounting_standard | translate }}
                </nz-tag>
              </td>
              <td>
                <nz-tag [nzColor]="statusColor(dossier.status)">
                  {{ 'statutoryFinancials.status.' + dossier.status | translate }}
                </nz-tag>
              </td>
              <td>
                <nz-tag [nzColor]="validationColor(dossier.validation_status)">
                  {{
                    'statutoryFinancials.validation.' + validationKey(dossier.validation_status)
                      | translate
                  }}
                </nz-tag>
              </td>
              <td class="num">{{ net(dossier) }}</td>
              <td>{{ dossier.generated_at ? dossier.generated_at.slice(0, 10) : '' }}</td>
              <td>
                <button nz-button nzSize="small" type="button" (click)="open(dossier.id)">
                  {{ 'statutoryFinancials.action.open' | translate }}
                </button>
                @if (canWrite() && deletable(dossier.status)) {
                  <button
                    nz-button
                    nzSize="small"
                    nzDanger
                    type="button"
                    nz-popconfirm
                    [nzPopconfirmTitle]="'statutoryFinancials.confirm.delete' | translate"
                    [nzOkText]="'statutoryFinancials.action.confirm' | translate"
                    [nzCancelText]="'statutoryFinancials.action.cancel' | translate"
                    (nzOnConfirm)="remove(dossier.id)"
                  >
                    {{ 'statutoryFinancials.action.delete' | translate }}
                  </button>
                }
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="8">
                <nz-empty
                  [nzNotFoundContent]="'statutoryFinancials.empty.dossiers' | translate"
                ></nz-empty>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-spin>
  `,
})
export class DossiersComponent implements OnInit {
  protected readonly store = inject(DossiersStore);
  private readonly router = inject(Router);
  private readonly permissions = inject(PermissionsService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly statuses = SF_STATUSES;
  protected readonly standards = SF_STANDARDS;
  protected readonly failure = signal<SfOutcome | null>(null);

  protected readonly statusColor = statusColor;
  protected readonly standardColor = standardColor;
  protected readonly validationColor = validationColor;
  protected readonly validationKey = validationKey;
  protected readonly deletable = canDelete;

  ngOnInit(): void {
    void this.store.init(this.i18n.currentLanguage());
  }

  protected canWrite(): boolean {
    return this.permissions.canWrite(STATUTORY_FINANCIALS_MODULE);
  }

  protected net(dossier: SfDossierSummary): string {
    return formatAmount(
      dossier.net_result,
      jurisdictionOf(dossier.accounting_standard),
      scaleOfMode(dossier.rounding_to_unit_mode),
    );
  }

  protected open(id: string): void {
    void this.router.navigate(['/statutory-financials', id]);
  }

  protected async remove(id: string): Promise<void> {
    const outcome = await this.store.remove(id);
    this.failure.set(outcome.ok ? null : outcome);
    if (outcome.ok) {
      this.message.success(this.i18n.instant('statutoryFinancials.message.deleted'));
    }
  }
}
