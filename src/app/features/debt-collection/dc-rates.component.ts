import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  DC_INTEREST_KINDS,
  DC_JURISDICTIONS,
  DcInterestRate,
  DcInterestRatePayload,
  DcJurisdiction,
  PermissionsService,
} from '@core';
import { TranslatePipe } from '@shared';
import { DcFeedback } from './dc-feedback.service';
import { DEBT_COLLECTION_MODULE, todayIso } from './debt-collection.util';
import { SettingsStore } from './settings.store';

/** The effective annual rate of a period: base rate plus markup, as a decimal string with two decimals. */
export function effectiveRate(
  rate: Pick<DcInterestRate, 'base_rate_percent' | 'markup_percent'>,
): string {
  return (
    Math.round((Number(rate.base_rate_percent) + Number(rate.markup_percent)) * 100) / 100
  ).toFixed(2);
}

function emptyRate(): DcInterestRatePayload {
  return {
    jurisdiction: 'CH',
    kind: 'statutory_ch',
    base_rate_percent: '5.00',
    markup_percent: '0.00',
    effective_from: todayIso(),
    effective_to: null,
    notes: null,
  };
}

/**
 * Interest rate periods: the statutory 5 % of Art. 104 CO for Switzerland, the ECB reference rate plus 8 points of
 * D.Lgs. 231/2002 for Italy (a new period per semester) and the contractual rates. Global rows are read-only; a tenant
 * adds its own rows.
 */
@Component({
  selector: 'app-dc-rates',
  imports: [
    FormsModule,
    TranslatePipe,
    NzButtonModule,
    NzEmptyModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
  ],
  styleUrl: './debt-collection.scss',
  template: `
    <div class="toolbar">
      <label class="field" for="dc-rate-jur">
        <span>{{ 'debtCollection.field.jurisdiction' | translate }}</span>
        <nz-select
          nzId="dc-rate-jur"
          nzAllowClear
          [nzPlaceHolder]="'debtCollection.action.all' | translate"
          [ngModel]="store.rateJurisdiction()"
          (ngModelChange)="store.setRateJurisdiction($event ?? null)"
        >
          @for (value of jurisdictions; track value) {
            <nz-option
              [nzValue]="value"
              [nzLabel]="'debtCollection.jurisdiction.' + value | translate"
            />
          }
        </nz-select>
      </label>
      @if (canWrite) {
        <button nz-button nzType="primary" type="button" (click)="edit(null)">
          {{ 'debtCollection.action.newRate' | translate }}
        </button>
      }
    </div>
    <p class="hint">{{ 'debtCollection.rate.hint' | translate }}</p>

    <nz-table #table nzSize="small" [nzData]="store.rates()" [nzShowPagination]="false">
      <thead>
        <tr>
          <th scope="col">{{ 'debtCollection.field.jurisdiction' | translate }}</th>
          <th scope="col">{{ 'debtCollection.rate.kind' | translate }}</th>
          <th scope="col" class="num">{{ 'debtCollection.rate.base' | translate }}</th>
          <th scope="col" class="num">{{ 'debtCollection.rate.markup' | translate }}</th>
          <th scope="col" class="num">{{ 'debtCollection.rate.effective' | translate }}</th>
          <th scope="col">{{ 'debtCollection.field.from' | translate }}</th>
          <th scope="col">{{ 'debtCollection.field.to' | translate }}</th>
          <th scope="col"></th>
        </tr>
      </thead>
      <tbody>
        @for (rate of table.data; track rate.id) {
          <tr>
            <th scope="row">
              {{ 'debtCollection.jurisdiction.' + rate.jurisdiction | translate }}
            </th>
            <td>
              {{ 'debtCollection.interestKind.' + rate.kind | translate }}
              @if (rate.is_global) {
                <nz-tag>{{ 'debtCollection.rate.global' | translate }}</nz-tag>
              }
            </td>
            <td class="num">{{ rate.base_rate_percent }} %</td>
            <td class="num">{{ rate.markup_percent }} %</td>
            <td class="num">
              <strong>{{ effective(rate) }} %</strong>
            </td>
            <td>{{ rate.effective_from }}</td>
            <td>{{ rate.effective_to ?? '' }}</td>
            <td>
              @if (canWrite && !rate.is_global) {
                <div class="row-actions">
                  <button nz-button nzSize="small" type="button" (click)="edit(rate)">
                    {{ 'debtCollection.action.edit' | translate }}
                  </button>
                  <button
                    nz-button
                    nzSize="small"
                    nzDanger
                    type="button"
                    nz-popconfirm
                    [nzPopconfirmTitle]="'debtCollection.rate.deleteConfirm' | translate"
                    (nzOnConfirm)="remove(rate)"
                  >
                    {{ 'debtCollection.action.delete' | translate }}
                  </button>
                </div>
              }
            </td>
          </tr>
        }
      </tbody>
    </nz-table>
    @if (store.rates().length === 0) {
      <nz-empty [nzNotFoundContent]="'debtCollection.rate.empty' | translate" />
    }

    <nz-modal
      [nzVisible]="draft() !== null"
      [nzTitle]="'debtCollection.rate.editor' | translate"
      [nzOkText]="'debtCollection.action.save' | translate"
      [nzCancelText]="'debtCollection.action.cancel' | translate"
      [nzOkDisabled]="!valid()"
      [nzOkLoading]="store.saving()"
      (nzOnOk)="save()"
      (nzOnCancel)="draft.set(null)"
    >
      <ng-container *nzModalContent>
        @if (draft(); as rate) {
          <div class="form-grid">
            <label class="field" for="dc-rate-ejur">
              <span>{{ 'debtCollection.field.jurisdiction' | translate }}</span>
              <nz-select
                nzId="dc-rate-ejur"
                [ngModel]="rate.jurisdiction"
                (ngModelChange)="patch({ jurisdiction: $event })"
              >
                @for (value of jurisdictions; track value) {
                  <nz-option
                    [nzValue]="value"
                    [nzLabel]="'debtCollection.jurisdiction.' + value | translate"
                  />
                }
              </nz-select>
            </label>
            <label class="field" for="dc-rate-kind">
              <span>{{ 'debtCollection.rate.kind' | translate }}</span>
              <nz-select
                nzId="dc-rate-kind"
                [ngModel]="rate.kind"
                (ngModelChange)="patch({ kind: $event })"
              >
                @for (value of kinds; track value) {
                  <nz-option
                    [nzValue]="value"
                    [nzLabel]="'debtCollection.interestKind.' + value | translate"
                  />
                }
              </nz-select>
            </label>
            <label class="field" for="dc-rate-base">
              <span>{{ 'debtCollection.rate.base' | translate }}</span>
              <input
                nz-input
                id="dc-rate-base"
                inputmode="decimal"
                [ngModel]="rate.base_rate_percent"
                (ngModelChange)="patch({ base_rate_percent: $event })"
              />
            </label>
            <label class="field" for="dc-rate-markup">
              <span>{{ 'debtCollection.rate.markup' | translate }}</span>
              <input
                nz-input
                id="dc-rate-markup"
                inputmode="decimal"
                [ngModel]="rate.markup_percent"
                (ngModelChange)="patch({ markup_percent: $event })"
              />
            </label>
            <label class="field" for="dc-rate-from">
              <span>{{ 'debtCollection.field.from' | translate }}</span>
              <input
                nz-input
                id="dc-rate-from"
                type="date"
                [ngModel]="rate.effective_from"
                (ngModelChange)="patch({ effective_from: $event })"
              />
            </label>
            <label class="field" for="dc-rate-to">
              <span>{{ 'debtCollection.field.to' | translate }}</span>
              <input
                nz-input
                id="dc-rate-to"
                type="date"
                [ngModel]="rate.effective_to ?? ''"
                (ngModelChange)="patch({ effective_to: $event || null })"
              />
            </label>
            <label class="field full" for="dc-rate-notes">
              <span>{{ 'debtCollection.field.notes' | translate }}</span>
              <input
                nz-input
                id="dc-rate-notes"
                maxlength="255"
                [ngModel]="rate.notes ?? ''"
                (ngModelChange)="patch({ notes: $event || null })"
              />
            </label>
          </div>
        }
      </ng-container>
    </nz-modal>
  `,
})
export class DcRatesComponent {
  protected readonly store = inject(SettingsStore);
  private readonly feedback = inject(DcFeedback);

