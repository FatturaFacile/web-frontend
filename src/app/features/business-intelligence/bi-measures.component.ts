import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { BiCalculatedMeasure, BiDataset, BiMeasureUnit, BusinessIntelligenceApiService, TranslateService } from '@core';
import { IconActionDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText } from './bi.util';

const UNITS: readonly BiMeasureUnit[] = ['number', 'currency', 'count', 'quantity', 'percent'];

/** The calculated measures of the company: formulas over the base measures of a dataset (+ - * / and parentheses). */
@Component({
  selector: 'app-bi-measures',
  styleUrl: './business-intelligence.scss',
  imports: [
    FormsModule,
    IconActionDirective,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
  ],
  template: `
    <app-page-header [title]="'BI.MEASURES_TITLE' | translate" [subtitle]="'BI.MEASURES_SUBTITLE' | translate">
      <button nz-button nzType="primary" appIconAction="create" (click)="openModal()"></button>
    </app-page-header>

    <nz-card class="main-card">
      <nz-table #table [nzData]="measures()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="25">
        <thead>
          <tr>
            <th>{{ 'BI.DATASET' | translate }}</th>
            <th>{{ 'BI.KEY' | translate }}</th>
            <th>{{ 'BI.NAME' | translate }}</th>
            <th>{{ 'BI.FORMULA' | translate }}</th>
            <th>{{ 'BI.UNIT' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <td>{{ row.dataset }}</td>
              <td><code>{{ row.key }}</code></td>
              <td>{{ row.label }}</td>
              <td><code>{{ row.formula }}</code></td>
              <td>{{ ('BI.UNIT_' + row.unit.toUpperCase()) | translate }}</td>
              <td>
                <div class="row-actions">
                  <button nz-button nzType="text" appIconAction="edit" (click)="openModal(row)"></button>
                  <button nz-button nzType="text" nzDanger appIconAction="delete" nz-popconfirm [nzPopconfirmTitle]="'BI.DELETE_MEASURE_CONFIRM' | translate" (nzOnConfirm)="remove(row)"></button>
                </div>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && measures().length === 0) {
        <nz-empty [nzNotFoundContent]="'BI.NO_MEASURES' | translate"></nz-empty>
      }
    </nz-card>

    <nz-modal [(nzVisible)]="modalVisible" [nzTitle]="(editing() ? 'BI.EDIT_MEASURE' : 'BI.NEW_MEASURE') | translate" (nzOnCancel)="modalVisible.set(false)" (nzOnOk)="save()" [nzOkDisabled]="!valid()">
      <ng-container *nzModalContent>
        <label for="measure-dataset">{{ 'BI.DATASET' | translate }}</label>
        <nz-select id="measure-dataset" style="width: 100%" [nzDisabled]="editing() !== null" [ngModel]="dataset()" (ngModelChange)="dataset.set($event)">
          @for (item of datasets(); track item.key) {
            <nz-option [nzValue]="item.key" [nzLabel]="item.label"></nz-option>
          }
        </nz-select>
        <label for="measure-key" class="bi-label">{{ 'BI.KEY' | translate }}</label>
        <input nz-input id="measure-key" maxlength="40" [disabled]="editing() !== null" [ngModel]="key()" (ngModelChange)="key.set($event)" />
        <label for="measure-label" class="bi-label">{{ 'BI.NAME' | translate }}</label>
        <input nz-input id="measure-label" maxlength="120" [ngModel]="label()" (ngModelChange)="label.set($event)" />
        <label for="measure-formula" class="bi-label">{{ 'BI.FORMULA' | translate }}</label>
        <input nz-input id="measure-formula" maxlength="500" [ngModel]="formula()" (ngModelChange)="formula.set($event)" />
        <small class="muted">{{ 'BI.FORMULA_HELP' | translate }} {{ availableMeasures() }}</small>
        <label for="measure-unit" class="bi-label">{{ 'BI.UNIT' | translate }}</label>
        <nz-select id="measure-unit" style="width: 100%" [ngModel]="unit()" (ngModelChange)="unit.set($event)">
          @for (value of units; track value) {
            <nz-option [nzValue]="value" [nzLabel]="('BI.UNIT_' + value.toUpperCase()) | translate"></nz-option>
          }
        </nz-select>
        <label for="measure-scale" class="bi-label">{{ 'BI.SCALE' | translate }}</label>
        <nz-input-number id="measure-scale" [nzMin]="0" [nzMax]="6" [ngModel]="scale()" (ngModelChange)="scale.set($event ?? 2)"></nz-input-number>
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .bi-label { display: block; margin-top: 12px; }
  `,
})
export class BiMeasuresComponent implements OnInit {
  private readonly api = inject(BusinessIntelligenceApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly units = UNITS;
  readonly measures = signal<BiCalculatedMeasure[]>([]);
  readonly datasets = signal<BiDataset[]>([]);
  readonly loading = signal(false);
  readonly modalVisible = signal(false);
  readonly editing = signal<BiCalculatedMeasure | null>(null);
  readonly dataset = signal<string | null>(null);
  readonly key = signal('');
  readonly label = signal('');
  readonly formula = signal('');
  readonly unit = signal<BiMeasureUnit>('number');
  readonly scale = signal(2);

  readonly availableMeasures = computed(
    () =>
      this.datasets()
        .find((item) => item.key === this.dataset())
        ?.measures.map((measure) => measure.key)
        .join(', ') ?? '',
  );

  readonly valid = computed(() => this.dataset() !== null && /^[a-z][a-z0-9_]{0,39}$/.test(this.key()) && this.label().trim() !== '' && this.formula().trim() !== '');

  ngOnInit(): void {
    this.load();
    this.api.getDatasets().subscribe({ next: (response) => this.datasets.set(response.data), error: () => this.datasets.set([]) });
  }

  load(): void {
    this.loading.set(true);
    this.api.getCalculatedMeasures().subscribe({
      next: (response) => {
        this.measures.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('BI.ACTION_ERROR'));
      },
    });
  }

  openModal(measure: BiCalculatedMeasure | null = null): void {
    this.editing.set(measure);
    this.dataset.set(measure?.dataset ?? null);
    this.key.set(measure?.key ?? '');
    this.label.set(measure?.label ?? '');
    this.formula.set(measure?.formula ?? '');
    this.unit.set(measure?.unit ?? 'number');
    this.scale.set(measure?.scale ?? 2);
    this.modalVisible.set(true);
  }

  save(): void {
    const editing = this.editing();
    const dataset = this.dataset();
    if (!this.valid() || !dataset) {
      return;
    }

    const body = { label: this.label().trim(), formula: this.formula().trim(), unit: this.unit(), scale: this.scale() };
    const request = editing ? this.api.updateCalculatedMeasure(editing.id, body) : this.api.createCalculatedMeasure({ ...body, dataset, key: this.key() });
    request.subscribe({
      next: () => {
        this.modalVisible.set(false);
        this.message.success(this.translate.instant('BI.MEASURE_SAVED'));
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('BI.ACTION_ERROR')),
    });
  }

  remove(measure: BiCalculatedMeasure): void {
    this.api.deleteCalculatedMeasure(measure.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('BI.MEASURE_DELETED'));
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('BI.ACTION_ERROR')),
    });
  }
}
