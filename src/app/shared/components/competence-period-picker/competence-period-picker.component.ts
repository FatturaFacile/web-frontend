import { CurrencyPipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { TranslatePipe } from '../../pipes/translate.pipe';
import {
  calculateCompetencePreview,
  isValidCompetencePair,
  presetFullCalendarYear,
  presetTwelveMonths,
} from '../../../features/general-ledger/accruals/competence-calculator.util';

export interface CompetenceRangeChange {
  start: string | null;
  end: string | null;
}

function isoToLocalDate(iso: string | null | undefined): Date | null {
  if (!iso) {
    return null;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) {
    return null;
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function localDateToIso(date: Date | null): string | null {
  if (!date) {
    return null;
  }
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

@Component({
  selector: 'app-competence-period-picker',
  imports: [CurrencyPipe, FormsModule, NzButtonModule, NzDatePickerModule, NzTagModule, TranslatePipe],
  template: `
    <div class="competence-picker">
      <div class="cp-controls">
        <span class="cp-title">{{ 'GL.COMPETENCE_PERIOD' | translate }}</span>
        <div class="cp-dates">
          <nz-date-picker
            nzSize="small"
            nzFormat="dd.MM.yyyy"
            [nzAllowClear]="true"
            [nzDisabled]="disabled()"
            [nzPlaceHolder]="'GL.COMPETENCE_START' | translate"
            [ngModel]="startAsDate()"
            (ngModelChange)="onStartChange($event)"
          />
          <span class="cp-sep">→</span>
          <nz-date-picker
            nzSize="small"
            nzFormat="dd.MM.yyyy"
            [nzAllowClear]="true"
            [nzDisabled]="disabled()"
            [nzPlaceHolder]="'GL.COMPETENCE_END' | translate"
            [ngModel]="endAsDate()"
            (ngModelChange)="onEndChange($event)"
          />
        </div>
        <div class="cp-presets">
          <button
            nz-button
            nzSize="small"
            nzType="default"
            type="button"
            [disabled]="disabled()"
            (click)="applyFullYear()"
          >
            {{ 'GL.COMPETENCE_PRESET_YEAR' | translate }}
          </button>
          <button
            nz-button
            nzSize="small"
            nzType="default"
            type="button"
            [disabled]="disabled()"
            (click)="applyTwelveMonths()"
          >
            {{ 'GL.COMPETENCE_PRESET_12M' | translate }}
          </button>
        </div>
      </div>

      @if (pairStatus() === 'incomplete') {
        <div class="cp-error" role="alert">{{ 'GL.COMPETENCE_PAIR_REQUIRED' | translate }}</div>
      } @else if (pairStatus() === 'inverted') {
        <div class="cp-error" role="alert">{{ 'GL.COMPETENCE_END_BEFORE_START' | translate }}</div>
      } @else if (preview(); as p) {
        <div class="cp-preview">
          <span>
            {{ 'GL.COMPETENCE_PREVIEW_DAYS' | translate }}:
            <strong>{{ p.periodDays }} / {{ p.totalDays }}</strong>
          </span>
          <span>
            {{ 'GL.COMPETENCE_RECOGNIZED' | translate }}:
            <strong>{{ p.recognizedAmount | currency: currency() : 'symbol' : '1.2-2' }}</strong>
          </span>
          @if (p.accrualType) {
            <span>
              {{ 'GL.COMPETENCE_CARRYOVER' | translate }}:
              <strong>{{ p.transitoryAmount | currency: currency() : 'symbol' : '1.2-2' }}</strong>
            </span>
            <nz-tag [nzColor]="tagColor(p.accrualType)">
              {{ 'GL.ACCRUAL_' + p.accrualType.toUpperCase() | translate }}
            </nz-tag>
          } @else {
            <nz-tag>{{ 'GL.COMPETENCE_IN_PERIOD' | translate }}</nz-tag>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .competence-picker {
      padding: 8px 10px;
      margin: 4px 0 8px;
      border-radius: 6px;
      background: var(--ff-surface-subtle, rgba(0, 0, 0, 0.02));
      border: 1px dashed var(--ff-border-color, #d9d9d9);
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .cp-controls {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    .cp-title {
      font-size: 12px;
      font-weight: 500;
      opacity: 0.85;
    }
    .cp-dates {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .cp-sep {
      opacity: 0.6;
    }
    .cp-presets {
      display: flex;
      gap: 6px;
    }
    .cp-error {
      font-size: 12px;
      color: var(--ff-danger-color, #cf1322);
    }
    .cp-preview {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
      font-size: 12px;
    }
  `,
})
export class CompetencePeriodPickerComponent {
  readonly startDate = input<string | null>(null);
  readonly endDate = input<string | null>(null);
  readonly amount = input<number>(0);
  readonly currency = input<string>('EUR');
  readonly documentDate = input<string | null>(null);
  readonly direction = input<'cost' | 'revenue'>('cost');
  readonly disabled = input<boolean>(false);

  readonly rangeChange = output<CompetenceRangeChange>();

  protected readonly startAsDate = computed(() => isoToLocalDate(this.startDate()));
  protected readonly endAsDate = computed(() => isoToLocalDate(this.endDate()));
  protected readonly pairStatus = computed(() =>
    isValidCompetencePair(this.startDate(), this.endDate()),
  );

  protected readonly preview = computed(() =>
    calculateCompetencePreview({
      totalAmount: this.amount(),
      startDate: this.startDate(),
      endDate: this.endDate(),
      documentDate: this.documentDate(),
      direction: this.direction(),
    }),
  );

  protected onStartChange(date: Date | null): void {
    this.rangeChange.emit({
      start: localDateToIso(date),
      end: this.endDate(),
    });
  }

  protected onEndChange(date: Date | null): void {
    this.rangeChange.emit({
      start: this.startDate(),
      end: localDateToIso(date),
    });
  }

  protected applyFullYear(): void {
    this.rangeChange.emit(presetFullCalendarYear(this.startDate() ?? this.documentDate()));
  }

  protected applyTwelveMonths(): void {
    this.rangeChange.emit(presetTwelveMonths(this.startDate() ?? this.documentDate()));
  }

  protected tagColor(type: string): string {
    switch (type) {
      case 'prepaid_expense':
        return 'blue';
      case 'deferred_revenue':
        return 'purple';
      case 'accrued_revenue':
        return 'green';
      case 'accrued_expense':
        return 'orange';
      default:
        return 'default';
    }
  }
}
