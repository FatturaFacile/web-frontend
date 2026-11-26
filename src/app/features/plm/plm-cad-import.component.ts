import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  PLM_CAD_SOURCE_SYSTEMS,
  PlmApiService,
  PlmCadImportSession,
  PlmCadSourceSystem,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText } from './plm.util';

/**
 * CAD-to-mBOM Import Wizard: ingests SolidWorks / Inventor / Creo / NX / Eplan / Altium XML/CSV/STEP exports,
 * auto-creates missing parts, reviews Side-by-Side eBOM vs mBOM Diff, and commits to Mod 059.
 */
@Component({
  selector: 'app-plm-cad-import',
  styleUrl: './plm.scss',
  imports: [
    ReactiveFormsModule,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
    NzFormModule,
    NzInputModule,
    NzSelectModule,
    NzStatisticModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'PLM.CAD_IMPORT_TITLE' | translate" [subtitle]="'PLM.CAD_IMPORT_SUBTITLE' | translate"></app-page-header>

    <nz-card class="main-card">
      <form nz-form [formGroup]="form" nzLayout="vertical">
        <div class="form-row">
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'PLM.CAD_SOURCE_SYSTEM' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="cad_source_system">
                @for (sys of systems; track sys) {
                  <nz-option [nzValue]="sys" [nzLabel]="sys"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'PLM.PRODUCT_CODE' | translate }}</nz-form-label>
            <nz-form-control><input nz-input formControlName="product_code" maxlength="80" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>{{ 'PLM.REVISION' | translate }}</nz-form-label>
            <nz-form-control><input nz-input formControlName="revision_code" maxlength="20" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>{{ 'PLM.CAD_PAYLOAD_FORMAT' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="payload_format">
                <nz-option nzValue="xml" nzLabel="XML"></nz-option>
                <nz-option nzValue="csv" nzLabel="CSV"></nz-option>
                <nz-option nzValue="step" nzLabel="STEP (ISO 10303-21)"></nz-option>
              </nz-select>
            </nz-form-control>
          </nz-form-item>
        </div>

        <nz-form-item>
          <nz-form-label nzRequired>{{ 'PLM.CAD_RAW_PAYLOAD' | translate }}</nz-form-label>
          <nz-form-control>
            <textarea nz-input rows="5" formControlName="raw_payload"></textarea>
          </nz-form-control>
        </nz-form-item>

        <div class="toolbar">
          <label nz-checkbox for="plm-cad-auto-create" nzId="plm-cad-auto-create" formControlName="auto_create_missing_parts">{{ 'PLM.CAD_AUTO_CREATE' | translate }}</label>
          <span class="spacer"></span>
          <button nz-button nzType="primary" type="button" [disabled]="form.invalid" [nzLoading]="loading()" (click)="runImport()">
            {{ 'PLM.CAD_RUN_IMPORT' | translate }}
          </button>
        </div>
      </form>
    </nz-card>

    @if (session(); as current) {
      <div class="stats-grid">
        <nz-card><nz-statistic [nzTitle]="'PLM.NEW_PARTS_CREATED' | translate" [nzValue]="current.new_parts_to_create_count"></nz-statistic></nz-card>
        <nz-card><nz-statistic [nzTitle]="'PLM.DIFF_ADDED' | translate" [nzValue]="current.side_by_side_diff_json?.summary?.added ?? 0"></nz-statistic></nz-card>
        <nz-card><nz-statistic [nzTitle]="'PLM.DIFF_MODIFIED' | translate" [nzValue]="current.side_by_side_diff_json?.summary?.modified ?? 0"></nz-statistic></nz-card>
        <nz-card><nz-statistic [nzTitle]="'PLM.COST_AFTER' | translate" [nzValue]="current.cost_rollup_comparison_json?.after_total_cost ?? '0.0000'"></nz-statistic></nz-card>
      </div>

      <nz-card class="main-card" [nzTitle]="current.session_code">
        <div class="toolbar">
          <nz-tag nzColor="blue">{{ current.status }}</nz-tag>
          <span class="spacer"></span>
          @if (current.status !== 'Committed') {
            <button nz-button nzType="primary" type="button" [nzLoading]="loading()" (click)="commit()">
              {{ 'PLM.CAD_COMMIT_MBOM' | translate }}
            </button>
          }
        </div>

        <nz-table [nzData]="current.side_by_side_diff_json?.nodes ?? []" nzSize="small" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'PLM.STATUS' | translate }}</th>
              <th>{{ 'PLM.ITEM' | translate }}</th>
              <th>{{ 'PLM.COST_BEFORE' | translate }}</th>
              <th>{{ 'PLM.COST_AFTER' | translate }}</th>
              <th class="num">{{ 'PLM.COST_DELTA' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (node of current.side_by_side_diff_json?.nodes ?? []; track node.key) {
              <tr>
                <td>
                  <nz-tag [nzColor]="node.color === 'default' ? 'default' : node.color">
                    {{ ('PLM.DIFF_' + node.status.toUpperCase()) | translate }}
                  </nz-tag>
                </td>
                <td>{{ node.item_code }} — {{ node.item_name }}</td>
                <td>{{ node.before_quantity ?? '-' }}</td>
                <td>{{ node.after_quantity ?? '-' }}</td>
                <td class="num">{{ node.cost_delta }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-card>
    }
  `,
})
export class PlmCadImportComponent {
  private readonly api = inject(PlmApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly systems = PLM_CAD_SOURCE_SYSTEMS;
  readonly loading = signal(false);
  readonly session = signal<PlmCadImportSession | null>(null);

  readonly form = this.fb.group({
    cad_source_system: ['SolidWorks' as PlmCadSourceSystem, [Validators.required]],
    product_code: ['', [Validators.required]],
    revision_code: ['A'],
    payload_format: ['xml' as 'xml' | 'csv' | 'step'],
    raw_payload: ['', [Validators.required]],
    auto_create_missing_parts: [true],
  });

  runImport(): void {
    const val = this.form.getRawValue();
    this.loading.set(true);
    this.api
      .importCadBom({
        cad_source_system: val.cad_source_system,
        product_code: val.product_code,
        revision_code: val.revision_code,
        payload_format: val.payload_format,
        raw_payload: val.raw_payload,
        auto_create_missing_parts: val.auto_create_missing_parts,
      })
      .subscribe({
        next: (res) => {
          this.session.set(res.data);
          this.loading.set(false);
          this.message.success(this.translate.instant('PLM.CAD_IMPORT_SUCCESS'));
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.message.error(apiErrorText(err) ?? this.translate.instant('PLM.ACTION_ERROR'));
        },
      });
  }

  commit(): void {
    const id = this.session()?.id;
    if (!id) {
      return;
    }
    this.loading.set(true);
    this.api.commitCadImport(id).subscribe({
      next: (res) => {
        this.session.set(res.data);
        this.loading.set(false);
        this.message.success(this.translate.instant('PLM.CAD_COMMIT_SUCCESS'));
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.message.error(apiErrorText(err) ?? this.translate.instant('PLM.ACTION_ERROR'));
      },
    });
  }
}
