import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStepsModule } from 'ng-zorro-antd/steps';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { ApItem, TranslateService } from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { PayablesBatchSummaryComponent } from './payables-batch-summary.component';
import { PayablesBatchesStore } from './payables-batches.store';
import {
  fromIsoDate,
  isPayable,
  skontoColor,
  skontoDaysParts,
  skontoState,
  toIsoDate,
  todayIso,
} from './payables.util';

/**
 * Guided creation of a payment batch: (1) cutoff date and Skonto priority, (2) pick the items and the credit notes to
 * net, (3) review the transfers grouped by creditor IBAN and the totals. The API recomputes set-off and grouping on
 * every change, so what is shown is exactly what the draft will contain.
 */
@Component({
  selector: 'app-payables-batch-wizard',
  styleUrl: './payables.scss',
  providers: [PayablesBatchesStore],
  imports: [
    FormsModule,
    MoneyPipe,
    PageHeaderComponent,
    PayablesBatchSummaryComponent,
    RouterLink,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzCheckboxModule,
    NzDatePickerModule,
    NzEmptyModule,
    NzInputModule,
    NzSpinModule,
    NzStepsModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <app-page-header
      [title]="'AP.WIZARD_TITLE' | translate"
      [subtitle]="'AP.WIZARD_SUBTITLE' | translate"
    >
      <a nz-button routerLink="/payables/batches">{{ 'AP.CANCEL' | translate }}</a>
    </app-page-header>

    <nz-steps class="wizard-steps" [nzCurrent]="step()" nzSize="small">
      <nz-step [nzTitle]="'AP.STEP_CUTOFF' | translate"></nz-step>
      <nz-step [nzTitle]="'AP.STEP_SELECT' | translate"></nz-step>
      <nz-step [nzTitle]="'AP.STEP_REVIEW' | translate"></nz-step>
    </nz-steps>

    @if (store.error(); as error) {
      <nz-alert class="card" nzType="error" nzShowIcon [nzMessage]="error | translate"></nz-alert>
    }
    @if (submitError(); as error) {
      <nz-alert class="card" nzType="error" nzShowIcon [nzMessage]="error"></nz-alert>
    }

    @switch (step()) {
      @case (0) {
        <div class="filters">
          <div class="field">
            <label for="wz-cutoff">{{ 'AP.CUTOFF_DATE' | translate }}</label>
            <nz-date-picker
              nzId="wz-cutoff"
              style="width: 100%"
              [ngModel]="cutoffDate()"
              (ngModelChange)="onCutoff($event)"
            ></nz-date-picker>
          </div>
          <div class="field">
            <label for="wz-currency">{{ 'AP.CURRENCY' | translate }}</label>
            <input
              nz-input
              id="wz-currency"
              maxlength="3"
              [ngModel]="currency()"
              (ngModelChange)="currency.set(($event ?? '').toUpperCase())"
            />
          </div>
          <div class="field">
            <label for="payables-batch-wizard-field" nzId="payables-batch-wizard-field"
              nz-checkbox
              [ngModel]="prioritizeSkonto()"
              (ngModelChange)="prioritizeSkonto.set($event)"
            >
              {{ 'AP.PRIORITIZE_SKONTO' | translate }}
            </label>
            <div class="muted small">{{ 'AP.PRIORITIZE_SKONTO_HINT' | translate }}</div>
          </div>
        </div>
        <button
          nz-button
          nzType="primary"
          type="button"
          [disabled]="!cutoffDate()"
          [nzLoading]="store.previewing()"
          (click)="propose()"
        >
          {{ 'AP.PROPOSE' | translate }}
        </button>
      }
      @case (1) {
        <nz-spin [nzSpinning]="store.previewing()">
          @if (candidates().length === 0) {
            <nz-empty [nzNotFoundContent]="'AP.NO_CANDIDATES' | translate"></nz-empty>
          } @else {
            <h4 class="section-title">{{ 'AP.CANDIDATES' | translate }}</h4>
            <nz-table
              nzSize="small"
              [nzData]="candidates()"
              [nzShowPagination]="false"
              [nzFrontPagination]="false"
            >
              <thead>
                <tr>
                  <th></th>
                  <th>{{ 'AP.SUPPLIER' | translate }}</th>
                  <th>{{ 'AP.DOCUMENT' | translate }}</th>
                  <th>{{ 'AP.DUE_DATE' | translate }}</th>
                  <th class="num">{{ 'AP.OPEN_AMOUNT' | translate }}</th>
                  <th>{{ 'AP.SKONTO' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (row of candidates(); track row.id) {
                  <tr>
                    <td>
                      <input
                        type="checkbox"
                        [checked]="store.selectedItemIds().includes(row.id)"
                        [disabled]="store.previewing()"
                        [attr.aria-label]="'AP.SELECT_ITEM' | translate"
                        (change)="store.toggleItem(row.id, isChecked($event))"
                      />
                    </td>
                    <td>{{ row.supplier_name }}</td>
                    <td>{{ row.document_number }}</td>
                    <td>{{ row.due_date }}</td>
                    <td class="num">{{ row.open_amount | money: row.currency }}</td>
                    <td>
                      @if (row.skonto; as skonto) {
                        <nz-tag [nzColor]="skontoTagColor(skontoOf(row))">
                          {{ skonto.percent }}% ·
                          {{ daysParts(skonto).key | translate: daysParts(skonto).params }}
                        </nz-tag>
                      } @else {
                        <span class="muted">—</span>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </nz-table>
          }

          @if ((store.preview()?.excluded ?? []).length > 0) {
            <nz-alert
              class="card"
              nzType="warning"
              nzShowIcon
              [nzMessage]="
                'AP.EXCLUDED_NOTICE' | translate: { count: store.preview()?.excluded?.length ?? 0 }
              "
              [nzDescription]="'AP.EXCLUDED_HINT' | translate"
            ></nz-alert>
          }

          @if (creditNotes().length > 0) {
            <h4 class="section-title">{{ 'AP.CREDIT_NOTES_SET_OFF' | translate }}</h4>
            <nz-table
              nzSize="small"
              [nzData]="creditNotes()"
              [nzShowPagination]="false"
              [nzFrontPagination]="false"
            >
              <thead>
                <tr>
                  <th></th>
                  <th>{{ 'AP.SUPPLIER' | translate }}</th>
                  <th>{{ 'AP.CREDIT_NOTE' | translate }}</th>
                  <th class="num">{{ 'AP.OPEN_AMOUNT' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (row of creditNotes(); track row.id) {
                  <tr>
                    <td>
                      <input
                        type="checkbox"
                        [checked]="store.selectedSetOffIds().includes(row.id)"
                        [disabled]="store.previewing()"
                        [attr.aria-label]="'AP.SELECT_CREDIT_NOTE' | translate"
                        (change)="store.toggleSetOff(row.id, isChecked($event))"
                      />
                    </td>
                    <td>{{ row.supplier_name }}</td>
                    <td>{{ row.document_number }}</td>
                    <td class="num negative">{{ row.open_amount | money: row.currency }}</td>
                  </tr>
                }
              </tbody>
            </nz-table>
          }

          <div class="toolbar">
            <button nz-button type="button" (click)="step.set(0)">
              {{ 'AP.BACK' | translate }}
            </button>
            <button
              nz-button
              nzType="primary"
              type="button"
              [disabled]="store.selectedItemIds().length === 0 || store.previewing()"
              (click)="step.set(2)"
            >
              {{ 'AP.NEXT' | translate }} ({{ store.selectedItemIds().length }})
            </button>
          </div>
        </nz-spin>
      }
      @case (2) {
        @if (store.proposed(); as batch) {
          <app-payables-batch-summary [batch]="batch"></app-payables-batch-summary>
        }
        <div class="toolbar">
          <button nz-button type="button" (click)="step.set(1)">{{ 'AP.BACK' | translate }}</button>
          <button
            nz-button
            nzType="primary"
            type="button"
            [disabled]="!store.canCreate()"
            [nzLoading]="store.saving()"
            (click)="create()"
          >
            {{ 'AP.CREATE_BATCH' | translate }}
          </button>
        </div>
      }
    }
  `,
})
export class PayablesBatchWizardComponent implements OnInit {
  readonly store = inject(PayablesBatchesStore);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly step = signal(0);
  readonly cutoffDate = signal<Date | null>(fromIsoDate(todayIso()));
  readonly prioritizeSkonto = signal(true);
  readonly currency = signal('');
  readonly submitError = signal<string | null>(null);

  /** Only the items that can be paid are offered; credit notes have their own list. */
  readonly candidates = computed<ApItem[]>(() =>
    (this.store.preview()?.candidates ?? []).filter((row) => isPayable(row)),
  );
  readonly creditNotes = computed<ApItem[]>(() => this.store.preview()?.credit_notes ?? []);

  readonly daysParts = skontoDaysParts;
  readonly skontoTagColor = skontoColor;

  ngOnInit(): void {
    this.store.resetWizard();
  }

  skontoOf(row: ApItem) {
    return skontoState(row.skonto);
  }

  onCutoff(date: Date | null): void {
    this.cutoffDate.set(date);
  }

  isChecked(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }

  async propose(): Promise<void> {
    const cutoff = toIsoDate(this.cutoffDate());
    if (!cutoff) {
      return;
    }
    this.submitError.set(null);
    await this.store.propose({
      cutoff_date: cutoff,
      prioritize_skonto: this.prioritizeSkonto(),
      ...(this.currency().length === 3 ? { currency: this.currency() } : {}),
    });
    if (this.store.preview()) {
      this.step.set(1);
    }
  }

  async create(): Promise<void> {
    const result = await this.store.create();
    if (result.ok && result.batch) {
      this.message.success(this.translate.instant('AP.BATCH_CREATED'));
      await this.router.navigate(['/payables/batches', result.batch.id]);
    } else {
      this.submitError.set(result.message ?? this.translate.instant('AP.SAVE_ERROR'));
    }
  }
}