  protected readonly canWrite = inject(PermissionsService).canWrite(DEBT_COLLECTION_MODULE);
  protected readonly jurisdictions: readonly DcJurisdiction[] = DC_JURISDICTIONS;
  protected readonly kinds = DC_INTEREST_KINDS;
  protected readonly effective = effectiveRate;

  protected readonly draft = signal<(DcInterestRatePayload & { id: string | null }) | null>(null);
  protected readonly valid = computed(() => {
    const rate = this.draft();
    return (
      rate !== null &&
      rate.effective_from !== '' &&
      rate.base_rate_percent.trim() !== '' &&
      !Number.isNaN(Number(rate.base_rate_percent)) &&
      !Number.isNaN(Number(rate.markup_percent)) &&
      (rate.effective_to === null || rate.effective_to >= rate.effective_from)
    );
  });

  protected edit(rate: DcInterestRate | null): void {
    this.draft.set(rate ? { ...rate } : { ...emptyRate(), id: null });
  }

  protected patch(change: Partial<DcInterestRatePayload>): void {
    this.draft.update((rate) => (rate ? { ...rate, ...change } : rate));
  }

  protected async save(): Promise<void> {
    const rate = this.draft();
    if (!rate) {
      return;
    }
    const payload: DcInterestRatePayload = {
      jurisdiction: rate.jurisdiction,
      kind: rate.kind,
      base_rate_percent: rate.base_rate_percent,
      markup_percent: rate.markup_percent,
      effective_from: rate.effective_from,
      effective_to: rate.effective_to,
      notes: rate.notes,
    };
    if (
      this.feedback.report(await this.store.saveRate(rate.id, payload), 'debtCollection.msg.saved')
    ) {
      this.draft.set(null);
    }
  }

  protected async remove(rate: DcInterestRate): Promise<void> {
    this.feedback.report(await this.store.deleteRate(rate.id), 'debtCollection.msg.deleted');
  }
}
