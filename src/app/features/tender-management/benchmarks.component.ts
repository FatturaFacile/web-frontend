import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { TND_JURISDICTIONS, TndBenchmark, TndJurisdiction } from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { BenchmarksStore } from './benchmarks.store';
import { jurisdictionBadge, jurisdictionColor } from './tender-management.util';

/**
 * Competitor and award history (Mod 169): who won what, at which discount and with which scores, by contracting authority and
 * CPV, with the statistics that feed the offer simulator and the requests to access the records (accesso agli atti).
 */
@Component({
  selector: 'app-tnd-benchmarks',
  imports: [
    FormsModule,
    MoneyPipe,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
    NzEmptyModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSpinModule,
    NzStatisticModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    ReactiveFormsModule,
    TranslatePipe,
  ],
  providers: [BenchmarksStore],
  template: `
    <app-page-header [title]="'PAGE_TITLE.TENDER_MANAGEMENT_BENCHMARKS' | translate"></app-page-header>

    <div class="toolbar">
      <label class="field" for="tnd-bm-search">
        <span>{{ 'tenderManagement.field.search' | translate }}</span>
        <input nz-input id="tnd-bm-search" maxlength="60" [ngModel]="q()" (ngModelChange)="q.set($event)" (keyup.enter)="apply()" />
      </label>
      <label class="field" for="tnd-bm-authority">
        <span>{{ 'tenderManagement.field.contractingAuthority' | translate }}</span>
        <input nz-input id="tnd-bm-authority" maxlength="120" [ngModel]="authority()" (ngModelChange)="authority.set($event)" (keyup.enter)="apply()" />
      </label>
      <label class="field" for="tnd-bm-cpv">
        <span>CPV</span>
        <input nz-input id="tnd-bm-cpv" maxlength="12" [ngModel]="cpv()" (ngModelChange)="cpv.set($event)" (keyup.enter)="apply()" />
      </label>
      <label class="field" for="tnd-bm-jurisdiction">
        <span>{{ 'tenderManagement.field.jurisdiction' | translate }}</span>
        <nz-select nzId="tnd-bm-jurisdiction" nzAllowClear [nzPlaceHolder]="'tenderManagement.action.all' | translate" [ngModel]="store.filters().jurisdiction ?? null" (ngModelChange)="store.setFilters({ jurisdiction: $event ?? undefined })">
          @for (value of jurisdictions; track value) {
            <nz-option [nzValue]="value" [nzLabel]="'tenderManagement.enum.jurisdiction.' + value | translate"></nz-option>
          }
        </nz-select>
      </label>
      <label nz-checkbox [ngModel]="!!store.filters().winners_only" (ngModelChange)="store.setFilters({ winners_only: $event })">
        {{ 'tenderManagement.filter.winnersOnly' | translate }}
      </label>
      <button nz-button type="button" (click)="apply()">{{ 'tenderManagement.action.search' | translate }}</button>
      <button nz-button nzType="primary" type="button" (click)="openForm(null)">{{ 'tenderManagement.action.addAward' | translate }}</button>
    </div>

    @if (store.error(); as error) {
      <nz-alert nzType="error" nzShowIcon [nzMessage]="error | translate"></nz-alert>
    }

    @if (store.statistics(); as stats) {
      <nz-card class="stats" [nzTitle]="'tenderManagement.stats.title' | translate">
        <div class="kpis">
          <nz-statistic [nzTitle]="'tenderManagement.stats.count' | translate" [nzValue]="stats.count"></nz-statistic>
          <nz-statistic [nzTitle]="'tenderManagement.stats.averageDiscount' | translate" [nzValue]="(stats.average_discount ?? '–') + ' %'"></nz-statistic>
          <nz-statistic [nzTitle]="'tenderManagement.stats.medianDiscount' | translate" [nzValue]="(stats.median_discount ?? '–') + ' %'"></nz-statistic>
          <nz-statistic [nzTitle]="'tenderManagement.stats.maxDiscount' | translate" [nzValue]="(stats.max_discount ?? '–') + ' %'"></nz-statistic>
          <nz-statistic [nzTitle]="'tenderManagement.stats.averageTechnical' | translate" [nzValue]="stats.average_technical_score ?? '–'"></nz-statistic>
          <nz-statistic [nzTitle]="'tenderManagement.stats.averageEconomic' | translate" [nzValue]="stats.average_economic_score ?? '–'"></nz-statistic>
          <nz-statistic [nzTitle]="'tenderManagement.stats.averageTotal' | translate" [nzValue]="stats.average_total_score ?? '–'"></nz-statistic>
        </div>
      </nz-card>
    }

    <nz-spin [nzSpinning]="store.loading()">
      <nz-table
        #table
        nzSize="small"
        [nzData]="store.items()"
        [nzTotal]="store.total()"
        [nzPageIndex]="store.page()"
        [nzPageSize]="store.pageSize()"
        [nzFrontPagination]="false"
        (nzPageIndexChange)="store.setPage($event)"
      >
        <thead>
          <tr>
            <th scope="col">{{ 'tenderManagement.field.competitor' | translate }}</th>
            <th scope="col">{{ 'tenderManagement.field.contractingAuthority' | translate }}</th>
            <th scope="col">CPV</th>
            <th scope="col">{{ 'tenderManagement.field.awardDate' | translate }}</th>
            <th scope="col" class="num">{{ 'tenderManagement.field.awardedAmount' | translate }}</th>
            <th scope="col" class="num">{{ 'tenderManagement.field.discount' | translate }}</th>
            <th scope="col" class="num">{{ 'tenderManagement.field.technicalScore' | translate }}</th>
            <th scope="col" class="num">{{ 'tenderManagement.field.economicScore' | translate }}</th>
            <th scope="col" class="num">{{ 'tenderManagement.field.totalScore' | translate }}</th>
            <th scope="col">{{ 'tenderManagement.field.outcome' | translate }}</th>
            <th scope="col"></th>
          </tr>
        </thead>
        <tbody>
          @for (item of table.data; track item.id) {
            <tr>
              <th scope="row">
                {{ item.competitor_name }}
                @if (item.jurisdiction) {
                  <nz-tag [nzColor]="jurisdictionColor(item.jurisdiction)">{{ badge(item.jurisdiction) }}</nz-tag>
                }
              </th>
              <td>{{ item.contracting_authority_name }}</td>
              <td>{{ item.cpv_code }}</td>
              <td>{{ item.award_date }}</td>
              <td class="num">{{ item.awarded_amount | money }}</td>
              <td class="num">{{ item.offered_discount_percentage ?? '–' }}</td>
              <td class="num">{{ item.technical_score ?? '–' }}</td>
              <td class="num">{{ item.economic_score ?? '–' }}</td>
              <td class="num">{{ item.total_score ?? '–' }}</td>
              <td>
                <nz-tag [nzColor]="item.is_winner ? 'green' : 'default'">
                  {{ (item.is_winner ? 'tenderManagement.stats.winner' : 'tenderManagement.stats.participant') | translate }}
                </nz-tag>
              </td>
              <td>
                <button nz-button nzSize="small" type="button" (click)="openForm(item)">{{ 'tenderManagement.action.edit' | translate }}</button>
                <button nz-button nzSize="small" nzDanger type="button" nz-popconfirm [nzPopconfirmTitle]="'tenderManagement.confirm.deleteAward' | translate" (nzOnConfirm)="store.remove(item.id)">
                  {{ 'tenderManagement.action.remove' | translate }}
                </button>
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="11"><nz-empty [nzNotFoundContent]="'tenderManagement.empty.benchmarks' | translate"></nz-empty></td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-spin>

    <nz-modal
      [nzVisible]="formOpen()"
      nzWidth="720px"
      [nzTitle]="'tenderManagement.action.addAward' | translate"
      [nzOkText]="'tenderManagement.action.save' | translate"
      [nzCancelText]="'tenderManagement.action.cancel' | translate"
      [nzOkLoading]="store.saving()"
      [nzOkDisabled]="form.invalid"
      (nzOnOk)="save()"
      (nzOnCancel)="formOpen.set(false)"
    >
      <ng-container *nzModalContent>
        @if (formError(); as key) {
          <nz-alert nzType="error" nzShowIcon [nzMessage]="key | translate"></nz-alert>
        }
        <form [formGroup]="form" class="form">
          <label for="tnd-bf-competitor">{{ 'tenderManagement.field.competitor' | translate }}</label>
          <input nz-input id="tnd-bf-competitor" formControlName="competitor_name" maxlength="200" />
          <label for="tnd-bf-authority">{{ 'tenderManagement.field.contractingAuthority' | translate }}</label>
          <input nz-input id="tnd-bf-authority" formControlName="contracting_authority_name" maxlength="200" />
          <label for="tnd-bf-cpv">CPV</label>
          <input nz-input id="tnd-bf-cpv" formControlName="cpv_code" maxlength="12" />
          <label for="tnd-bf-jurisdiction">{{ 'tenderManagement.field.jurisdiction' | translate }}</label>
          <nz-select nzId="tnd-bf-jurisdiction" nzAllowClear formControlName="jurisdiction">
            @for (value of jurisdictions; track value) {
              <nz-option [nzValue]="value" [nzLabel]="'tenderManagement.enum.jurisdiction.' + value | translate"></nz-option>
            }
          </nz-select>
          <label for="tnd-bf-date">{{ 'tenderManagement.field.awardDate' | translate }}</label>
          <input nz-input id="tnd-bf-date" type="date" formControlName="award_date" />
          <label for="tnd-bf-base">{{ 'tenderManagement.field.baseAuctionAmount' | translate }}</label>
          <input nz-input id="tnd-bf-base" type="number" min="0" step="0.01" formControlName="base_auction_amount" />
          <label for="tnd-bf-amount">{{ 'tenderManagement.field.awardedAmount' | translate }}</label>
          <input nz-input id="tnd-bf-amount" type="number" min="0" step="0.01" formControlName="awarded_amount" />
          <label for="tnd-bf-discount">{{ 'tenderManagement.field.discount' | translate }}</label>
          <input nz-input id="tnd-bf-discount" type="number" min="0" max="100" step="0.0001" formControlName="offered_discount_percentage" />
          <label for="tnd-bf-tech">{{ 'tenderManagement.field.technicalScore' | translate }}</label>
          <input nz-input id="tnd-bf-tech" type="number" min="0" step="0.01" formControlName="technical_score" />
          <label for="tnd-bf-econ">{{ 'tenderManagement.field.economicScore' | translate }}</label>
          <input nz-input id="tnd-bf-econ" type="number" min="0" step="0.01" formControlName="economic_score" />
          <label for="tnd-bf-source">{{ 'tenderManagement.field.source' | translate }}</label>
          <input nz-input id="tnd-bf-source" formControlName="source" maxlength="120" />
          <label nz-checkbox formControlName="is_winner">{{ 'tenderManagement.stats.winner' | translate }}</label>
        </form>
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: flex-end;
      margin-bottom: 16px;
    }
    .field {
      display: flex;
      flex-direction: column;
      min-width: 160px;
      gap: 4px;
    }
    .stats {
      margin-bottom: 16px;
    }
    .kpis {
      display: flex;
      flex-wrap: wrap;
      gap: 32px;
    }
    .num {
      text-align: right;
    }
    .form {
      display: grid;
      gap: 6px;
    }
  `,
})
export class BenchmarksComponent implements OnInit {
  protected readonly store = inject(BenchmarksStore);
  private readonly fb = inject(FormBuilder);

