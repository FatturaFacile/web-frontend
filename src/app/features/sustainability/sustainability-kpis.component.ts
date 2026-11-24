import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  ESG_PILLARS,
  EsgDataQuality,
  EsgKpiDefinition,
  EsgKpiDirection,
  EsgKpiValue,
  EsgPillar,
  EsgReportingPeriod,
  SustainabilityApiService,
  TranslateService,
} from '@core';
import { IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText } from './sustainability.util';

interface KpiRow {
  definition: EsgKpiDefinition;
  value: EsgKpiValue | null;
}

/** ESG indicators: definitions (environmental, social, governance) and their value per reporting period. */
@Component({
  selector: 'app-sustainability-kpis',
  styleUrl: './sustainability.scss',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    IconActionDirective,
    ModalActionsDirective,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'SUSTAINABILITY.KPIS_TITLE' | translate" [subtitle]="'SUSTAINABILITY.KPIS_SUBTITLE' | translate"></app-page-header>

    <nz-card class="main-card">
      <nz-tabs>
        <nz-tab [nzTitle]="'SUSTAINABILITY.TAB_VALUES' | translate">
          <div class="toolbar">
            <nz-select style="min-width: 240px" [ngModel]="periodId()" (ngModelChange)="selectPeriod($event)" [nzPlaceHolder]="'SUSTAINABILITY.SELECT_PERIOD' | translate">
              @for (period of periods(); track period.id) {
                <nz-option [nzValue]="period.id" [nzLabel]="period.name"></nz-option>
              }
            </nz-select>
            @if (selectedPeriod()?.status === 'closed') {
              <nz-tag>{{ 'SUSTAINABILITY.PERIOD_CLOSED' | translate }}</nz-tag>
            }
          </div>
          <nz-table #values [nzData]="rows()" nzSize="small" [nzShowPagination]="false">
            <thead>
              <tr>
                <th>{{ 'SUSTAINABILITY.PILLAR' | translate }}</th>
                <th>{{ 'SUSTAINABILITY.KPI' | translate }}</th>
                <th>{{ 'SUSTAINABILITY.ESRS_REFERENCE' | translate }}</th>
                <th style="width: 200px">{{ 'SUSTAINABILITY.VALUE' | translate }}</th>
                <th>{{ 'SUSTAINABILITY.TARGET' | translate }}</th>
                <th>{{ 'SUSTAINABILITY.DATA_QUALITY' | translate }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (row of values.data; track row.definition.id) {
                <tr>
                  <td>{{ ('SUSTAINABILITY.PILLAR_' + row.definition.pillar.toUpperCase()) | translate }}</td>
                  <td>{{ row.definition.name }} <span class="muted">({{ row.definition.unit }})</span></td>
                  <td>{{ row.definition.esrs_reference }}</td>
                  <td>
                    <input
                      nz-input
                      type="number"
                      step="any"
                      [disabled]="selectedPeriod()?.status !== 'open'"
                      [ngModel]="draftOf(row)"
                      (ngModelChange)="setDraft(row.definition.id, $event)"
                      [attr.aria-label]="row.definition.name"
                    />
                  </td>
                  <td>
                    @if (row.definition.target_value) {
                      {{ row.definition.target_value }}
                      @if (row.value && row.value.target_met !== null) {
                        <nz-tag [nzColor]="row.value.target_met ? 'green' : 'red'">{{ (row.value.target_met ? 'SUSTAINABILITY.TARGET_MET' : 'SUSTAINABILITY.TARGET_NOT_MET') | translate }}</nz-tag>
                      }
                    }
                  </td>
                  <td>
                    <nz-select style="width: 130px" [ngModel]="qualityOf(row)" (ngModelChange)="setQuality(row.definition.id, $event)" [nzDisabled]="selectedPeriod()?.status !== 'open'">
                      <nz-option nzValue="measured" [nzLabel]="'SUSTAINABILITY.QUALITY_MEASURED' | translate"></nz-option>
                      <nz-option nzValue="estimated" [nzLabel]="'SUSTAINABILITY.QUALITY_ESTIMATED' | translate"></nz-option>
                    </nz-select>
                  </td>
                  <td>
                    <button nz-button nzType="primary" appIconAction="save" [disabled]="selectedPeriod()?.status !== 'open' || draftOf(row) === ''" (click)="saveValue(row)"></button>
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
          @if (rows().length === 0) {
            <nz-empty [nzNotFoundContent]="'SUSTAINABILITY.NO_KPIS' | translate"></nz-empty>
          }
        </nz-tab>

        <nz-tab [nzTitle]="'SUSTAINABILITY.TAB_DEFINITIONS' | translate">
          <div class="toolbar">
            <button nz-button (click)="installDefaults()">{{ 'SUSTAINABILITY.INSTALL_DEFAULT_KPIS' | translate }}</button>
            <button nz-button nzType="primary" (click)="openModal()" appIconAction="create"></button>
          </div>
          <nz-table #defs [nzData]="definitions()" nzSize="small" [nzPageSize]="25">
            <thead>
              <tr>
                <th>{{ 'SUSTAINABILITY.CODE' | translate }}</th>
                <th>{{ 'SUSTAINABILITY.NAME' | translate }}</th>
                <th>{{ 'SUSTAINABILITY.PILLAR' | translate }}</th>
                <th>{{ 'SUSTAINABILITY.UNIT' | translate }}</th>
                <th>{{ 'SUSTAINABILITY.DIRECTION' | translate }}</th>
                <th>{{ 'SUSTAINABILITY.STATUS' | translate }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (row of defs.data; track row.id) {
                <tr>
                  <td>{{ row.code }}</td>
                  <td>{{ row.name }} @if (row.is_example) { <nz-tag nzColor="orange">{{ 'SUSTAINABILITY.EXAMPLE' | translate }}</nz-tag> }</td>
                  <td>{{ ('SUSTAINABILITY.PILLAR_' + row.pillar.toUpperCase()) | translate }}</td>
                  <td>{{ row.unit }}</td>
                  <td>{{ ('SUSTAINABILITY.' + row.direction.toUpperCase()) | translate }}</td>
                  <td><nz-tag [nzColor]="row.is_active ? 'green' : 'default'">{{ (row.is_active ? 'SUSTAINABILITY.ACTIVE' : 'SUSTAINABILITY.INACTIVE') | translate }}</nz-tag></td>
                  <td><button nz-button nzType="text" (click)="toggleActive(row)">{{ (row.is_active ? 'SUSTAINABILITY.DEACTIVATE' : 'SUSTAINABILITY.ACTIVATE') | translate }}</button></td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-tab>
      </nz-tabs>
    </nz-card>

    <nz-modal appModalActions
      [(nzVisible)]="modalVisible"
      [nzTitle]="'SUSTAINABILITY.NEW_KPI' | translate"
      (nzOnCancel)="modalVisible.set(false)"
      (nzOnOk)="saveDefinition()"
      okAction="save"
      [nzOkDisabled]="form.invalid"
    >
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="form" nzLayout="vertical">
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'SUSTAINABILITY.CODE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input formControlName="code" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'SUSTAINABILITY.NAME' | translate }}</nz-form-label>
              <nz-form-control><input nz-input formControlName="name" /></nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'SUSTAINABILITY.PILLAR' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="pillar">
                  @for (pillar of pillars; track pillar) {
                    <nz-option [nzValue]="pillar" [nzLabel]="('SUSTAINABILITY.PILLAR_' + pillar.toUpperCase()) | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'SUSTAINABILITY.UNIT' | translate }}</nz-form-label>
              <nz-form-control><input nz-input formControlName="unit" /></nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label>{{ 'SUSTAINABILITY.DIRECTION' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="direction">
                  <nz-option nzValue="higher_is_better" [nzLabel]="'SUSTAINABILITY.HIGHER_IS_BETTER' | translate"></nz-option>
                  <nz-option nzValue="lower_is_better" [nzLabel]="'SUSTAINABILITY.LOWER_IS_BETTER' | translate"></nz-option>
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'SUSTAINABILITY.TARGET' | translate }}</nz-form-label>
              <nz-form-control><input nz-input type="number" step="any" formControlName="target_value" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'SUSTAINABILITY.ESRS_REFERENCE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input formControlName="esrs_reference" /></nz-form-control>
            </nz-form-item>
          </div>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class SustainabilityKpisComponent implements OnInit {
  private readonly api = inject(SustainabilityApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly pillars = ESG_PILLARS;
  readonly periods = signal<EsgReportingPeriod[]>([]);
  readonly periodId = signal<string | null>(null);
  readonly definitions = signal<EsgKpiDefinition[]>([]);
  readonly values = signal<EsgKpiValue[]>([]);
  readonly modalVisible = signal(false);
  private readonly drafts = signal<Record<string, string>>({});
  private readonly qualities = signal<Record<string, EsgDataQuality>>({});

  readonly selectedPeriod = computed(() => this.periods().find((period) => period.id === this.periodId()) ?? null);

  readonly rows = computed<KpiRow[]>(() =>
    this.definitions()
      .filter((definition) => definition.is_active)
      .map((definition) => ({ definition, value: this.values().find((value) => value.kpi_definition_id === definition.id) ?? null })),
  );

  readonly form = this.fb.group({
    code: ['', [Validators.required, Validators.maxLength(60), Validators.pattern(/^[a-z0-9_]+$/)]],
    name: ['', [Validators.required, Validators.maxLength(190)]],
    pillar: ['environmental' as EsgPillar, [Validators.required]],
    unit: ['', [Validators.required, Validators.maxLength(20)]],
    direction: ['lower_is_better' as EsgKpiDirection],
    target_value: [''],
    esrs_reference: ['', [Validators.maxLength(30)]],
  });

  ngOnInit(): void {
    this.loadDefinitions();
    this.api.getPeriods().subscribe({
      next: (response) => {
        this.periods.set(response.data);
        this.selectPeriod(response.data[0]?.id ?? null);
      },
    });
  }

  loadDefinitions(): void {
    this.api.getKpiDefinitions().subscribe({ next: (response) => this.definitions.set(response.data) });
  }

  selectPeriod(id: string | null): void {
    this.periodId.set(id);
    this.drafts.set({});
    this.qualities.set({});
    this.loadValues();
  }

  private loadValues(): void {
    const id = this.periodId();
    if (id === null) {
      this.values.set([]);
      return;
    }

    this.api.getKpiValues(id).subscribe({ next: (response) => this.values.set(response.data) });
  }

  draftOf(row: KpiRow): string {
    return this.drafts()[row.definition.id] ?? (row.value ? String(Number(row.value.value)) : '');
  }

  qualityOf(row: KpiRow): EsgDataQuality {
    return this.qualities()[row.definition.id] ?? row.value?.data_quality ?? 'measured';
  }

  setDraft(id: string, value: string): void {
    this.drafts.update((drafts) => ({ ...drafts, [id]: value === null ? '' : String(value) }));
  }

  setQuality(id: string, quality: EsgDataQuality): void {
    this.qualities.update((qualities) => ({ ...qualities, [id]: quality }));
  }

  saveValue(row: KpiRow): void {
    const period = this.selectedPeriod();
    if (period === null) {
      return;
    }

    this.api
      .recordKpiValue({
        kpi_definition_id: row.definition.id,
        reporting_period_id: period.id,
        value: this.draftOf(row),
        data_quality: this.qualityOf(row),
      })
      .subscribe({
        next: () => {
          this.message.success(this.translate.instant('SUSTAINABILITY.KPI_VALUE_SAVED'));
          this.loadValues();
        },
        error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('SUSTAINABILITY.ACTION_ERROR')),
      });
  }

  installDefaults(): void {
    this.api.installDefaultKpis().subscribe({
      next: (response) => {
        this.message.success(this.translate.instant('SUSTAINABILITY.KPIS_INSTALLED', { count: response.created }));
        this.loadDefinitions();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('SUSTAINABILITY.ACTION_ERROR')),
    });
  }

  openModal(): void {
    this.form.reset({ code: '', name: '', pillar: 'environmental', unit: '', direction: 'lower_is_better', target_value: '', esrs_reference: '' });
    this.modalVisible.set(true);
  }

  saveDefinition(): void {
    const value = this.form.getRawValue();
    this.api
      .createKpiDefinition({
        ...value,
        target_value: value.target_value === '' ? null : String(value.target_value),
        esrs_reference: value.esrs_reference || null,
      })
      .subscribe({
        next: () => {
          this.message.success(this.translate.instant('SUSTAINABILITY.KPI_SAVED'));
          this.modalVisible.set(false);
          this.loadDefinitions();
        },
        error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('SUSTAINABILITY.ACTION_ERROR')),
      });
  }

  toggleActive(definition: EsgKpiDefinition): void {
    this.api.updateKpiDefinition(definition.id, { is_active: !definition.is_active }).subscribe({
      next: () => this.loadDefinitions(),
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('SUSTAINABILITY.ACTION_ERROR')),
    });
  }
}
