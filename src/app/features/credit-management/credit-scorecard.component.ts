import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  CREDIT_FACTOR_SOURCES,
  CREDIT_RISK_LEVELS,
  CreditFactorSource,
  CreditManagementApiService,
  CreditRatingBand,
  CreditRiskLevel,
  CreditScorecardFactor,
  TranslateService,
} from '@core';
import { IconActionDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText, statusColor } from './credit.util';

type ScorecardDialog = 'factor' | 'band' | null;

/** Scorecard configuration: factors with their weights (active weights total 100) and the rating bands. */
@Component({
  selector: 'app-credit-scorecard',
  styleUrl: './credit-management.scss',
  imports: [
    DecimalPipe,
    ReactiveFormsModule,
    IconActionDirective,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSwitchModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'CREDIT.SCORECARD_TITLE' | translate" [subtitle]="'CREDIT.SCORECARD_SUBTITLE' | translate">
      <button nz-button nz-popconfirm [nzPopconfirmTitle]="'CREDIT.DEFAULTS_CONFIRM' | translate" (nzOnConfirm)="seedDefaults()">{{ 'CREDIT.LOAD_DEFAULTS' | translate }}</button>
    </app-page-header>

    <nz-card class="main-card" [nzTitle]="'CREDIT.FACTORS' | translate">
      <div class="toolbar">
        <span [class.row-overdue]="totalWeight() !== 100">{{ 'CREDIT.TOTAL_WEIGHT' | translate }}: {{ totalWeight() | number: '1.0-2' }}%</span>
        <span class="spacer"></span>
        <button nz-button nzType="primary" (click)="openFactor()" appIconAction="create"></button>
      </div>
      <nz-table #factorTable [nzData]="factors()" [nzLoading]="loading()" nzSize="small" [nzShowPagination]="false">
        <thead>
          <tr>
            <th>{{ 'CREDIT.CODE' | translate }}</th>
            <th>{{ 'CREDIT.NAME' | translate }}</th>
            <th>{{ 'CREDIT.FACTOR_SOURCE' | translate }}</th>
            <th class="num">{{ 'CREDIT.WEIGHT' | translate }}</th>
            <th>{{ 'CREDIT.ACTIVE' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of factorTable.data; track row.id) {
            <tr>
              <td>{{ row.code }}</td>
              <td>{{ row.name }}</td>
              <td>{{ ('CREDIT.SOURCE_' + row.source.toUpperCase()) | translate }}</td>
              <td class="num">{{ +row.weight | number: '1.0-2' }}</td>
              <td>{{ (row.is_active ? 'CREDIT.YES' : 'CREDIT.NO') | translate }}</td>
              <td>
                <div class="row-actions">
                  <button nz-button nzType="text" appIconAction="edit" (click)="openFactor(row)"></button>
                  <button nz-button nzType="text" nzDanger appIconAction="delete" nz-popconfirm [nzPopconfirmTitle]="'CREDIT.DELETE_CONFIRM' | translate" (nzOnConfirm)="removeFactor(row)"></button>
                </div>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && factors().length === 0) {
        <nz-empty [nzNotFoundContent]="'CREDIT.NO_FACTORS' | translate"></nz-empty>
      }
    </nz-card>

    <nz-card class="main-card" [nzTitle]="'CREDIT.RATING_BANDS' | translate">
      <div class="toolbar">
        <span class="spacer"></span>
        <button nz-button nzType="primary" (click)="openBand()" appIconAction="create"></button>
      </div>
      <nz-table #bandTable [nzData]="bands()" nzSize="small" [nzShowPagination]="false">
        <thead>
          <tr>
            <th>{{ 'CREDIT.RATING' | translate }}</th>
            <th>{{ 'CREDIT.NAME' | translate }}</th>
            <th class="num">{{ 'CREDIT.MIN_SCORE' | translate }}</th>
            <th class="num">{{ 'CREDIT.MAX_SCORE' | translate }}</th>
            <th>{{ 'CREDIT.RISK_LEVEL' | translate }}</th>
            <th class="num">{{ 'CREDIT.LIMIT_MULTIPLIER' | translate }}</th>
            <th class="num">{{ 'CREDIT.LIMIT_CEILING' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of bandTable.data; track row.id) {
            <tr>
              <td>{{ row.code }}</td>
              <td>{{ row.name }}</td>
              <td class="num">{{ +row.min_score | number: '1.0-2' }}</td>
              <td class="num">{{ +row.max_score | number: '1.0-2' }}</td>
              <td><nz-tag [nzColor]="color(row.risk_level)">{{ ('CREDIT.RISK_' + row.risk_level.toUpperCase()) | translate }}</nz-tag></td>
              <td class="num">{{ +row.limit_multiplier | number: '1.0-4' }}</td>
              <td class="num">{{ +row.limit_ceiling | number: '1.2-2' }}</td>
              <td>
                <div class="row-actions">
                  <button nz-button nzType="text" appIconAction="edit" (click)="openBand(row)"></button>
                  <button nz-button nzType="text" nzDanger appIconAction="delete" nz-popconfirm [nzPopconfirmTitle]="'CREDIT.DELETE_CONFIRM' | translate" (nzOnConfirm)="removeBand(row)"></button>
                </div>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (bands().length === 0) {
        <nz-empty [nzNotFoundContent]="'CREDIT.NO_BANDS' | translate"></nz-empty>
      }
    </nz-card>

    <nz-modal [nzVisible]="dialog() === 'factor'" [nzTitle]="'CREDIT.FACTOR' | translate" (nzOnCancel)="dialog.set(null)" (nzOnOk)="saveFactor()" okAction="save" [nzOkDisabled]="factorForm.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="factorForm" nzLayout="vertical">
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="factor-code">{{ 'CREDIT.CODE' | translate }}</nz-form-label>
              <nz-form-control [nzExtra]="'CREDIT.FACTOR_CODE_HINT' | translate"><input nz-input id="factor-code" formControlName="code" maxlength="40" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="factor-weight">{{ 'CREDIT.WEIGHT' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="factor-weight" type="number" min="0.01" max="100" step="any" formControlName="weight" /></nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="factor-name">{{ 'CREDIT.NAME' | translate }}</nz-form-label>
            <nz-form-control><input nz-input id="factor-name" formControlName="name" maxlength="120" /></nz-form-control>
          </nz-form-item>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'CREDIT.FACTOR_SOURCE' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="source">
                  @for (source of sources; track source) {
                    <nz-option [nzValue]="source" [nzLabel]="('CREDIT.SOURCE_' + source.toUpperCase()) | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="factor-order">{{ 'CREDIT.SORT_ORDER' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="factor-order" type="number" min="0" max="65000" formControlName="sort_order" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'CREDIT.ACTIVE' | translate }}</nz-form-label>
              <nz-form-control><nz-switch formControlName="is_active"></nz-switch></nz-form-control>
            </nz-form-item>
          </div>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal [nzVisible]="dialog() === 'band'" [nzTitle]="'CREDIT.RATING_BAND' | translate" (nzOnCancel)="dialog.set(null)" (nzOnOk)="saveBand()" okAction="save" [nzOkDisabled]="bandForm.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="bandForm" nzLayout="vertical">
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="band-code">{{ 'CREDIT.RATING' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="band-code" formControlName="code" maxlength="10" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="band-name">{{ 'CREDIT.NAME' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="band-name" formControlName="name" maxlength="120" /></nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="band-min">{{ 'CREDIT.MIN_SCORE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="band-min" type="number" min="0" max="100" step="any" formControlName="min_score" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="band-max">{{ 'CREDIT.MAX_SCORE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="band-max" type="number" min="0" max="100" step="any" formControlName="max_score" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'CREDIT.RISK_LEVEL' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="risk_level">
                  @for (level of riskLevels; track level) {
                    <nz-option [nzValue]="level" [nzLabel]="('CREDIT.RISK_' + level.toUpperCase()) | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="band-multiplier">{{ 'CREDIT.LIMIT_MULTIPLIER' | translate }}</nz-form-label>
              <nz-form-control [nzExtra]="'CREDIT.LIMIT_MULTIPLIER_HINT' | translate"><input nz-input id="band-multiplier" type="number" min="0" max="100" step="any" formControlName="limit_multiplier" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="band-ceiling">{{ 'CREDIT.LIMIT_CEILING' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="band-ceiling" type="number" min="0" step="any" formControlName="limit_ceiling" /></nz-form-control>
            </nz-form-item>
          </div>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class CreditScorecardComponent implements OnInit {
  private readonly api = inject(CreditManagementApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly sources = CREDIT_FACTOR_SOURCES;
  readonly riskLevels = CREDIT_RISK_LEVELS;
  readonly factors = signal<CreditScorecardFactor[]>([]);
  readonly bands = signal<CreditRatingBand[]>([]);
  readonly loading = signal(false);
  readonly dialog = signal<ScorecardDialog>(null);
  readonly editingFactor = signal<CreditScorecardFactor | null>(null);
  readonly editingBand = signal<CreditRatingBand | null>(null);
  readonly totalWeight = computed(() => this.factors().filter((factor) => factor.is_active).reduce((sum, factor) => sum + Number(factor.weight), 0));

  readonly factorForm = this.fb.group({
    code: ['', [Validators.required, Validators.maxLength(40), Validators.pattern(/^[a-z][a-z0-9_]*$/)]],
    name: ['', [Validators.required, Validators.maxLength(120)]],
    source: ['manual' as CreditFactorSource, [Validators.required]],
    weight: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01), Validators.max(100)]),
    sort_order: [0, [Validators.min(0), Validators.max(65000)]],
    is_active: [true],
  });

  readonly bandForm = this.fb.group({
    code: ['', [Validators.required, Validators.maxLength(10)]],
    name: ['', [Validators.required, Validators.maxLength(120)]],
    min_score: this.fb.control<number | null>(0, [Validators.required, Validators.min(0), Validators.max(100)]),
    max_score: this.fb.control<number | null>(100, [Validators.required, Validators.min(0), Validators.max(100)]),
    risk_level: ['low' as CreditRiskLevel, [Validators.required]],
    limit_multiplier: this.fb.control<number | null>(1, [Validators.required, Validators.min(0), Validators.max(100)]),
    limit_ceiling: this.fb.control<number | null>(0, [Validators.required, Validators.min(0)]),
  });

  ngOnInit(): void {
    this.load();
  }

  color(level: string): string {
    return statusColor(level);
  }

  load(): void {
    this.loading.set(true);
    this.api.getFactors().subscribe({
      next: (response) => {
        this.factors.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('CREDIT.ACTION_ERROR'));
      },
    });
    this.api.getRatingBands().subscribe({ next: (response) => this.bands.set(response.data), error: () => undefined });
  }

  seedDefaults(): void {
    this.finish(this.api.seedScorecardDefaults(), 'CREDIT.DEFAULTS_LOADED');
  }

  openFactor(factor: CreditScorecardFactor | null = null): void {
    this.editingFactor.set(factor);
    this.factorForm.reset({
      code: factor?.code ?? '',
      name: factor?.name ?? '',
      source: factor?.source ?? 'manual',
      weight: factor ? Number(factor.weight) : null,
      sort_order: factor?.sort_order ?? 0,
      is_active: factor?.is_active ?? true,
    });
    this.dialog.set('factor');
  }

  saveFactor(): void {
    const value = this.factorForm.getRawValue();
    const payload = { code: value.code, name: value.name, source: value.source, weight: String(value.weight), sort_order: value.sort_order, is_active: value.is_active };
    const current = this.editingFactor();
    this.finish(current ? this.api.updateFactor(current.id, payload) : this.api.createFactor(payload), 'CREDIT.FACTOR_SAVED');
  }

  removeFactor(factor: CreditScorecardFactor): void {
    this.finish(this.api.deleteFactor(factor.id), 'CREDIT.DELETED');
  }

  openBand(band: CreditRatingBand | null = null): void {
    this.editingBand.set(band);
    this.bandForm.reset({
      code: band?.code ?? '',
      name: band?.name ?? '',
      min_score: band ? Number(band.min_score) : 0,
      max_score: band ? Number(band.max_score) : 100,
      risk_level: band?.risk_level ?? 'low',
      limit_multiplier: band ? Number(band.limit_multiplier) : 1,
      limit_ceiling: band ? Number(band.limit_ceiling) : 0,
    });
    this.dialog.set('band');
  }

  saveBand(): void {
    const value = this.bandForm.getRawValue();
    const payload = {
      code: value.code,
      name: value.name,
      min_score: String(value.min_score),
      max_score: String(value.max_score),
      risk_level: value.risk_level,
      limit_multiplier: String(value.limit_multiplier),
      limit_ceiling: String(value.limit_ceiling),
    };
    const current = this.editingBand();
    this.finish(current ? this.api.updateRatingBand(current.id, payload) : this.api.createRatingBand(payload), 'CREDIT.BAND_SAVED');
  }

  removeBand(band: CreditRatingBand): void {
    this.finish(this.api.deleteRatingBand(band.id), 'CREDIT.DELETED');
  }

  private finish(request: Observable<unknown>, successKey: string): void {
    request.subscribe({
      next: () => {
        this.message.success(this.translate.instant(successKey));
        this.dialog.set(null);
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('CREDIT.ACTION_ERROR')),
    });
  }
}