  protected readonly jurisdictions: readonly TndJurisdiction[] = TND_JURISDICTIONS;
  protected readonly q = signal('');
  protected readonly authority = signal('');
  protected readonly cpv = signal('');
  protected readonly formOpen = signal(false);
  protected readonly formError = signal<string | null>(null);
  private editingId: string | null = null;

  protected readonly jurisdictionColor = jurisdictionColor;
  protected readonly badge = jurisdictionBadge;

  protected readonly form = this.fb.group({
    competitor_name: ['', Validators.required],
    contracting_authority_name: ['', Validators.required],
    cpv_code: [''],
    jurisdiction: [null as TndJurisdiction | null],
    award_date: [''],
    base_auction_amount: [null as number | null],
    awarded_amount: [null as number | null],
    offered_discount_percentage: [null as number | null],
    technical_score: [null as number | null],
    economic_score: [null as number | null],
    source: [''],
    is_winner: [false],
  });

  ngOnInit(): void {
    void this.store.init();
  }

  protected apply(): void {
    void this.store.setFilters({
      q: this.q() || undefined,
      contracting_authority_name: this.authority() || undefined,
      cpv_code: this.cpv() || undefined,
    });
  }

  protected openForm(item: TndBenchmark | null): void {
    this.editingId = item?.id ?? null;
    this.formError.set(null);
    this.form.reset({
      competitor_name: item?.competitor_name ?? '',
      contracting_authority_name: item?.contracting_authority_name ?? this.authority(),
      cpv_code: item?.cpv_code ?? this.cpv(),
      jurisdiction: item?.jurisdiction ?? null,
      award_date: item?.award_date?.slice(0, 10) ?? '',
      base_auction_amount: item?.base_auction_amount ? Number(item.base_auction_amount) : null,
      awarded_amount: item?.awarded_amount ? Number(item.awarded_amount) : null,
      offered_discount_percentage: item?.offered_discount_percentage ? Number(item.offered_discount_percentage) : null,
      technical_score: item?.technical_score ? Number(item.technical_score) : null,
      economic_score: item?.economic_score ? Number(item.economic_score) : null,
      source: item?.source ?? '',
      is_winner: item?.is_winner ?? false,
    });
    this.formOpen.set(true);
  }

  protected async save(): Promise<void> {
    if (this.form.invalid) {
      return;
    }
    const value = this.form.getRawValue();
    const numeric = (input: number | null): string | null => (input === null ? null : String(input));
    const payload = {
      competitor_name: value.competitor_name ?? '',
      contracting_authority_name: value.contracting_authority_name ?? '',
      cpv_code: value.cpv_code || null,
      jurisdiction: value.jurisdiction,
      award_date: value.award_date || null,
      base_auction_amount: numeric(value.base_auction_amount),
      awarded_amount: numeric(value.awarded_amount),
      offered_discount_percentage: numeric(value.offered_discount_percentage),
      technical_score: numeric(value.technical_score),
      economic_score: numeric(value.economic_score),
      total_score:
        value.technical_score !== null || value.economic_score !== null
          ? String((value.technical_score ?? 0) + (value.economic_score ?? 0))
          : null,
      source: value.source || null,
      is_winner: !!value.is_winner,
    };
    const outcome = this.editingId
      ? await this.store.update(this.editingId, payload)
      : await this.store.create(payload);
    if (!outcome.ok) {
      this.formError.set(outcome.errorKey);
      return;
    }
    this.formOpen.set(false);
  }
}
