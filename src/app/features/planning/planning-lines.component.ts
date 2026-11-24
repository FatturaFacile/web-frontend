import { DecimalPipe } from '@angular/common';
import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { PLANNING_LINE_TYPES, PlanningApiService, PlanningLine, PlanningLineType, TranslateService } from '@core';
import { IconActionDirective, ModalActionsDirective, TranslatePipe } from '@shared';
import { apiErrorText, blankToNull, monthLabel } from './planning.util';

/** Demand and supply lines of a scenario: edited while the scenario is a draft, read-only afterwards. */
@Component({
  selector: 'app-planning-lines',
  styleUrl: './planning.scss',
  imports: [
    DecimalPipe,
    FormsModule,
    ReactiveFormsModule,
    IconActionDirective,
    ModalActionsDirective,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
  ],
  template: `
    <div class="toolbar">
      <nz-select style="width: 200px" nzAllowClear [ngModel]="lineType()" (ngModelChange)="lineType.set($event); load()" [nzPlaceHolder]="'PLANNING.SIDE' | translate" [attr.aria-label]="'PLANNING.SIDE' | translate">
        @for (value of types; track value) {
          <nz-option [nzValue]="value" [nzLabel]="('PLANNING.LINE_' + value.toUpperCase()) | translate"></nz-option>
        }
      </nz-select>
      <span class="spacer"></span>
      @if (editable()) {
        <button nz-button (click)="importForecasts(false)">{{ 'PLANNING.IMPORT_FORECASTS' | translate }}</button>
        <button nz-button nz-popconfirm [nzPopconfirmTitle]="'PLANNING.IMPORT_OVERWRITE_CONFIRM' | translate" (nzOnConfirm)="importForecasts(true)">{{ 'PLANNING.IMPORT_FORECASTS_OVERWRITE' | translate }}</button>
        <button nz-button nzType="primary" (click)="openModal()" appIconAction="create"></button>
      }
    </div>

    <nz-card class="main-card">
      <nz-table #table [nzData]="lines()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="25">
        <thead>
          <tr>
            <th>{{ 'PLANNING.SIDE' | translate }}</th>
            <th>{{ 'PLANNING.ITEM' | translate }}</th>
            <th>{{ 'PLANNING.PERIOD' | translate }}</th>
            <th class="num">{{ 'PLANNING.QUANTITY' | translate }}</th>
            <th>{{ 'PLANNING.SOURCE' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <td>{{ ('PLANNING.LINE_' + row.line_type.toUpperCase()) | translate }}</td>
              <td>{{ row.item_code }} <span class="muted">{{ row.item_name }}</span></td>
              <td>{{ monthLabel(row.period) }}</td>
              <td class="num">{{ row.quantity | number: '1.0-3' }}</td>
              <td>{{ ('PLANNING.SOURCE_' + row.source.toUpperCase()) | translate }}</td>
              <td>
                @if (editable()) {
                  <div class="row-actions">
                    <button nz-button nzType="text" appIconAction="edit" (click)="openModal(row)"></button>
                    <button nz-button nzType="text" nzDanger appIconAction="delete" nz-popconfirm [nzPopconfirmTitle]="'PLANNING.DELETE_CONFIRM' | translate" (nzOnConfirm)="remove(row)"></button>
                  </div>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && lines().length === 0) {
        <nz-empty [nzNotFoundContent]="'PLANNING.NO_LINES' | translate"></nz-empty>
      }
    </nz-card>

    <nz-modal appModalActions [(nzVisible)]="modalVisible" [nzTitle]="(editing() ? 'PLANNING.EDIT_LINE' : 'PLANNING.NEW_LINE') | translate" (nzOnCancel)="modalVisible.set(false)" (nzOnOk)="save()" okAction="save" [nzOkDisabled]="form.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="form" nzLayout="vertical">
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'PLANNING.SIDE' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="line_type">
                  @for (value of types; track value) {
                    <nz-option [nzValue]="value" [nzLabel]="('PLANNING.LINE_' + value.toUpperCase()) | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="line-period">{{ 'PLANNING.PERIOD' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="line-period" type="date" formControlName="period" /></nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="line-code">{{ 'PLANNING.ITEM_CODE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="line-code" formControlName="item_code" maxlength="60" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="line-name">{{ 'PLANNING.ITEM_NAME' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="line-name" formControlName="item_name" maxlength="160" /></nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="line-quantity">{{ 'PLANNING.QUANTITY' | translate }}</nz-form-label>
            <nz-form-control><input nz-input id="line-quantity" type="number" min="0" step="any" formControlName="quantity" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="line-notes">{{ 'PLANNING.NOTES' | translate }}</nz-form-label>
            <nz-form-control><input nz-input id="line-notes" formControlName="notes" maxlength="500" /></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class PlanningLinesComponent {
  private readonly api = inject(PlanningApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly scenarioId = input.required<string>();
  readonly editable = input(false);
  readonly changed = output<void>();

  readonly types = PLANNING_LINE_TYPES;
  readonly monthLabel = monthLabel;
  readonly lines = signal<PlanningLine[]>([]);
  readonly loading = signal(false);
  readonly lineType = signal<PlanningLineType | null>(null);
  readonly modalVisible = signal(false);
  readonly editing = signal<PlanningLine | null>(null);

  readonly form = this.fb.group({
    line_type: ['demand' as PlanningLineType, [Validators.required]],
    period: ['', [Validators.required]],
    item_code: ['', [Validators.required, Validators.maxLength(60)]],
    item_name: [''],
    quantity: this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
    notes: [''],
  });

  constructor() {
    effect(() => {
      this.scenarioId();
      this.load();
    });
  }

  load(): void {
    this.loading.set(true);
    this.api.getLines(this.scenarioId(), { line_type: this.lineType() ?? undefined, per_page: 100 }).subscribe({
      next: (response) => {
        this.lines.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('PLANNING.ACTION_ERROR'));
      },
    });
  }

  openModal(line: PlanningLine | null = null): void {
    this.editing.set(line);
    this.form.reset({
      line_type: line?.line_type ?? 'demand',
      period: line?.period ?? '',
      item_code: line?.item_code ?? '',
      item_name: line?.item_name ?? '',
      quantity: line ? Number(line.quantity) : null,
      notes: line?.notes ?? '',
    });
    this.modalVisible.set(true);
  }

  save(): void {
    const value = this.form.getRawValue();
    const payload = {
      line_type: value.line_type,
      item_code: blankToNull(value.item_code),
      item_name: blankToNull(value.item_name),
      period: value.period,
      quantity: String(value.quantity),
      notes: blankToNull(value.notes),
    };
    const current = this.editing();
    const request = current ? this.api.updateLine(current.id, payload) : this.api.saveLine(this.scenarioId(), payload);

    request.subscribe({
      next: () => {
        this.message.success(this.translate.instant('PLANNING.LINE_SAVED'));
        this.modalVisible.set(false);
        this.load();
        this.changed.emit();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('PLANNING.ACTION_ERROR')),
    });
  }

  remove(line: PlanningLine): void {
    this.api.deleteLine(line.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('PLANNING.DELETED'));
        this.load();
        this.changed.emit();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('PLANNING.ACTION_ERROR')),
    });
  }

  importForecasts(overwrite: boolean): void {
    this.api.importForecasts(this.scenarioId(), overwrite).subscribe({
      next: (response) => {
        this.message.success(this.translate.instant('PLANNING.IMPORT_DONE', { created: response.data.created, updated: response.data.updated, skipped: response.data.skipped }));
        this.load();
        this.changed.emit();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('PLANNING.ACTION_ERROR')),
    });
  }
}
